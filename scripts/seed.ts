import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import path from "node:path";
import ExcelJS from "exceljs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, gte } from "drizzle-orm";
import { planDays, planExercises } from "../lib/schema";
import { normalizeDate, parseBullets, focusFromPlanned } from "../lib/parse";

const XLSX_PATH = path.resolve(
  process.cwd(),
  "example/Axel Gym - 6 Month plan.xlsx",
);

const HEADERS = {
  date: "Date",
  day: "Day",
  week: "Week",
  workoutType: "Workout Type",
  focus: "Focus",
  planned: "Planned Workout",
  notes: "Target / Notes",
} as const;

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  const db = drizzle(neon(url), { schema: { planDays, planExercises } });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  let position = 0;
  let dayCount = 0;
  let exerciseCount = 0;

  for (const ws of wb.worksheets) {
    const monthLabel = ws.name;

    // Locate the header row by matching cell text, and map column letters by header name.
    const colByHeader: Record<string, number> = {};
    let headerRowNumber = -1;
    ws.eachRow((row, rowNumber) => {
      if (headerRowNumber !== -1) return;
      const texts: Record<number, string> = {};
      row.eachCell((cell, colNumber) => {
        texts[colNumber] = String(cell.text ?? "").trim();
      });
      const values = Object.values(texts);
      if (values.includes(HEADERS.date) && values.includes(HEADERS.planned)) {
        headerRowNumber = rowNumber;
        for (const [colNumber, text] of Object.entries(texts)) {
          colByHeader[text] = Number(colNumber);
        }
      }
    });

    if (headerRowNumber === -1) {
      console.warn(`! ${monthLabel}: no header row found, skipping`);
      continue;
    }

    const cellText = (row: ExcelJS.Row, header: string): string | null => {
      const col = colByHeader[header];
      if (!col) return null;
      return clean(String(row.getCell(col).text ?? ""));
    };

    let weekLabel: string | null = null;

    for (let rowNumber = headerRowNumber + 1; rowNumber <= ws.rowCount; rowNumber++) {
      const row = ws.getRow(rowNumber);
      const rawDate = cellText(row, HEADERS.date);
      const date = rawDate ? normalizeDate(rawDate) : null;
      if (!date) continue; // skip blank/non-date rows

      // Forward-fill the sparse Week column.
      const wk = cellText(row, HEADERS.week);
      if (wk) weekLabel = wk;

      const planned = cellText(row, HEADERS.planned);
      const focus =
        cellText(row, HEADERS.focus) ??
        (planned ? focusFromPlanned(planned) : null);

      // Upsert the plan day (keyed by date) and get its id back.
      const [dayRow] = await db
        .insert(planDays)
        .values({
          date,
          dayOfWeek: cellText(row, HEADERS.day),
          weekLabel,
          monthLabel,
          workoutType: cellText(row, HEADERS.workoutType),
          focus,
          plannedRaw: planned,
          targetNotes: cellText(row, HEADERS.notes),
          position: position++,
        })
        .onConflictDoUpdate({
          target: planDays.date,
          set: {
            dayOfWeek: cellText(row, HEADERS.day),
            weekLabel,
            monthLabel,
            workoutType: cellText(row, HEADERS.workoutType),
            focus,
            plannedRaw: planned,
            targetNotes: cellText(row, HEADERS.notes),
          },
        })
        .returning({ id: planDays.id });

      const planDayId = dayRow.id;

      // Upsert each parsed exercise (keyed by day + position) so ids stay stable.
      const parsed = planned ? parseBullets(planned) : [];
      for (const ex of parsed) {
        await db
          .insert(planExercises)
          .values({
            planDayId,
            position: ex.position,
            name: ex.name,
            target: ex.target,
            raw: ex.raw,
          })
          .onConflictDoUpdate({
            target: [planExercises.planDayId, planExercises.position],
            set: { name: ex.name, target: ex.target, raw: ex.raw },
          });
        exerciseCount++;
      }

      // Remove stale exercises if the plan shrank (logs survive via ON DELETE SET NULL).
      await db
        .delete(planExercises)
        .where(
          and(
            eq(planExercises.planDayId, planDayId),
            gte(planExercises.position, parsed.length),
          ),
        );

      dayCount++;
    }
    console.log(`✓ ${monthLabel}: imported`);
  }

  console.log(`\nDone. ${dayCount} days, ${exerciseCount} exercises imported.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
