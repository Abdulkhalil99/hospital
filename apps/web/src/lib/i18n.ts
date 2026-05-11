import en_common    from '@/i18n/en/common.json';
import en_patients  from '@/i18n/en/patients.json';
import en_auth      from '@/i18n/en/auth.json';
import en_emr       from '@/i18n/en/emr.json';

import fa_common    from '@/i18n/fa/common.json';
import fa_patients  from '@/i18n/fa/patients.json';
import fa_auth      from '@/i18n/fa/auth.json';
import fa_emr       from '@/i18n/fa/emr.json';

import ps_common    from '@/i18n/ps/common.json';
import ps_patients  from '@/i18n/ps/patients.json';
import ps_auth      from '@/i18n/ps/auth.json';
import ps_emr       from '@/i18n/ps/emr.json';

const MESSAGES: Record<string, Record<string, Record<string, string>>> = {
  en: { common: en_common, patients: en_patients, auth: en_auth, emr: en_emr },
  fa: { common: fa_common, patients: fa_patients, auth: fa_auth, emr: fa_emr },
  ps: { common: ps_common, patients: ps_patients, auth: ps_auth, emr: ps_emr },
};

// Add dashboard-specific translations inline
const DASHBOARD: Record<string, Record<string, string>> = {
  en: {
    'nav.overview':        'Overview',
    'nav.patients':        'Patients',
    'nav.doctors':         'Doctors',
    'nav.appointments':    'Appointments',
    'nav.queue':           'My Queue',
    'nav.emr':             'EMR',
    'nav.prescriptions':   'Prescriptions',
    'nav.lab':             'Lab Orders',
    'nav.pharmacy':        'Pharmacy',
    'nav.inventory':       'Inventory',
    'nav.dispense':        'Dispense',
    'nav.worklist':        'Worklist',
    'nav.results':         'Enter Results',
    'nav.critical':        'Critical Alerts',
    'nav.catalog':         'Test Catalog',
    'nav.billing':         'Billing',
    'nav.invoices':        'Invoices',
    'nav.payments':        'Payments',
    'nav.outstanding':     'Outstanding',
    'nav.report':          'Daily Report',
    'nav.emergency':       'ED Board',
    'nav.triage':          'Triage',
    'nav.beds':            'Beds',
    'nav.trauma':          'Trauma',
    'nav.checkin':         'Check-in',
    'nav.book':            'Book Appointment',
    'nav.today':           'Today\'s List',
    'nav.vitals':          'Vital Signs',
    'nav.settings':        'Settings',
    'nav.reports':         'Reports',
    'nav.myhealthcare':    'My Health',
    'nav.myappointments':  'My Appointments',
    'nav.myresults':       'Lab Results',
    'nav.mybills':         'My Bills',
    'nav.signout':         'Sign out',
    'dash.welcome':        'Welcome',
    'dash.loading':        'Loading…',
    'dash.nodata':         'No data found',
    'dash.today':          'Today',
    'dash.callnext':       'Call next patient',
    'dash.complete':       'Complete',
    'dash.checkin':        'Check in',
    'dash.register':       'Register patient',
    'dash.book':           'Book appointment',
    'dash.save':           'Save',
    'dash.cancel':         'Cancel',
    'dash.search':         'Search…',
    'dash.date':           'Date',
    'dash.time':           'Time',
    'dash.patient':        'Patient',
    'dash.doctor':         'Doctor',
    'dash.status':         'Status',
    'dash.action':         'Action',
    'dash.total':          'Total',
    'dash.balance':        'Balance',
    'dash.paid':           'Paid',
    'dash.amount':         'Amount',
    'dash.method':         'Method',
    'dash.notes':          'Notes',
    'dash.type':           'Type',
    'dash.gender':         'Gender',
    'dash.phone':          'Phone',
    'dash.blood':          'Blood type',
    'dash.allergy':        'Allergy',
    'dash.mrn':            'MRN',
    'dash.name':           'Name',
    'dash.dob':            'Date of birth',
    'dash.specialty':      'Specialty',
    'dash.fee':            'Fee',
    'dash.available':      'Available',
    'dash.unavailable':    'Unavailable',
    'dash.waiting':        'Waiting',
    'dash.active':         'Active',
    'dash.completed':      'Completed',
    'dash.cancelled':      'Cancelled',
    'dash.priority':       'Priority',
    'dash.barcode':        'Barcode',
    'dash.urgency':        'Urgency',
    'dash.sample':         'Sample',
    'dash.component':      'Component',
    'dash.result':         'Result',
    'dash.unit':           'Unit',
    'dash.flag':           'Flag',
    'dash.drug':           'Drug',
    'dash.dose':           'Dose',
    'dash.frequency':      'Frequency',
    'dash.route':          'Route',
    'dash.quantity':       'Quantity',
    'dash.stock':          'Stock',
    'dash.reorder':        'Reorder level',
    'dash.location':       'Location',
    'dash.invoice':        'Invoice',
    'dash.receipt':        'Receipt',
    'dash.cashier':        'Cashier',
    'dash.transactions':   'Transactions',
    'dash.revenue':        'Revenue',
    'dash.esiLevel':       'ESI Level',
    'dash.complaint':      'Complaint',
    'dash.bed':            'Bed',
    'dash.timined':        'Time in ED',
    'dash.mechanism':      'Mechanism',
    'dash.arrivalmode':    'Arrival mode',
  },
  fa: {
    'nav.overview':        'نمای کلی',
    'nav.patients':        'بیماران',
    'nav.doctors':         'پزشکان',
    'nav.appointments':    'نوبت‌ها',
    'nav.queue':           'صف انتظار من',
    'nav.emr':             'پرونده پزشکی',
    'nav.prescriptions':   'نسخه‌ها',
    'nav.lab':             'آزمایش‌ها',
    'nav.pharmacy':        'داروخانه',
    'nav.inventory':       'موجودی',
    'nav.dispense':        'تحویل دارو',
    'nav.worklist':        'لیست کار',
    'nav.results':         'ثبت نتایج',
    'nav.critical':        'هشدارهای بحرانی',
    'nav.catalog':         'فهرست آزمایش‌ها',
    'nav.billing':         'مالی',
    'nav.invoices':        'فاکتورها',
    'nav.payments':        'پرداخت‌ها',
    'nav.outstanding':     'بدهی‌ها',
    'nav.report':          'گزارش روزانه',
    'nav.emergency':       'تابلو اورژانس',
    'nav.triage':          'تریاژ',
    'nav.beds':            'تخت‌ها',
    'nav.trauma':          'تروما',
    'nav.checkin':         'پذیرش',
    'nav.book':            'رزرو نوبت',
    'nav.today':           'لیست امروز',
    'nav.vitals':          'علائم حیاتی',
    'nav.settings':        'تنظیمات',
    'nav.reports':         'گزارش‌ها',
    'nav.myhealthcare':    'سلامت من',
    'nav.myappointments':  'نوبت‌های من',
    'nav.myresults':       'نتایج آزمایش',
    'nav.mybills':         'صورت‌حساب‌های من',
    'nav.signout':         'خروج',
    'dash.welcome':        'خوش آمدید',
    'dash.loading':        'در حال بارگذاری...',
    'dash.nodata':         'داده‌ای یافت نشد',
    'dash.today':          'امروز',
    'dash.callnext':       'صدا زدن بیمار بعدی',
    'dash.complete':       'تکمیل',
    'dash.checkin':        'پذیرش',
    'dash.register':       'ثبت بیمار',
    'dash.book':           'رزرو نوبت',
    'dash.save':           'ذخیره',
    'dash.cancel':         'لغو',
    'dash.search':         'جستجو...',
    'dash.date':           'تاریخ',
    'dash.time':           'زمان',
    'dash.patient':        'بیمار',
    'dash.doctor':         'پزشک',
    'dash.status':         'وضعیت',
    'dash.action':         'عملیات',
    'dash.total':          'جمع کل',
    'dash.balance':        'مانده',
    'dash.paid':           'پرداخت شده',
    'dash.amount':         'مبلغ',
    'dash.method':         'روش پرداخت',
    'dash.notes':          'یادداشت',
    'dash.type':           'نوع',
    'dash.gender':         'جنسیت',
    'dash.phone':          'تلفن',
    'dash.blood':          'گروه خونی',
    'dash.allergy':        'حساسیت',
    'dash.mrn':            'شماره پرونده',
    'dash.name':           'نام',
    'dash.dob':            'تاریخ تولد',
    'dash.specialty':      'تخصص',
    'dash.fee':            'تعرفه',
    'dash.available':      'در دسترس',
    'dash.unavailable':    'غیر قابل دسترس',
    'dash.waiting':        'در انتظار',
    'dash.active':         'فعال',
    'dash.completed':      'تکمیل شده',
    'dash.cancelled':      'لغو شده',
    'dash.priority':       'اولویت',
    'dash.barcode':        'بارکد',
    'dash.urgency':        'اورژانسی بودن',
    'dash.sample':         'نمونه',
    'dash.component':      'پارامتر',
    'dash.result':         'نتیجه',
    'dash.unit':           'واحد',
    'dash.flag':           'علامت',
    'dash.drug':           'دارو',
    'dash.dose':           'دوز',
    'dash.frequency':      'دفعات مصرف',
    'dash.route':          'مسیر مصرف',
    'dash.quantity':       'تعداد',
    'dash.stock':          'موجودی',
    'dash.reorder':        'سطح سفارش مجدد',
    'dash.location':       'مکان',
    'dash.invoice':        'فاکتور',
    'dash.receipt':        'رسید',
    'dash.cashier':        'صندوقدار',
    'dash.transactions':   'تراکنش‌ها',
    'dash.revenue':        'درآمد',
    'dash.esiLevel':       'سطح تریاژ',
    'dash.complaint':      'شکایت',
    'dash.bed':            'تخت',
    'dash.timined':        'مدت در اورژانس',
    'dash.mechanism':      'مکانیسم آسیب',
    'dash.arrivalmode':    'نحوه ورود',
  },
  ps: {
    'nav.overview':        'لنډیز',
    'nav.patients':        'ناروغان',
    'nav.doctors':         'ډاکتران',
    'nav.appointments':    'وختونه',
    'nav.queue':           'زما لیکه',
    'nav.emr':             'طبي ریکارډ',
    'nav.prescriptions':   'نسخې',
    'nav.lab':             'آزمایشونه',
    'nav.pharmacy':        'درملتون',
    'nav.inventory':       'موجودي',
    'nav.dispense':        'دارو وکړئ',
    'nav.worklist':        'د کار لیست',
    'nav.results':         'پایلې ثبت کړئ',
    'nav.critical':        'بحراني خبرتیاوې',
    'nav.catalog':         'د آزمایش لیست',
    'nav.billing':         'مالي',
    'nav.invoices':        'فاکتورونه',
    'nav.payments':        'تادیې',
    'nav.outstanding':     'پاتې قرضونه',
    'nav.report':          'ورځنۍ راپور',
    'nav.emergency':       'بیړني تابلو',
    'nav.triage':          'تریاژ',
    'nav.beds':            'کاټونه',
    'nav.trauma':          'ټروما',
    'nav.checkin':         'پذیرش',
    'nav.book':            'وخت ورکول',
    'nav.today':           'د نن لیست',
    'nav.vitals':          'حیاتي نښانې',
    'nav.settings':        'ترتیبات',
    'nav.reports':         'راپورونه',
    'nav.myhealthcare':    'زما روغتیا',
    'nav.myappointments':  'زما وختونه',
    'nav.myresults':       'د آزمایش پایلې',
    'nav.mybills':         'زما حسابونه',
    'nav.signout':         'وتل',
    'dash.welcome':        'ښه راغلاست',
    'dash.loading':        'بار کیږي...',
    'dash.nodata':         'معلومات ونه موندل شو',
    'dash.today':          'نن',
    'dash.callnext':       'بل ناروغ وغواړئ',
    'dash.complete':       'بشپړ',
    'dash.checkin':        'پذیرش',
    'dash.register':       'ناروغ ثبت کړئ',
    'dash.book':           'وخت ورکول',
    'dash.save':           'خوندي کړئ',
    'dash.cancel':         'لغوه',
    'dash.search':         'لټون...',
    'dash.date':           'نیټه',
    'dash.time':           'وخت',
    'dash.patient':        'ناروغ',
    'dash.doctor':         'ډاکتر',
    'dash.status':         'حالت',
    'dash.action':         'اقدام',
    'dash.total':          'ټول',
    'dash.balance':        'پاتې',
    'dash.paid':           'تادیه شوي',
    'dash.amount':         'مقدار',
    'dash.method':         'د تادیې لار',
    'dash.notes':          'یادداشتونه',
    'dash.type':           'ډول',
    'dash.gender':         'جنس',
    'dash.phone':          'تلیفون',
    'dash.blood':          'د وینې ډله',
    'dash.allergy':        'الرژي',
    'dash.mrn':            'د ریکارډ شمیره',
    'dash.name':           'نوم',
    'dash.dob':            'د زیږون نیټه',
    'dash.specialty':      'تخصص',
    'dash.fee':            'فیس',
    'dash.available':      'شتون لري',
    'dash.unavailable':    'شتون نه لري',
    'dash.waiting':        'انتظار',
    'dash.active':         'فعال',
    'dash.completed':      'بشپړ شوی',
    'dash.cancelled':      'لغوه شوی',
    'dash.priority':       'لومړیتوب',
    'dash.barcode':        'بارکوډ',
    'dash.urgency':        'بیړتیا',
    'dash.sample':         'نمونه',
    'dash.component':      'برخه',
    'dash.result':         'پایله',
    'dash.unit':           'واحد',
    'dash.flag':           'نښه',
    'dash.drug':           'دارو',
    'dash.dose':           'ډوز',
    'dash.frequency':      'دورې',
    'dash.route':          'لار',
    'dash.quantity':       'مقدار',
    'dash.stock':          'موجودي',
    'dash.reorder':        'د سفارش کچه',
    'dash.location':       'ځای',
    'dash.invoice':        'فاکتور',
    'dash.receipt':        'رسید',
    'dash.cashier':        'کاسیر',
    'dash.transactions':   'معاملې',
    'dash.revenue':        'عاید',
    'dash.esiLevel':       'د تریاژ کچه',
    'dash.complaint':      'شکایت',
    'dash.bed':            'کاټ',
    'dash.timined':        'د بیړني وخت',
    'dash.mechanism':      'د ضربې میکانیزم',
    'dash.arrivalmode':    'د رارسیدلو ډول',
  },
};

