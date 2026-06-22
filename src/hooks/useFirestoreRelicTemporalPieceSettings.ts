import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { relicConfigs, type RelicKey } from '../data/relicCalculatorConfig';

export interface RelicTemporalPieceSettings {
  levelCostsByRelic: Record<RelicKey, number[]>;
  updatedAt: string;
}

interface UseFirestoreRelicTemporalPieceSettingsReturn {
  settings: RelicTemporalPieceSettings;
  loading: boolean;
  error: string | null;
  saveSettings: (levelCostsByRelic: Record<RelicKey, number[]>) => Promise<void>;
}

const MAX_RELIC_LEVEL = 100;
export const RELIC_TEMPORAL_PIECE_SETTINGS_DOC = doc(db, 'relicCalculator', 'temporalPieceSettings');

const EMPTY_SETTINGS: RelicTemporalPieceSettings = {
  levelCostsByRelic: {} as Record<RelicKey, number[]>,
  updatedAt: '',
};

let cachedSettings: RelicTemporalPieceSettings | null = null;
let fetchPromise: Promise<void> | null = null;

const normalizeLevelCosts = (raw: unknown): Record<RelicKey, number[]> => {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const result = {} as Record<RelicKey, number[]>;

  relicConfigs.forEach((relic) => {
    let candidate = Array.isArray(record[relic.id]) ? (record[relic.id] as unknown[]) : [];

    if (candidate.length === 0 && relic.id === 'magic-storm') {
      const oldData = record['magic-storn'];
      if (Array.isArray(oldData)) candidate = oldData as unknown[];
    }

    const normalized = Array.from({ length: MAX_RELIC_LEVEL + 1 }, (_, level) => {
      if (level === 0) return 0;
      const value = candidate[level];
      if (typeof value !== 'number' || Number.isNaN(value)) return 0;
      return Math.max(0, Math.round(value));
    });
    result[relic.id] = normalized;
  });

  return result;
};

const normalizeSettings = (raw: Partial<RelicTemporalPieceSettings> | undefined): RelicTemporalPieceSettings => {
  return {
    levelCostsByRelic: normalizeLevelCosts(raw?.levelCostsByRelic),
    updatedAt: raw?.updatedAt ?? '',
  };
};

export const useFirestoreRelicTemporalPieceSettings = (): UseFirestoreRelicTemporalPieceSettingsReturn => {
  const [settings, setSettings] = useState<RelicTemporalPieceSettings>(
    () => cachedSettings ?? EMPTY_SETTINGS
  );
  const [loading, setLoading] = useState(!cachedSettings);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedSettings) return;

    const doFetch = async () => {
      try {
        const snapshot = await getDoc(RELIC_TEMPORAL_PIECE_SETTINGS_DOC);
        const raw = snapshot.exists() ? (snapshot.data() as Partial<RelicTemporalPieceSettings>) : undefined;
        const normalized = normalizeSettings(raw);
        cachedSettings = normalized;
        setSettings(normalized);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load relic temporal piece settings';
        console.error('Firestore relic temporal piece settings error:', err);
        setError(message);
        fetchPromise = null;
      } finally {
        setLoading(false);
      }
    };

    if (!fetchPromise) {
      fetchPromise = doFetch();
    }

    fetchPromise.then(() => {
      setSettings(cachedSettings ?? EMPTY_SETTINGS);
      setLoading(false);
    });
  }, []);

  const saveSettings = async (levelCostsByRelic: Record<RelicKey, number[]>) => {
    try {
      const normalized = normalizeLevelCosts(levelCostsByRelic);
      const updatedSettings: RelicTemporalPieceSettings = {
        levelCostsByRelic: normalized,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(RELIC_TEMPORAL_PIECE_SETTINGS_DOC, updatedSettings, { merge: true });
      cachedSettings = updatedSettings;
      setSettings(updatedSettings);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save relic temporal piece settings';
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
