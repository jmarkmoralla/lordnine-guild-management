import { useCallback, useEffect, useMemo, useRef } from 'react';
import { runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useFirestoreBossInfo } from './useFirestoreBossInfo';
import { BOSS_NOTIFIER_SETTINGS_DOC, useFirestoreBossNotifierSettings } from './useFirestoreBossNotifierSettings.ts';
import type { BossInfo } from './useFirestoreBossInfo';
import { getNextRespawnDate } from '../utils/bossRespawn';
import {
  getPhilippinesNowIsoString,
} from '../utils/philippinesTime';

interface UseDailyBossDiscordNotifierOptions {
  enabled: boolean;
}

const POLL_INTERVAL_MS = 60 * 1000;
const RETRY_AFTER_ERROR_MS = 5 * 60 * 1000;
const SEND_LOCK_TTL_MS = 2 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const getPhilippinesDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
};

const formatPhilippinesMonthDayAndTime12 = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  const dayPeriod = (parts.find((part) => part.type === 'dayPeriod')?.value ?? '').toUpperCase();

  return {
    monthDay: `${month}/${day}`,
    time: `${hour}:${minute} ${dayPeriod}`.trim(),
  };
};

const toPhilippinesScheduleIso = (dateKey: string, time: string) => {
  if (!dateKey || !time) return '';
  return `${dateKey}T${time}:00+08:00`;
};

const toHoursAndMinutes = (time: string) => {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
};