export function useT(locale: string) {
  const loc = ['en','fa','ps'].includes(locale) ? locale : 'en';
  const dash = DASHBOARD[loc] ?? DASHBOARD.en;
  const msgs = MESSAGES[loc]  ?? MESSAGES.en;

  return function t(key: string, ns = 'common'): string {
    // Dashboard keys are stored as full dotted ids like `nav.overview`.
    if (dash[key]) return dash[key];

    let resolvedNamespace = ns;
    let resolvedKey = key;

    // Allow callers to pass dotted keys like `auth.username` or `patients.years`.
    if (key.includes('.')) {
      const [prefix, ...rest] = key.split('.');
      const nestedKey = rest.join('.');

      if ((prefix === 'nav' || prefix === 'dash') && dash[key]) {
        return dash[key];
      }

      if (nestedKey && msgs[prefix]) {
        resolvedNamespace = prefix;
        resolvedKey = nestedKey;
      }
    }

    const nsObj = msgs[resolvedNamespace] as Record<string, string> | undefined;
    if (nsObj?.[resolvedKey]) return nsObj[resolvedKey];

    // Fallback to English for the resolved namespace/key pair.
    const enNs = MESSAGES.en[resolvedNamespace] as Record<string, string> | undefined;
    return enNs?.[resolvedKey] ?? DASHBOARD.en[key] ?? key;
  };
}

