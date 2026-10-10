import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  HARD_RAID_GROUPS_FIELD,
  type HardRaidGroupDefinition,
} from '../types/hardRaid';

interface UseFirestoreHardRaidReturn {
  groups: HardRaidGroupDefinition[];
  loading: boolean;
  error: string | null;
  saveGroups: (groups: HardRaidGroupDefinition[]) => Promise<void>;
}

export const HARD_RAID_DOC = doc(db, 'appSettings', 'hardRaid');

const normalizeGroups = (raw: unknown): HardRaidGroupDefinition[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, index) => ({
      id: typeof entry.id === 'string' && entry.id ? entry.id : `group-${index}`,
      name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `Squad ${index + 1}`,
      order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : index,
    }))
    .sort((first, second) => first.order - second.order);
};

export const useFirestoreHardRaid = (): UseFirestoreHardRaidReturn => {
  const [groups, setGroups] = useState<HardRaidGroupDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      HARD_RAID_DOC,
      (snapshot) => {
        const raw = snapshot.exists()
          ? (snapshot.data() as Record<string, unknown>)[HARD_RAID_GROUPS_FIELD]
          : undefined;
        setGroups(normalizeGroups(raw));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore hard raid error:', err);
        setError(err.message || 'Failed to load hard raid lineup');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const saveGroups = async (nextGroups: HardRaidGroupDefinition[]) => {
    try {
      await setDoc(HARD_RAID_DOC, { [HARD_RAID_GROUPS_FIELD]: nextGroups }, { merge: true });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hard raid lineup');
      throw err;
    }
  };

  return {
    groups,
    loading,
    error,
    saveGroups,
  };
};
