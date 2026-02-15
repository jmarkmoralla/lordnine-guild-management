import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader, Pencil, Plus, Skull, Trash2, X } from 'lucide-react';
import '../styles/Rankings.css';
import '../styles/BossManage.css';
import { useFirestoreBossInfo } from '../hooks/useFirestoreBossInfo';
import type { BossInfo, BossType, SpawnType } from '../hooks/useFirestoreBossInfo';
import {
  formatPhilippinesMonthDayTime12,
  formatPhilippinesDayTime,
  formatTimeLabel,
  getPhilippinesNowDate,
  getPhilippinesNowIsoString,
  getPhilippinesNowParts,
} from '../utils/philippinesTime';

interface ManageBossTimerPageProps {
  userType: 'guest' | 'admin';
}

const defaultBoss: BossInfo = {
  bossType: 'Field Boss',
  name: '',
  level: 1,
  spawnType: 'fixed',
  spawnTime: '0',
  scheduledStart: '',
  scheduledEnd: '',
  scheduledStartDay: '',
  scheduledStartTime: '',
  scheduledEndDay: '',
  scheduledEndTime: '',
  spawnRegion: '',
  bossImage: '/assets/images/Venatus.jpg',
  killedTime: '',
  status: 'alive',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const RESPAWNING_WINDOW_MS = 10 * 60 * 1000;
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const totalMinutes = index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});

const toPhilippinesDateTime = (value: string) => {
  if (!value) return '';
  const timeOnlyMatch = /^\d{2}:\d{2}$/.test(value);
  if (!timeOnlyMatch) return value;

  const { year, month, day } = getPhilippinesNowParts();
  const phDate = `${year}-${month}-${day}`;
  return `${phDate}T${value}:00+08:00`;
};

const normalizeBossPayload = (boss: BossInfo) => {
  const normalizedKilledTime = boss.status === 'dead'
    ? (toPhilippinesDateTime(boss.killedTime) || getPhilippinesNowIsoString())
    : '';

  const payload = {
    ...boss,
    killedTime: normalizedKilledTime,
  };

  if (boss.spawnType === 'scheduled') {
    return {
      ...payload,
      spawnTime: boss.spawnTime || '0',
      scheduledStart: '',
      scheduledEnd: '',
      scheduledStartDay: boss.scheduledStartDay || '',
      scheduledStartTime: boss.scheduledStartTime || '',
      scheduledEndDay: boss.scheduledEndDay || '',
      scheduledEndTime: boss.scheduledEndTime || '',
    };
  }

  return {
    ...payload,
    scheduledStart: '',
    scheduledEnd: '',
    scheduledStartDay: '',
    scheduledStartTime: '',
    scheduledEndDay: '',
    scheduledEndTime: '',
  };
};

const getPhilippinesNow = () => {
  return getPhilippinesNowIsoString();
};

const formatScheduleLine = (day?: string, time?: string) => {
  if (!day || !time) return '';
  if (!WEEKDAYS.includes(day as typeof WEEKDAYS[number])) return '';

  const label = formatTimeLabel(time);
  if (!label) return '';

  return `${day} ${label}`;
};

const getNextWeeklyOccurrence = (day?: string, time?: string, referenceDate?: Date) => {
  if (!day || !time) return null;
  const dayIndex = WEEKDAYS.indexOf(day as typeof WEEKDAYS[number]);
  if (dayIndex < 0) return null;

  const [hoursValue, minutesValue] = time.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const now = referenceDate ?? getPhilippinesNowDate();
  const target = new Date(now);
  const currentDay = target.getDay();
  const delta = dayIndex - currentDay;
  target.setDate(target.getDate() + delta);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 7);
  }

  return target;
};

const getDailyNextOccurrence = (time?: string, referenceDate?: Date) => {
  if (!time) return null;

  const [hoursValue, minutesValue] = time.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const now = referenceDate ?? getPhilippinesNowDate();
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
};

