import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface BossNotifierSettings {
  isEnabled: boolean;
  discordWebhookUrl: string;
  notificationTime: string;
  enabledBossIds: string[];
  lastNotifiedDate: string;
  lastNotifiedScheduleKey: string;
  updatedAt: string;
}

interface UseFirestoreBossNotifierSettingsReturn {
  settings: BossNotifierSettings;
  loading: boolean;
  error: string | null;
  saveSettings: (updates: Partial<BossNotifierSettings>) => Promise<void>;
}

export const BOSS_NOTIFIER_SETTINGS_DOC = doc(db, 'bossNotifier', 'settings');

const DEFAULT_SETTINGS: BossNotifierSettings = {
  isEnabled: false,
  discordWebhookUrl: '',
  notificationTime: '09:00',
  enabledBossIds: [],
  lastNotifiedDate: '',
  lastNotifiedScheduleKey: '',
  updatedAt: '',
};

const normalizeSettings = (raw: Partial<BossNotifierSettings> | undefined): BossNotifierSettings => {
  const normalizedNotificationTime = raw?.notificationTime ?? '09:00';
  const normalizedLastNotifiedDate = raw?.lastNotifiedDate ?? '';
  const normalizedScheduleKey = raw?.lastNotifiedScheduleKey
    ?? (normalizedLastNotifiedDate && normalizedNotificationTime
      ? `${normalizedLastNotifiedDate} ${normalizedNotificationTime}`
      : '');

  return {
    isEnabled: raw?.isEnabled === true,
    discordWebhookUrl: raw?.discordWebhookUrl ?? '',
    notificationTime: normalizedNotificationTime,
    enabledBossIds: Array.isArray(raw?.enabledBossIds)
      ? raw.enabledBossIds.filter((id): id is string => typeof id === 'string')
      : [],
    lastNotifiedDate: normalizedLastNotifiedDate,
    lastNotifiedScheduleKey: normalizedScheduleKey,
    updatedAt: raw?.updatedAt ?? '',
  };
};

export const useFirestoreBossNotifierSettings = (): UseFirestoreBossNotifierSettingsReturn => {
  const [settings, setSettings] = useState<BossNotifierSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      BOSS_NOTIFIER_SETTINGS_DOC,
      (snapshot) => {
        const raw = snapshot.exists() ? (snapshot.data() as Partial<BossNotifierSettings>) : undefined;
        setSettings(normalizeSettings(raw));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore boss notifier settings error:', err);
        setError(err.message || 'Failed to load boss notifier settings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const saveSettings = async (updates: Partial<BossNotifierSettings>) => {
    try {
      const payload: BossNotifierSettings = {
        ...settings,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(BOSS_NOTIFIER_SETTINGS_DOC, payload, { merge: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save boss notifier settings';
      setError(message);
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    saveSettings,
  };
};
