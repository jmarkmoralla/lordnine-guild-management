import '../styles/Dashboard.css';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { useFirestoreGuildInfo } from '../hooks/useFirestoreGuildInfo';
import { Trophy, Users } from 'lucide-react';
import { useMemo } from 'react';
import { MEMBER_CLASSES, getMemberClassIconPath, type MemberClass } from '../utils/memberClass';
import { useAttendanceSummary } from '../contexts/AttendanceSummaryContext';
import { useAttendanceParticipation } from '../contexts/ParticipationContext';

interface DashboardPageProps {
  userName?: string;
}

const MAX_GUILD_CAPACITY = 50;

const formatToday = () => {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const GUILD_COLORS: Record<string, string> = {
  G1: '#4a90e2',
  G2: '#f1c40f',
  G3: '#2ecc71',
};

const CLASS_COLORS: Record<string, string> = {
  'Bare Hands': '#2ecc71',
  'Battle Shield': '#8d6e63',
  'Battle Staff': '#9b59b6',
  'Bow': '#e74c3c',
  'Crossbow': '#f39c12',
  'Dual Daggers': '#3498db',
  'Staff': '#e84393',
  'Sword and Shield': '#78909c',
  'Greatsword': '#1a237e',
};

const BAR_COLORS = ['#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6'];

const GuildPieChart: React.FC<{ ratio: number; color: string }> = ({ ratio, color }) => {
  const size = 48;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const clamped = Math.min(ratio, 1);
  const percent = Math.round(clamped * 100);

  if (clamped === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="var(--bg-tertiary)" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">
          0%
        </text>
      </svg>
    );
  }

  if (clamped >= 1) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill={color} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
          100%
        </text>
      </svg>
    );
  }

  const angle = clamped * 360;
  const radians = ((angle - 90) * Math.PI) / 180;
  const x = cx + r * Math.cos(radians);
  const y = cy + r * Math.sin(radians);
  const largeArc = angle > 180 ? 1 : 0;

  const path = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="var(--bg-tertiary)" />
      <path d={path} fill={color} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
        {percent}%
      </text>
    </svg>
  );
};

const ClassPieChart: React.FC<{ entries: Array<{ cls: string; count: number }>; total: number }> = ({ entries, total }) => {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="var(--bg-tertiary)" />
      </svg>
    );
  }

  const slices: Array<{ d: string; fill: string; cls: string }> = [];
  let currentAngle = -90;

  entries.forEach((entry) => {
    const sliceAngle = (entry.count / total) * 360;
    const startRad = (currentAngle * Math.PI) / 180;
    const endRad = ((currentAngle + sliceAngle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = sliceAngle > 180 ? 1 : 0;

    slices.push({
      d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      fill: CLASS_COLORS[entry.cls] ?? '#aaa',
      cls: entry.cls,
    });

    currentAngle += sliceAngle;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s) => <path key={s.cls} d={s.d} fill={s.fill} />)}
    </svg>
  );
};

