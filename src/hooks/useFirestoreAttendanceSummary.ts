import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAttendancePoints } from '../utils/attendancePoints.ts';
import { buildAttendanceSessionIdFromAttendanceDate } from '../utils/attendanceSession.ts';

export interface GuildAttendanceSummary {
  id: string;
  name: string;
  kransia: number;
  kransiaCount: number;
  fieldBoss: number;
  fieldBossCount: number;
  guildBoss: number;
  guildBossCount: number;
  guildvsguild: number;
  guildvsguildCount: number;
  totalAttendance: number;
  totalEventsAttended: number | null;
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
    presentMembers: Array<{ name: string; multiplier: number }>,
    attendancePoints?: number,
    totalEventsAttendedIncrement?: number,
    bossCountIncrement?: number
  ) => Promise<void>;
  refreshSummaryForMember: (memberName: string) => Promise<void>;
}

export interface SummaryEditableFields {
  kransia: number;
  fieldBoss: number;
  guildBoss: number;
  guildvsguild: number;
}

const normalizeAttendanceType = (attendanceType: string) => attendanceType.trim().toLowerCase();

const getSummaryFieldByAttendanceType = (attendanceType: string): keyof SummaryEditableFields | null => {
  const normalizedType = normalizeAttendanceType(attendanceType);

  if (normalizedType === 'field boss') return 'fieldBoss';
  if (normalizedType === 'guild boss') return 'guildBoss';
  if (normalizedType === 'kransia') return 'kransia';
  if (normalizedType === 'guild vs. guild' || normalizedType === 'guild vs guild') return 'guildvsguild';

  return null;
};

const getCountFieldByAttendanceType = (attendanceType: string): string | null => {
  const normalizedType = normalizeAttendanceType(attendanceType);

  if (normalizedType === 'field boss') return 'fieldBossCount';
  if (normalizedType === 'guild boss') return 'guildBossCount';
  if (normalizedType === 'kransia') return 'kransiaCount';
  if (normalizedType === 'guild vs. guild' || normalizedType === 'guild vs guild') return 'guildvsguildCount';

  return null;
};

const computeTotalPoints = (values: SummaryEditableFields) => (
  Number(values.kransia || 0)
  + Number(values.fieldBoss || 0)
  + Number(values.guildBoss || 0)
  + Number(values.guildvsguild || 0)
);

const sanitizeSummaryDocId = (name: string) =>
  `${name.trim().toLowerCase().replace(/\s+/g, '-')}_summary`;

const EXCLUDED_PARTICIPATION_ATTENDANCE_TYPE = 'guild boss';

