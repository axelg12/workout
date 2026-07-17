// Static, theme-aware SVG line chart rendered on the server — no client JS.
// Point tooltips use native SVG <title>. Colors: emerald-600 line + amber-600
// PR markers (validated for contrast and CVD separation on light and dark
// surfaces); all text uses text tokens, never the series color.

import { formatDay } from "@/lib/dates";

export type ChartPoint = { x: string; y: number }; // x = "YYYY-MM-DD"

const LINE = "#059669"; // emerald-600
const PR = "#d97706"; // amber-600

const W = 360;
const PAD = { top: 10, right: 48, bottom: 18, left: 34 };

function dateMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Round ticks on a clean step (1/2/2.5/5 × 10^n) inside [min, max]. */
function niceTicks(min: number, max: number, count = 3): number[] {
  if (max <= min) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 1 });

/**
 * One line chart. With only `points`, they draw as the accent line with dots.
 * With `avgPoints` (a smoothed version of the same quantity), the average
 * becomes the accent line and the raw points recede to context dots.
 */
export function LineChart({
  points,
  avgPoints,
  prDates,
  unit = "",
  height = 150,
}: {
  points: ChartPoint[];
  avgPoints?: ChartPoint[];
  prDates?: string[];
  unit?: string;
  height?: number;
}) {
  if (points.length === 0) return null;

  const H = height;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const all = [...points, ...(avgPoints ?? [])];
  const xs = all.map((p) => dateMs(p.x));
  const ys = all.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const yPad = yMax === yMin ? Math.max(1, yMax * 0.05) : (yMax - yMin) * 0.12;
  yMin -= yPad;
  yMax += yPad;

  const sx = (iso: string) =>
    xMax === xMin
      ? PAD.left + plotW / 2
      : PAD.left + ((dateMs(iso) - xMin) / (xMax - xMin)) * plotW;
  const sy = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const path = (pts: ChartPoint[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");

  const prSet = new Set(prDates ?? []);
  const accent = avgPoints ?? points;
  const last = accent[accent.length - 1];
  const ticks = niceTicks(yMin, yMax);
  const firstX = points[0].x;
  const lastX = points[points.length - 1].x;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Trend from ${formatDay(firstX)} to ${formatDay(lastX)}, latest ${fmt(last.y)}${unit}`}
    >
      {/* recessive hairline grid + y ticks */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={sy(t)}
            y2={sy(t)}
            className="stroke-zinc-200 dark:stroke-zinc-800"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={sy(t) + 3}
            textAnchor="end"
            className="fill-zinc-400 text-[9px]"
          >
            {fmt(t)}
          </text>
        </g>
      ))}

      {/* raw daily points as context when a smoothed accent line is present */}
      {avgPoints &&
        points.map((p) => (
          <circle
            key={p.x}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={2}
            className="fill-zinc-400 dark:fill-zinc-500"
          />
        ))}

      {/* accent line */}
      <path
        d={path(accent)}
        fill="none"
        stroke={LINE}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* dots on the accent series (skipped for dense smoothed lines) */}
      {!avgPoints &&
        points.map((p) => {
          const isPr = prSet.has(p.x);
          return (
            <circle
              key={p.x}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={isPr ? 4.5 : 4}
              fill={isPr ? PR : LINE}
              strokeWidth={2}
              className="stroke-white dark:stroke-zinc-900"
            />
          );
        })}

      {/* end marker + last-value direct label (text token, not series color) */}
      <circle
        cx={sx(last.x)}
        cy={sy(last.y)}
        r={4}
        fill={avgPoints ? LINE : prSet.has(last.x) ? PR : LINE}
        strokeWidth={2}
        className="stroke-white dark:stroke-zinc-900"
      />
      <text
        x={sx(last.x) + 8}
        y={sy(last.y) + 3.5}
        className="fill-zinc-600 text-[10px] font-semibold dark:fill-zinc-300"
      >
        {fmt(last.y)}
        {unit}
      </text>

      {/* x-axis: first and last date only (mobile width) */}
      <text
        x={PAD.left}
        y={H - 4}
        className="fill-zinc-400 text-[9px]"
      >
        {formatDay(firstX)}
      </text>
      <text
        x={W - PAD.right}
        y={H - 4}
        textAnchor="end"
        className="fill-zinc-400 text-[9px]"
      >
        {formatDay(lastX)}
      </text>

      {/* native tooltips: generous invisible hit targets over each point */}
      {points.map((p) => (
        <circle key={`hit-${p.x}`} cx={sx(p.x)} cy={sy(p.y)} r={11} fill="transparent">
          <title>
            {`${formatDay(p.x)} · ${fmt(p.y)}${unit}${prSet.has(p.x) ? " · PR" : ""}`}
          </title>
        </circle>
      ))}
    </svg>
  );
}
