// Pure parsing helpers shared by the seed script (and unit-testable in isolation).
// No DB or filesystem access here.

/** A single exercise parsed from a "•" bullet line in the Planned Workout cell. */
export type ParsedExercise = {
  position: number;
  name: string;
  target: string | null;
  raw: string;
};

/**
 * Convert the spreadsheet's "DD-MM-YYYY" date string into a canonical
 * "YYYY-MM-DD" string. Returns null if the input doesn't look like a date.
 */
export function normalizeDate(input: string): string | null {
  const trimmed = (input ?? "").trim();
  const m = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/**
 * Parse the multi-line "Planned Workout" cell into individual exercises.
 *
 * The cell typically looks like:
 *   Lower Body (Knee-Friendly Quad & Stability)
 *
 *   • Squat (Heels slightly elevated): 3 sets x 12 reps
 *   • Bulgarian Split Squats: 3 sets x 8 reps/leg
 *
 * Only bullet lines (•, -, *) become exercises. Rest days have no bullets
 * (just prose), so they return an empty array.
 */
export function parseBullets(plannedWorkout: string): ParsedExercise[] {
  const lines = (plannedWorkout ?? "").split(/\r?\n/);
  const exercises: ParsedExercise[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Only treat lines that start with a bullet glyph as exercises.
    const bulletMatch = trimmed.match(/^([•\-*])\s*(.+)$/);
    if (!bulletMatch) continue;

    const body = bulletMatch[2].trim();
    if (!body) continue;

    // Split on the first colon → name / target.
    const colonIdx = body.indexOf(":");
    const name = colonIdx >= 0 ? body.slice(0, colonIdx).trim() : body;
    const target = colonIdx >= 0 ? body.slice(colonIdx + 1).trim() || null : null;

    exercises.push({
      position: exercises.length,
      name,
      target,
      raw: trimmed,
    });
  }

  return exercises;
}

/**
 * Derive a focus label from the Planned Workout cell when the Focus column is
 * blank: the first non-empty, non-bullet line.
 */
export function focusFromPlanned(plannedWorkout: string): string | null {
  const lines = (plannedWorkout ?? "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[•\-*]/.test(trimmed)) break; // reached the bullets without a heading
    return trimmed;
  }
  return null;
}
