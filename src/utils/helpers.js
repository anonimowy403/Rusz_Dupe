export const safeSubstring = (str) => (str && typeof str === 'string') ? str.substring(0, 16) : '';

export const formatDateTime = (deadline) => {
  try {
    const dateObj = new Date(deadline);
    if (isNaN(dateObj.getTime())) return 'Błędna data';
    return dateObj.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'Błędna data';
  }
};

export const getHexColor = (colorStr) => {
  if (!colorStr) return '#9ca3af';
  if (colorStr.startsWith('#')) return colorStr;
  const map = {
    'bg-blue-500': '#3b82f6', 'bg-purple-500': '#a855f7', 'bg-pink-500': '#ec4899',
    'bg-yellow-500': '#eab308', 'bg-indigo-500': '#6366f1', 'bg-teal-500': '#14b8a6',
    'bg-orange-500': '#f97316', 'bg-emerald-500': '#10b981', 'bg-red-500': '#ef4444'
  };
  return map[colorStr] || '#9ca3af';
};

export const COLOR_PRESETS = ['#3b82f6', '#a855f7', '#ec4899', '#eab308', '#f97316', '#10b981', '#ef4444'];

export const getLocalDateString = (d) => {
  const tzOffset = d.getTimezoneOffset() * 60000;
  return (new Date(d - tzOffset)).toISOString().split('T')[0];
};

export const getTodayDate = () => getLocalDateString(new Date());

export const getEndOfWeekDate = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day; 
  d.setDate(d.getDate() + diff);
  return getLocalDateString(d);
};

export const getPast7Days = (referenceDateStr) => {
  const dates = [];
  const refDate = new Date(referenceDateStr);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    dates.push(getLocalDateString(d));
  }
  return dates;
};

export const getDayName = (dateStr) => {
  const d = new Date(dateStr);
  const days = ['ND', 'PN', 'WT', 'ŚR', 'CZW', 'PT', 'SOB'];
  return days[d.getDay()];
};

export const generateScheduleDays = (startOffset = 0, totalDays = 3) => {
  const dates = [];
  const today = new Date();
  for (let i = startOffset; i < totalDays + startOffset; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
};

export const getMonthGrid = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  let startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  for (let i = startDayOfWeek; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    days.push({ date: getLocalDateString(d), isCurrentMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: getLocalDateString(d), isCurrentMonth: true });
  }
  let nextMonthDays = 1;
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, nextMonthDays++);
    days.push({ date: getLocalDateString(d), isCurrentMonth: false });
  }
  return days;
};

export const isTaskOverdueCheck = (deadline) => {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
};

export const calculateNextDeadline = (currentDeadlineStr, repeatType) => {
  if (!currentDeadlineStr) return null;
  const d = new Date(currentDeadlineStr);
  if (isNaN(d.getTime())) return null;
  if (repeatType === 'daily') d.setDate(d.getDate() + 1);
  else if (repeatType === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeatType === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};

export const playBeep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
};

export const formatTimeFromSeconds = (sec) => {
  if (isNaN(sec) || sec < 0) return '0m 0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
};