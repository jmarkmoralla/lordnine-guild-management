import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface GuildAttendanceSummary {
  id: string;
  name: string;
  kransia: number;
  fieldBoss: number;
  guildBoss: number;
  guildvsguild: number;
  totalAttendance: number;
  totalPercentage: number;
  totalShareUSDT: number;
}

interface UseFirestoreAttendanceSummaryReturn {
  summaryRows: GuildAttendanceSummary[];
  loading: boolean;
  error: string | null;
  updateSummaryRow: (rowId: string, values: SummaryEditableFields) => Promise<void>;
  syncPresentMembersToSummary: (
    attendanceType: string,
    presentMembers: Array<{ name: string; multiplier: number }>
  ) => Promise<void>;
  refreshSummaryForMember: (memberName: string) => Promise<void>;
}

export interface SummaryEditableFields {
  kransia: number;
  fieldBoss: number;
  guildBoss: number;
  guildvsguild: number;
}

const ATTENDANCE_POINTS: Readonly<Record<keyof SummaryEditableFields, number>> = {
  kransia: 10,
  fieldBoss: 1,
  guildBoss: 2,
  guildvsguild: 1,
};

const getSummaryFieldByAttendanceType = (attendanceType: string): keyof SummaryEditableFields => {
  if (attendanceType === 'Field Boss') return 'fieldBoss';
  if (attendanceType === 'Guild Boss') return 'guildBoss';
  if (attendanceType === 'Kransia') return 'kransia';
  return 'guildvsguild';
};

const computeTotalPoints = (values: SummaryEditableFields) => (
  Number(values.kransia || 0)
  + Number(values.fieldBoss || 0)
  + Number(values.guildBoss || 0)
  + Number(values.guildvsguild || 0)
);

const sanitizeSummaryDocId = (name: string) =>
  `${name.trim().toLowerCase().replace(/\s+/g, '-')}_summary`;

const hasZeroAttendance = (values: SummaryEditableFields) => (
  values.kransia === 0
  && values.fieldBoss === 0
  && values.guildBoss === 0
  && values.guildvsguild === 0
);

