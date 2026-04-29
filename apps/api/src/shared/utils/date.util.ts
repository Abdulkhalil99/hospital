import type { Locale } from '@/shared/middleware/i18n.middleware';

// Jalali month names
const JALALI_MONTHS_FA = [
  'فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور',
  'مهر','آبان','آذر','دی','بهمن','اسفند',
];
const JALALI_MONTHS_PS = [
  'وری','غویی','غبرګولی','چنګاښ','زمری','وږی',
  'تله','لړم','لیندۍ','مرغومی','سلواغه','کب',
];

// Convert Gregorian to Jalali (simplified algorithm)
export function toJalali(date: Date): { year: number; month: number; day: number } {
  const g  = [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  const gy = g[0] - 1600;
  const gm = g[1] - 1;
  const gd = g[2] - 1;

  let gDayNo = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100)
             + Math.floor((gy + 399) / 400);

  for (let i = 0; i < gm; i++) {
    gDayNo += [31,28+((gy%4===0&&gy%100!==0)||(gy%400===0)?1:0),31,30,31,30,31,31,30,31,30,31][i];
  }
  gDayNo += gd;

  let jDayNo = gDayNo - 79;
  const jNp  = Math.floor(jDayNo / 12053);
  jDayNo    %= 12053;

  let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;

  if (jDayNo >= 366) {
    jy    += Math.floor((jDayNo - 1) / 365);
    jDayNo = (jDayNo - 1) % 365;
  }

  let jm = 0, jd = 0;
  const monthDays = [31,31,31,31,31,31,30,30,30,30,30,29];
  for (let i = 0; i < 11 && jDayNo >= monthDays[i]; i++) {
    jDayNo -= monthDays[i];
    jm++;
  }
  jd = jDayNo + 1;

  return { year: jy, month: jm + 1, day: jd };
}

// Format a date for display based on locale
export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (locale === 'en') {
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  const { year, month, day } = toJalali(d);
  const monthNames = locale === 'ps' ? JALALI_MONTHS_PS : JALALI_MONTHS_FA;

  if (locale === 'fa') {
    // Persian-Indic digits
    const toFa = (n: number) =>
      n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
    return `${toFa(day)} ${monthNames[month - 1]} ${toFa(year)}`;
  }

  // Pashto — Eastern Arabic digits
  const toAr = (n: number) =>
    n.toString().replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
  return `${toAr(day)} ${monthNames[month - 1]} ${toAr(year)}`;
}

// Format time (24h for all locales, RTL uses Arabic-Indic digits for fa/ps)
export function formatTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const time = `${h}:${m}`;

  if (locale === 'fa') {
    return time.replace(/\d/g, n => '۰۱۲۳۴۵۶۷۸۹'[parseInt(n)]);
  }
  return time;
}
