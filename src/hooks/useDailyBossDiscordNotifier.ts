import { useCallback, useEffect, useMemo, useRef } from 'react';
import { runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useFirestoreBossInfo } from './useFirestoreBossInfo';
import { BOSS_NOTIFIER_SETTINGS_DOC, useFirestoreBossNotifierSettings } from './useFirestoreBossNotifierSettings.ts';
import type { BossInfo } from './useFirestoreBossInfo';
import { getNextRespawnDate } from '../utils/bossRespawn';
import {
  formatPhilippinesMonthDayTime12,
  getPhilippinesNowDate,
  getPhilippinesNowParts,
} from '../utils/philippinesTime';

interface UseDailyBossDiscordNotifierOptions {
  enabled: boolean;
}

const POLL_INTERVAL_MS = 60 * 1000;
const RETRY_AFTER_ERROR_MS = 5 * 60 * 1000;
const SEND_LOCK_TTL_MS = 2 * 60 * 1000;

const getTodayKey = () => {
  const { year, month, day } = getPhilippinesNowParts();
  return `${year}-${month}-${day}`;
};

const toMinutes = (time: string) => {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
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

const finalizeScheduleSend = async (scheduleKey: string, reservationId: string, todayKey: string) => {
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
      lastNotifiedDate: todayKey,
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

const sendDiscordWebhook = async (webhookUrl: string, content: string) => {
  const payload = JSON.stringify({ content } as DiscordWebhookPayload);

  try {
    const response = await fetch(webhookUrl, {
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
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(
        webhookUrl,
        new Blob([payload], { type: 'application/json' })
      );

      if (sent) {
        return;
      }
    }

    throw error;
  }
};

const buildSimpleScheduleText = (bosses: BossInfo[], todayKey: string) => {
  const lines: string[] = [];

  BOSS_TYPE_ORDER.forEach((bossType) => {
    const groupedBosses = bosses.filter((boss) => boss.bossType === bossType);
    if (groupedBosses.length === 0) return;

    lines.push(`**${bossType} Schedule (${todayKey})**`);
    lines.push('');

    groupedBosses.forEach((boss) => {
      const respawn = getNextRespawnDate(boss);
      const nextRespawn = respawn ? formatPhilippinesMonthDayTime12(respawn) : '-';
      lines.push(`• **${boss.name}** — ${nextRespawn}`);
    });

    lines.push('');
  });

  return lines.join('\n').trim();
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
    const todayKey = getTodayKey();
    if (inFlightRef.current || Date.now() < retryAfterRef.current) return;
    if (!enabled || bossesLoading || settingsLoading) return;
    if (!settings.isEnabled || !settings.discordWebhookUrl) return;
    if (selectedBosses.length === 0) return;

    const now = getPhilippinesNowDate();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const scheduledMinutes = toMinutes(settings.notificationTime);
    if (scheduledMinutes === null || nowMinutes < scheduledMinutes) return;

    const scheduleKey = `${todayKey} ${settings.notificationTime}`;
    if (settings.lastNotifiedScheduleKey === scheduleKey) return;

    const reservationId = await reserveScheduleSend(scheduleKey);
    if (!reservationId) return;

    const sortedBosses = [...selectedBosses].sort((first, second) => {
      const firstRespawn = getNextRespawnDate(first)?.getTime() ?? Number.POSITIVE_INFINITY;
      const secondRespawn = getNextRespawnDate(second)?.getTime() ?? Number.POSITIVE_INFINITY;
      return firstRespawn - secondRespawn;
    });

    const content = buildSimpleScheduleText(sortedBosses, todayKey);

    try {
      inFlightRef.current = true;
      await sendDiscordWebhook(settings.discordWebhookUrl, content);
      await finalizeScheduleSend(scheduleKey, reservationId, todayKey);
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
    settings.notificationTime,
    selectedBosses,
  ]);

  useEffect(() => {
    sendNotification();
    const timer = window.setInterval(sendNotification, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [sendNotification]);
};