const DashboardPage: React.FC<DashboardPageProps> = ({ userName }) => {
  const { members } = useFirestoreMembers();
  const { summaryRows } = useAttendanceSummary();
  const { totalSessions } = useAttendanceParticipation();
  const { guildInfo } = useFirestoreGuildInfo();

  const guildEntries = useMemo(() => {
    const guildMap = new Map<string, number>();
    members.forEach((m) => {
      if (m.guildName.trim()) {
        guildMap.set(m.guildName.trim(), (guildMap.get(m.guildName.trim()) ?? 0) + 1);
      }
    });
    return [...guildMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, count], index) => ({ label: `G${index + 1}`, count }));
  }, [members]);

  const guildAttendance = useMemo(() => {
    const map = new Map<string, number>();

    summaryRows.forEach((row) => {
      const member = members.find((m) => m.name === row.name);
      const guildName = member?.guildName?.trim();
      if (!guildName) return;

      const current = map.get(guildName) ?? 0;
      map.set(guildName, current + row.fieldBossCount);
    });

    const totalAllGuilds = [...map.values()].reduce((s, v) => s + v, 0);

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, total], i) => ({
        label: `G${i + 1}`,
        pct: totalAllGuilds > 0 ? +(((total / totalAllGuilds) * 100).toFixed(1)) : 0,
      }));
  }, [summaryRows, members]);

  const topAttendees = useMemo(() => {
    return summaryRows
      .map((row) => {
        const member = members.find((m) => m.name === row.name);
        return { ...row, guildName: member?.guildName ?? '—' };
      })
      .filter((row) => totalSessions > 0 && (row.totalEventsAttended ?? 0) >= totalSessions && (row.totalAttendance ?? 0) > 0)
      .sort((a, b) => (b.totalAttendance ?? 0) - (a.totalAttendance ?? 0))
      .slice(0, 10);
  }, [summaryRows, members, totalSessions]);

  const maxAttended = useMemo(() => topAttendees[0]?.totalAttendance ?? 1, [topAttendees]);

  const classCounts = useMemo(() => {
    const map = new Map<MemberClass, number>();
    members.forEach((m) => map.set(m.playerClass, (map.get(m.playerClass) ?? 0) + 1));
    return MEMBER_CLASSES
      .map((cls) => ({ cls, count: map.get(cls) ?? 0 }))
      .filter((e) => e.count > 0);
  }, [members]);

  const totalClassMembers = useMemo(() => classCounts.reduce((s, e) => s + e.count, 0), [classCounts]);

  const topCPMembers = useMemo(() => {
    return [...members]
      .filter((m) => m.status === 'active')
      .sort((a, b) => b.combatPower - a.combatPower)
      .slice(0, 3);
  }, [members]);

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p className="page-subtitle">Welcome to Guild Dashboard</p>
      </div>
      {userName && (
        <div className="dashboard-welcome">
          <img src="/assets/images/Avatar.png" alt="Avatar" className="dashboard-avatar" />
          <div className="dashboard-welcome-text-wrap">
            <p className="dashboard-welcome-text">Welcome back, Lord <span className="dashboard-user-name">{userName}</span>!</p>
            <span className="dashboard-date">{formatToday()}</span>
          </div>
        </div>
      )}
      <div className="dashboard-content">
        <div className="dashboard-left">
          <section className="guild-capacity-section">
            <h3 className="guild-capacity-heading">Guilds</h3>
            <div className="guild-capacity-grid">
              {guildEntries.map((guild) => {
                const available = MAX_GUILD_CAPACITY - guild.count;
                return (
                  <div className="guild-kpi-card" key={guild.label}>
                    <div className="guild-kpi-left">
                      <div
                        className="guild-kpi-icon"
                        aria-hidden="true"
                        style={{ '--guild-color': GUILD_COLORS[guild.label] ?? '#4a90e2' } as React.CSSProperties}
                      >
                        <Users size={24} strokeWidth={1.75} />
                      </div>
                      <div className="guild-kpi-content">
                        <h3>{guild.label}</h3>
                        <p className="guild-kpi-count">{guild.count}/{MAX_GUILD_CAPACITY}</p>
                        <p className="guild-kpi-available">
                          {available === 0 ? 'Full' : `${available} slot${available !== 1 ? 's' : ''} available`}
                        </p>
                      </div>
                    </div>
                    <GuildPieChart ratio={guild.count / MAX_GUILD_CAPACITY} color={GUILD_COLORS[guild.label] ?? '#4a90e2'} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="attendance-section">
            <h3 className="guild-capacity-heading">Attendance</h3>

            <div className="attendance-subsection">
              <h4 className="attendance-subheading">Field Boss Participation</h4>
              {guildAttendance.length > 0 ? (
                <div className="attendance-bar-chart">
                  {guildAttendance.map((g) => (
                    <div key={g.label} className="attendance-bar-row">
                      <span className="attendance-bar-label">{g.label}</span>
                      <div className="attendance-bar-track">
                        <div className="attendance-bar-fill" style={{ width: `${g.pct}%` }} />
                      </div>
                      <span className="attendance-bar-value">{g.pct}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-placeholder">No field boss participation data yet.</p>
              )}
            </div>

            <div className="attendance-details-row">
              <div className="attendance-top-attendees">
                <div className="top-attendee-header">
                  <h4 className="attendance-subheading">Top Attendees</h4>
                  <span className="top-attendee-total-events">Total Bosses: {totalSessions}</span>
                </div>
                {topAttendees.length > 0 ? (
                  <div className="top-attendee-chart">
                    {topAttendees.map((row, i) => (
                      <div key={row.id} className="top-attendee-bar-wrap">
                        <div className="top-attendee-bar-container">
                          <div
                            className="top-attendee-bar"
                            style={{
                              height: `${((row.totalAttendance ?? 0) / maxAttended) * 100}%`,
                              background: BAR_COLORS[i] ?? '#aaa',
                            }}
                          />
                        </div>
                        <span className="top-attendee-bar-name">
                          {row.name.length > 10 ? row.name.slice(0, 5) + '…' : row.name}
                        </span>
                        <span className="top-attendee-bar-points">{row.totalAttendance.toLocaleString()} pts</span>
                        <span className="top-attendee-bar-events">{row.totalEventsAttended}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="section-placeholder">No attendance data yet.</p>
                )}
              </div>

              <section className="treasury-section">
                <h4 className="treasury-heading">Treasury</h4>
                <div className="treasury-card">
                  <span className="treasury-label">Total Fund</span>
                  <span className="treasury-value">
                    ${guildInfo?.totalFund?.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) ?? '—'}
                  </span>
                </div>
                <div className="treasury-card">
                  <span className="treasury-label">Attendance Share (90%)</span>
                  <span className="treasury-value">
                    ${guildInfo?.totalFund ? (guildInfo.totalFund * 0.9).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                  </span>
                </div>
                <div className="treasury-card">
                  <span className="treasury-label">Management Share (10%)</span>
                  <span className="treasury-value">
                    ${guildInfo?.totalFund ? (guildInfo.totalFund * 0.1).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                  </span>
                </div>
              </section>
            </div>
          </section>

          <section className="top-cp-section">
            <h3 className="guild-capacity-heading">Rankers</h3>
            <div className="top-cp-list">
              {topCPMembers.map((member, _) => (
                <div key={member.name} className="top-cp-row">
                  <span className="top-cp-rank"><Trophy size={18} strokeWidth={2} /></span>
                  <span className="top-cp-name">{member.name}</span>
                  <span className="top-cp-value">{member.combatPower.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="dashboard-right">
          <section className="class-section">
            <h3 className="guild-capacity-heading">Member Classes</h3>
            <p className="section-subtitle">Breakdown of all member classes.</p>
            <div className="class-list">
              {classCounts.map(({ cls, count }) => (
                <div key={cls} className="class-row">
                  <img src={getMemberClassIconPath(cls)} alt={cls} className="class-icon" />
                  <span className="class-name">{cls}</span>
                  <span className="class-count">{count}</span>
                </div>
              ))}
            </div>
          </section>

          {classCounts.length > 0 && (
            <section className="pie-section">
              <h3 className="guild-capacity-heading">Member Class Chart</h3>
              <div className="class-pie-wrapper">
                <ClassPieChart entries={classCounts} total={totalClassMembers} />
                <div className="class-legend">
                  {classCounts.map(({ cls, count }) => (
                    <div key={cls} className="class-legend-item">
                      <span className="class-legend-dot" style={{ background: CLASS_COLORS[cls] ?? '#aaa' }} />
                      <span className="class-legend-name">{cls}</span>
                      <span className="class-legend-count">{Math.round((count / totalClassMembers) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

export default DashboardPage;