const getScheduledRespawnCandidates = (boss: BossInfo, referenceDate?: Date) => {
  if (boss.spawnType !== 'scheduled') return [] as Date[];

  // For Destroyer scheduled timers, dead/respawning/alive transitions are based on either timer reached.
  const candidates = boss.bossType === 'Destroyer'
    ? [
        getDailyNextOccurrence(boss.scheduledStartTime, referenceDate),
        getDailyNextOccurrence(boss.scheduledEndTime, referenceDate),
      ]
    : [
        getNextWeeklyOccurrence(boss.scheduledStartDay, boss.scheduledStartTime, referenceDate),
        getNextWeeklyOccurrence(boss.scheduledEndDay, boss.scheduledEndTime, referenceDate),
      ];

  return candidates
    .filter((date): date is Date => Boolean(date))
    .sort((first, second) => first.getTime() - second.getTime());
};

const formatKilledTime = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return formatPhilippinesMonthDayTime12(parsed);
};

const getScheduleLines = (boss: BossInfo) => {
  if (boss.spawnType !== 'scheduled') return null;

  if (boss.bossType === 'Destroyer') {
    // For Destroyer, show only times with "Daily" prefix
    const startTime = boss.scheduledStartTime ? `Daily ${formatTimeLabel(boss.scheduledStartTime)}` : '';
    const endTime = boss.scheduledEndTime ? `Daily ${formatTimeLabel(boss.scheduledEndTime)}` : '';
    const lines = Array.from(new Set([startTime, endTime].filter(Boolean)));
    return lines.length > 0 ? lines : null;
  }

  if (boss.scheduledStartDay || boss.scheduledStartTime || boss.scheduledEndDay || boss.scheduledEndTime) {
    const startLine = formatScheduleLine(boss.scheduledStartDay, boss.scheduledStartTime);
    const endLine = formatScheduleLine(boss.scheduledEndDay, boss.scheduledEndTime);
    const lines = Array.from(new Set([startLine, endLine].filter(Boolean)));
    return lines.length > 0 ? lines : null;
  }

  const startDate = boss.scheduledStart ? new Date(boss.scheduledStart) : null;
  const endDate = boss.scheduledEnd ? new Date(boss.scheduledEnd) : null;
  const startLine = startDate && !Number.isNaN(startDate.getTime())
    ? formatPhilippinesDayTime(startDate)
    : '';
  const endLine = endDate && !Number.isNaN(endDate.getTime())
    ? formatPhilippinesDayTime(endDate)
    : '';
  const lines = Array.from(new Set([startLine, endLine].filter(Boolean)));
  return lines.length > 0 ? lines : null;
};

const renderScheduleLines = (lines: string[]): ReactNode => (
  <span className="schedule-lines">
    {lines.map((line, index) => (
      <span key={`${line}-${index}`}>
        {line}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    ))}
  </span>
);

const renderScheduleLinesForBoss = (boss: BossInfo): ReactNode => {
  const lines = getScheduleLines(boss);
  return lines ? renderScheduleLines(lines) : 'Scheduled';
};

const getNextSpawnTime = (boss: BossInfo): ReactNode => {
  if (boss.spawnType === 'scheduled') {
    const nextRespawn = getNextRespawnDate(boss);
    if (!nextRespawn) return '';
    return formatPhilippinesMonthDayTime12(nextRespawn);
  }

  const spawnHours = Number(boss.spawnTime);
  if (!boss.killedTime || Number.isNaN(spawnHours)) return '';

  const killedDate = new Date(boss.killedTime);
  if (Number.isNaN(killedDate.getTime())) return '';

  const nextSpawn = new Date(killedDate.getTime() + spawnHours * 60 * 60 * 1000);
  return formatPhilippinesMonthDayTime12(nextSpawn);
};