export function isRTL(locale: string): boolean {
  return locale === 'fa' || locale === 'ps';
}

export function formatDate(date: string | Date, locale: string): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';

  if (locale === 'en') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // Jalali conversion
  const g  = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  const gy = g[0] - 1600, gm = g[1] - 1, gd = g[2] - 1;
  let gDayNo = 365*gy + Math.floor((gy+3)/4) - Math.floor((gy+99)/100) + Math.floor((gy+399)/400);
  for (let i=0;i<gm;i++) gDayNo+=[31,28+((gy%4===0&&gy%100!==0)||(gy%400===0)?1:0),31,30,31,30,31,31,30,31,30,31][i];
  gDayNo+=gd;
  let jDayNo=gDayNo-79;
  const jNp=Math.floor(jDayNo/12053); jDayNo%=12053;
  let jy=979+33*jNp+4*Math.floor(jDayNo/1461); jDayNo%=1461;
  if(jDayNo>=366){jy+=Math.floor((jDayNo-1)/365);jDayNo=(jDayNo-1)%365;}
  let jm=0;
  const jMonths=[31,31,31,31,31,31,30,30,30,30,30,29];
  for(let i=0;i<11&&jDayNo>=jMonths[i];i++){jDayNo-=jMonths[i];jm++;}
  const jd=jDayNo+1;

  const FA_M=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const PS_M=['وری','غویی','غبرګولی','چنګاښ','زمری','وږی','تله','لړم','لیندۍ','مرغومی','سلواغه','کب'];

  const toFa=(n:number)=>n.toString().replace(/\d/g,x=>'۰۱۲۳۴۵۶۷۸۹'[+x]);
  const months = locale==='ps'?PS_M:FA_M;
  return `${toFa(jd)} ${months[jm]} ${toFa(jy)}`;
}
