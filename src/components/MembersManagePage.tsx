import { useState } from 'react';
import { Award, Loader, Pencil, Plus, Trash2, X } from 'lucide-react';
import '../styles/Rankings.css';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';

interface MemberRanking {
  id?: string;
  rank: number;
  name: string;
  walletAddress: string;
  level: number;
  combatPower: number;
  status: 'active' | 'inactive';
  memberType: 'guild master' | 'elite' | 'normal';
}

interface MembersManagePageProps {
  userType: 'guest' | 'admin';
}

const MembersManagePage: React.FC<MembersManagePageProps> = ({ userType }) => {
  const { members, loading, error, addMember, updateMember, deleteMember } = useFirestoreMembers();
  const [editingMember, setEditingMember] = useState<MemberRanking | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedWalletMemberId, setCopiedWalletMemberId] = useState<string | null>(null);
  const [sortBy] = useState<'combatPower'>('combatPower');
  const [searchQuery, setSearchQuery] = useState('');

  const sortedMembers = [...members].sort((a, b) => {
    if (sortBy === 'combatPower') return b.combatPower - a.combatPower;
    return 0;
  });

  const filteredMembers = sortedMembers.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const getCombatPowerMultiplier = (combatPower: number): number => {
    if (combatPower >= 100000) return 2.5;
    if (combatPower >= 90000) return 2.0;
    if (combatPower >= 80000) return 1.5;
    return 1.0;
  };

  const [newMember, setNewMember] = useState<MemberRanking>({
    rank: 1,
    name: '',
    walletAddress: '',
    level: 1,
    combatPower: 0,
    status: 'active',
    memberType: 'normal',
  });

  const openAddModal = () => {
    setNewMember({
      rank: 1,
      name: '',
      walletAddress: '',
      level: 1,
      combatPower: 0,
      status: 'active',
      memberType: 'normal',
    });
    setShowAddModal(true);
  };

  const handleSaveMember = async (updatedMember: MemberRanking) => {
    if (!updatedMember.id) return;
    try {
      setSaving(true);
      const { id, ...updates } = updatedMember;
      await updateMember(id, updates);
      setEditingMember(null);
    } catch (err) {
      console.error('Failed to save member:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    try {
      setSaving(true);
      await addMember({
        name: newMember.name,
        walletAddress: newMember.walletAddress,
        level: newMember.level,
        combatPower: newMember.combatPower,
        status: newMember.status,
        memberType: newMember.memberType,
      });
      setShowAddModal(false);
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteMember = async (memberId: string) => {
    try {
      setSaving(true);
      await deleteMember(memberId);
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete member:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleWalletAddressClick = async (memberId: string, walletAddress: string) => {
    if (!walletAddress.trim()) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedWalletMemberId(memberId);
      window.setTimeout(() => {
        setCopiedWalletMemberId((currentId) => (currentId === memberId ? null : currentId));
      }, 1200);
    } catch (err) {
      console.error('Failed to copy wallet address:', err);
    }
  };

  if (userType !== 'admin') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Member Management</h2>
          <p className="page-subtitle">Admin access required</p>
        </div>
        <div className="error-state">
          <p>Access denied. Please sign in as admin to manage members.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Member Management</h2>
        <p className="page-subtitle">Add, update, and remove guild members</p>
      </div>

      <div className="rankings-filters">
        <button className="refresh-btn-filter" onClick={openAddModal}>
          <Plus size={16} strokeWidth={1.8} />
          Add Member
        </button>
        <input
          type="text"
          className="filter-input members-search-input"
          placeholder="Search member..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading members... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
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
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member, index) => (
              <tr key={member.id || member.rank} className={`rank-row rank-${member.rank}`}>
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
                <td className="col-level">{member.level}</td>
                <td className="col-combat">
                  <span className="combat-power">{member.combatPower.toLocaleString()}</span>
                </td>
                <td className="col-multiplier">{getCombatPowerMultiplier(member.combatPower).toFixed(1)}</td>
                <td className="col-status">
                  <span className={`status-badge status-${member.status}`}>
                    {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                  </span>
                </td>
                <td className="col-type">
                  <span className="member-type">{member.memberType}</span>
                </td>
                <td className="col-actions">
                  <button
                    className="action-btn edit-btn"
                    onClick={() => setEditingMember(member)}
                    title="Edit member"
                    disabled={saving}
                  >
                    <Pencil size={16} strokeWidth={1.8} />
                  </button>
                  <button
                    className="action-btn delete-btn"
                    onClick={() => setShowDeleteConfirm(member.id!)}
                    title="Delete member"
                    disabled={saving}
                  >
                    <Trash2 size={16} strokeWidth={1.8} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={9} className="attendance-empty-row">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Member</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={newMember.name}
                  onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Wallet Address</label>
                <input
                  type="text"
                  value={newMember.walletAddress}
                  onChange={(e) => setNewMember({ ...newMember, walletAddress: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Level</label>
                <input
                  type="number"
                  value={newMember.level}
                  onChange={(e) => setNewMember({ ...newMember, level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="form-group">
                <label>Combat Power</label>
                <input
                  type="number"
                  value={newMember.combatPower}
                  onChange={(e) => setNewMember({ ...newMember, combatPower: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={newMember.status}
                  onChange={(e) => setNewMember({ ...newMember, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label>Member Type</label>
                <select
                  value={newMember.memberType}
                  onChange={(e) => setNewMember({ ...newMember, memberType: e.target.value as 'guild master' | 'elite' | 'normal' })}
                >
                  <option value="normal">Normal</option>
                  <option value="elite">Elite</option>
                  <option value="guild master">Guild Master</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddMember} disabled={saving || !newMember.name}>
                {saving ? 'Saving...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Member</h3>
              <button className="modal-close" onClick={() => setEditingMember(null)} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Wallet Address</label>
                <input
                  type="text"
                  value={editingMember.walletAddress}
                  onChange={(e) => setEditingMember({ ...editingMember, walletAddress: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Level</label>
                <input
                  type="number"
                  value={editingMember.level}
                  onChange={(e) => setEditingMember({ ...editingMember, level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="form-group">
                <label>Combat Power</label>
                <input
                  type="number"
                  value={editingMember.combatPower}
                  onChange={(e) => setEditingMember({ ...editingMember, combatPower: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={editingMember.status}
                  onChange={(e) => setEditingMember({ ...editingMember, status: e.target.value as 'active' | 'inactive' })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label>Member Type</label>
                <select
                  value={editingMember.memberType}
                  onChange={(e) => setEditingMember({ ...editingMember, memberType: e.target.value as 'guild master' | 'elite' | 'normal' })}
                >
                  <option value="normal">Normal</option>
                  <option value="elite">Elite</option>
                  <option value="guild master">Guild Master</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingMember(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleSaveMember(editingMember!)} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm !== null && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to remove <strong>{members.find(m => m.id === showDeleteConfirm)?.name}</strong> from the guild?
              </p>
              <p className="confirm-warning">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDeleteMember(showDeleteConfirm)} disabled={saving}>
                {saving ? 'Deleting...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersManagePage;