const getNextRespawnDate = (boss: BossInfo) => {
  if (boss.spawnType === 'scheduled') {
    const isDead = boss.status !== 'alive';
    const killedDate = boss.killedTime ? new Date(boss.killedTime) : null;
    const referenceDate = isDead && killedDate && !Number.isNaN(killedDate.getTime())
      ? killedDate
      : undefined;

    const candidates = getScheduledRespawnCandidates(boss, referenceDate);
    return candidates[0] ?? null;
  }

  const spawnHours = Number(boss.spawnTime);
  if (!boss.killedTime || Number.isNaN(spawnHours)) return null;

  const killedDate = new Date(boss.killedTime);
  if (Number.isNaN(killedDate.getTime())) return null;

  return new Date(killedDate.getTime() + spawnHours * 60 * 60 * 1000);
};

const getPersistedBossStatus = (boss: BossInfo) => (boss.status === 'alive' ? 'alive' : 'dead');

const getDisplayBossStatus = (boss: BossInfo) => {
  const persistedStatus = getPersistedBossStatus(boss);
  if (persistedStatus === 'alive') return 'alive';

  const nextRespawn = getNextRespawnDate(boss);

  if (!nextRespawn) return 'dead';

  const now = getPhilippinesNowDate();
  const timeUntilRespawn = nextRespawn.getTime() - now.getTime();
  if (timeUntilRespawn <= 0) return 'alive';
  if (timeUntilRespawn <= RESPAWNING_WINDOW_MS) return 'respawning';
  return 'dead';
};

const toPhilippinesDateTimeFromLocal = (value: string) => {
  if (!value) return '';
  return `${value}:00+08:00`;
};

const withDefaultSpawnType = (boss: BossInfo): BossInfo => ({
  ...boss,
  spawnType: boss.spawnType || 'fixed',
  scheduledStart: boss.scheduledStart || '',
  scheduledEnd: boss.scheduledEnd || '',
  scheduledStartDay: boss.scheduledStartDay || '',
  scheduledStartTime: boss.scheduledStartTime || '',
  scheduledEndDay: boss.scheduledEndDay || '',
  scheduledEndTime: boss.scheduledEndTime || '',
});

const validateBossForm = (boss: BossInfo): string => {
  if (!boss.name.trim()) return 'Boss name is required.';
  if (!boss.bossType) return 'Boss type is required.';
  if (!boss.level || boss.level < 1) return 'Level is required and must be at least 1.';
  if (!boss.spawnType) return 'Spawn type is required.';

  if (boss.spawnType === 'fixed') {
    const spawnHours = Number(boss.spawnTime);
    if (!boss.spawnTime || Number.isNaN(spawnHours) || spawnHours < 0 || spawnHours > 23) {
      return 'Spawn time is required and must be between 0 and 23 hours.';
    }
  } else if (boss.bossType === 'Destroyer') {
    if (!boss.scheduledStartTime) return 'Spawn Time 1 is required.';
    if (!boss.scheduledEndTime) return 'Spawn Time 2 is required.';
  } else {
    if (!boss.scheduledStartDay || !boss.scheduledStartTime) return 'Spawn Time 1 day and time are required.';
    if (!boss.scheduledEndDay || !boss.scheduledEndTime) return 'Spawn Time 2 day and time are required.';
  }

  if (!boss.bossImage.trim()) return 'Boss image is required.';
  if (!boss.status) return 'Status is required.';
  if (boss.status === 'dead' && !boss.killedTime.trim()) return 'Killed time is required when status is dead.';

  return '';
};

