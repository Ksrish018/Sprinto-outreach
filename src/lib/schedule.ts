// The weekly run is Monday 09:00 IST, which is Monday 03:30 UTC (vercel.json cron "30 3 * * 1").
export function nextWeeklyRun(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(3, 30, 0, 0);
  let add = (8 - d.getUTCDay()) % 7; // days until Monday
  if (add === 0 && now >= d) add = 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatIst(d: Date): string {
  return `${IST.format(d)} IST`;
}
