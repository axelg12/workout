import { redirect } from "next/navigation";
import { getPlanDates } from "@/lib/queries";
import { todayISO, nearestDate } from "@/lib/dates";

export default async function Home() {
  const dates = await getPlanDates();
  const target = nearestDate(dates, todayISO()) ?? todayISO();
  redirect(`/day/${target}`);
}
