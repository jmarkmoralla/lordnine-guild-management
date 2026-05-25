import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UseFirestoreAttendanceParticipationReturn {
  totalSessions: number;
  loading: boolean;
  error: string | null;
}

const ACTIVE_SESSION_STATUS = 'active';
const normalizeValue = (value: string) => value.trim().toLowerCase();

export const useFirestoreAttendanceParticipation = (): UseFirestoreAttendanceParticipationReturn => {
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionsQuery = query(collection(db, 'attendanceSessions'));
    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        const eligibleSessions = snapshot.docs.filter((sessionDoc) => {
          const data = sessionDoc.data() as { status?: string; isParticipationEligible?: boolean };
          const normalizedStatus = normalizeValue(data.status || ACTIVE_SESSION_STATUS);
          const isParticipationEligible = data.isParticipationEligible !== false;
          return normalizedStatus === ACTIVE_SESSION_STATUS && isParticipationEligible;
        });
        setTotalSessions(eligibleSessions.length);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Failed to load attendance sessions');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return {
    totalSessions,
    loading,
    error,
  };
};