export const useFirestoreAttendanceSummary = (): UseFirestoreAttendanceSummaryReturn => {
  const [summaryRows, setSummaryRows] = useState<GuildAttendanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const summaryQuery = query(collection(db, 'guildAttendanceSummary'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(
      summaryQuery,
      (snapshot) => {
        const rows = snapshot.docs.map((summaryDoc) => {
          const data = summaryDoc.data() as Partial<Omit<GuildAttendanceSummary, 'id'>>;
          return {
            id: summaryDoc.id,
            name: data.name || '',
            kransia: Number(data.kransia || 0),
            fieldBoss: Number(data.fieldBoss || 0),
            guildBoss: Number(data.guildBoss || 0),
            guildvsguild: Number(data.guildvsguild || 0),
            totalAttendance: Number(data.totalAttendance || 0),
            totalPercentage: Number(data.totalPercentage || 0),
            totalShareUSDT: Number(data.totalShareUSDT || 0),
          };
        });

        setSummaryRows(rows);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message || 'Failed to load attendance summary');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const updateSummaryRow = async (rowId: string, values: SummaryEditableFields) => {
    const summaryRef = doc(db, 'guildAttendanceSummary', rowId);
    const normalizedValues: SummaryEditableFields = {
      kransia: Number(values.kransia) || 0,
      fieldBoss: Number(values.fieldBoss) || 0,
      guildBoss: Number(values.guildBoss) || 0,
      guildvsguild: Number(values.guildvsguild) || 0,
    };

    if (hasZeroAttendance(normalizedValues)) {
      await deleteDoc(summaryRef);
      return;
    }

    const totalAttendance = computeTotalPoints(normalizedValues);

    await updateDoc(summaryRef, {
      kransia: normalizedValues.kransia,
      fieldBoss: normalizedValues.fieldBoss,
      guildBoss: normalizedValues.guildBoss,
      guildvsguild: normalizedValues.guildvsguild,
      totalAttendance,
    });
  };

  const syncPresentMembersToSummary = async (
    attendanceType: string,
    presentMembers: Array<{ name: string; multiplier: number }>
  ) => {
    const targetField = getSummaryFieldByAttendanceType(attendanceType);
    const existingByName = new Map(summaryRows.map((row) => [row.name.trim().toLowerCase(), row]));
    const batch = writeBatch(db);

    presentMembers.forEach(({ name: memberName, multiplier }) => {
      const normalizedName = memberName.trim().toLowerCase();
      if (!normalizedName) return;

      const normalizedMultiplier = Number(multiplier);
      const effectiveMultiplier = Number.isFinite(normalizedMultiplier) && normalizedMultiplier > 0
        ? normalizedMultiplier
        : 1;
      const attendancePoints = ATTENDANCE_POINTS[targetField] * effectiveMultiplier;

      const existing = existingByName.get(normalizedName);

      if (existing) {
        const nextValues: SummaryEditableFields = {
          kransia: existing.kransia,
          fieldBoss: existing.fieldBoss,
          guildBoss: existing.guildBoss,
          guildvsguild: existing.guildvsguild,
        };

        nextValues[targetField] += attendancePoints;
        const nextTotalAttendance = computeTotalPoints(nextValues);

        batch.set(
          doc(db, 'guildAttendanceSummary', existing.id),
          {
            kransia: nextValues.kransia,
            fieldBoss: nextValues.fieldBoss,
            guildBoss: nextValues.guildBoss,
            guildvsguild: nextValues.guildvsguild,
            totalAttendance: nextTotalAttendance,
          },
          { merge: true }
        );
        return;
      }

      const initialValues: SummaryEditableFields = {
        kransia: 0,
        fieldBoss: 0,
        guildBoss: 0,
        guildvsguild: 0,
      };
      initialValues[targetField] = attendancePoints;

      batch.set(
        doc(db, 'guildAttendanceSummary', sanitizeSummaryDocId(memberName)),
        {
          name: memberName,
          kransia: initialValues.kransia,
          fieldBoss: initialValues.fieldBoss,
          guildBoss: initialValues.guildBoss,
          guildvsguild: initialValues.guildvsguild,
          totalAttendance: computeTotalPoints(initialValues),
          totalPercentage: 0,
          totalShareUSDT: 0,
        },
        { merge: true }
      );
    });

    await batch.commit();
  };

  const refreshSummaryForMember = async (memberName: string) => {
    const normalizedName = memberName.trim().toLowerCase();
    if (!normalizedName) return;

    const attendanceQuery = query(
      collection(db, 'guildAttendance'),
      where('name', '==', memberName)
    );
    const attendanceSnapshot = await getDocs(attendanceQuery);

    const nextValues: SummaryEditableFields = {
      kransia: 0,
      fieldBoss: 0,
      guildBoss: 0,
      guildvsguild: 0,
    };

    attendanceSnapshot.docs.forEach((attendanceDoc) => {
      const data = attendanceDoc.data() as { attendanceType?: string; multiplier?: number };
      const targetField = getSummaryFieldByAttendanceType(data.attendanceType || '');
      const normalizedMultiplier = Number(data.multiplier ?? 1);
      const effectiveMultiplier = Number.isFinite(normalizedMultiplier) && normalizedMultiplier > 0
        ? normalizedMultiplier
        : 1;
      nextValues[targetField] += ATTENDANCE_POINTS[targetField] * effectiveMultiplier;
    });

    const totalAttendance = computeTotalPoints(nextValues);

    const existing = summaryRows.find((row) => row.name.trim().toLowerCase() === normalizedName);
    const summaryDocId = existing?.id || sanitizeSummaryDocId(memberName);

    if (hasZeroAttendance(nextValues)) {
      if (existing) {
        await deleteDoc(doc(db, 'guildAttendanceSummary', existing.id));
      }
      return;
    }

    await setDoc(doc(db, 'guildAttendanceSummary', summaryDocId), {
      name: existing?.name || memberName,
      kransia: nextValues.kransia,
      fieldBoss: nextValues.fieldBoss,
      guildBoss: nextValues.guildBoss,
      guildvsguild: nextValues.guildvsguild,
      totalAttendance,
    }, { merge: true });
  };

  return { summaryRows, loading, error, updateSummaryRow, syncPresentMembersToSummary, refreshSummaryForMember };
};