const createPhilippinesDateForKeyAndTime = (dateKey: string, time: string) => {
  if (!dateKey || !time) return null;
  const parsedTime = toHoursAndMinutes(time);
  if (!parsedTime) return null;

  const { hours, minutes } = parsedTime;
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

  return new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00+08:00`);
};

const formatDateKeyForHeader = (dateKey: string) => {
  const headerDate = createPhilippinesDateForKeyAndTime(dateKey, '00:00');
  if (!headerDate) return dateKey;

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(headerDate);
};

const getPhilippinesWeekdayForDateKey = (dateKey: string) => {
  const baseDate = createPhilippinesDateForKeyAndTime(dateKey, '00:00');
  if (!baseDate) return null;

  const weekday = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
  }).format(baseDate);

  return WEEKDAYS.includes(weekday as typeof WEEKDAYS[number])
    ? weekday as typeof WEEKDAYS[number]
    : null;
};

interface BossScheduleEntry {
  boss: BossInfo;
  respawn: Date;
}

const getBossRespawnForDate = (boss: BossInfo, dateKey: string): Date | null => {
  if (boss.spawnType === 'scheduled') {
    if (boss.bossType === 'Destroyer') {
      const candidates = [
        createPhilippinesDateForKeyAndTime(dateKey, boss.scheduledStartTime ?? ''),
        createPhilippinesDateForKeyAndTime(dateKey, boss.scheduledEndTime ?? ''),
      ].filter((entry): entry is Date => Boolean(entry));

      if (candidates.length === 0) return null;
      return candidates.sort((first, second) => first.getTime() - second.getTime())[0];
    }

    const weekday = getPhilippinesWeekdayForDateKey(dateKey);
    if (!weekday) return null;

    const candidates = [
      boss.scheduledStartDay === weekday
        ? createPhilippinesDateForKeyAndTime(dateKey, boss.scheduledStartTime ?? '')
        : null,
      boss.scheduledEndDay === weekday
        ? createPhilippinesDateForKeyAndTime(dateKey, boss.scheduledEndTime ?? '')
        : null,
    ].filter((entry): entry is Date => Boolean(entry));

    if (candidates.length === 0) return null;
    return candidates.sort((first, second) => first.getTime() - second.getTime())[0];
  }

  const nextRespawn = getNextRespawnDate(boss);
  if (!nextRespawn) return null;
  return getPhilippinesDateKey(nextRespawn) === dateKey ? nextRespawn : null;
};

const getScheduledBossesForDate = (allBosses: BossInfo[], dateKey: string) => {
  return allBosses
    .map((boss): BossScheduleEntry | null => {
      const respawn = getBossRespawnForDate(boss, dateKey);
      if (!respawn) return null;

      // Keep a strict selected-date check so only bosses with matching respawn date are sent.
      if (getPhilippinesDateKey(respawn) !== dateKey) return null;

      return { boss, respawn };
    })
    .filter((entry): entry is BossScheduleEntry => Boolean(entry))
    .sort((first, second) => first.respawn.getTime() - second.respawn.getTime());
};

const buildReservationId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const reserveScheduleSend = async (scheduleKey: string) => {
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(BOSS_NOTIFIER_SETTINGS_DOC);
    const data = snapshot.data() as Record<string, unknown> | undefined;

    const currentScheduleKey = typeof data?.lastNotifiedScheduleKey === 'string'
      ? data.lastNotifiedScheduleKey
      : '';

    if (currentScheduleKey === scheduleKey) {
      return null;
    }

    const lockScheduleKey = typeof data?.sendLockScheduleKey === 'string'
      ? data.sendLockScheduleKey
      : '';
    const lockExpiresAt = Number(data?.sendLockExpiresAt ?? 0);
    const now = Date.now();

    if (lockScheduleKey === scheduleKey && lockExpiresAt > now) {
      return null;
    }

    const reservationId = buildReservationId();
    transaction.set(BOSS_NOTIFIER_SETTINGS_DOC, {
      sendLockScheduleKey: scheduleKey,
      sendLockId: reservationId,
      sendLockExpiresAt: now + SEND_LOCK_TTL_MS,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return reservationId;
  });
};

const finalizeScheduleSend = async (scheduleKey: string, reservationId: string, targetDateKey: string) => {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(BOSS_NOTIFIER_SETTINGS_DOC);
    const data = snapshot.data() as Record<string, unknown> | undefined;

    const lockScheduleKey = typeof data?.sendLockScheduleKey === 'string'
      ? data.sendLockScheduleKey
      : '';
    const lockId = typeof data?.sendLockId === 'string'
      ? data.sendLockId
      : '';

    if (lockScheduleKey !== scheduleKey || lockId !== reservationId) {
      return;
    }

    transaction.set(BOSS_NOTIFIER_SETTINGS_DOC, {
      lastNotifiedScheduleKey: scheduleKey,
      lastNotifiedDate: targetDateKey,
      sendLockScheduleKey: '',
      sendLockId: '',
      sendLockExpiresAt: 0,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
};

const releaseScheduleSend = async (scheduleKey: string, reservationId: string) => {
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(BOSS_NOTIFIER_SETTINGS_DOC);
    const data = snapshot.data() as Record<string, unknown> | undefined;

    const lockScheduleKey = typeof data?.sendLockScheduleKey === 'string'
      ? data.sendLockScheduleKey
      : '';
    const lockId = typeof data?.sendLockId === 'string'
      ? data.sendLockId
      : '';

    if (lockScheduleKey !== scheduleKey || lockId !== reservationId) {
      return;
    }

    transaction.set(BOSS_NOTIFIER_SETTINGS_DOC, {
      sendLockScheduleKey: '',
      sendLockId: '',
      sendLockExpiresAt: 0,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
};

interface DiscordWebhookPayload {
  content?: string;
}

const BOSS_TYPE_ORDER: BossInfo['bossType'][] = ['Field Boss', 'Destroyer', 'Guild Boss'];

const normalizeWebhookUrl = (webhookUrl: string) => {
  const trimmed = webhookUrl.trim();
  if (!trimmed) return '';
  return trimmed.replace('discordapp.com/api/webhooks', 'discord.com/api/webhooks');
};

const isLikelyDiscordWebhookUrl = (webhookUrl: string) => {
  try {
    const parsed = new URL(webhookUrl);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com')
      && parsed.pathname.startsWith('/api/webhooks/');
  } catch {
    return false;
  }
};

const sendDiscordWebhook = async (webhookUrl: string, content: string) => {
  const normalizedWebhookUrl = normalizeWebhookUrl(webhookUrl);
  if (!isLikelyDiscordWebhookUrl(normalizedWebhookUrl)) {
    throw new Error('Invalid Discord webhook URL format');
  }

  const payload = JSON.stringify({ content } as DiscordWebhookPayload);

  try {
    const response = await fetch(normalizedWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Discord webhook returned ${response.status}`);
    }

    return;
  } catch (error) {
    try {
      // Discord webhooks accept multipart payload_json and this no-cors path avoids preflight failures.
      const formData = new FormData();
      formData.append('payload_json', payload);
      await fetch(normalizedWebhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
      });
      return;
    } catch {
      // Fall through to sendBeacon fallback.
    }

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const beaconBody = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon(normalizedWebhookUrl, beaconBody);

      if (sent) {
        return;
      }
    }

    throw error;
  }
};

