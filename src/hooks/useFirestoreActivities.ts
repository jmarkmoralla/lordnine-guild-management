import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface GuildActivity {
  id?: string;
  playerName: string;
  action: string;
  timestamp: number;
}

interface UseFirestoreActivitiesReturn {
  activities: GuildActivity[];
  loading: boolean;
  error: string | null;
  addActivity: (activity: Omit<GuildActivity, 'id'>) => Promise<void>;
}

export const useFirestoreActivities = (): UseFirestoreActivitiesReturn => {
  const [activities, setActivities] = useState<GuildActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set up real-time listener on mount - get last 10 activities
  useEffect(() => {
    const q = query(
      collection(db, 'guildActivities'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const activityData: GuildActivity[] = [];
        snapshot.forEach((doc) => {
          activityData.push({
            id: doc.id,
            ...doc.data(),
          } as GuildActivity);
        });
        setActivities(activityData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Firestore error:', err);
        setError(err.message || 'Failed to load activities');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addActivity = async (activity: Omit<GuildActivity, 'id'>) => {
    try {
      await addDoc(collection(db, 'guildActivities'), {
        ...activity,
        timestamp: activity.timestamp || Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add activity');
      throw err;
    }
  };

  return {
    activities,
    loading,
    error,
    addActivity,
  };
};
