import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { asc, isNotNull } from "drizzle-orm";
import { exerciseLogs } from "../lib/schema";
import { analyzeHistory, canonicalName, parseActual } from "../lib/analysis";

// Read-only check of the free-text set parser against every real logged
// entry. Prints parsed sets / warmups / rejected fragments per session so
// mis-parses are easy to spot, plus the raw → canonical name mapping.

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env.local)");
  const db = drizzle(neon(url), { schema: { exerciseLogs } });

  const rows = await db
    .select({
      date: exerciseLogs.date,
      exerciseName: exerciseLogs.exerciseName,
      actual: exerciseLogs.actual,
    })
    .from(exerciseLogs)
    .where(isNotNull(exerciseLogs.actual))
    .orderBy(asc(exerciseLogs.date));

  // Raw → canonical mapping table.
  const nameMap = new Map<string, string>();
  for (const r of rows) nameMap.set(r.exerciseName, canonicalName(r.exerciseName));

  const byCanonical = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = canonicalName(r.exerciseName);
    const list = byCanonical.get(key) ?? [];
    list.push(r);
    byCanonical.set(key, list);
  }

  const totalRows = rows.length;
  let strengthRows = 0;
  let otherRows = 0;
  let rowsWithRejects = 0;

  for (const r of rows) {
    const kind = parseActual(r.actual ?? "").kind;
    if (kind === "strength") strengthRows++;
    else otherRows++;
  }

  console.log("=== Name mapping (raw → canonical) ===");
  for (const [raw, canon] of [...nameMap.entries()].sort()) {
    console.log(raw === canon ? `  ${raw}` : `  ${raw}  →  ${canon}`);
  }

  for (const [canon, list] of [...byCanonical.entries()].sort()) {
    const sessions = analyzeHistory(list);
    const hasData = sessions.some((s) => s.topWeightKg !== null);
    console.log(`\n=== ${canon} (${sessions.length} sessions${hasData ? "" : ", no strength data"}) ===`);

    for (const s of sessions) {
      const raw = list
        .filter((r) => r.date === s.date)
        .map((r) => (r.actual ?? "").replace(/\r?\n/g, " ⏎ "))
        .join(" ⏎ ");
      console.log(`  ${s.date}  raw: ${raw}`);
      const setsStr = s.sets
        .map((x) => `${x.reps}×${x.weightKg}${x.isWarmup ? "w" : ""}`)
        .join("  ");
      const top = s.topWeightKg !== null ? `top ${s.topWeightKg}` : "top –";
      console.log(
        `             sets: ${setsStr || "(none)"}   ${top}  vol ${Math.round(s.volumeKg)}${s.isPr ? "  ★PR" : ""}`,
      );
      if (s.rejected.length > 0) {
        rowsWithRejects++;
        console.log(`             REJECTED: ${s.rejected.join(" | ")}`);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  rows: ${totalRows}  strength: ${strengthRows}  other/empty: ${otherRows}`);
  console.log(`  sessions with rejected fragments: ${rowsWithRejects}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
