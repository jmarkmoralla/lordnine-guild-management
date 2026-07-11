import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

interface ParticipationContextValue {
  totalSessions: number;
  fieldBossSessions: number;
  loading: boolean;
  error: string | null;
}

const ParticipationContext = createContext<ParticipationContextValue | null>(null);

const ACTIVE_SESSION_STATUS = 'active';
const normalizeValue = (value: string) => value.trim().toLowerCase();

export const ParticipationProvider = ({ children }: { children: ReactNode }) => {
  const [totalSessions, setTotalSessions] = useState(0);
  const [fieldBossSessions, setFieldBossSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionsQuery = query(collection(db, 'attendanceSessions'));
    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => {
        let total = 0;
        let fieldBoss = 0;

        snapshot.docs.forEach((sessionDoc) => {
          const data = sessionDoc.data() as { status?: string; isParticipationEligible?: boolean; attendanceType?: string };
          const normalizedStatus = normalizeValue(data.status || ACTIVE_SESSION_STATUS);
          const isParticipationEligible = data.isParticipationEligible !== false;

          if (normalizedStatus === ACTIVE_SESSION_STATUS && isParticipationEligible) {
            total++;
            if (data.attendanceType === 'Field Boss') {
              fieldBoss++;
            }
          }
        });

        setTotalSessions(total);
        setFieldBossSessions(fieldBoss);
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

  return (
    <ParticipationContext.Provider value={{ totalSessions, fieldBossSessions, loading, error }}>
      {children}
    </ParticipationContext.Provider>
  );
};

export const useAttendanceParticipation = (): ParticipationContextValue => {
  const context = useContext(ParticipationContext);
  if (!context) {
    throw new Error('useAttendanceParticipation must be used within a ParticipationProvider');
  }
  return context;
};
