/** Calendar dates and appointment times belong to the hospital's timezone. */
export function hospitalClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.HOSPITAL_TIMEZONE ?? 'Asia/Kabul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

export function isCalendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
