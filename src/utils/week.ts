const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RESET_DAY = 4;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getWeekWindow(date = new Date()) {
  const normalized = startOfDay(date);
  const day = normalized.getDay();
  const daysSinceReset = (day - RESET_DAY + 7) % 7;
  const weekStart = new Date(normalized.getTime() - daysSinceReset * MS_PER_DAY);
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY - 1000);

  return { weekStart, weekEnd };
}

export function getWeekKey(date = new Date()) {
  const { weekStart } = getWeekWindow(date);
  const year = weekStart.getFullYear();
  const month = `${weekStart.getMonth() + 1}`.padStart(2, "0");
  const day = `${weekStart.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatWeekRange(date = new Date()) {
  const { weekStart, weekEnd } = getWeekWindow(date);
  return `${formatDate(weekStart)} 00:00 ~ ${formatDate(weekEnd)} 23:59`;
}
