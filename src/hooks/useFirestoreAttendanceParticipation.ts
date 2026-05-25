import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../config/firebase';

interface ParticipationStats {
  attendedEvents: number;
  totalEligibleEvents: number;
  participationPercent: number;
}

interface UseFirestoreAttendanceParticipationReturn {
  participationByMemberId: Record<string, ParticipationStats>;
  participationByMemberName: Record<string, ParticipationStats>;
  loading: boolean;
  error: string | null;
}

const EXCLUDED_ATTENDANCE_TYPE = 'guild boss';
const PRESENT_STATUS = 'present';

const normalizeValue = (value: string) => value.trim().toLowerCase();

const buildLegacyAttendanceSessionId = (attendanceDate: string, attendanceType: string, bossName: string) => {
  const [datePart] = attendanceDate.split('T');
  return [datePart || attendanceDate, normalizeValue(attendanceType), normalizeValue(bossName)].join('|');
};

const createParticipationStats = (attendedEvents: number, totalEligibleEvents: number): ParticipationStats => ({
  attendedEvents,
  totalEligibleEvents,
  participationPercent: totalEligibleEvents > 0 ? (attendedEvents / totalEligibleEvents) * 100 : 0,
});

export const useFirestoreAttendanceParticipation = (): UseFirestoreAttendanceParticipationReturn => {
  const [participationByMemberId, setParticipationByMemberId] = useState<Record<string, ParticipationStats>>({});
  const [participationByMemberName, setParticipationByMemberName] = useState<Record<string, ParticipationStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const attendanceQuery = query(collection(db, 'guildAttendance'));

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const eligibleEvents = new Set<string>();
        const eventsByMemberId = new Map<string, Set<string>>();
        const eventsByMemberName = new Map<string, Set<string>>();

        snapshot.docs.forEach((attendanceDoc) => {
          const data = attendanceDoc.data() as {
            memberId?: string;
            name?: string;
            attendanceType?: string;
            bossName?: string;
            attendanceDate?: string;
            attendanceSessionId?: string;
            status?: string;
          };

          const normalizedAttendanceType = normalizeValue(data.attendanceType || '');
          if (!normalizedAttendanceType || normalizedAttendanceType === EXCLUDED_ATTENDANCE_TYPE) {
            return;
          }

          const attendanceSessionId = data.attendanceSessionId?.trim()
            || buildLegacyAttendanceSessionId(data.attendanceDate || '', data.attendanceType || '', data.bossName || '');

          if (!attendanceSessionId) {
            return;
          }

          eligibleEvents.add(attendanceSessionId);

          const normalizedStatus = normalizeValue(data.status === 'Present' ? PRESENT_STATUS : data.status || '');
          if (normalizedStatus !== PRESENT_STATUS) {
            return;
          }

          const memberId = data.memberId?.trim() || attendanceDoc.id.split('|')[1] || '';
          const normalizedMemberName = normalizeValue(data.name || '');

          if (memberId) {
            const memberEvents = eventsByMemberId.get(memberId) || new Set<string>();
            memberEvents.add(attendanceSessionId);
            eventsByMemberId.set(memberId, memberEvents);
          }

          if (normalizedMemberName) {
            const memberEvents = eventsByMemberName.get(normalizedMemberName) || new Set<string>();
            memberEvents.add(attendanceSessionId);
            eventsByMemberName.set(normalizedMemberName, memberEvents);
          }
        });

        const totalEligibleEvents = eligibleEvents.size;

        setParticipationByMemberId(
          Object.fromEntries(
            Array.from(eventsByMemberId.entries()).map(([memberId, memberEvents]) => [
              memberId,
              createParticipationStats(memberEvents.size, totalEligibleEvents),
            ])
          )
        );

        setParticipationByMemberName(
          Object.fromEntries(
            Array.from(eventsByMemberName.entries()).map(([memberName, memberEvents]) => [
              memberName,
              createParticipationStats(memberEvents.size, totalEligibleEvents),
            ])
          )
        );

        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Failed to load attendance participation');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    participationByMemberId,
    participationByMemberName,
    loading,
    error,
  };
};