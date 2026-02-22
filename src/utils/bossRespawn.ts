import type { BossInfo } from '../hooks/useFirestoreBossInfo';
import { getPhilippinesNowDate } from './philippinesTime';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const getNextWeeklyOccurrence = (day?: string, time?: string, referenceDate?: Date) => {
  if (!day || !time) return null;
  const dayIndex = WEEKDAYS.indexOf(day as typeof WEEKDAYS[number]);
  if (dayIndex < 0) return null;

  const [hoursValue, minutesValue] = time.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const now = referenceDate ?? getPhilippinesNowDate();
  const target = new Date(now);
  const currentDay = target.getDay();
  const delta = dayIndex - currentDay;
  target.setDate(target.getDate() + delta);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 7);
  }

  return target;
};

const getDailyNextOccurrence = (time?: string, referenceDate?: Date) => {
  if (!time) return null;

  const [hoursValue, minutesValue] = time.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const now = referenceDate ?? getPhilippinesNowDate();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
};

const getScheduledRespawnCandidates = (boss: BossInfo, referenceDate?: Date) => {
  if (boss.spawnType !== 'scheduled') return [] as Date[];

  const candidates = boss.bossType === 'Destroyer'
    ? [
        getDailyNextOccurrence(boss.scheduledStartTime, referenceDate),
        getDailyNextOccurrence(boss.scheduledEndTime, referenceDate),
      ]
    : [
        getNextWeeklyOccurrence(boss.scheduledStartDay, boss.scheduledStartTime, referenceDate),
        getNextWeeklyOccurrence(boss.scheduledEndDay, boss.scheduledEndTime, referenceDate),
      ];

  return candidates
    .filter((date): date is Date => Boolean(date))
    .sort((first, second) => first.getTime() - second.getTime());
};

export const getNextRespawnDate = (boss: BossInfo): Date | null => {
  if (boss.spawnType === 'scheduled') {
    const isDead = boss.status === 'dead';
    const killedDate = boss.killedTime ? new Date(boss.killedTime) : null;
    const referenceDate = isDead && killedDate && !Number.isNaN(killedDate.getTime())
      ? killedDate
      : undefined;

    const candidates = getScheduledRespawnCandidates(boss, referenceDate);
    return candidates[0] ?? null;
  }

  const spawnHours = Number(boss.spawnTime);
  if (!boss.killedTime || Number.isNaN(spawnHours)) return null;

  const killedDate = new Date(boss.killedTime);
  if (Number.isNaN(killedDate.getTime())) return null;

  return new Date(killedDate.getTime() + spawnHours * 60 * 60 * 1000);
};
