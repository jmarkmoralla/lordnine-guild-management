import { createContext, useContext, type ReactNode } from 'react';
import { useFirestoreAttendanceSummary } from '../hooks/useFirestoreAttendanceSummary';
import type { GuildAttendanceSummary, SummaryEditableFields } from '../hooks/useFirestoreAttendanceSummary';

interface AttendanceSummaryContextValue {
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
  refreshSummaryForMember: (memberName: string, bossPointsMap?: Map<string, number>) => Promise<void>;
}

const AttendanceSummaryContext = createContext<AttendanceSummaryContextValue | null>(null);

export const AttendanceSummaryProvider = ({ children }: { children: ReactNode }) => {
  const value = useFirestoreAttendanceSummary();

  return (
    <AttendanceSummaryContext.Provider value={value}>
      {children}
    </AttendanceSummaryContext.Provider>
  );
};

export const useAttendanceSummary = (): AttendanceSummaryContextValue => {
  const context = useContext(AttendanceSummaryContext);
  if (!context) {
    throw new Error('useAttendanceSummary must be used within an AttendanceSummaryProvider');
  }
  return context;
};
