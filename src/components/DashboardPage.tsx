import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Crown, Trophy, Users, Loader, Clock3 } from 'lucide-react';
import '../styles/Dashboard.css';
import { useFirestoreActivities } from '../hooks/useFirestoreActivities';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { useFirestoreGuildInfo } from '../hooks/useFirestoreGuildInfo';
import { useFirestoreBossInfo } from '../hooks/useFirestoreBossInfo';
import type { BossInfo } from '../hooks/useFirestoreBossInfo';
import { formatPhilippinesMonthDayTime12, getPhilippinesNowDate } from '../utils/philippinesTime';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const RESPAWNING_WINDOW_MS = 10 * 60 * 1000;

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

  // For Destroyer scheduled timers, respawn/status transitions are driven by either timer reached.
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

const getNextScheduledOccurrence = (boss: BossInfo, referenceDate?: Date) => {
  if (boss.spawnType !== 'scheduled') return null;

  const candidates = getScheduledRespawnCandidates(boss, referenceDate);
  return candidates[0] ?? null;
};

const getNextRespawnDate = (boss: BossInfo) => {
  if (boss.spawnType === 'scheduled') {
    const isDead = boss.status === 'dead';
    const killedDate = boss.killedTime ? new Date(boss.killedTime) : null;
    const hasValidKilledDate = Boolean(killedDate && !Number.isNaN(killedDate.getTime()));

    if (isDead && hasValidKilledDate) {
      return getNextScheduledOccurrence(boss, killedDate as Date);
    }

    return getNextScheduledOccurrence(boss);
  }

  if (!boss.killedTime) return null;

  const spawnHours = Number(boss.spawnTime);
  if (Number.isNaN(spawnHours)) return null;

  const killedDate = new Date(boss.killedTime);
  if (Number.isNaN(killedDate.getTime())) return null;

  return new Date(killedDate.getTime() + spawnHours * 60 * 60 * 1000);
};

const compareByNextRespawn = (first: BossInfo, second: BossInfo) => {
  const firstRespawn = getNextRespawnDate(first);
  const secondRespawn = getNextRespawnDate(second);

  if (!firstRespawn && !secondRespawn) {
    return first.level - second.level;
  }

  if (!firstRespawn) return 1;
  if (!secondRespawn) return -1;

  const respawnDifference = firstRespawn.getTime() - secondRespawn.getTime();
  if (respawnDifference !== 0) return respawnDifference;

  return first.level - second.level;
};

const getNextSpawnTime = (boss: BossInfo): ReactNode => {
  if (boss.spawnType === 'scheduled') {
    const nextOccurrence = getNextScheduledOccurrence(boss);

    return nextOccurrence ? `Next Respawn: ${formatPhilippinesMonthDayTime12(nextOccurrence)}` : 'N/A';
  }

  if (!boss.killedTime) return 'N/A';

  const spawnHours = Number(boss.spawnTime);
  if (Number.isNaN(spawnHours)) return 'N/A';

  const killedDate = new Date(boss.killedTime);
  if (Number.isNaN(killedDate.getTime())) return 'N/A';

  const nextSpawn = new Date(killedDate.getTime() + spawnHours * 60 * 60 * 1000);
  return `Next Respawn: ${formatPhilippinesMonthDayTime12(nextSpawn)}`;
};

