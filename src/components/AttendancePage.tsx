import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader, Plus, Trash2, X } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import '../styles/Attendance.css';
import { auth, db } from '../config/firebase';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { type AttendanceStatus, useFirestoreAttendance } from '../hooks/useFirestoreAttendance';
import { useFirestoreAttendanceSummary } from '../hooks/useFirestoreAttendanceSummary';
import { useFirestoreBossInfo } from '../hooks/useFirestoreBossInfo';
import { useFirestoreGuildInfo } from '../hooks/useFirestoreGuildInfo';
import { getPhilippinesNowParts } from '../utils/philippinesTime';

interface AttendancePageProps {
  userType: 'guest' | 'admin';
  mode?: 'view' | 'manage';
}

const AttendancePage: React.FC<AttendancePageProps> = ({ userType, mode = 'view' }) => {
  const canManage = userType === 'admin' && mode === 'manage';
  const { year, month, day } = getPhilippinesNowParts();
  const todayInPhilippines = `${year}-${month}-${day}`;
  const [selectedDate, setSelectedDate] = useState(todayInPhilippines);
  const [attendanceType, setAttendanceType] = useState('Field Boss');
  const [bossName, setBossName] = useState('Metus');
  const [searchQuery, setSearchQuery] = useState('');
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'unmarked'>('all');
  const [isCreateAttendanceOpen, setIsCreateAttendanceOpen] = useState(false);
  const [isResetAttendanceConfirmOpen, setIsResetAttendanceConfirmOpen] = useState(false);
  const [resetAdminPassword, setResetAdminPassword] = useState('');
  const [showResetAdminPassword, setShowResetAdminPassword] = useState(false);
  const [resetConfirmError, setResetConfirmError] = useState<string | null>(null);
  const [isConfirmingResetAttendance, setIsConfirmingResetAttendance] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isSavingAttendanceData, setIsSavingAttendanceData] = useState(false);
  const [isSyncingAttendanceSummary, setIsSyncingAttendanceSummary] = useState(false);
  const [createAttendanceError, setCreateAttendanceError] = useState<string | null>(null);
  const [draftAttendanceByMemberId, setDraftAttendanceByMemberId] = useState<Record<string, AttendanceStatus | 'unmarked'>>({});
  const [editingMetric, setEditingMetric] = useState<'totalFund' | null>(null);
  const [editingMetricValue, setEditingMetricValue] = useState('');
  const [isSavingMetric, setIsSavingMetric] = useState(false);
  const [viewingMemberName, setViewingMemberName] = useState<string | null>(null);
  const [memberAttendanceDetails, setMemberAttendanceDetails] = useState<Array<{
    id: string;
    attendanceType: string;
    bossName: string;
    attendanceDate: string;
    status: AttendanceStatus;
  }>>([]);
  const [isLoadingMemberDetails, setIsLoadingMemberDetails] = useState(false);
  const [memberDetailsError, setMemberDetailsError] = useState<string | null>(null);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null);

  const { members, loading: membersLoading, error: membersError } = useFirestoreMembers();
  const { bosses, loading: bossesLoading, error: bossesError } = useFirestoreBossInfo();
  const {
    guildInfo,
    loading: guildInfoLoading,
    error: guildInfoError,
    updateGuildInfoFields,
  } = useFirestoreGuildInfo();
  const {
    summaryRows,
    loading: summaryLoading,
    error: summaryError,
    syncPresentMembersToSummary,
    refreshSummaryForMember,
  } = useFirestoreAttendanceSummary();
  const {
    records,
    loading: attendanceLoading,
    error: attendanceError,
    upsertAttendance,
  } = useFirestoreAttendance(selectedDate, attendanceType, bossName);

  const forceDashBossName = attendanceType === 'Guild Boss' || attendanceType === 'Guild vs. Guild';
  const activeStatusFilter = canManage ? 'all' : statusFilter;

  const bossNameOptions = useMemo(
    () => Array.from(new Set(bosses.map((boss) => boss.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [bosses]
  );

  useEffect(() => {
    if (forceDashBossName) {
      if (bossName !== '-') {
        setBossName('-');
      }
      return;
    }

    if (bossNameOptions.length === 0) return;
    if (!bossName || !bossNameOptions.includes(bossName)) {
      setBossName(bossNameOptions[0]);
    }
  }, [attendanceType, bossName, bossNameOptions, forceDashBossName]);

  useEffect(() => {
    if (!canManage || !isCreateAttendanceOpen) return;

    const nextDraft: Record<string, AttendanceStatus | 'unmarked'> = {};
    members.forEach((member) => {
      if (!member.id) return;
      nextDraft[member.id] = 'unmarked';
    });

    setDraftAttendanceByMemberId(nextDraft);
  }, [canManage, isCreateAttendanceOpen, members]);

  const recordsByMemberId = useMemo(() => {
    const entries = records.map((record) => [record.memberId, record.status] as const);
    return new Map<string, AttendanceStatus>(entries);
  }, [records]);

  const membersWithAttendance = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return members
      .map((member) => ({
        ...member,
        attendanceStatus: (() => {
          const memberId = member.id || '';
          if (!memberId) return undefined;

          if (canManage && isCreateAttendanceOpen) {
            const draftStatus = draftAttendanceByMemberId[memberId];
            return draftStatus === 'unmarked' ? undefined : draftStatus;
          }

          return recordsByMemberId.get(memberId);
        })(),
      }))
      .filter((member) => {
        const matchesSearch = member.name.toLowerCase().includes(normalizedSearch);
        if (!matchesSearch) return false;

          if (activeStatusFilter === 'all') return true;
          if (activeStatusFilter === 'unmarked') return !member.attendanceStatus;
          return member.attendanceStatus === activeStatusFilter;
      })
      .sort((first, second) => first.rank - second.rank);
        }, [members, recordsByMemberId, searchQuery, activeStatusFilter, canManage, isCreateAttendanceOpen, draftAttendanceByMemberId]);

  const handleAttendanceCheckboxChange = (
    memberId: string,
    _memberName: string,
    checked: boolean
  ) => {
    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }

    setDraftAttendanceByMemberId((current) => ({
      ...current,
      [memberId]: checked ? 'present' : 'unmarked',
    }));
  };

  const clearAllAttendance = async () => {
    if (!canManage) return;

    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }

    setIsClearingAll(true);
    setDraftAttendanceByMemberId((current) => {
      const nextDraft = { ...current };
      membersWithAttendance
        .filter((member) => member.id)
        .forEach((member) => {
          nextDraft[member.id as string] = 'unmarked';
        });
      return nextDraft;
    });
    setIsClearingAll(false);
  };

  const resetAttendanceToolbarState = () => {
    if (!canManage) return;

    setSelectedDate(todayInPhilippines);
    setAttendanceType('Field Boss');
    setBossName('');
    setSearchQuery('');
    setStatusFilter('all');
    setDraftAttendanceByMemberId({});
  };

  const closeResetAttendanceConfirm = () => {
    setIsResetAttendanceConfirmOpen(false);
    setResetAdminPassword('');
    setShowResetAdminPassword(false);
    setResetConfirmError(null);
    setIsConfirmingResetAttendance(false);
  };

  const openResetAttendanceConfirm = () => {
    setIsResetAttendanceConfirmOpen(true);
    setResetAdminPassword('');
    setShowResetAdminPassword(false);
    setResetConfirmError(null);
    setIsConfirmingResetAttendance(false);
  };

  const deleteCollectionDocuments = async (collectionName: 'guildAttendance' | 'guildAttendanceSummary') => {
    const snapshot = await getDocs(collection(db, collectionName));
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    const batchSize = 400;

    for (let start = 0; start < docs.length; start += batchSize) {
      const batch = writeBatch(db);
      docs.slice(start, start + batchSize).forEach((snapshotDoc) => {
        batch.delete(snapshotDoc.ref);
      });
      await batch.commit();
    }
  };

  const deleteAllAttendanceRecords = async () => {
    await deleteCollectionDocuments('guildAttendance');
    await deleteCollectionDocuments('guildAttendanceSummary');
  };

  const confirmResetAttendance = async () => {
    const trimmedPassword = resetAdminPassword.trim();
    if (!trimmedPassword) {
      setResetConfirmError('Enter admin password to continue.');
      return;
    }

    const currentUser = auth.currentUser;
    const currentUserEmail = currentUser?.email;

    if (!currentUser || !currentUserEmail) {
      setResetConfirmError('Admin session not found. Please sign in again.');
      return;
    }

    try {
      setIsConfirmingResetAttendance(true);
      setResetConfirmError(null);

      const credential = EmailAuthProvider.credential(currentUserEmail, trimmedPassword);
      await reauthenticateWithCredential(currentUser, credential);

      await deleteAllAttendanceRecords();

      resetAttendanceToolbarState();
      closeResetAttendanceConfirm();
    } catch (error) {
      console.error('Failed to confirm reset attendance:', error);
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';

      if (
        errorCode === 'auth/wrong-password'
        || errorCode === 'auth/invalid-credential'
        || errorCode === 'auth/invalid-login-credentials'
      ) {
        setResetConfirmError('Incorrect admin password. Please try again.');
      } else {
        setResetConfirmError('Failed to reset attendance records. Please try again.');
      }
    } finally {
      setIsConfirmingResetAttendance(false);
    }
  };

  const saveAttendanceFromModal = async () => {
    if (!canManage) return;

    const presentMemberNames = membersWithAttendance
      .filter((member) => {
        if (!member.id) return false;
        return draftAttendanceByMemberId[member.id] === 'present';
      })
      .map((member) => member.name)
      .filter(Boolean);

    if (presentMemberNames.length === 0) {
      setCreateAttendanceError('Select atleast 1 member before creating attendance.');
      return;
    }

    try {
      setCreateAttendanceError(null);
      setIsSavingAttendanceData(true);
      setIsSyncingAttendanceSummary(true);

      const membersToPersist = membersWithAttendance.filter((member) => member.id) as Array<{
        id: string;
        name: string;
      }>;

      await Promise.all(
        membersToPersist.map(async (member) => {
          const draftStatus = draftAttendanceByMemberId[member.id] || 'unmarked';

          if (draftStatus === 'present') {
            await upsertAttendance(member.id, member.name, 'present');
          }
        })
      );

      if (presentMemberNames.length > 0) {
        await syncPresentMembersToSummary(attendanceType, presentMemberNames);
      }

      setIsCreateAttendanceOpen(false);
      setCreateAttendanceError(null);
    } catch (error) {
      console.error('Failed to sync attendance summary:', error);
    } finally {
      setIsSavingAttendanceData(false);
      setIsSyncingAttendanceSummary(false);
    }
  };

  const getStatusBadge = (status?: AttendanceStatus) => {
    if (!status) {
      return <span className="badge badge-unmarked">Unmarked</span>;
    }

    if (status === 'present') return <span className="badge badge-present">Present</span>;
    if (status === 'late') return <span className="badge badge-late">Late</span>;
    return <span className="badge badge-absent">Absent</span>;
  };

  const loading = membersLoading || attendanceLoading || summaryLoading || bossesLoading || guildInfoLoading;
  const pageError = membersError || attendanceError || summaryError || bossesError || guildInfoError;
  const isClearAllDisabled = isClearingAll || loading;
  const isSaveAttendanceDisabled =
    isClearingAll || loading || isSyncingAttendanceSummary || isSavingAttendanceData;
  const totalFund = guildInfo?.totalFund ?? 0;
  const attendancePercentage = totalFund * 0.9;
  const managementPercentage = totalFund * 0.1;
  const monthAbbreviations = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  const currentDateLabel = `${monthAbbreviations[Math.max(0, Math.min(11, Number(month) - 1))]} ${Number(day)}`;
  const summaryRowsComputed = useMemo(() => {
    const rowsWithMemberTotals = summaryRows.map((row) => {
      const computedTotalAttendance =
        Number(row.kransia || 0)
        + Number(row.fieldBoss || 0)
        + Number(row.guildBoss || 0)
        + Number(row.guildvsguild || 0);

      return {
        ...row,
        computedTotalAttendance,
      };
    });

    const computedGrandTotalAttendance = rowsWithMemberTotals.reduce(
      (sum, row) => sum + row.computedTotalAttendance,
      0
    );

    return rowsWithMemberTotals
      .map((row) => {
        const computedPercentage = computedGrandTotalAttendance > 0
          ? (row.computedTotalAttendance / computedGrandTotalAttendance) * 100
          : 0;
        const computedUsdtShare = attendancePercentage * (computedPercentage / 100);

        return {
          ...row,
          computedPercentage,
          computedUsdtShare,
        };
      })
      .sort((first, second) => {
        const attendanceDifference = second.computedTotalAttendance - first.computedTotalAttendance;
        if (attendanceDifference !== 0) return attendanceDifference;
        return first.name.localeCompare(second.name);
      });
  }, [summaryRows, attendancePercentage]);

  const totalAttendanceAsOfCurrentDate = useMemo(
    () => summaryRowsComputed.reduce((sum, row) => sum + row.computedTotalAttendance, 0),
    [summaryRowsComputed]
  );

  const guestSummaryRowsComputed = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return summaryRowsComputed;

    return summaryRowsComputed.filter((row) => row.name.toLowerCase().includes(normalizedSearch));
  }, [summaryRowsComputed, searchQuery]);

  const manageSummaryRowsComputed = useMemo(() => {
    const normalizedSearch = manageSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return summaryRowsComputed;

    return summaryRowsComputed.filter((row) => row.name.toLowerCase().includes(normalizedSearch));
  }, [summaryRowsComputed, manageSearchQuery]);

  const startMetricEdit = (currentValue: number) => {
    setEditingMetric('totalFund');
    setEditingMetricValue(String(currentValue));
  };

  const cancelMetricEdit = () => {
    setEditingMetric(null);
    setEditingMetricValue('');
    setIsSavingMetric(false);
  };

  const saveMetricEdit = async () => {
    if (!editingMetric || !guildInfo?.id) return;

    const parsedValue = Math.max(0, Number(editingMetricValue || 0));
    if (Number.isNaN(parsedValue)) return;

    try {
      setIsSavingMetric(true);
      await updateGuildInfoFields(guildInfo.id, {
        totalFund: parsedValue,
        attendancePercentage: Number((parsedValue * 0.9).toFixed(1)),
        managementPercentage: Number((parsedValue * 0.1).toFixed(1)),
      });
      setEditingMetric(null);
      setEditingMetricValue('');
    } catch (error) {
      console.error('Failed to update guild metric:', error);
    } finally {
      setIsSavingMetric(false);
    }
  };

  const viewMemberAttendanceDetails = async (memberName: string) => {
    setViewingMemberName(memberName);
    setIsLoadingMemberDetails(true);
    setMemberDetailsError(null);
    setMemberAttendanceDetails([]);

    try {
      const memberAttendanceQuery = query(
        collection(db, 'guildAttendance'),
        where('name', '==', memberName)
      );
      const snapshot = await getDocs(memberAttendanceQuery);
      const details = snapshot.docs
        .map((attendanceDoc) => {
          const data = attendanceDoc.data() as {
            attendanceType?: string;
            bossName?: string;
            attendanceDate?: string;
            status?: string;
          };

          const status: AttendanceStatus =
            data.status === 'Present'
              ? 'present'
              : data.status === 'Late'
                ? 'late'
                : 'absent';

          return {
            id: attendanceDoc.id,
            attendanceType: data.attendanceType || '-',
            bossName: data.bossName || '-',
            attendanceDate: data.attendanceDate || '',
            status,
          };
        })
        .sort((first, second) => {
          const firstDate = Date.parse(first.attendanceDate);
          const secondDate = Date.parse(second.attendanceDate);

          if (Number.isNaN(firstDate) || Number.isNaN(secondDate)) {
            return second.attendanceDate.localeCompare(first.attendanceDate);
          }

          return secondDate - firstDate;
        });

      setMemberAttendanceDetails(details);
    } catch (detailsError) {
      console.error('Failed to load member attendance details:', detailsError);
      setMemberDetailsError('Failed to load attendance details. Please try again.');
    } finally {
      setIsLoadingMemberDetails(false);
    }
  };

  const closeMemberAttendanceDetails = () => {
    setViewingMemberName(null);
    setMemberAttendanceDetails([]);
    setMemberDetailsError(null);
    setIsLoadingMemberDetails(false);
    setDeletingAttendanceId(null);
  };

  const formatAttendanceDateOnly = (attendanceDate: string) => {
    if (!attendanceDate) return '-';
    const [datePart] = attendanceDate.split('T');
    return datePart || '-';
  };

  const deleteAttendanceDetail = async (attendance: {
    id: string;
    attendanceType: string;
    bossName: string;
    attendanceDate: string;
  }) => {
    const attendanceDateLabel = formatAttendanceDateOnly(attendance.attendanceDate);
    const confirmationMessage = [
      'Delete this attendance record?',
      '',
      `Type: ${attendance.attendanceType || '-'}`,
      `Boss: ${attendance.bossName || '-'}`,
      `Date: ${attendanceDateLabel}`,
    ].join('\n');

    const isConfirmed = window.confirm(confirmationMessage);
    if (!isConfirmed) return;

    try {
      setDeletingAttendanceId(attendance.id);
      await deleteDoc(doc(db, 'guildAttendance', attendance.id));
      setMemberAttendanceDetails((current) => current.filter((currentAttendance) => currentAttendance.id !== attendance.id));
      if (viewingMemberName) {
        await refreshSummaryForMember(viewingMemberName);
      }
    } catch (deleteError) {
      console.error('Failed to delete attendance detail:', deleteError);
      setMemberDetailsError('Failed to delete attendance record. Please try again.');
    } finally {
      setDeletingAttendanceId(null);
    }
  };

  const memberAttendanceTable = (
    <div className="attendance-table-container">
      <table className="attendance-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Name</th>
            <th>Type</th>
            <th>Boss</th>
            <th>Date</th>
            <th className="col-status">Status</th>
            {canManage && <th className="col-action">Action</th>}
          </tr>
        </thead>
        <tbody>
          {membersWithAttendance.map((member, index) => (
            <tr key={member.id}>
              <td className="member-rank">
                {canManage && isCreateAttendanceOpen ? index + 1 : member.rank}
              </td>
              <td className="member-name">{member.name}</td>
              <td className="member-date">{attendanceType}</td>
              <td className="member-date">{bossName}</td>
              <td className="member-date">{selectedDate}</td>
              <td className="member-status">
                {getStatusBadge(member.attendanceStatus)}
              </td>
              {canManage && (
                <td className="member-action">
                  <label className="attendance-checkbox-toggle">
                    <input
                      type="checkbox"
                      checked={member.attendanceStatus === 'present'}
                      onChange={(event) =>
                        handleAttendanceCheckboxChange(
                          member.id as string,
                          member.name,
                          event.target.checked
                        )
                      }
                      disabled={!member.id}
                    />
                  </label>
                </td>
              )}
            </tr>
          ))}
          {!loading && membersWithAttendance.length === 0 && (
            <tr>
              <td colSpan={canManage ? 7 : 6} className="attendance-empty-row">
                No members found for the selected filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`page-container ${canManage ? 'attendance-manage-page' : 'attendance-guest-page'}`}>
      <div className="page-header">
        <h2>{canManage ? 'Manage Attendance' : 'Attendance'}</h2>
        <p className="page-subtitle">
          {canManage ? 'Attendance recording for all guild members' : 'Guild member attendance records'}
        </p>
      </div>

      {loading && (
        <div className="loading-state attendance-loading">
          <p>Loading attendance... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {pageError && (
        <div className="error-state">
          <p>{pageError}</p>
        </div>
      )}

      {!canManage && (
        <>
          <div className="guild-metrics-grid">
            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Total Guild Fund</p>
              </div>
              <p className="guild-metric-value">${totalFund.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Attendance Share (90%)</p>
              </div>
              <p className="guild-metric-value">${attendancePercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Management Share (10%)</p>
              </div>
              <p className="guild-metric-value">${managementPercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>
          </div>

          <div className="attendance-guest-search-row">
            <div className="attendance-guest-search-box">
              <input
                type="text"
                className="attendance-guest-search-input"
                placeholder="Search member name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search member name"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  className="attendance-guest-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {canManage && (
        <>
          <div className="guild-metrics-grid">
            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Total Guild Fund</p>
                {editingMetric !== 'totalFund' ? (
                  <button
                    type="button"
                    className="guild-metric-edit-btn"
                    onClick={() => startMetricEdit(totalFund)}
                    aria-label="Edit Total Guild Fund"
                    disabled={isSavingMetric}
                  >
                    ✎
                  </button>
                ) : (
                  <div className="guild-metric-actions">
                    <button type="button" className="guild-metric-save-btn" onClick={saveMetricEdit} disabled={isSavingMetric}>✓</button>
                    <button type="button" className="guild-metric-cancel-btn" onClick={cancelMetricEdit} disabled={isSavingMetric}>✕</button>
                  </div>
                )}
              </div>
              {editingMetric === 'totalFund' ? (
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="guild-metric-input"
                  value={editingMetricValue}
                  onChange={(event) => setEditingMetricValue(event.target.value)}
                />
              ) : (
                <p className="guild-metric-value">${totalFund.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
              )}
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Attendance Share (90%)</p>
              </div>
              <p className="guild-metric-value">${attendancePercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Management Share (10%)</p>
              </div>
              <p className="guild-metric-value">${managementPercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>
          </div>

          <div className="attendance-toolbar attendance-toolbar-below-metrics">
            <div className="attendance-guest-search-box attendance-manage-search-box">
              <input
                type="text"
                className="attendance-guest-search-input attendance-manage-search-input"
                placeholder="Search member name"
                value={manageSearchQuery}
                onChange={(event) => setManageSearchQuery(event.target.value)}
                aria-label="Search member name"
              />
              {manageSearchQuery.trim().length > 0 && (
                <button
                  type="button"
                  className="attendance-guest-search-clear"
                  onClick={() => setManageSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
            <button className="reset-attendance-btn" onClick={openResetAttendanceConfirm}>
              Reset Attendance
            </button>
            <button
              className="create-attendance-btn"
              onClick={() => {
                setCreateAttendanceError(null);
                setIsCreateAttendanceOpen(true);
              }}
            >
              <Plus size={16} strokeWidth={1.8} />
              Create Attendance
            </button>
          </div>

          <div className="attendance-table-container attendance-summary-main">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kransia</th>
                <th>Field Boss</th>
                <th>Guild Boss</th>
                <th>Guild vs Guild</th>
                <th>Total Attendance</th>
                <th>Percentage</th>
                <th>USDT Share</th>
                <th className="summary-action-col">View</th>
              </tr>
            </thead>
            <tbody>
              {manageSummaryRowsComputed.map((row) => (
                <tr key={row.id}>
                  <td className="member-name">{row.name}</td>
                  <td className="member-date">{row.kransia}</td>
                  <td className="member-date">{row.fieldBoss}</td>
                  <td className="member-date">{row.guildBoss}</td>
                  <td className="member-date">{row.guildvsguild}</td>
                  <td className="member-date">{row.computedTotalAttendance}</td>
                  <td className="member-date">{row.computedPercentage.toFixed(2)}%</td>
                  <td className="member-date">${row.computedUsdtShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="summary-action-cell">
                    <div className="summary-action-buttons">
                      <button
                        className="summary-view-btn"
                        type="button"
                        aria-label={`View attendance details for ${row.name}`}
                        onClick={() => viewMemberAttendanceDetails(row.name)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && manageSummaryRowsComputed.length === 0 && (
                <tr>
                  <td colSpan={9} className="attendance-empty-row">
                    No guild attendance summary records found.
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && summaryRowsComputed.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="summary-footer-label">Total Attendance (as of {currentDateLabel})</td>
                  <td className="summary-footer-value">{totalAttendanceAsOfCurrentDate.toLocaleString()}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </>
      )}

      {!canManage && (
        <div className="attendance-table-container attendance-summary-main">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kransia</th>
                <th>Field Boss</th>
                <th>Guild Boss</th>
                <th>Guild vs Guild</th>
                <th>Total Attendance</th>
                <th>Percentage</th>
                <th>USDT Share</th>
                <th className="summary-action-col">View</th>
              </tr>
            </thead>
            <tbody>
              {guestSummaryRowsComputed.map((row) => (
                <tr key={row.id}>
                  <td className="member-name">{row.name}</td>
                  <td className="member-date">{row.kransia}</td>
                  <td className="member-date">{row.fieldBoss}</td>
                  <td className="member-date">{row.guildBoss}</td>
                  <td className="member-date">{row.guildvsguild}</td>
                  <td className="member-date">{row.computedTotalAttendance}</td>
                  <td className="member-date">{row.computedPercentage.toFixed(2)}%</td>
                  <td className="member-date">${row.computedUsdtShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="summary-action-cell">
                    <div className="summary-action-buttons">
                      <button
                        className="summary-view-btn"
                        type="button"
                        aria-label={`View attendance details for ${row.name}`}
                        onClick={() => viewMemberAttendanceDetails(row.name)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && guestSummaryRowsComputed.length === 0 && (
                <tr>
                  <td colSpan={9} className="attendance-empty-row">
                    No guild attendance summary records found.
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && summaryRowsComputed.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="summary-footer-label">Total Attendance (as of {currentDateLabel})</td>
                  <td className="summary-footer-value">{totalAttendanceAsOfCurrentDate.toLocaleString()}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {canManage && isResetAttendanceConfirmOpen && (
        <div className="attendance-modal-overlay" onClick={closeResetAttendanceConfirm}>
          <div className="attendance-modal-content attendance-reset-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="attendance-modal-header">
              <h3>Reset Attendance</h3>
              <button
                className="attendance-modal-close"
                onClick={closeResetAttendanceConfirm}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="attendance-reset-confirm-body">
              <p>
                This action will delete the attendance record in the database and cannot be undone.
              </p>

              <div className="attendance-reset-password-wrapper">
                <input
                  type={showResetAdminPassword ? 'text' : 'password'}
                  className="attendance-reset-password-input"
                  placeholder="Enter admin password"
                  value={resetAdminPassword}
                  onChange={(event) => {
                    setResetAdminPassword(event.target.value);
                    if (resetConfirmError) {
                      setResetConfirmError(null);
                    }
                  }}
                  disabled={isConfirmingResetAttendance}
                />
                {resetAdminPassword.length > 0 && (
                  <button
                    type="button"
                    className="attendance-reset-password-toggle"
                    onClick={() => setShowResetAdminPassword((current) => !current)}
                    aria-label={showResetAdminPassword ? 'Hide password' : 'Show password'}
                    disabled={isConfirmingResetAttendance}
                  >
                    {showResetAdminPassword ? (
                      <EyeOff size={16} strokeWidth={1.8} />
                    ) : (
                      <Eye size={16} strokeWidth={1.8} />
                    )}
                  </button>
                )}
              </div>

              {resetConfirmError && <p className="attendance-reset-confirm-error">{resetConfirmError}</p>}
            </div>

            <div className="attendance-modal-footer">
              <div className="attendance-modal-footer-right">
                <button
                  className="action-btn attendance-save-btn"
                  onClick={confirmResetAttendance}
                  disabled={isConfirmingResetAttendance || !resetAdminPassword.trim()}
                >
                  {isConfirmingResetAttendance ? 'Verifying...' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManage && isCreateAttendanceOpen && (
        <div
          className="attendance-modal-overlay"
          onClick={() => {
            setIsCreateAttendanceOpen(false);
            setCreateAttendanceError(null);
          }}
        >
          <div className="attendance-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="attendance-modal-header">
              <h3>Create Attendance</h3>
              <button
                className="attendance-modal-close"
                onClick={() => {
                  setIsCreateAttendanceOpen(false);
                  setCreateAttendanceError(null);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="attendance-filters">
              <input
                type="date"
                className="filter-input"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
              <select
                className="filter-select"
                value={attendanceType}
                onChange={(event) => setAttendanceType(event.target.value)}
              >
                <option value="Field Boss">Field Boss</option>
                <option value="Guild Boss">Guild Boss</option>
                <option value="Kransia">Kransia</option>
                <option value="Guild vs. Guild">Guild vs. Guild</option>
              </select>
              <select
                className="filter-select"
                value={bossName}
                onChange={(event) => setBossName(event.target.value)}
                disabled={forceDashBossName || bossNameOptions.length === 0}
              >
                {forceDashBossName ? (
                  <option value="-">-</option>
                ) : bossNameOptions.length === 0 ? (
                  <option value="">No bosses available</option>
                ) : (
                  bossNameOptions.map((nameOption) => (
                    <option key={nameOption} value={nameOption}>
                      {nameOption}
                    </option>
                  ))
                )}
              </select>
              <input
                type="text"
                className="filter-input"
                placeholder="Search member name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            {memberAttendanceTable}

            <div className="attendance-modal-footer">
              <div className="attendance-modal-footer-left">
                <button
                  className="action-btn action-btn-muted clear-all-btn"
                  onClick={clearAllAttendance}
                  disabled={isClearAllDisabled}
                >
                  {isClearingAll ? 'Clearing...' : 'Clear All'}
                </button>
              </div>

              <div className="attendance-modal-footer-right">
                {createAttendanceError && (
                  <p className="attendance-create-error">{createAttendanceError}</p>
                )}
                <button
                  className="action-btn attendance-save-btn"
                  onClick={saveAttendanceFromModal}
                  disabled={isSaveAttendanceDisabled}
                >
                  {isSaveAttendanceDisabled ? 'Please wait...' : 'Save Attendance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingMemberName && (
        <div className="attendance-modal-overlay" onClick={closeMemberAttendanceDetails}>
          <div className="attendance-modal-content attendance-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="attendance-modal-header">
              <div className="attendance-details-heading">
                <h3>{viewingMemberName}</h3>
                <p className="attendance-details-subtitle">Attendance details</p>
              </div>
              <button
                className="attendance-modal-close"
                onClick={closeMemberAttendanceDetails}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {isLoadingMemberDetails && (
              <div className="loading-state attendance-loading">
                <p>Loading attendance details... <Loader size={16} strokeWidth={1.8} /></p>
              </div>
            )}

            {memberDetailsError && (
              <div className="error-state">
                <p>{memberDetailsError}</p>
              </div>
            )}

            {!isLoadingMemberDetails && !memberDetailsError && (
              <div className="attendance-table-container">
                <table className="attendance-table attendance-details-table">
                  <thead>
                    <tr>
                      <th className="details-col-number">No.</th>
                      <th className="details-col-type">Type</th>
                      <th className="details-col-boss">Boss</th>
                      <th className="details-col-date">Date</th>
                      <th className="details-col-status">Status</th>
                      {canManage && <th className="details-col-action">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {memberAttendanceDetails.map((attendance, index) => (
                      <tr key={attendance.id}>
                        <td className="details-cell-number">{index + 1}</td>
                        <td className="details-cell-type">{attendance.attendanceType}</td>
                        <td className="details-cell-boss">{attendance.bossName}</td>
                        <td className="details-cell-date">{formatAttendanceDateOnly(attendance.attendanceDate)}</td>
                        <td className="details-cell-status">{getStatusBadge(attendance.status)}</td>
                        {canManage && (
                          <td className="details-cell-action">
                            <button
                              type="button"
                              className="summary-edit-btn details-delete-btn"
                              aria-label="Delete attendance"
                              onClick={() => deleteAttendanceDetail(attendance)}
                              disabled={deletingAttendanceId === attendance.id}
                              title={deletingAttendanceId === attendance.id ? 'Deleting...' : 'Delete attendance'}
                            >
                              <span className="summary-edit-glyph" aria-hidden="true">
                                {deletingAttendanceId === attendance.id ? (
                                  <Loader className="details-delete-icon" size={16} strokeWidth={2} />
                                ) : (
                                  <Trash2 className="details-delete-icon" size={16} strokeWidth={2} />
                                )}
                              </span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {memberAttendanceDetails.length === 0 && (
                      <tr>
                        <td colSpan={canManage ? 6 : 5} className="attendance-empty-row">
                          No attendance records found for this member.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AttendancePage;
