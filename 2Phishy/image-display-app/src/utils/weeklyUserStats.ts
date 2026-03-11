export interface WeeklyData {
  week: number;
  year: number;
  startDate: string;
  endDate: string;
  newUsers: number;
  weekNumber: string;
}

export interface WeeklyUserStats {
  weeks: WeeklyData[];
  currentWeekNewUsers: number;
  totalNewUsersThisWeek: number;
  lastUpdated: string;
}
function getWeekNumber(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week: weekNum, year: d.getUTCFullYear() };
}
function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());

  const start = new Date(ISOweekStart);
  const end = new Date(ISOweekStart);
  end.setDate(end.getDate() + 6);

  return { start, end };
}
export function initializeWeeklyStats(users: any[]): WeeklyUserStats {
  const weeksMap: { [key: string]: WeeklyData } = {};
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const currentWeekKey = `${currentWeek.year}-W${currentWeek.week}`;

  users.forEach((user) => {
    if (user.created_at) {
      const createdDate = new Date(user.created_at);
      const { week, year } = getWeekNumber(createdDate);
      const weekKey = `${year}-W${week}`;

      if (!weeksMap[weekKey]) {
        const { start, end } = getWeekDateRange(week, year);
        weeksMap[weekKey] = {
          week,
          year,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          newUsers: 0,
          weekNumber: `Week ${week}, ${year}`,
        };
      }
      weeksMap[weekKey].newUsers++;
    }
  });
  const weeks = Object.values(weeksMap).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.week - a.week;
  });

  const currentWeekData = weeksMap[currentWeekKey];
  const totalNewUsersThisWeek = currentWeekData?.newUsers || 0;

  return {
    weeks,
    currentWeekNewUsers: totalNewUsersThisWeek,
    totalNewUsersThisWeek,
    lastUpdated: new Date().toISOString(),
  };
}
export function getCachedWeeklyStats(): WeeklyUserStats | null {
  const cached = localStorage.getItem('weeklyUserStats');
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
  return null;
}
export function cacheWeeklyStats(stats: WeeklyUserStats): void {
  localStorage.setItem('weeklyUserStats', JSON.stringify(stats));
}
export function getWeeklyChartData(weeksData: WeeklyData[]): any[] {
  return weeksData.slice(0, 12).reverse().map((week) => ({
    week: `W${week.week}`,
    users: week.newUsers,
    fullWeek: week.weekNumber,
  }));
}
export function getFormattedWeekRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startFormatted = startDate.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
  const endFormatted = endDate.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startFormatted} - ${endFormatted}`;
}
