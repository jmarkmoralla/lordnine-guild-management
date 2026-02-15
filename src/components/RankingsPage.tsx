import { Award, Loader } from 'lucide-react';
import '../styles/Rankings.css';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';

const RankingsPage: React.FC = () => {
  const { members, loading, error } = useFirestoreMembers();

  const rankedMembers = [...members].sort((a, b) => b.combatPower - a.combatPower);

  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Award className="rank-medal rank-medal-1" size={18} strokeWidth={1.8} />;
      case 1:
        return <Award className="rank-medal rank-medal-2" size={18} strokeWidth={1.8} />;
      case 2:
        return <Award className="rank-medal rank-medal-3" size={18} strokeWidth={1.8} />;
      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Guild Member Rankings</h2>
        <p className="page-subtitle">Member rankings by combat power and level</p>
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading guild members... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && members.length > 0 && (
        <div className="rankings-stats">
          <h3>Rankings Summary</h3>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-title">Highest Combat Power</span>
              <span className="summary-value">{members[0].combatPower.toLocaleString()}</span>
            </div>
            <div className="summary-card">
              <span className="summary-title">Average Combat Power</span>
              <span className="summary-value">
                {Math.round(
                  members.reduce((sum, m) => sum + m.combatPower, 0) / members.length
                ).toLocaleString()}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-title">Total Members</span>
              <span className="summary-value">{members.length}</span>
            </div>
            <div className="summary-card">
              <span className="summary-title">Highest Level</span>
              <span className="summary-value">{members[0].level}</span>
            </div>
          </div>
        </div>
      )}

      <div className="rankings-table-container">
        <table className="rankings-table">
          <thead>
            <tr>
              <th className="col-rank">Rank</th>
              <th className="col-name">Name</th>
              <th className="col-level">Level</th>
              <th className="col-combat">Combat Power</th>
              <th className="col-status">Status</th>
              <th className="col-type">Member Type</th>
            </tr>
          </thead>
          <tbody>
            {rankedMembers.map((member, index) => (
              <tr key={member.rank} className={`rank-row rank-${member.rank}`}>
                <td className="col-rank">
                  <span className="rank-badge">
                    {getMedalIcon(index) || member.rank}
                  </span>
                </td>
                <td className="col-name">
                  <span className="member-name">{member.name}</span>
                </td>
                <td className="col-level">
                  <span className="member-level">{member.level}</span>
                </td>
                <td className="col-combat">
                  <span className="combat-power">{member.combatPower.toLocaleString()}</span>
                </td>
                <td className="col-status">
                  <span className={`status-badge status-${member.status}`}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </span>
                </td>
                <td className="col-type">
                  <span className="member-type">{member.memberType}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RankingsPage;