const buildSimpleScheduleText = (entries: BossScheduleEntry[], dateKey: string) => {
  const lines: string[] = [];
  const headerDateLabel = formatDateKeyForHeader(dateKey);

  BOSS_TYPE_ORDER.forEach((bossType) => {
    const groupedBosses = entries.filter((entry) => entry.boss.bossType === bossType);
    if (groupedBosses.length === 0) return;

    lines.push(`**${bossType} Schedule (${headerDateLabel})**`);
    lines.push('');

    groupedBosses.forEach((entry) => {
      const { monthDay, time } = formatPhilippinesMonthDayAndTime12(entry.respawn);
      lines.push(`• **${entry.boss.name}** — ${monthDay} - **${time}**`);
    });

    lines.push('');
  });

  return lines.join('\n').trim();
};

interface SendBossNotificationForDateParams {
  webhookUrl: string;
  bosses: BossInfo[];
  dateKey: string;
}

export const sendBossNotificationForDate = async ({
  webhookUrl,
  bosses,
  dateKey,
}: SendBossNotificationForDateParams) => {
  const scheduledBossEntries = getScheduledBossesForDate(bosses, dateKey);
  if (scheduledBossEntries.length === 0) {
    return 0;
  }

  const content = buildSimpleScheduleText(scheduledBossEntries, dateKey);
  await sendDiscordWebhook(webhookUrl, content);
  return scheduledBossEntries.length;
};

export const useDailyBossDiscordNotifier = ({ enabled }: UseDailyBossDiscordNotifierOptions) => {
  const { bosses, loading: bossesLoading } = useFirestoreBossInfo();
  const {
    settings,
    loading: settingsLoading,
  } = useFirestoreBossNotifierSettings();

  const inFlightRef = useRef(false);
  const retryAfterRef = useRef(0);

  const selectedBosses = useMemo(() => {
    const selectedIds = new Set(settings.enabledBossIds);
    return bosses.filter((boss) => boss.id && selectedIds.has(boss.id));
  }, [bosses, settings.enabledBossIds]);

  const sendNotification = useCallback(async () => {
    if (inFlightRef.current || Date.now() < retryAfterRef.current) return;
    if (!enabled || bossesLoading || settingsLoading) return;
    if (!settings.isEnabled || !settings.discordWebhookUrl) return;
    if (selectedBosses.length === 0) return;

    const nowIso = getPhilippinesNowIsoString();
    const nowTimeMs = Date.parse(nowIso);

    const hasManualSchedule = Boolean(settings.manualNotificationDate && settings.manualNotificationTime);
    if (!hasManualSchedule) return;

    const manualScheduleIso = toPhilippinesScheduleIso(settings.manualNotificationDate, settings.manualNotificationTime);
    const manualScheduleMs = Date.parse(manualScheduleIso);
    if (!manualScheduleIso || !Number.isFinite(manualScheduleMs) || nowTimeMs < manualScheduleMs) return;

    const targetDateKey = settings.manualNotificationDate;
    const scheduleKey = `manual ${targetDateKey} ${settings.manualNotificationTime}`;

    if (settings.lastNotifiedScheduleKey === scheduleKey) return;

    const reservationId = await reserveScheduleSend(scheduleKey);
    if (!reservationId) return;

    let sentCount = 0;
    try {
      sentCount = await sendBossNotificationForDate({
        webhookUrl: settings.discordWebhookUrl,
        bosses: selectedBosses,
        dateKey: targetDateKey,
      });
    } catch (error) {
      console.error('Daily Discord boss notification failed:', error);
      await releaseScheduleSend(scheduleKey, reservationId).catch((releaseError) => {
        console.error('Failed to release notifier send lock:', releaseError);
      });
      retryAfterRef.current = Date.now() + RETRY_AFTER_ERROR_MS;
      inFlightRef.current = false;
      return;
    }

    if (sentCount === 0) {
      await releaseScheduleSend(scheduleKey, reservationId).catch((releaseError) => {
        console.error('Failed to release notifier send lock:', releaseError);
      });
      return;
    }

    try {
      inFlightRef.current = true;
      await finalizeScheduleSend(scheduleKey, reservationId, targetDateKey);
    } catch (error) {
      console.error('Daily Discord boss notification failed:', error);
      await releaseScheduleSend(scheduleKey, reservationId).catch((releaseError) => {
        console.error('Failed to release notifier send lock:', releaseError);
      });
      retryAfterRef.current = Date.now() + RETRY_AFTER_ERROR_MS;
    } finally {
      inFlightRef.current = false;
    }
  }, [
    enabled,
    bossesLoading,
    settingsLoading,
    settings.isEnabled,
    settings.discordWebhookUrl,
    settings.lastNotifiedScheduleKey,
    settings.manualNotificationDate,
    settings.manualNotificationTime,
    selectedBosses,
  ]);

  useEffect(() => {
    sendNotification();
    const timer = window.setInterval(sendNotification, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sendNotification]);
};
