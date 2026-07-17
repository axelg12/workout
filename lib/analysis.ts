// Pure analysis of logged free-text performance (exercise_logs.actual).
// No DB or filesystem access here — importable from scripts and server code alike.
//
// The logged text is mostly one set per line as "reps x weight" ("10x70"),
// but real entries include decimal commas ("28,5"), warmup lines, early
// comma-separated entries in reversed "weight x reps" order ("50x11"),
// inline notes in Icelandic/English, and non-strength content (runs, planks).
// Everything that can't be parsed is surfaced in `rejected`, never dropped
// silently.

export type ParsedSet = {
  reps: number;
  weightKg: number;
  isWarmup: boolean;
  raw: string;
};

export type ParsedActual = {
  kind: "strength" | "other" | "empty"; // "other" = runs/planks/time-based
  sets: ParsedSet[]; // warmups included but flagged
  rejected: string[];
};

export type SessionStats = {
  date: string; // YYYY-MM-DD
  topWeightKg: number | null; // max working-set weight (warmups excluded)
  volumeKg: number; // Σ reps × weight over working sets
  isPr: boolean; // strictly exceeds all prior sessions' topWeightKg
  sets: ParsedSet[];
  rejected: string[];
};

export type ExerciseInsight = {
  trend: "up" | "down" | "same" | null; // vs previous session's topWeightKg
  isPr: boolean;
  prevTopWeightKg: number | null;
};

// ── Canonical exercise names ────────────────────────────────────────────────

// The plan spreadsheet names the same movement several ways across months.
// Keys are normalized (lowercased, collapsed whitespace).
const ALIASES: Record<string, string> = {
  "squat (heels slightly elevated)": "Squats",
  "squats (heels slightly elevated)": "Squats",
  squat: "Squats",
  "barbell or t-bar rows": "T-Bar Rows",
  "leg extensions (slow eccentric)": "Leg Extensions",
  "leg extensions (slow 3s eccentric descent)": "Leg Extensions",
  "leg press (feet high & wide)": "Leg Press",
  "bicep curls superset with face pulls": "Bicep Curls",
};

export function canonicalName(raw: string): string {
  const cleaned = (raw ?? "").trim().replace(/\s+/g, " ");
  return ALIASES[cleaned.toLowerCase()] ?? cleaned;
}

// ── Fragment-level parsing ──────────────────────────────────────────────────

const SET_RE = /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/g;
const setRe = () => new RegExp(SET_RE.source, "g");
const HAS_SET_RE = new RegExp(SET_RE.source);
const WARMUP_RE = /warm\s*p?\s*up/i; // "warm up", "warmup", "warmpup"
// Paces ("@ 3:58", "5km@5:26") and durations ("65sec", "2 min") mean the
// fragment is endurance/time work, not weight sets.
const TIME_RE = /@|\d\s*:\s*\d|\d\s*(?:sec|sek|min)\b|\dkm\b|\bkm\b/i;

type RawPair = {
  a: number; // first number as written
  b: number; // second number as written
  isWarmup: boolean;
  raw: string;
};

type FragmentParse = {
  pairs: RawPair[];
  rejected: string[];
  sawTimeWork: boolean;
  sawText: boolean;
};