const ManageBossTimerPage: React.FC<ManageBossTimerPageProps> = ({ userType }) => {
  const { bosses, loading, error, addBoss, updateBoss, deleteBoss } = useFirestoreBossInfo();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editingBoss, setEditingBoss] = useState<BossInfo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeadModal, setShowDeadModal] = useState<BossInfo | null>(null);
  const [deadTimeInput, setDeadTimeInput] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newBoss, setNewBoss] = useState<BossInfo>({ ...defaultBoss });
  const [addFormError, setAddFormError] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [statusTick, setStatusTick] = useState(0);
  const bossesRef = useRef<BossInfo[]>([]);
  const isPromotingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusTick((current) => current + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bossesRef.current = bosses;
  }, [bosses]);

  useEffect(() => {
    const promoteDeadBossesToAlive = async () => {
      if (isPromotingRef.current) return;

      const now = getPhilippinesNowDate();
      const nowIso = getPhilippinesNowIsoString();
      const deadScheduledBossIdsMissingKilledTime = bossesRef.current
        .filter((boss) => {
          if (!boss.id) return false;
          if (getPersistedBossStatus(boss) !== 'dead') return false;
          if (boss.spawnType !== 'scheduled') return false;
          if (!boss.killedTime) return true;
          const killedDate = new Date(boss.killedTime);
          return Number.isNaN(killedDate.getTime());
        })
        .map((boss) => boss.id as string);

      const bossIdsToPromote = bossesRef.current
        .filter((boss) => {
          if (!boss.id) return false;
          if (getPersistedBossStatus(boss) !== 'dead') return false;
          const nextRespawn = getNextRespawnDate(boss);
          if (!nextRespawn) return false;
          return nextRespawn.getTime() <= now.getTime();
        })
        .map((boss) => boss.id as string);

      if (deadScheduledBossIdsMissingKilledTime.length === 0 && bossIdsToPromote.length === 0) return;

      try {
        isPromotingRef.current = true;
        if (deadScheduledBossIdsMissingKilledTime.length > 0) {
          await Promise.all(
            deadScheduledBossIdsMissingKilledTime.map((bossId) =>
              updateBoss(bossId, { killedTime: nowIso })
            )
          );
        }

        await Promise.all(
          bossIdsToPromote.map((bossId) => updateBoss(bossId, { status: 'alive' }))
        );
      } catch (promotionError) {
        console.error('Failed to promote dead bosses to alive:', promotionError);
      } finally {
        isPromotingRef.current = false;
      }
    };

    const interval = setInterval(() => {
      void promoteDeadBossesToAlive();
    }, 5000);

    void promoteDeadBossesToAlive();

    return () => clearInterval(interval);
  }, [updateBoss]);

  const filteredBosses = useMemo(() => {
    void statusTick;
    return bosses
      .filter((boss) =>
        boss.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((boss) => (statusFilter ? getDisplayBossStatus(boss) === statusFilter : true))
      .filter((boss) => (typeFilter ? boss.bossType === typeFilter : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [bosses, searchQuery, statusFilter, typeFilter, statusTick]);

  const deletingBoss = useMemo(
    () => (showDeleteConfirm ? bosses.find((boss) => boss.id === showDeleteConfirm) : undefined),
    [bosses, showDeleteConfirm]
  );

  const handleAddBoss = async () => {
    const validationError = validateBossForm(newBoss);
    if (validationError) {
      setAddFormError(validationError);
      return;
    }

    try {
      setAddFormError('');
      setSaving(true);
      const payload = normalizeBossPayload(newBoss);
      await addBoss(payload);
      setShowAddModal(false);
      setNewBoss({ ...defaultBoss });
    } catch (err) {
      console.error('Failed to add boss:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBoss = async (boss: BossInfo) => {
    if (!boss.id) return;

    const validationError = validateBossForm(boss);
    if (validationError) {
      setEditFormError(validationError);
      return;
    }

    try {
      setEditFormError('');
      setSaving(true);
      const updates = normalizeBossPayload(boss);
      delete updates.id;
      await updateBoss(boss.id, updates);
      setEditingBoss(null);
    } catch (err) {
      console.error('Failed to save boss:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBoss = async (bossId: string) => {
    try {
      setSaving(true);
      await deleteBoss(bossId);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete boss:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsDead = async (boss: BossInfo) => {
    const now = getPhilippinesNow();
    setDeadTimeInput(now.slice(0, 16));
    setShowDeadModal(boss);
  };

  const handleConfirmDead = async () => {
    if (!showDeadModal?.id) return;
    try {
      setSaving(true);
      await updateBoss(showDeadModal.id, {
        status: 'dead',
        killedTime: toPhilippinesDateTimeFromLocal(deadTimeInput),
      });
      setShowDeadModal(null);
    } catch (err) {
      console.error('Failed to mark boss as dead:', err);
    } finally {
      setSaving(false);
    }
  };

  if (userType !== 'admin') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Manage Boss Timers</h2>
          <p className="page-subtitle">Admin access required</p>
        </div>
        <div className="error-state">
          <p>Access denied. Please sign in as admin to manage boss timers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Manage Boss Timers</h2>
        <p className="page-subtitle">Create, update, and track boss spawn statuses</p>
      </div>

      <div className="rankings-filters boss-filters">
        <div className="boss-search-box">
          <input
            className="boss-search-input"
            placeholder="Search boss name"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="boss-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear boss search"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        <select
          className="filter-select"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        >
          <option value="">All Types</option>
          <option value="Field Boss">Field Boss</option>
          <option value="Destroyer">Destroyer</option>
          <option value="Guild Boss">Guild Boss</option>
        </select>
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All</option>
          <option value="alive">Alive</option>
          <option value="respawning">Respawning</option>
          <option value="dead">Dead</option>
        </select>
        <button className="refresh-btn-filter" onClick={() => setShowAddModal(true)}>
          <Plus size={16} strokeWidth={1.8} />
          Add Boss
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading bosses... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      <div className="rankings-table-container">
        <table className="rankings-table boss-table">
          <thead>
            <tr>
              <th className="col-image">Image</th>
              <th className="col-name">Name</th>
              <th className="col-spawn">Spawn Time</th>
              <th className="col-next">Next Respawn</th>
              <th className="col-status">Status</th>
              <th className="col-killed">Killed Time</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBosses.sort((a, b) => {
              const bossTypeOrder = { 'Field Boss': 0, 'Destroyer': 1, 'Guild Boss': 2 };
              const typeA = bossTypeOrder[a.bossType as keyof typeof bossTypeOrder] ?? 3;
              const typeB = bossTypeOrder[b.bossType as keyof typeof bossTypeOrder] ?? 3;
              
              if (typeA !== typeB) {
                return typeA - typeB;
              }
              
              return a.level - b.level;
            }).map((boss) => {
              const displayStatus = getDisplayBossStatus(boss);
              const persistedStatus = getPersistedBossStatus(boss);

              return (
              <tr key={boss.id}>
                <td className="col-image">
                  <img className="boss-table-image" src={boss.bossImage} alt={boss.name} />
                </td>
                <td className="col-name">
                  <span 
                    className={`boss-name-text ${boss.bossType === 'Destroyer' ? 'boss-name-text-destroyer' : ''}`}
                  >
                    {boss.name}
                  </span>
                  <span className="boss-level-text">Level {boss.level}</span>
                </td>
                <td className="col-spawn">
                  {boss.spawnType === 'scheduled'
                    ? renderScheduleLinesForBoss(boss)
                    : `${boss.spawnTime}h`}
                </td>
                <td className="col-next">
                  {boss.spawnType === 'scheduled'
                    ? getNextSpawnTime(boss) || 'N/A'
                    : (persistedStatus === 'dead' ? getNextSpawnTime(boss) || 'N/A' : '')}
                </td>
                <td className="col-status">
                  <span className={`status-badge status-${displayStatus}`}>
                    {displayStatus}
                  </span>
                </td>
                <td className="col-killed">
                  {persistedStatus === 'dead' ? formatKilledTime(boss.killedTime) || 'N/A' : ''}
                </td>
                <td className="col-actions">
                  <button
                    className="action-btn edit-btn"
                    onClick={() => setEditingBoss(withDefaultSpawnType(boss))}
                    title="Edit boss"
                    disabled={saving}
                  >
                    <Pencil size={16} strokeWidth={1.8} />
                  </button>
                  <button
                    className="action-btn dead-btn"
                    onClick={() => handleMarkAsDead(boss)}
                    title="Mark as dead"
                    disabled={saving || persistedStatus === 'dead'}
                  >
                    <Skull size={16} strokeWidth={1.8} />
                  </button>
                  <button
                    className="action-btn delete-btn"
                    onClick={() => boss.id && setShowDeleteConfirm(boss.id)}
                    title="Delete boss"
                    disabled={saving}
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content boss-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Boss</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowAddModal(false);
                  setAddFormError('');
                }}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              {addFormError && <p className="boss-modal-error">{addFormError}</p>}
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={newBoss.name}
                    onChange={(event) => setNewBoss({ ...newBoss, name: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={newBoss.bossType}
                    onChange={(event) => setNewBoss({ ...newBoss, bossType: event.target.value as BossType })}
                  >
                    <option value="Field Boss">Field Boss</option>
                    <option value="Destroyer">Destroyer</option>
                    <option value="Guild Boss">Guild Boss</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Level</label>
                  <input
                    type="number"
                    value={newBoss.level}
                    onChange={(event) => setNewBoss({ ...newBoss, level: Number(event.target.value) || 1 })}
                  />
                </div>
                <div className="form-group">
                  <label>Spawn Type</label>
                  <select
                    value={newBoss.spawnType}
                    onChange={(event) => {
                      const nextType = event.target.value as SpawnType;
                      setNewBoss({
                        ...newBoss,
                        spawnType: nextType,
                        ...(nextType === 'fixed'
                          ? {
                              scheduledStart: '',
                              scheduledEnd: '',
                              scheduledStartDay: '',
                              scheduledStartTime: '',
                              scheduledEndDay: '',
                              scheduledEndTime: '',
                            }
                          : {}),
                      });
                    }}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                {newBoss.spawnType === 'fixed' ? (
                  <div className="form-group">
                    <label>Spawn Time (Hours)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      step={1}
                      value={newBoss.spawnTime}
                      onChange={(event) => setNewBoss({ ...newBoss, spawnTime: event.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    {newBoss.bossType === 'Destroyer' ? (
                      <>
                        <div className="form-group">
                          <label>Spawn Time 1</label>
                          <select
                            value={newBoss.scheduledStartTime || ''}
                            onChange={(event) =>
                              setNewBoss({ ...newBoss, scheduledStartTime: event.target.value })
                            }
                          >
                            <option value="">Select time</option>
                            {TIME_OPTIONS.map((time) => (
                              <option key={time} value={time}>
                                {formatTimeLabel(time)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Spawn Time 2</label>
                          <select
                            value={newBoss.scheduledEndTime || ''}
                            onChange={(event) =>
                              setNewBoss({ ...newBoss, scheduledEndTime: event.target.value })
                            }
                          >
                            <option value="">Select time</option>
                            {TIME_OPTIONS.map((time) => (
                              <option key={time} value={time}>
                                {formatTimeLabel(time)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label>Spawn Time 1</label>
                          <div className="spawn-time-selects">
                            <select
                              value={newBoss.scheduledStartDay || ''}
                              onChange={(event) =>
                                setNewBoss({ ...newBoss, scheduledStartDay: event.target.value })
                              }
                            >
                              <option value="">Select day</option>
                              {WEEKDAYS.map((day) => (
                                <option key={day} value={day}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            <select
                              value={newBoss.scheduledStartTime || ''}
                              onChange={(event) =>
                                setNewBoss({ ...newBoss, scheduledStartTime: event.target.value })
                              }
                            >
                              <option value="">Select time</option>
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {formatTimeLabel(time)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Spawn Time 2</label>
                          <div className="spawn-time-selects">
                            <select
                              value={newBoss.scheduledEndDay || ''}
                              onChange={(event) =>
                                setNewBoss({ ...newBoss, scheduledEndDay: event.target.value })
                              }
                            >
                              <option value="">Select day</option>
                              {WEEKDAYS.map((day) => (
                                <option key={day} value={day}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            <select
                              value={newBoss.scheduledEndTime || ''}
                              onChange={(event) =>
                                setNewBoss({ ...newBoss, scheduledEndTime: event.target.value })
                              }
                            >
                              <option value="">Select time</option>
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {formatTimeLabel(time)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="form-group">
                  <label>Spawn Region</label>
                  <input
                    type="text"
                    value={newBoss.spawnRegion}
                    onChange={(event) => setNewBoss({ ...newBoss, spawnRegion: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Boss Image</label>
                  <input
                    type="text"
                    value={newBoss.bossImage}
                    onChange={(event) => setNewBoss({ ...newBoss, bossImage: event.target.value })}
                  />
                  {newBoss.bossImage && (
                    <div className="image-preview">
                      <img src={newBoss.bossImage} alt="Boss preview" />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={newBoss.status}
                    onChange={(event) => setNewBoss({ ...newBoss, status: event.target.value })}
                  >
                    <option value="alive">Alive</option>
                    <option value="dead">Dead</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Killed Time (PH)</label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DDTHH:mm:ss+08:00"
                    value={newBoss.killedTime}
                    onChange={(event) => setNewBoss({ ...newBoss, killedTime: event.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAddModal(false);
                  setAddFormError('');
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleAddBoss} disabled={saving}>
                Save Boss
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBoss && (
        <div className="modal-overlay" onClick={() => setEditingBoss(null)}>
          <div className="modal-content boss-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Boss</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setEditingBoss(null);
                  setEditFormError('');
                }}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              {editFormError && <p className="boss-modal-error">{editFormError}</p>}
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editingBoss.name}
                    onChange={(event) => setEditingBoss({ ...editingBoss, name: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={editingBoss.bossType}
                    onChange={(event) => setEditingBoss({ ...editingBoss, bossType: event.target.value as BossType })}
                  >
                    <option value="Field Boss">Field Boss</option>
                    <option value="Destroyer">Destroyer</option>
                    <option value="Guild Boss">Guild Boss</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Level</label>
                  <input
                    type="number"
                    value={editingBoss.level}
                    onChange={(event) => setEditingBoss({ ...editingBoss, level: Number(event.target.value) || 1 })}
                  />
                </div>
                <div className="form-group">
                  <label>Spawn Type</label>
                  <select
                    value={editingBoss.spawnType}
                    onChange={(event) => {
                      const nextType = event.target.value as SpawnType;
                      setEditingBoss({
                        ...editingBoss,
                        spawnType: nextType,
                        ...(nextType === 'fixed'
                          ? {
                              scheduledStart: '',
                              scheduledEnd: '',
                              scheduledStartDay: '',
                              scheduledStartTime: '',
                              scheduledEndDay: '',
                              scheduledEndTime: '',
                            }
                          : {}),
                      });
                    }}
                  >
                    <option value="fixed">Fixed</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                {editingBoss.spawnType === 'fixed' ? (
                  <div className="form-group">
                    <label>Spawn Time (Hours)</label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      step={1}
                      value={editingBoss.spawnTime}
                      onChange={(event) => setEditingBoss({ ...editingBoss, spawnTime: event.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    {editingBoss.bossType === 'Destroyer' ? (
                      <>
                        <div className="form-group">
                          <label>Spawn Time 1</label>
                          <select
                            value={editingBoss.scheduledStartTime || ''}
                            onChange={(event) =>
                              setEditingBoss({ ...editingBoss, scheduledStartTime: event.target.value })
                            }
                          >
                            <option value="">Select time</option>
                            {TIME_OPTIONS.map((time) => (
                              <option key={time} value={time}>
                                {formatTimeLabel(time)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Spawn Time 2</label>
                          <select
                            value={editingBoss.scheduledEndTime || ''}
                            onChange={(event) =>
                              setEditingBoss({ ...editingBoss, scheduledEndTime: event.target.value })
                            }
                          >
                            <option value="">Select time</option>
                            {TIME_OPTIONS.map((time) => (
                              <option key={time} value={time}>
                                {formatTimeLabel(time)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label>Spawn Time 1</label>
                          <div className="spawn-time-selects">
                            <select
                              value={editingBoss.scheduledStartDay || ''}
                              onChange={(event) =>
                                setEditingBoss({ ...editingBoss, scheduledStartDay: event.target.value })
                              }
                            >
                              <option value="">Select day</option>
                              {WEEKDAYS.map((day) => (
                                <option key={day} value={day}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editingBoss.scheduledStartTime || ''}
                              onChange={(event) =>
                                setEditingBoss({ ...editingBoss, scheduledStartTime: event.target.value })
                              }
                            >
                              <option value="">Select time</option>
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {formatTimeLabel(time)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Spawn Time 2</label>
                          <div className="spawn-time-selects">
                            <select
                              value={editingBoss.scheduledEndDay || ''}
                              onChange={(event) =>
                                setEditingBoss({ ...editingBoss, scheduledEndDay: event.target.value })
                              }
                            >
                              <option value="">Select day</option>
                              {WEEKDAYS.map((day) => (
                                <option key={day} value={day}>
                                  {day}
                                </option>
                              ))}
                            </select>
                            <select
                              value={editingBoss.scheduledEndTime || ''}
                              onChange={(event) =>
                                setEditingBoss({ ...editingBoss, scheduledEndTime: event.target.value })
                              }
                            >
                              <option value="">Select time</option>
                              {TIME_OPTIONS.map((time) => (
                                <option key={time} value={time}>
                                  {formatTimeLabel(time)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="form-group">
                  <label>Spawn Region</label>
                  <input
                    type="text"
                    value={editingBoss.spawnRegion}
                    onChange={(event) => setEditingBoss({ ...editingBoss, spawnRegion: event.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Boss Image</label>
                  <input
                    type="text"
                    value={editingBoss.bossImage}
                    onChange={(event) => setEditingBoss({ ...editingBoss, bossImage: event.target.value })}
                  />
                  {editingBoss.bossImage && (
                    <div className="image-preview">
                      <img src={editingBoss.bossImage} alt="Boss preview" />
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingBoss.status}
                    onChange={(event) => setEditingBoss({ ...editingBoss, status: event.target.value })}
                  >
                    <option value="alive">Alive</option>
                    <option value="dead">Dead</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Killed Time (PH)</label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DDTHH:mm:ss+08:00"
                    value={editingBoss.killedTime}
                    onChange={(event) => setEditingBoss({ ...editingBoss, killedTime: event.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setEditingBoss(null);
                  setEditFormError('');
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={() => handleSaveBoss(editingBoss)} disabled={saving}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Boss</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete{' '}
                <span
                  className={`delete-boss-name ${deletingBoss?.bossType === 'Destroyer' ? 'delete-boss-name-destroyer' : 'delete-boss-name-field'}`}
                >
                  {deletingBoss?.name}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDeleteBoss(showDeleteConfirm)}
                disabled={saving}
              >
                Delete Boss
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeadModal && (
        <div className="modal-overlay" onClick={() => setShowDeadModal(null)}>
          <div className="modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Mark as Dead</h3>
              <button className="modal-close" onClick={() => setShowDeadModal(null)} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Kill Time (PH)</label>
                <input
                  type="datetime-local"
                  value={deadTimeInput}
                  onChange={(event) => setDeadTimeInput(event.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeadModal(null)} disabled={saving}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleConfirmDead} disabled={saving || !deadTimeInput}>
                Mark as Dead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageBossTimerPage;
