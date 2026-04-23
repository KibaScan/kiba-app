export function startOfISOWeekUTC(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // getUTCDay: Sun=0, Mon=1, ..., Sat=6 → ISO offset Monday=0
  const isoDow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - isoDow);
  return d.toISOString();
}
