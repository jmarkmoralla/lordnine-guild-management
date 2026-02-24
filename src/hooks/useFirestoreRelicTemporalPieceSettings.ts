import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { buildDefaultTemporalPieceLevelMap, type RelicKey } from '../data/relicCalculatorConfig';

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

const DEFAULT_SETTINGS: RelicTemporalPieceSettings = {
  levelCostsByRelic: buildDefaultTemporalPieceLevelMap(),
  updatedAt: '',
};

const normalizeLevelCosts = (raw: unknown): Record<RelicKey, number[]> => {
  const defaults = buildDefaultTemporalPieceLevelMap();
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  (Object.keys(defaults) as RelicKey[]).forEach((relicId) => {
    const candidate = Array.isArray(record[relicId]) ? (record[relicId] as unknown[]) : [];
    const normalized = Array.from({ length: MAX_RELIC_LEVEL + 1 }, (_, level) => {
      const value = candidate[level];
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return defaults[relicId][level];
      }

      return Math.max(0, Math.round(value));
    });

    normalized[0] = 0;
    defaults[relicId] = normalized;
  });

  return defaults;
};

const normalizeSettings = (raw: Partial<RelicTemporalPieceSettings> | undefined): RelicTemporalPieceSettings => {
  return {
    levelCostsByRelic: normalizeLevelCosts(raw?.levelCostsByRelic),
    updatedAt: raw?.updatedAt ?? '',
  };
};

export const useFirestoreRelicTemporalPieceSettings = (): UseFirestoreRelicTemporalPieceSettingsReturn => {
  const [settings, setSettings] = useState<RelicTemporalPieceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      RELIC_TEMPORAL_PIECE_SETTINGS_DOC,
      (snapshot) => {
        const raw = snapshot.exists() ? (snapshot.data() as Partial<RelicTemporalPieceSettings>) : undefined;
        setSettings(normalizeSettings(raw));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore relic temporal piece settings error:', err);
        setError(err.message || 'Failed to load relic temporal piece settings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const saveSettings = async (levelCostsByRelic: Record<RelicKey, number[]>) => {
    try {
      const payload: RelicTemporalPieceSettings = {
        levelCostsByRelic: normalizeLevelCosts(levelCostsByRelic),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(RELIC_TEMPORAL_PIECE_SETTINGS_DOC, payload, { merge: true });
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