const hasZeroAttendance = (values: SummaryEditableFields, totalEventsAttended: number) => (
  values.kransia === 0
  && values.fieldBoss === 0
  && values.guildBoss === 0
  && values.guildvsguild === 0
  && totalEventsAttended === 0
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
            kransiaCount: Number(data.kransiaCount || 0),
            fieldBoss: Number(data.fieldBoss || 0),
            fieldBossCount: Number(data.fieldBossCount || 0),
            guildBoss: Number(data.guildBoss || 0),
            guildBossCount: Number(data.guildBossCount || 0),
            guildvsguild: Number(data.guildvsguild || 0),
            guildvsguildCount: Number(data.guildvsguildCount || 0),
            totalAttendance: Number(data.totalAttendance || 0),
            totalEventsAttended: data.totalEventsAttended === undefined ? null : Number(data.totalEventsAttended || 0),
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
    const existing = summaryRows.find((row) => row.id === rowId);
    const normalizedValues: SummaryEditableFields = {
      kransia: Number(values.kransia) || 0,
      fieldBoss: Number(values.fieldBoss) || 0,
      guildBoss: Number(values.guildBoss) || 0,
      guildvsguild: Number(values.guildvsguild) || 0,
    };
    const totalEventsAttended = Number(existing?.totalEventsAttended ?? 0);

    if (hasZeroAttendance(normalizedValues, totalEventsAttended)) {
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
    presentMembers: Array<{ name: string; multiplier: number }>,
    attendancePoints = getAttendancePoints(attendanceType),
    totalEventsAttendedIncrement = 0,
    bossCountIncrement = 0
  ) => {
    const targetField = getSummaryFieldByAttendanceType(attendanceType);
    const countField = getCountFieldByAttendanceType(attendanceType);
    if (!targetField) return;

    const normalizedAttendancePoints = Number(attendancePoints);
    const effectiveAttendancePoints = Number.isFinite(normalizedAttendancePoints) && normalizedAttendancePoints > 0
      ? normalizedAttendancePoints
      : getAttendancePoints(attendanceType);

    const existingByName = new Map(summaryRows.map((row) => [row.name.trim().toLowerCase(), row]));
    const batch = writeBatch(db);

    const normalizedBossCount = Number(bossCountIncrement);
    const effectiveBossCount = Number.isFinite(normalizedBossCount) && normalizedBossCount > 0
      ? normalizedBossCount
      : 0;

    presentMembers.forEach(({ name: memberName, multiplier }) => {
      const normalizedName = memberName.trim().toLowerCase();
      if (!normalizedName) return;

      const normalizedMultiplier = Number(multiplier);
      const effectiveMultiplier = Number.isFinite(normalizedMultiplier) && normalizedMultiplier >= 0
        ? normalizedMultiplier
        : 1;
      const weightedAttendancePoints = effectiveAttendancePoints * effectiveMultiplier;
      const normalizedEventsIncrement = Number(totalEventsAttendedIncrement);
      const effectiveEventsIncrement = Number.isFinite(normalizedEventsIncrement) && normalizedEventsIncrement > 0
        ? normalizedEventsIncrement
        : 0;

      const existing = existingByName.get(normalizedName);

      if (existing) {
        const nextValues: SummaryEditableFields = {
          kransia: existing.kransia,
          fieldBoss: existing.fieldBoss,
          guildBoss: existing.guildBoss,
          guildvsguild: existing.guildvsguild,
        };

        nextValues[targetField] += weightedAttendancePoints;
        const nextTotalAttendance = computeTotalPoints(nextValues);
        const nextTotalEventsAttended = Number(existing.totalEventsAttended ?? 0) + effectiveEventsIncrement;

        const updateData: Record<string, unknown> = {
          kransia: nextValues.kransia,
          fieldBoss: nextValues.fieldBoss,
          guildBoss: nextValues.guildBoss,
          guildvsguild: nextValues.guildvsguild,
          totalAttendance: nextTotalAttendance,
          totalEventsAttended: nextTotalEventsAttended,
        };

        if (countField && effectiveBossCount > 0) {
          const currentCount = Number((existing as Record<string, unknown>)[countField] || 0);
          updateData[countField] = currentCount + effectiveBossCount;
        }

        batch.set(
          doc(db, 'guildAttendanceSummary', existing.id),
          updateData,
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
      initialValues[targetField] = weightedAttendancePoints;

      const newDocData: Record<string, unknown> = {
        name: memberName,
        kransia: initialValues.kransia,
        fieldBoss: initialValues.fieldBoss,
        guildBoss: initialValues.guildBoss,
        guildvsguild: initialValues.guildvsguild,
        totalAttendance: computeTotalPoints(initialValues),
        totalEventsAttended: effectiveEventsIncrement,
        totalPercentage: 0,
        totalShareUSDT: 0,
      };

      if (countField && effectiveBossCount > 0) {
        newDocData[countField] = effectiveBossCount;
      }

      batch.set(
        doc(db, 'guildAttendanceSummary', sanitizeSummaryDocId(memberName)),
        newDocData,
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
    const countValues: Record<string, number> = {
      kransiaCount: 0,
      fieldBossCount: 0,
      guildBossCount: 0,
      guildvsguildCount: 0,
    };
    const attendedEvents = new Set<string>();

    attendanceSnapshot.docs.forEach((attendanceDoc) => {
      const data = attendanceDoc.data() as {
        attendanceType?: string;
        bossName?: string;
        multiplier?: number;
        attendanceDate?: string;
        attendanceSessionId?: string;
        status?: string;
      };
      const targetField = getSummaryFieldByAttendanceType(data.attendanceType || '');
      const countField = getCountFieldByAttendanceType(data.attendanceType || '');
      if (!targetField || !countField) return;

      const normalizedMultiplier = Number(data.multiplier ?? 1);
      const effectiveMultiplier = Number.isFinite(normalizedMultiplier) && normalizedMultiplier >= 0
        ? normalizedMultiplier
        : 1;
      nextValues[targetField] += getAttendancePoints(data.attendanceType || '', data.bossName || '') * effectiveMultiplier;
      countValues[countField] += 1;

      const normalizedAttendanceType = normalizeAttendanceType(data.attendanceType || '');
      if (normalizedAttendanceType === EXCLUDED_PARTICIPATION_ATTENDANCE_TYPE || data.status !== 'Present') {
        return;
      }

      const attendanceSessionId = data.attendanceSessionId?.trim()
        || buildAttendanceSessionIdFromAttendanceDate(data.attendanceDate || '', data.attendanceType || '', data.bossName || '');
      if (attendanceSessionId) {
        attendedEvents.add(attendanceSessionId);
      }
    });

    const totalAttendance = computeTotalPoints(nextValues);
    const totalEventsAttended = attendedEvents.size;

    const existing = summaryRows.find((row) => row.name.trim().toLowerCase() === normalizedName);
    const summaryDocId = existing?.id || sanitizeSummaryDocId(memberName);

    if (hasZeroAttendance(nextValues, totalEventsAttended)) {
      if (existing) {
        await deleteDoc(doc(db, 'guildAttendanceSummary', existing.id));
      }
      return;
    }

    await setDoc(doc(db, 'guildAttendanceSummary', summaryDocId), {
      name: existing?.name || memberName,
      kransia: nextValues.kransia,
      kransiaCount: countValues.kransiaCount,
      fieldBoss: nextValues.fieldBoss,
      fieldBossCount: countValues.fieldBossCount,
      guildBoss: nextValues.guildBoss,
      guildBossCount: countValues.guildBossCount,
      guildvsguild: nextValues.guildvsguild,
      guildvsguildCount: countValues.guildvsguildCount,
      totalAttendance,
      totalEventsAttended,
    }, { merge: true });
  };

  return { summaryRows, loading, error, updateSummaryRow, syncPresentMembersToSummary, refreshSummaryForMember };
};