const getRespawnCountdown = (boss: BossInfo) => {
  const nextRespawn = getNextRespawnDate(boss);
  if (!nextRespawn) return 'N/A';

  const now = getPhilippinesNowDate();
  const remainingMs = Math.max(0, nextRespawn.getTime() - now.getTime());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const renderScheduledIndicator = (boss: BossInfo): ReactNode => {
  if (boss.spawnType !== 'scheduled') return null;

  return (
    <span className="boss-scheduled-indicator">
      <Clock3 size={12} strokeWidth={2} />
      Scheduled
    </span>
  );
};

const getDisplayBossStatus = (boss: BossInfo): 'alive' | 'dead' | 'respawning' | 'unknown' => {
  const persistedStatus = boss.status === 'alive' ? 'alive' : boss.status === 'unknown' ? 'unknown' : 'dead';
  if (persistedStatus === 'alive') return 'alive';
  if (persistedStatus === 'unknown') return 'unknown';

  const nextRespawnTime = getNextRespawnDate(boss);
  if (!nextRespawnTime) return 'dead';

  const now = getPhilippinesNowDate();
  const timeUntilRespawn = nextRespawnTime.getTime() - now.getTime();
  if (timeUntilRespawn <= 0) return 'alive';
  if (timeUntilRespawn <= RESPAWNING_WINDOW_MS) return 'respawning';
  return 'dead';
};

const getBossSpawnTimeLabel = (boss: BossInfo) => {
  if (boss.spawnType !== 'scheduled') return `${boss.spawnTime}h`;

  if (boss.bossType === 'Destroyer') {
    const first = boss.scheduledStartTime || '-';
    const second = boss.scheduledEndTime || '-';
    return `Daily ${first} / Daily ${second}`;
  }

  const firstDay = boss.scheduledStartDay || '-';
  const firstTime = boss.scheduledStartTime || '-';
  const secondDay = boss.scheduledEndDay || '-';
  const secondTime = boss.scheduledEndTime || '-';
  return `${firstDay} ${firstTime} / ${secondDay} ${secondTime}`;
};

const getBossDetailNextRespawn = (boss: BossInfo) => {
  if (getDisplayBossStatus(boss) === 'unknown') return '-';

  const nextRespawn = getNextRespawnDate(boss);
  if (!nextRespawn) return 'N/A';

  return formatPhilippinesMonthDayTime12(nextRespawn);
};

const getBossDetailSpawnType = (boss: BossInfo) => (boss.spawnType === 'scheduled' ? 'Scheduled' : 'Fixed');

const getBossDetailStatus = (boss: BossInfo) => {
  const status = getDisplayBossStatus(boss);

  if (status === 'respawning') return 'Respawning';
  if (status === 'alive') return 'Alive';
  if (status === 'dead') return 'Dead';
  return 'Unknown';
};

const DashboardPage: React.FC = () => {
  const { activities, loading, error } = useFirestoreActivities();
  const { members } = useFirestoreMembers();
  const { guildInfo, loading: guildLoading } = useFirestoreGuildInfo();
  const { bosses, loading: bossLoading } = useFirestoreBossInfo();
  const [, setStatusTick] = useState(0);
  const [selectedBoss, setSelectedBoss] = useState<BossInfo | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [tooltipPlacement, setTooltipPlacement] = useState<'top' | 'bottom'>('bottom');
  
  const guildMaster = members.find((member) => member.memberType === 'guild master');
  const recentActivities = activities.slice(0, 5);
  const aliveBosses = bosses
    .filter((boss) => getDisplayBossStatus(boss) === 'alive')
    .slice()
    .sort(compareByNextRespawn);
  const respawningBosses = bosses
    .filter((boss) => getDisplayBossStatus(boss) === 'respawning')
    .slice()
    .sort(compareByNextRespawn);
  const deadBosses = bosses
    .filter((boss) => getDisplayBossStatus(boss) === 'dead')
    .slice()
    .sort(compareByNextRespawn);
  const unknownBosses = bosses
    .filter((boss) => getDisplayBossStatus(boss) === 'unknown')
    .slice()
    .sort((first, second) => first.level - second.level);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusTick((current) => current + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedBoss(null);
        setTooltipPosition(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const openBossDetails = (boss: BossInfo, cardElement: HTMLElement) => {
    const rect = cardElement.getBoundingClientRect();
    const tooltipWidth = 520;
    const tooltipHeight = 320;
    const gap = 10;

    const initialTop = rect.bottom + gap;
    const shouldPlaceAbove = initialTop + tooltipHeight > window.innerHeight - 8;
    const top = initialTop + tooltipHeight > window.innerHeight - 8
      ? Math.max(8, rect.top - tooltipHeight - gap)
      : initialTop;

    const initialLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    const left = Math.min(
      Math.max(8, initialLeft),
      Math.max(8, window.innerWidth - tooltipWidth - 8)
    );

    setSelectedBoss(boss);
    setTooltipPosition({ top, left });
    setTooltipPlacement(shouldPlaceAbove ? 'top' : 'bottom');
  };

  const closeBossDetails = () => {
    setSelectedBoss(null);
    setTooltipPosition(null);
  };

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p className="page-subtitle">Welcome to Guild Dashboard</p>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true">
            <Users size={28} strokeWidth={1.75} />
          </div>
          <div className="stat-content">
            <h3>Guild Members</h3>
            <p className="stat-value">{members.length}/50</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true">
            <Trophy size={28} strokeWidth={1.75} />
          </div>
          <div className="stat-content">
            <h3>Guild Level</h3>
            <p className="stat-value">
              {guildLoading ? (
                <Loader size={20} className="spinner" />
              ) : guildInfo?.guildLevel !== undefined ? (
                guildInfo.guildLevel
              ) : (
                'N/A'
              )}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" aria-hidden="true">
            <Crown size={28} strokeWidth={1.75} />
          </div>
          <div className="stat-content">
            <h3>Guild Master</h3>
            <p className="stat-value">{guildMaster?.name || 'None'}</p>
          </div>
        </div>
      </div>

      <div className="boss-timers">
        <div className="boss-header">
          <h3>BOSS TIMERS</h3>
          <span className="boss-count">{bosses.length} total</span>
        </div>
        {bossLoading && (
          <div className="loading-state">
            <p>Loading bosses... <Loader size={16} strokeWidth={1.8} /></p>
          </div>
        )}
        {!bossLoading && bosses.length === 0 && (
          <div className="empty-state">
            <p>No bosses configured</p>
          </div>
        )}
        {!bossLoading && bosses.length > 0 && (
          <div className="boss-groups">
            <div className="boss-group boss-group-alive">
              <div className="boss-group-header">
                <span className="boss-group-title">Alive</span>
                <span className="boss-group-count">{aliveBosses.length}</span>
              </div>
              <div className="boss-grid">
                {aliveBosses.map((boss) => (
                  <button
                    key={boss.id}
                    className={`boss-card ${selectedBoss?.id === boss.id ? 'boss-card-active' : ''}`}
                    type="button"
                    onClick={(event) => openBossDetails(boss, event.currentTarget)}
                  >
                    <div className="boss-countdown">{getRespawnCountdown(boss)}</div>
                    <img className="boss-image" src={boss.bossImage} alt={boss.name} />
                    <div className="boss-meta">
                      <span 
                        className={`boss-name ${boss.bossType === 'Destroyer' ? 'boss-name-destroyer' : boss.bossType === 'Guild Boss' ? 'boss-name-guild' : ''}`}
                      >
                        {boss.name}
                      </span>
                      <span className="boss-subtitle">Level {boss.level}</span>
                      {renderScheduledIndicator(boss)}
                    </div>
                  </button>
                ))}
                {aliveBosses.length === 0 && (
                  <div className="boss-empty">No alive bosses</div>
                )}
              </div>
            </div>

            <div className="boss-group boss-group-respawning">
              <div className="boss-group-header">
                <span className="boss-group-title">Respawning</span>
                <span className="boss-group-count">{respawningBosses.length}</span>
              </div>
              <div className="boss-grid">
                {respawningBosses.map((boss) => (
                  <button
                    key={boss.id}
                    className={`boss-card boss-card-respawning ${selectedBoss?.id === boss.id ? 'boss-card-active' : ''}`}
                    type="button"
                    onClick={(event) => openBossDetails(boss, event.currentTarget)}
                  >
                    <div className="boss-countdown">{getRespawnCountdown(boss)}</div>
                    <img className="boss-image" src={boss.bossImage} alt={boss.name} />
                    <div className="boss-meta">
                      <span 
                        className={`boss-name ${boss.bossType === 'Destroyer' ? 'boss-name-destroyer' : boss.bossType === 'Guild Boss' ? 'boss-name-guild' : ''}`}
                      >
                        {boss.name}
                      </span>
                      <span className="boss-subtitle">Level {boss.level}</span>
                      {renderScheduledIndicator(boss)}
                      <div className="boss-next-respawn">
                        {getNextSpawnTime(boss)}
                      </div>
                    </div>
                  </button>
                ))}
                {respawningBosses.length === 0 && (
                  <div className="boss-empty">No respawning bosses</div>
                )}
              </div>
            </div>

            <div className="boss-group boss-group-dead">
              <div className="boss-group-header">
                <span className="boss-group-title">Dead</span>
                <span className="boss-group-count">{deadBosses.length}</span>
              </div>
              <div className="boss-grid">
                {deadBosses.map((boss) => (
                  <button
                    key={boss.id}
                    className={`boss-card boss-card-dead ${selectedBoss?.id === boss.id ? 'boss-card-active' : ''}`}
                    type="button"
                    onClick={(event) => openBossDetails(boss, event.currentTarget)}
                  >
                    <div className="boss-countdown">{getRespawnCountdown(boss)}</div>
                    <img className="boss-image" src={boss.bossImage} alt={boss.name} />
                    <div className="boss-meta">
                      <span 
                        className={`boss-name ${boss.bossType === 'Destroyer' ? 'boss-name-destroyer' : boss.bossType === 'Guild Boss' ? 'boss-name-guild' : ''}`}
                      >
                        {boss.name}
                      </span>
                      <span className="boss-subtitle">Level {boss.level}</span>
                      {renderScheduledIndicator(boss)}
                      <div className="boss-next-respawn">
                        {getNextSpawnTime(boss)}
                      </div>
                    </div>
                  </button>
                ))}
                {deadBosses.length === 0 && (
                  <div className="boss-empty">No dead bosses</div>
                )}
              </div>
            </div>

            <div className="boss-group boss-group-unknown">
              <div className="boss-group-header">
                <span className="boss-group-title">Unknown</span>
                <span className="boss-group-count">{unknownBosses.length}</span>
              </div>
              <div className="boss-grid">
                {unknownBosses.map((boss) => (
                  <button
                    key={boss.id}
                    className={`boss-card boss-card-unknown ${selectedBoss?.id === boss.id ? 'boss-card-active' : ''}`}
                    type="button"
                    onClick={(event) => openBossDetails(boss, event.currentTarget)}
                  >
                    <div className="boss-countdown">00:00:00</div>
                    <img className="boss-image" src={boss.bossImage} alt={boss.name} />
                    <div className="boss-meta">
                      <span
                        className={`boss-name ${boss.bossType === 'Destroyer' ? 'boss-name-destroyer' : boss.bossType === 'Guild Boss' ? 'boss-name-guild' : ''}`}
                      >
                        {boss.name}
                      </span>
                      <span className="boss-subtitle">Level {boss.level}</span>
                      {renderScheduledIndicator(boss)}
                      <div className="boss-next-respawn">Next Respawn: ---</div>
                    </div>
                  </button>
                ))}
                {unknownBosses.length === 0 && (
                  <div className="boss-empty">No unknown bosses</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedBoss && tooltipPosition && (
        <div className="boss-tooltip-overlay" onClick={closeBossDetails}>
          <div
            className={`boss-tooltip-panel boss-tooltip-${tooltipPlacement}`}
            style={{ top: `${tooltipPosition.top}px`, left: `${tooltipPosition.left}px` }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="boss-tooltip-header">
              <h4>Boss Details</h4>
              <button
                type="button"
                className="boss-tooltip-close"
                onClick={closeBossDetails}
                aria-label="Close boss details"
              >
                ×
              </button>
            </div>

            <div className="boss-tooltip-main">
              <img className="boss-tooltip-image" src={selectedBoss.bossImage} alt={selectedBoss.name} />
              <div className="boss-tooltip-name-wrap">
                <div
                  className={`boss-tooltip-name ${selectedBoss.bossType === 'Destroyer' ? 'boss-tooltip-name-destroyer' : selectedBoss.bossType === 'Guild Boss' ? 'boss-tooltip-name-guild' : ''}`}
                >
                  {selectedBoss.name}
                </div>
                <div className="boss-tooltip-type">{selectedBoss.bossType}</div>
              </div>
            </div>

            <div className="boss-tooltip-grid">
              <div className="boss-tooltip-item"><span>Level</span><strong>{selectedBoss.level}</strong></div>
              <div className="boss-tooltip-item"><span>Spawn Type</span><strong>{getBossDetailSpawnType(selectedBoss)}</strong></div>
              <div className="boss-tooltip-item"><span>Spawn Time</span><strong>{getBossSpawnTimeLabel(selectedBoss)}</strong></div>
              <div className="boss-tooltip-item"><span>Spawn Region</span><strong>{selectedBoss.spawnRegion || 'N/A'}</strong></div>
              <div className="boss-tooltip-item"><span>Status</span><strong>{getBossDetailStatus(selectedBoss)}</strong></div>
              <div className="boss-tooltip-item"><span>Next Respawn</span><strong>{getBossDetailNextRespawn(selectedBoss)}</strong></div>
            </div>
          </div>
        </div>
      )}

      <div className="recent-activity">
        <h3>Recent Activities</h3>
        {loading && (
          <div className="loading-state">
            <p>Loading activities... <Loader size={16} strokeWidth={1.8} /></p>
          </div>
        )}
        {error && (
          <div className="error-state">
            <p>Error: {error}</p>
          </div>
        )}
        {!loading && recentActivities.length === 0 && (
          <div className="empty-state">
            <p>No recent activities</p>
          </div>
        )}
        {!loading && recentActivities.length > 0 && (
          <ul className="activity-list">
            {recentActivities.map((activity) => (
              <li key={activity.id} className="activity-item">
                <span className="activity-user">{activity.playerName}</span>
                <span className="activity-action">{activity.action}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
