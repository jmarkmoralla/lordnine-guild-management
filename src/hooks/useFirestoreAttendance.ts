import { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getPhilippinesNowParts } from '../utils/philippinesTime';

export type AttendanceStatus = 'present' | 'late' | 'absent';
type FirestoreAttendanceStatus = 'Present' | 'Late' | 'Absent';

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  attendanceType: string;
  bossName: string;
  attendanceDate: string;
  status: AttendanceStatus;
}

interface UseFirestoreAttendanceReturn {
  records: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  upsertAttendance: (memberId: string, memberName: string, status: AttendanceStatus) => Promise<void>;
  clearAttendance: (memberId: string) => Promise<void>;
}

const toFirestoreStatus = (status: AttendanceStatus): FirestoreAttendanceStatus => {
  if (status === 'present') return 'Present';
  if (status === 'late') return 'Late';
  return 'Absent';
};

const fromFirestoreStatus = (status?: string): AttendanceStatus => {
  if (status === 'Present') return 'present';
  if (status === 'Late') return 'late';
  return 'absent';
};

const sanitizeIdPart = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '-');

const sanitizeDateTimeIdPart = (value: string) =>
  value.replace(/[^0-9a-zA-Z]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();

const buildAttendanceDocId = (attendanceDateTime: string, memberId: string, attendanceType: string, bossName: string) => (
  `${sanitizeDateTimeIdPart(attendanceDateTime)}|${memberId}|${sanitizeIdPart(attendanceType)}|${sanitizeIdPart(bossName)}`
);

const buildAttendanceDateTime = (selectedDate: string) => {
  const { hour, minute, second } = getPhilippinesNowParts();
  const milliseconds = String(new Date().getMilliseconds()).padStart(3, '0');
  return `${selectedDate}T${hour}:${minute}:${second}.${milliseconds}+08:00`;
};

export const useFirestoreAttendance = (
  date: string,
  attendanceType: string,
  bossName: string
): UseFirestoreAttendanceReturn => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dayStart = `${date}T00:00:00+08:00`;
    const dayEnd = `${date}T23:59:59+08:00`;
    const attendanceQuery = query(
      collection(db, 'guildAttendance'),
      where('attendanceDate', '>=', dayStart),
      where('attendanceDate', '<=', dayEnd)
    );

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const items: AttendanceRecord[] = snapshot.docs
          .map((attendanceDoc) => {
            const data = attendanceDoc.data() as {
              name?: string;
              attendanceType?: string;
              bossName?: string;
              attendanceDate?: string;
              status?: string;
            };

            const memberId = attendanceDoc.id.split('|')[1] || '';

            return {
              id: attendanceDoc.id,
              memberId,
              memberName: data.name || '',
              attendanceType: data.attendanceType || '',
              bossName: data.bossName || '',
              attendanceDate: data.attendanceDate || '',
              status: fromFirestoreStatus(data.status),
            };
          })
          .filter((record) => record.attendanceType === attendanceType && record.bossName === bossName);

        items.sort((first, second) => first.memberName.localeCompare(second.memberName));
        setRecords(items);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Failed to load attendance records');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [date, attendanceType, bossName]);

  const upsertAttendance = async (memberId: string, memberName: string, status: AttendanceStatus) => {
    const attendanceDateTime = buildAttendanceDateTime(date);
    const attendanceDocId = buildAttendanceDocId(attendanceDateTime, memberId, attendanceType, bossName);
    await setDoc(
      doc(db, 'guildAttendance', attendanceDocId),
      {
        memberId,
        name: memberName,
        attendanceType,
        bossName,
        attendanceDate: attendanceDateTime,
        status: toFirestoreStatus(status),
      },
      { merge: true }
    );
  };

  const clearAttendance = async (memberId: string) => {
    const dayStart = `${date}T00:00:00+08:00`;
    const dayEnd = `${date}T23:59:59+08:00`;
    const memberAttendanceQuery = query(
      collection(db, 'guildAttendance'),
      where('attendanceDate', '>=', dayStart),
      where('attendanceDate', '<=', dayEnd)
    );

    const snapshot = await getDocs(memberAttendanceQuery);
    const matchingDocs = snapshot.docs.filter((attendanceDoc) => {
      const data = attendanceDoc.data() as {
        attendanceType?: string;
        bossName?: string;
      };

      const recordMemberId = attendanceDoc.id.split('|')[1] || '';
      return (
        recordMemberId === memberId
        && (data.attendanceType || '') === attendanceType
        && (data.bossName || '') === bossName
      );
    });

    await Promise.all(matchingDocs.map((attendanceDoc) => deleteDoc(attendanceDoc.ref)));
  };

  return {
    records,
    loading,
    error,
    upsertAttendance,
    clearAttendance,
  };
};
