import { useMemo, useState } from 'react';
import { Award, Loader, Search, SlidersHorizontal, X } from 'lucide-react';
import '../styles/Attendance.css';
import '../styles/Rankings.css';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { COMBAT_POWER_MULTIPLIER_TIERS, getCombatPowerMultiplier } from '../utils/combatPowerMultiplier.ts';
import { MEMBER_CLASSES, getMemberClassIconPath, type MemberClass } from '../utils/memberClass';

const RankingsPage: React.FC = () => {
  const { members, loading, error } = useFirestoreMembers();
  const [copiedWalletMemberId, setCopiedWalletMemberId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuildFilter, setSelectedGuildFilter] = useState('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<'all' | MemberClass>('all');
  const [showFilters, setShowFilters] = useState(false);

  const rankedMembers = [...members].sort((a, b) => b.combatPower - a.combatPower);
  const guildFilterOptions = useMemo(() => {
    const nextGuildNames = new Set<string>();

    members.forEach((member) => {
      if (member.guildName.trim()) nextGuildNames.add(member.guildName.trim());
    });

    return [...nextGuildNames].sort((first, second) => first.localeCompare(second));
  }, [members]);

  const hasActiveFilters = selectedGuildFilter !== 'all' || selectedClassFilter !== 'all';

  const filteredMembers = rankedMembers.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGuild = selectedGuildFilter === 'all' || member.guildName === selectedGuildFilter;
    const matchesClass = selectedClassFilter === 'all' || member.playerClass === selectedClassFilter;

    return matchesSearch && matchesGuild && matchesClass;
  });

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
        <section className="multiplier-legend" aria-labelledby="multiplier-legend-heading">
          <h4 id="multiplier-legend-heading">Multiplier Legend (Combat Power)</h4>
          <div className="multiplier-legend-grid" role="list" aria-label="Multiplier tiers">
            {COMBAT_POWER_MULTIPLIER_TIERS.map((tier) => (
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
        </section>
      )}

      {!loading && members.length > 0 && (
        <div className="rankings-filters" role="search">
          <div className="attendance-guest-search-box attendance-manage-search-box">
            <span className="attendance-guest-search-icon" aria-hidden="true">
              <Search size={14} strokeWidth={1.9} />
            </span>
            <input
              type="text"
              className="attendance-guest-search-input attendance-manage-search-input"
              placeholder="Search member..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search member"
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
          <button
            type="button"
            className={`refresh-btn-filter icon-only filter-toggle-btn${hasActiveFilters ? ' active' : ''}`}
            onClick={() => setShowFilters((current) => !current)}
            title="Filter members"
            aria-label="Filter members"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={16} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {!loading && members.length > 0 && showFilters && (
        <div className="rankings-filter-panel" aria-label="Member filters">
          <select
            className="filter-select"
            value={selectedGuildFilter}
            onChange={(event) => setSelectedGuildFilter(event.target.value)}
            aria-label="Filter members by guild"
          >
            <option value="all">All Guilds</option>
            {guildFilterOptions.map((guildName) => (
              <option key={guildName} value={guildName}>{guildName}</option>
            ))}
          </select>
          <select
            className="filter-select"
            value={selectedClassFilter}
            onChange={(event) => setSelectedClassFilter(event.target.value as 'all' | MemberClass)}
            aria-label="Filter members by class"
          >
            <option value="all">All Classes</option>
            {MEMBER_CLASSES.map((memberClass) => (
              <option key={memberClass} value={memberClass}>{memberClass}</option>
            ))}
          </select>
        </div>
      )}

      <div className="rankings-table-container">
        <table className="rankings-table">
          <thead>
            <tr>
              <th className="col-rank">Rank</th>
              <th className="col-name">Name</th>
              <th className="col-wallet">Wallet Address</th>
              <th className="col-class">Class</th>
              <th className="col-level">Level</th>
              <th className="col-combat">Combat Power</th>
              <th className="col-multiplier">Multiplier</th>
              <th className="col-guild">Guild</th>
              <th className="col-status">Status</th>
              <th className="col-type">Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member, index) => (
              <tr key={member.rank} className={`rank-row rank-${member.rank}`}>
                <td className="col-rank">
                  <span className="rank-badge">
                    {getMedalIcon(index) || index + 1}
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
                <td className="col-class">
                  <span className="member-class">
                    <img
                      src={getMemberClassIconPath(member.playerClass)}
                      alt={member.playerClass}
                      className="member-class-icon"
                      loading="lazy"
                    />
                  </span>
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
                <td className="col-guild">
                  <span className="member-level">{member.guildName || '—'}</span>
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
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={10} className="attendance-empty-row">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RankingsPage;
