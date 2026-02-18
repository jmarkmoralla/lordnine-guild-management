import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export type BossType = 'Field Boss' | 'Destroyer' | 'Guild Boss';
export type SpawnType = 'fixed' | 'scheduled';
export type BossStatus = 'alive' | 'dead' | 'unknown';

export interface BossInfo {
  id?: string;
  bossType: BossType;
  name: string;
  level: number;
  spawnType: SpawnType;
  spawnTime: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduledStartDay?: string;
  scheduledStartTime?: string;
  scheduledEndDay?: string;
  scheduledEndTime?: string;
  spawnRegion: string;
  bossImage: string;
  killedTime: string;
  status: BossStatus;
}

const getPersistedStatus = (status?: string): BossStatus => {
  if (status === 'alive') return 'alive';
  if (status === 'unknown') return 'unknown';
  return 'dead';
};

interface UseFirestoreBossInfoReturn {
  bosses: BossInfo[];
  loading: boolean;
  error: string | null;
  addBoss: (boss: Omit<BossInfo, 'id'>) => Promise<void>;
  updateBoss: (id: string, updates: Partial<BossInfo>) => Promise<void>;
  deleteBoss: (id: string) => Promise<void>;
  saveBoss: (boss: BossInfo) => Promise<void>;
}

export const useFirestoreBossInfo = (): UseFirestoreBossInfoReturn => {
  const [bosses, setBosses] = useState<BossInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'bossInfo'), orderBy('spawnTime', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bossData: BossInfo[] = [];

        snapshot.forEach((docSnap) => {
          const rawData = docSnap.data() as Partial<BossInfo>;
          const normalizedPersistedStatus = getPersistedStatus(rawData.status);

          bossData.push({
            id: docSnap.id,
            spawnType: 'fixed',
            scheduledStart: '',
            scheduledEnd: '',
            scheduledStartDay: '',
            scheduledStartTime: '',
            scheduledEndDay: '',
            scheduledEndTime: '',
            ...rawData,
            status: normalizedPersistedStatus,
          } as BossInfo);
        });

        setBosses(bossData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError(err.message || 'Failed to load boss info');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addBoss = async (boss: Omit<BossInfo, 'id'>) => {
    try {
      await addDoc(collection(db, 'bossInfo'), {
        ...boss,
        status: getPersistedStatus(boss.status),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add boss');
      throw err;
    }
  };

  const updateBoss = async (id: string, updates: Partial<BossInfo>) => {
    try {
      const normalizedUpdates: Partial<BossInfo> = {
        ...updates,
        ...(updates.status !== undefined
          ? { status: getPersistedStatus(updates.status) }
          : {}),
      };

      await updateDoc(doc(db, 'bossInfo', id), normalizedUpdates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update boss');
      throw err;
    }
  };

  const deleteBoss = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'bossInfo', id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete boss');
      throw err;
    }
  };

  const saveBoss = async (boss: BossInfo) => {
    try {
      if (boss.id) {
        const { id, ...updates } = boss;
        await updateBoss(id, updates);
      } else {
        await addBoss(boss);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save boss');
      throw err;
    }
  };

  return {
    bosses,
    loading,
    error,
    addBoss,
    updateBoss,
    deleteBoss,
    saveBoss,
  };
};