// Split a line on ",<space>" (how early entries separate sets), but never
// inside parentheses — "warmpup (12x20, 10x40)" must stay one fragment so
// both sets keep their warmup flag.
function splitSets(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0 && /\s/.test(line[i + 1] ?? "")) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function parseFragments(actual: string): FragmentParse {
  const pairs: RawPair[] = [];
  const rejected: string[] = [];
  let sawTimeWork = false;
  let sawText = false;

  for (const line of (actual ?? "").split(/\r?\n/)) {
    // Splitting only on ",<space>" keeps decimal commas ("57,5") intact.
    for (const piece of splitSets(line)) {
      const original = piece.trim();
      if (!original) continue;
      sawText = true;

      let frag = original
        // A comma directly between two complete "NxN" tokens separates sets
        // ("10x20,10x50"); only then is it not a decimal comma.
        .replace(/(\d\s*[x×*]\s*\d+(?:[.,]\d+)?),(?=\d+\s*[x×*]\s*\d)/g, "$1 ")
        .replace(/(\d),(\d)/g, "$1.$2") // decimal comma → dot
        .replace(/[“”"']/g, "") // typo/quote chars ("122”x5")
        .replace(/(\d)\s*kg\b/gi, "$1"); // "80kg" → "80"

      const isWarmup = WARMUP_RE.test(frag);

      // Parenthesized notes without a set pattern are commentary
      // ("(per hönd í tæki)", "(watch out for knee pain)") — drop them.
      // Parens that DO contain sets ("warmpup (12x20, 10x40)") are kept.
      frag = frag.replace(/\(([^)]*)\)/g, (_m, inner: string) =>
        HAS_SET_RE.test(inner) ? ` ${inner} ` : " ",
      );

      if (TIME_RE.test(frag)) {
        sawTimeWork = true;
        continue;
      }

      const matches = [...frag.matchAll(setRe())];
      if (matches.length === 0) {
        if (isWarmup) continue; // bare "warm up" line — expected, not an error
        if (/\d/.test(frag)) rejected.push(original);
        continue; // pure prose is ignored
      }

      for (const m of matches) {
        pairs.push({
          a: Number(m[1]),
          b: Number(m[2]),
          isWarmup,
          raw: original,
        });
      }
    }
  }

  return { pairs, rejected, sawTimeWork, sawText };
}

// Orientation of an "A x B" pair. Reps are integers and almost always ≤ 20;
// a decimal on either side marks the weight ("57,5x9").
type Orientation = "reps-weight" | "weight-reps" | "ambiguous";

const MAX_REPS = 20;

function orient(p: RawPair): Orientation {
  if (!Number.isInteger(p.a)) return "weight-reps";
  if (!Number.isInteger(p.b)) return "reps-weight";
  if (p.a <= MAX_REPS && p.b > MAX_REPS) return "reps-weight";
  if (p.a > MAX_REPS && p.b <= MAX_REPS) return "weight-reps";
  return "ambiguous";
}

function toSet(p: RawPair, o: Exclude<Orientation, "ambiguous">): ParsedSet {
  return o === "reps-weight"
    ? { reps: p.a, weightKg: p.b, isWarmup: p.isWarmup, raw: p.raw }
    : { reps: p.b, weightKg: p.a, isWarmup: p.isWarmup, raw: p.raw };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Parse a single logged entry without history context. Ambiguous pairs
 * (both numbers ≤ 20) default to reps×weight; `analyzeHistory` resolves
 * them better using the exercise's typical weights.
 */
export function parseActual(actual: string): ParsedActual {
  const text = (actual ?? "").trim();
  if (!text) return { kind: "empty", sets: [], rejected: [] };

  const { pairs, rejected, sawText } = parseFragments(text);
  const sets = pairs.map((p) => {
    const o = orient(p);
    return toSet(p, o === "ambiguous" ? "reps-weight" : o);
  });

  const kind = sets.length > 0 ? "strength" : sawText ? "other" : "empty";
  return { kind, sets, rejected };
}

/**
 * Parse an exercise's full history (entries for ONE canonical exercise,
 * any date order) into per-session stats, using the whole history to
 * resolve ambiguous set orientation and to reject outliers, then flag PRs.
 */
export function analyzeHistory(
  entries: { date: string; actual: string | null }[],
): SessionStats[] {
  type Session = { date: string; parse: FragmentParse };
  const byDate = new Map<string, Session>();
  for (const e of entries) {
    if (!e.actual?.trim()) continue;
    const parse = parseFragments(e.actual);
    const existing = byDate.get(e.date);
    if (existing) {
      existing.parse.pairs.push(...parse.pairs);
      existing.parse.rejected.push(...parse.rejected);
    } else {
      byDate.set(e.date, { date: e.date, parse });
    }
  }
  const sessions = [...byDate.values()].sort((x, y) =>
    x.date < y.date ? -1 : 1,
  );

  // Pass 1: median working weight from unambiguous sets (fall back to the
  // default orientation when the exercise has no unambiguous set at all).
  const unambiguous: number[] = [];
  const fallback: number[] = [];
  for (const s of sessions) {
    for (const p of s.parse.pairs) {
      if (p.isWarmup) continue;
      const o = orient(p);
      if (o !== "ambiguous") unambiguous.push(toSet(p, o).weightKg);
      else fallback.push(p.b);
    }
  }
  const med = median(unambiguous.length > 0 ? unambiguous : fallback);

  // Pass 2: resolve ambiguous pairs (whichever weight reading is closer to
  // the median wins; ties keep reps×weight) and reject outliers.
  const stats: SessionStats[] = [];
  let bestSoFar: number | null = null;

  for (const s of sessions) {
    const sets: ParsedSet[] = [];
    const rejected = [...s.parse.rejected];

    for (const p of s.parse.pairs) {
      let o = orient(p);
      if (o === "ambiguous") {
        o =
          med !== null && Math.abs(p.a - med) < Math.abs(p.b - med)
            ? "weight-reps"
            : "reps-weight";
      }
      const set = toSet(p, o);
      const outlier =
        set.reps > 50 || (med !== null && set.weightKg > 3 * med);
      if (outlier) rejected.push(set.raw);
      else sets.push(set);
    }

    const working = sets.filter((x) => !x.isWarmup);
    const topWeightKg =
      working.length > 0 ? Math.max(...working.map((x) => x.weightKg)) : null;
    const volumeKg = working.reduce((sum, x) => sum + x.reps * x.weightKg, 0);
    // First session with data sets the baseline; only improvements on a
    // known baseline count as PRs.
    const isPr =
      topWeightKg !== null && bestSoFar !== null && topWeightKg > bestSoFar;
    if (topWeightKg !== null) {
      bestSoFar = bestSoFar === null ? topWeightKg : Math.max(bestSoFar, topWeightKg);
    }

    stats.push({ date: s.date, topWeightKg, volumeKg, isPr, sets, rejected });
  }

  return stats;
}

/** Insight for one day's logged entry, derived from `analyzeHistory` output. */
export function insightFor(
  sessions: SessionStats[],
  date: string,
): ExerciseInsight | null {
  const current = sessions.find((s) => s.date === date);
  if (!current || current.topWeightKg === null) return null;

  const prev = [...sessions]
    .reverse()
    .find((s) => s.date < date && s.topWeightKg !== null);
  const prevTop = prev?.topWeightKg ?? null;

  const trend =
    prevTop === null
      ? null
      : current.topWeightKg > prevTop
        ? "up"
        : current.topWeightKg < prevTop
          ? "down"
          : "same";

  return { trend, isPr: current.isPr, prevTopWeightKg: prevTop };
}

// ── Body-weight helpers ─────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function dateMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Trailing rolling average (window includes the point's own day). */
export function rollingAverage(
  points: { date: string; value: number }[],
  windowDays = 7,
): { date: string; value: number }[] {
  const sorted = [...points].sort((x, y) => (x.date < y.date ? -1 : 1));
  return sorted.map((p, i) => {
    const from = dateMs(p.date) - (windowDays - 1) * DAY_MS;
    const inWindow = [];
    for (let j = i; j >= 0 && dateMs(sorted[j].date) >= from; j--) {
      inWindow.push(sorted[j].value);
    }
    return {
      date: p.date,
      value: inWindow.reduce((a, b) => a + b, 0) / inWindow.length,
    };
  });
}
