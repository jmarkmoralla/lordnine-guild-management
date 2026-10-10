import { useMemo, useState } from 'react';
import { Check, Loader, Pencil, Plus, Search, Shield, Trash2, Users, X } from 'lucide-react';
import '../styles/HardRaid.css';
import { useFirestoreMembers, type MemberRanking } from '../hooks/useFirestoreMembers';
import { useFirestoreHardRaid } from '../hooks/useFirestoreHardRaid';
import { getMemberClassIconPath } from '../utils/memberClass';
import { HARD_RAID_GROUP_SIZE, type HardRaidGroupDefinition } from '../types/hardRaid';

interface HardRaidPageProps {
  userType: 'guest' | 'admin';
}

const createGroupId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const HardRaidPage: React.FC<HardRaidPageProps> = ({ userType }) => {
  const {
    members,
    loading: membersLoading,
    error: membersError,
    updateMember,
  } = useFirestoreMembers();
  const {
    groups,
    loading: groupsLoading,
    error: groupsError,
    saveGroups,
  } = useFirestoreHardRaid();

  const isAdmin = userType === 'admin';
  const loading = membersLoading || groupsLoading;
  const error = membersError || groupsError;

  const [poolSearch, setPoolSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [addTargetGroupId, setAddTargetGroupId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  const groupIds = useMemo(() => new Set(groups.map((group) => group.id)), [groups]);

  const membersByGroup = useMemo(() => {
    const map = new Map<string, MemberRanking[]>();
    groups.forEach((group) => map.set(group.id, []));

    members.forEach((member) => {
      if (member.hardRaidGroup && map.has(member.hardRaidGroup)) {
        map.get(member.hardRaidGroup)?.push(member);
      }
    });

    return map;
  }, [groups, members]);

  const unassignedMembers = useMemo(() => (
    members
      .filter((member) => !member.hardRaidGroup || !groupIds.has(member.hardRaidGroup))
      .filter((member) => member.status === 'active')
      .sort((first, second) => second.combatPower - first.combatPower)
  ), [members, groupIds]);

  const availableMembers = useMemo(() => {
    const normalizedSearch = poolSearch.trim().toLowerCase();
    return unassignedMembers.filter((member) => (
      !normalizedSearch || member.name.toLowerCase().includes(normalizedSearch)
    ));
  }, [unassignedMembers, poolSearch]);

  const pickerMembers = useMemo(() => {
    const normalizedSearch = pickerSearch.trim().toLowerCase();
    return unassignedMembers.filter((member) => (
      !normalizedSearch || member.name.toLowerCase().includes(normalizedSearch)
    ));
  }, [unassignedMembers, pickerSearch]);

  const getGroupName = (groupId: string) => (
    groups.find((group) => group.id === groupId)?.name ?? 'Group'
  );

  const getGroupCount = (groupId: string) => membersByGroup.get(groupId)?.length ?? 0;

  const getNextGroupName = () => {
    const usedNames = new Set(groups.map((group) => group.name.trim().toLowerCase()));
    let index = 1;
    while (usedNames.has(`squad ${index}`)) {
      index += 1;
    }
    return `Squad ${index}`;
  };

  const handleCreateGroup = async () => {
    if (!isAdmin) return;

    const nextGroup: HardRaidGroupDefinition = {
      id: createGroupId(),
      name: getNextGroupName(),
      order: groups.length,
    };

    try {
      await saveGroups([...groups, nextGroup]);
      setActionError(null);
    } catch {
      setActionError('Failed to create group. Please try again.');
    }
  };

  const startRenameGroup = (group: HardRaidGroupDefinition) => {
    if (!isAdmin) return;
    setRenamingGroupId(group.id);
    setRenameValue(group.name);
  };

  const cancelRenameGroup = () => {
    setRenamingGroupId(null);
    setRenameValue('');
  };

  const commitRenameGroup = async () => {
    if (!isAdmin || !renamingGroupId) return;

    const trimmedName = renameValue.trim();
    if (!trimmedName) {
      setActionError('Group name cannot be empty.');
      return;
    }

    const hasDuplicate = groups.some((group) => (
      group.id !== renamingGroupId && group.name.trim().toLowerCase() === trimmedName.toLowerCase()
    ));
    if (hasDuplicate) {
      setActionError('A group with that name already exists.');
      return;
    }

    const nextGroups = groups.map((group) => (
      group.id === renamingGroupId ? { ...group, name: trimmedName } : group
    ));

    try {
      await saveGroups(nextGroups);
      setActionError(null);
      cancelRenameGroup();
    } catch {
      setActionError('Failed to rename group. Please try again.');
    }
  };

  const handleDeleteGroup = async (group: HardRaidGroupDefinition) => {
    if (!isAdmin) return;

    const assignedMembers = membersByGroup.get(group.id) ?? [];

    try {
      await saveGroups(groups.filter((entry) => entry.id !== group.id));
      await Promise.all(assignedMembers.map((member) => (
        member.id ? updateMember(member.id, { hardRaidGroup: null }) : Promise.resolve()
      )));
      if (addTargetGroupId === group.id) {
        setAddTargetGroupId(null);
      }
      setActionError(null);
    } catch {
      setActionError('Failed to delete group. Please try again.');
    }
  };

  const assignMember = async (memberId: string, groupId: string) => {
    if (!isAdmin || !memberId) return;

    const member = members.find((entry) => entry.id === memberId);
    if (!member || member.hardRaidGroup === groupId) return;

    if (getGroupCount(groupId) >= HARD_RAID_GROUP_SIZE) {
      setActionError(`${getGroupName(groupId)} is full (${HARD_RAID_GROUP_SIZE} members max).`);
      return;
    }

    try {
      await updateMember(memberId, { hardRaidGroup: groupId });
      setActionError(null);
    } catch {
      setActionError('Failed to assign member. Please try again.');
    }
  };

  const unassignMember = async (memberId: string) => {
    if (!isAdmin || !memberId) return;

    try {
      await updateMember(memberId, { hardRaidGroup: null });
      setActionError(null);
    } catch {
      setActionError('Failed to remove member. Please try again.');
    }
  };

  const handleDragStart = (event: React.DragEvent, memberId: string) => {
    if (!isAdmin || !memberId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData('text/plain', memberId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (!isAdmin) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnGroup = (event: React.DragEvent, groupId: string) => {
    event.preventDefault();
    const memberId = event.dataTransfer.getData('text/plain');
    if (memberId) {
      void assignMember(memberId, groupId);
    }
  };

  const handleDropOnPool = (event: React.DragEvent) => {
    event.preventDefault();
    const memberId = event.dataTransfer.getData('text/plain');
    if (memberId) {
      void unassignMember(memberId);
    }
  };

  const renderMemberChip = (
    member: MemberRanking,
    options: { draggable: boolean; onRemove?: () => void },
  ) => (
    <div
      key={member.id ?? member.name}
      className={`hard-raid-chip ${options.draggable ? 'hard-raid-chip-draggable' : ''}`}
      draggable={options.draggable}
      onDragStart={(event) => handleDragStart(event, member.id ?? '')}
    >
      <img
        src={getMemberClassIconPath(member.playerClass)}
        alt={member.playerClass}
        className="hard-raid-chip-class"
        loading="lazy"
      />
      <div className="hard-raid-chip-info">
        <span className="hard-raid-chip-name">{member.name}</span>
        <span className="hard-raid-chip-cp">{member.combatPower.toLocaleString()} CP</span>
      </div>
      {options.onRemove && (
        <button
          type="button"
          className="hard-raid-chip-remove"
          onClick={options.onRemove}
          aria-label={`Remove ${member.name}`}
          title="Remove from group"
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );

  const addTargetGroup = addTargetGroupId
    ? groups.find((group) => group.id === addTargetGroupId) ?? null
    : null;

  return (
    <div className="page-container hard-raid-page">
      <div className="page-header hard-raid-header">
        <div>
          <h2>Hard Raid</h2>
          <p className="page-subtitle">Manage the hard raid lineup. Up to {HARD_RAID_GROUP_SIZE} members per group.</p>
        </div>
        {isAdmin && (
          <button type="button" className="hard-raid-create-btn" onClick={handleCreateGroup}>
            <Plus size={16} strokeWidth={2.2} />
            Create Group
          </button>
        )}
      </div>

      {loading && (
        <div className="loading-state">
          <p>Loading hard raid lineup... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {error && (
        <div className="error-state">
          <p>Error: {error}</p>
        </div>
      )}

      {actionError && (
        <div className="hard-raid-action-error" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} aria-label="Dismiss message">
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>
      )}

      {!loading && (
        <div className="hard-raid-layout">
          <aside
            className="hard-raid-pool"
            onDragOver={handleDragOver}
            onDrop={handleDropOnPool}
          >
            <header className="hard-raid-pool-header">
              <h3>
                <Users size={16} strokeWidth={1.9} />
                Available Members
                <span className="hard-raid-count">{availableMembers.length}</span>
              </h3>
              <p className="hard-raid-hint">
                {isAdmin ? 'Drag a member into a group, or use a group\'s Add button.' : 'Unassigned members.'}
              </p>
            </header>

            <div className="hard-raid-search">
              <span className="hard-raid-search-icon" aria-hidden="true">
                <Search size={14} strokeWidth={1.9} />
              </span>
              <input
                type="text"
                className="hard-raid-search-input"
                placeholder="Search members..."
                value={poolSearch}
                onChange={(event) => setPoolSearch(event.target.value)}
                aria-label="Search available members"
              />
              {poolSearch.trim().length > 0 && (
                <button
                  type="button"
                  className="hard-raid-search-clear"
                  onClick={() => setPoolSearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="hard-raid-pool-list">
              {availableMembers.map((member) => renderMemberChip(member, { draggable: isAdmin }))}
              {availableMembers.length === 0 && (
                <p className="hard-raid-empty">
                  {unassignedMembers.length === 0 ? 'All members are assigned.' : 'No members match your search.'}
                </p>
              )}
            </div>
          </aside>

          <section className="hard-raid-groups">
            {groups.length === 0 && (
              <div className="hard-raid-empty-state">
                <Shield size={28} strokeWidth={1.6} />
                <p>No groups yet.</p>
                {isAdmin && <p className="hard-raid-empty-sub">Create a group to start building your lineup.</p>}
              </div>
            )}

            {groups.map((group) => {
              const groupMembers = membersByGroup.get(group.id) ?? [];
              const isFull = groupMembers.length >= HARD_RAID_GROUP_SIZE;
              const isRenaming = renamingGroupId === group.id;

              return (
                <article
                  key={group.id}
                  className={`hard-raid-group ${isFull ? 'hard-raid-group-full' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(event) => handleDropOnGroup(event, group.id)}
                >
                  <header className="hard-raid-group-header">
                    {isRenaming ? (
                      <div className="hard-raid-group-rename">
                        <input
                          type="text"
                          className="hard-raid-group-rename-input"
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void commitRenameGroup();
                            if (event.key === 'Escape') cancelRenameGroup();
                          }}
                          autoFocus
                          aria-label="Group name"
                        />
                        <button type="button" className="hard-raid-icon-btn" onClick={() => void commitRenameGroup()} aria-label="Save name">
                          <Check size={15} strokeWidth={2.2} />
                        </button>
                        <button type="button" className="hard-raid-icon-btn" onClick={cancelRenameGroup} aria-label="Cancel rename">
                          <X size={15} strokeWidth={2.2} />
                        </button>
                      </div>
                    ) : (
                      <h3 className="hard-raid-group-name">
                        {group.name}
                        <span className={`hard-raid-count ${isFull ? 'hard-raid-count-full' : ''}`}>
                          {groupMembers.length}/{HARD_RAID_GROUP_SIZE}
                        </span>
                      </h3>
                    )}

                    {isAdmin && !isRenaming && (
                      <div className="hard-raid-group-actions">
                        <button type="button" className="hard-raid-icon-btn" onClick={() => startRenameGroup(group)} aria-label={`Rename ${group.name}`} title="Rename group">
                          <Pencil size={14} strokeWidth={1.9} />
                        </button>
                        <button type="button" className="hard-raid-icon-btn hard-raid-icon-btn-danger" onClick={() => void handleDeleteGroup(group)} aria-label={`Delete ${group.name}`} title="Delete group">
                          <Trash2 size={14} strokeWidth={1.9} />
                        </button>
                      </div>
                    )}
                  </header>

                  <div className="hard-raid-group-list">
                    {groupMembers.map((member) => renderMemberChip(member, {
                      draggable: isAdmin,
                      onRemove: isAdmin && member.id ? () => void unassignMember(member.id as string) : undefined,
                    }))}
                    {groupMembers.length === 0 && (
                      <p className="hard-raid-empty">
                        {isAdmin ? 'Drop members here or use Add.' : 'No members assigned.'}
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      className="hard-raid-add-btn"
                      onClick={() => {
                        setPickerSearch('');
                        setAddTargetGroupId(group.id);
                      }}
                      disabled={isFull || unassignedMembers.length === 0}
                    >
                      <Plus size={14} strokeWidth={2.2} />
                      {isFull ? 'Group full' : 'Add member'}
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        </div>
      )}

      {addTargetGroup && isAdmin && (
        <div className="hard-raid-modal-overlay" role="dialog" aria-modal="true" aria-label={`Add members to ${addTargetGroup.name}`}>
          <div className="hard-raid-modal">
            <header className="hard-raid-modal-header">
              <h3>
                Add to {addTargetGroup.name}
                <span className="hard-raid-count">
                  {getGroupCount(addTargetGroup.id)}/{HARD_RAID_GROUP_SIZE}
                </span>
              </h3>
              <button type="button" className="hard-raid-icon-btn" onClick={() => setAddTargetGroupId(null)} aria-label="Close">
                <X size={16} strokeWidth={2.2} />
              </button>
            </header>

            <div className="hard-raid-search">
              <span className="hard-raid-search-icon" aria-hidden="true">
                <Search size={14} strokeWidth={1.9} />
              </span>
              <input
                type="text"
                className="hard-raid-search-input"
                placeholder="Search available members..."
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                aria-label="Search available members"
                autoFocus
              />
            </div>

            <div className="hard-raid-modal-list">
              {pickerMembers.map((member) => (
                <button
                  key={member.id ?? member.name}
                  type="button"
                  className="hard-raid-picker-item"
                  onClick={() => member.id && void assignMember(member.id, addTargetGroup.id)}
                  disabled={getGroupCount(addTargetGroup.id) >= HARD_RAID_GROUP_SIZE}
                >
                  <img
                    src={getMemberClassIconPath(member.playerClass)}
                    alt={member.playerClass}
                    className="hard-raid-chip-class"
                    loading="lazy"
                  />
                  <span className="hard-raid-chip-name">{member.name}</span>
                  <span className="hard-raid-chip-cp">{member.combatPower.toLocaleString()} CP</span>
                  <Plus size={14} strokeWidth={2.2} />
                </button>
              ))}
              {pickerMembers.length === 0 && (
                <p className="hard-raid-empty">
                  {unassignedMembers.length === 0 ? 'No available members.' : 'No members match your search.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HardRaidPage;
