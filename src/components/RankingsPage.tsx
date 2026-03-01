import { useState } from 'react';
import { Award, Loader } from 'lucide-react';
import '../styles/Rankings.css';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';

const RankingsPage: React.FC = () => {
  const { members, loading, error } = useFirestoreMembers();
  const [copiedWalletMemberId, setCopiedWalletMemberId] = useState<string | null>(null);

  const rankedMembers = [...members].sort((a, b) => b.combatPower - a.combatPower);

  const getCombatPowerMultiplier = (combatPower: number): number => {
    if (combatPower >= 100000) return 2.5;
    if (combatPower >= 90000) return 2.0;
    if (combatPower >= 80000) return 1.5;
    return 1.0;
  };

  const multiplierTiers = [
    { id: 'tier-1' as const, label: '>= 100,000', multiplier: 2.5 },
    { id: 'tier-2' as const, label: '90,000 – 99,999', multiplier: 2.0 },
    { id: 'tier-3' as const, label: '80,000 – 89,999', multiplier: 1.5 },
    { id: 'tier-4' as const, label: '<= 79,999', multiplier: 1.0 },
  ];

  const handleWalletAddressClick = async (memberId: string, walletAddress: string) => {
    if (!walletAddress.trim()) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedWalletMemberId(memberId);
      window.setTimeout(() => {
        setCopiedWalletMemberId((currentId) => (currentId === memberId ? null : currentId));
      }, 1200);
    } catch (clipboardError) {
      console.error('Failed to copy wallet address:', clipboardError);
    }
  };

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
        <h2>Guild Members</h2>
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
          <h3>Summary</h3>
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
              <span className="summary-value">{members.length}/50</span>
            </div>
          </div>

          <div className="multiplier-legend">
            <h4>Multiplier Legend</h4>
            <div className="multiplier-legend-grid" role="list" aria-label="Multiplier tiers">
              {multiplierTiers.map((tier) => (
                <div
                  key={tier.id}
                  role="listitem"
                  className="multiplier-legend-tier"
                >
                  <span className="multiplier-legend-tier-range">{tier.label}</span>
                  <span className="multiplier-legend-tier-value">{tier.multiplier.toFixed(1)}</span>
                </div>
              ))}
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
              <th className="col-wallet">Wallet Address</th>
              <th className="col-level">Level</th>
              <th className="col-combat">Combat Power</th>
              <th className="col-multiplier">Multiplier</th>
              <th className="col-status">Status</th>
              <th className="col-type">Type</th>
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
                <td className="col-wallet">
                  {member.walletAddress ? (
                    <button
                      type="button"
                      className="wallet-address-btn"
                      onClick={() => handleWalletAddressClick(member.id || String(member.rank), member.walletAddress)}
                      title="Click to copy wallet address"
                    >
                      {copiedWalletMemberId === (member.id || String(member.rank)) ? 'Copied!' : member.walletAddress}
                    </button>
                  ) : (
                    <span className="wallet-address-empty">—</span>
                  )}
                </td>
                <td className="col-level">
                  <span className="member-level">{member.level}</span>
                </td>
                <td className="col-combat">
                  <span className="combat-power">{member.combatPower.toLocaleString()}</span>
                </td>
                <td className="col-multiplier">
                  <span className="member-level">{getCombatPowerMultiplier(member.combatPower).toFixed(1)}</span>
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
