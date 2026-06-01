import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import path from "node:path";
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { asc, eq } from "drizzle-orm";
import { planDays, planExercises, exerciseLogs, dayLogs } from "../lib/schema";
import { normalizeDate } from "../lib/parse";

// One-time backfill of workouts that were already completed in the spreadsheet
// (Actual Performance / Feel / Comments). Insert-only: it never overwrites a log
// that already exists, so it's safe to re-run and won't clobber in-app edits.
//
// The sheet logs per day; the app logs per exercise. We map the Actual Performance
// cell's lines to exercises by position, but ONLY when the line count matches the
// exercise count (high confidence). Otherwise we keep the whole blob in the day
// comment so nothing is lost.

const XLSX_PATH = path.resolve(process.cwd(), "example/Axel Gym - 6 Month plan.xlsx");
const H = {
  date: "Date",
  planned: "Planned Workout",
  actual: "Actual Performance",
  feel: "Feel (1–10)",
  comments: "Comments",
} as const;

const clean = (v: unknown): string => String(v ?? "").trim();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  const db = drizzle(neon(url), {
    schema: { planDays, planExercises, exerciseLogs, dayLogs },
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  let exInserted = 0, exSkipped = 0, dayInserted = 0, daySkipped = 0;
  const mismatches: string[] = [];

  for (const ws of wb.worksheets) {
    const col: Record<string, number> = {};
    let hr = -1;
    ws.eachRow((row, n) => {
      if (hr !== -1) return;
      const t: Record<number, string> = {};
      row.eachCell((c, cn) => (t[cn] = clean(c.text)));
      const vals = Object.values(t);
      if (vals.includes(H.date) && vals.includes(H.planned)) {
        hr = n;
        for (const [cn, txt] of Object.entries(t)) col[txt] = Number(cn);
      }
    });
    if (hr === -1) continue;

    const cell = (row: ExcelJS.Row, h: string) =>
      col[h] ? clean(row.getCell(col[h]).text) : "";

    for (let n = hr + 1; n <= ws.rowCount; n++) {
      const row = ws.getRow(n);
      const date = normalizeDate(cell(row, H.date));
      if (!date) continue;

      const actual = cell(row, H.actual);
      const feelRaw = cell(row, H.feel);
      const comment = cell(row, H.comments);
      if (!actual && !feelRaw && !comment) continue; // not a completed day

      // Load this day's exercises (ordered by position) to map actual lines onto.
      const exs = await db
        .select({ id: planExercises.id, name: planExercises.name, position: planExercises.position })
        .from(planExercises)
        .innerJoin(planDays, eq(planExercises.planDayId, planDays.id))
        .where(eq(planDays.date, date))
        .orderBy(asc(planExercises.position));

      const lines = actual.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      let dayCommentExtra = "";

      if (actual && exs.length > 0 && lines.length === exs.length) {
        // Clean 1:1 mapping → one log per exercise.
        for (let i = 0; i < exs.length; i++) {
          const res = await db
            .insert(exerciseLogs)
            .values({
              planExerciseId: exs[i].id,
              date,
              exerciseName: exs[i].name,
              actual: lines[i],
              done: true,
            })
            .onConflictDoNothing({ target: exerciseLogs.planExerciseId })
            .returning({ id: exerciseLogs.id });
          if (res.length) exInserted++;
          else exSkipped++;
        }
      } else if (actual) {
        // Can't safely map per-exercise → keep the full blob on the day log.
        mismatches.push(`${date} (lines=${lines.length}, exercises=${exs.length})`);
        dayCommentExtra = `\n\n[Actual Performance]\n${actual}`;
      }

      // Day-level: Feel + Comments (+ any unmapped actual blob).
      const feelNum = feelRaw ? Math.round(parseFloat(feelRaw.replace(",", "."))) : null;
      const feel = feelNum && feelNum >= 1 && feelNum <= 10 ? feelNum : null;
      const dayComment = (comment + dayCommentExtra).trim() || null;
      if (feel != null || dayComment) {
        const res = await db
          .insert(dayLogs)
          .values({ date, feel, comment: dayComment })
          .onConflictDoNothing({ target: dayLogs.date })
          .returning({ id: dayLogs.id });
        if (res.length) dayInserted++;
        else daySkipped++;
      }
    }
  }

  console.log(`\nBackfill complete.`);
  console.log(`  exercise_logs: ${exInserted} inserted, ${exSkipped} skipped (already existed)`);
  console.log(`  day_logs:      ${dayInserted} inserted, ${daySkipped} skipped (already existed)`);
  if (mismatches.length) {
    console.log(`  ⚠ Unmapped actuals kept in day comment for: ${mismatches.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
