import { useMemo, useState } from 'react';
import { AlertCircle, Ban, Crown, Loader, Pencil, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useAdminManagement } from '../hooks/useAdminManagement';
import type { ManagedAdmin, ManagedAdminRole } from '../types/admin';
import '../styles/Rankings.css';
import '../styles/AdminManagement.css';

interface ManageAdminsPageProps {
  canManageAdmins: boolean;
  currentUserUid: string | null;
}

interface NewAdminFormState {
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
  role: ManagedAdminRole;
}

interface EditAdminFormState {
  uid: string;
  email: string;
  displayName: string;
}

const defaultFormState: NewAdminFormState = {
  email: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  role: 'admin',
};

const ManageAdminsPage: React.FC<ManageAdminsPageProps> = ({ canManageAdmins, currentUserUid }) => {
  const {
    admins,
    loading,
    error,
    createAdmin,
    updateAdminProfile,
    updateAdminRole,
    setAdminDisabled,
    deleteAdmin,
  } = useAdminManagement(canManageAdmins);
  const [formState, setFormState] = useState<NewAdminFormState>(defaultFormState);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ uid: string; label: string } | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<EditAdminFormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeRowUid, setActiveRowUid] = useState<string | null>(null);

  const adminCounts = useMemo(() => ({
    total: admins.length,
    enabled: admins.filter((admin) => admin.enabled).length,
    superAdmins: admins.filter((admin) => admin.role === 'super_admin' && admin.enabled).length,
  }), [admins]);

  const openCreateModal = () => {
    setFormState(defaultFormState);
    setActionError(null);
    setActionMessage(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (submitting) return;
    setShowCreateModal(false);
  };

  const openEditModal = (admin: ManagedAdmin) => {
    setActionError(null);
    setActionMessage(null);
    setEditingAdmin({
      uid: admin.uid,
      email: admin.email || '',
      displayName: admin.displayName || '',
    });
  };

  const closeEditModal = () => {
    if (submitting) return;
    setEditingAdmin(null);
  };

  const handleCreateAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);

    if (!formState.email.trim()) {
      setActionError('Email is required.');
      return;
    }

    if (formState.password.length < 6) {
      setActionError('Password must be at least 6 characters long.');
      return;
    }

    if (formState.password !== formState.confirmPassword) {
      setActionError('Password confirmation does not match.');
      return;
    }

    try {
      setSubmitting(true);
      await createAdmin({
        email: formState.email.trim(),
        displayName: formState.displayName.trim(),
        password: formState.password,
        role: formState.role,
      });
      setFormState(defaultFormState);
      setShowCreateModal(false);
      setActionMessage('Admin account created.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (uid: string, role: ManagedAdminRole) => {
    try {
      setActiveRowUid(uid);
      setActionMessage(null);
      setActionError(null);
      await updateAdminRole(uid, role);
      setActionMessage('Admin role updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update admin role.');
    } finally {
      setActiveRowUid(null);
    }
  };

  const handleSaveAdminProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAdmin) return;

    setActionMessage(null);
    setActionError(null);

    if (!editingAdmin.email.trim()) {
      setActionError('Email is required.');
      return;
    }

    try {
      setSubmitting(true);
      await updateAdminProfile({
        uid: editingAdmin.uid,
        email: editingAdmin.email.trim(),
        displayName: editingAdmin.displayName.trim(),
      });
      setEditingAdmin(null);
      setActionMessage('Admin profile updated.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update admin profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (uid: string, nextDisabled: boolean) => {
    try {
      setActiveRowUid(uid);
      setActionMessage(null);
      setActionError(null);
      await setAdminDisabled(uid, nextDisabled);
      setActionMessage(nextDisabled ? 'Admin disabled.' : 'Admin enabled.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update admin status.');
    } finally {
      setActiveRowUid(null);
    }
  };

  const handleDeleteAdmin = async (uid: string) => {
    try {
      setActiveRowUid(uid);
      setActionMessage(null);
      setActionError(null);
      await deleteAdmin(uid);
      setShowDeleteConfirm(null);
      setActionMessage('Admin deleted.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete admin.');
    } finally {
      setActiveRowUid(null);
    }
  };

  if (!canManageAdmins) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Admin Management</h2>
          <p className="page-subtitle">Super admin access required</p>
        </div>
        <div className="error-state">
          <p>Access denied. Only super admins can manage admin accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container admin-management-page">
      <div className="page-header admin-management-header">
        <div>
          <h2>Admin Management</h2>
          <p className="page-subtitle">Review admin access, adjust roles, and manage account status.</p>
        </div>
      </div>

      <div className="members-stats-grid admin-stats-grid">
        <article className="members-stat-card admin-stat-card admin-stat-card-total">
          <div className="members-stat-icon admin-stat-icon" aria-hidden="true">
            <Users size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Total Admins</h3>
            <p className="members-stat-value">{adminCounts.total}</p>
          </div>
        </article>
        <article className="members-stat-card admin-stat-card admin-stat-card-enabled">
          <div className="members-stat-icon admin-stat-icon" aria-hidden="true">
            <ShieldCheck size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Enabled</h3>
            <p className="members-stat-value">{adminCounts.enabled}</p>
          </div>
        </article>
        <article className="members-stat-card admin-stat-card admin-stat-card-super">
          <div className="members-stat-icon admin-stat-icon" aria-hidden="true">
            <Crown size={24} strokeWidth={1.75} />
          </div>
          <div className="members-stat-content">
            <h3>Super Admins</h3>
            <p className="members-stat-value">{adminCounts.superAdmins}</p>
          </div>
        </article>
      </div>

      <div className="rankings-filters members-toolbar admin-management-toolbar">
        <button
          type="button"
          className="refresh-btn-filter"
          onClick={openCreateModal}
        >
          <UserPlus size={16} strokeWidth={1.8} />
          Add Admin
        </button>
      </div>

      <section className="admin-list-section">
        <div className="admin-list-heading">
          <h3>Existing Admins</h3>
          <p>Manage role access, account status, and removal for current admins.</p>
          </div>

          {(actionError || error) && (
            <div className="admin-message admin-message-error" role="alert">
              <AlertCircle size={16} strokeWidth={1.8} />
              <span>{actionError || error}</span>
            </div>
          )}

          {actionMessage && (
            <div className="admin-message admin-message-success" role="status">
              <span>{actionMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="admin-loading-state">
              <Loader size={16} strokeWidth={1.8} />
              <span>Loading admins...</span>
            </div>
          ) : (
            <div className="rankings-table-container">
              <table className="rankings-table admin-table">
                <thead>
                  <tr>
                    <th className="admin-col-name">Name</th>
                    <th className="admin-col-email">Email</th>
                    <th className="admin-col-role">Role</th>
                    <th className="admin-col-status">Status</th>
                    <th className="admin-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => {
                    const isCurrentUser = admin.uid === currentUserUid;
                    const isBusy = activeRowUid === admin.uid;

                    return (
                      <tr key={admin.uid}>
                        <td className="admin-col-name">
                          <span className="member-name admin-name-text">{admin.displayName || 'Unnamed Admin'}</span>
                        </td>
                        <td className="admin-col-email">
                          <span className="admin-email-text">{admin.email || 'Unknown email'}</span>
                        </td>
                        <td className="admin-col-role">
                          <select
                            className="admin-role-select"
                            value={admin.role}
                            onChange={(event) => void handleRoleChange(admin.uid, event.target.value as ManagedAdminRole)}
                            disabled={isBusy || isCurrentUser}
                          >
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        </td>
                        <td className="admin-col-status">
                          <span className={`status-badge admin-status-badge ${admin.enabled ? 'admin-status-enabled' : 'admin-status-disabled'}`}>
                            {admin.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td className="admin-col-actions">
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="action-btn admin-action-btn admin-action-disable"
                              onClick={() => void handleToggleStatus(admin.uid, admin.enabled)}
                              disabled={isBusy || isCurrentUser}
                              aria-label={admin.enabled ? 'Disable admin' : 'Enable admin'}
                              title={admin.enabled ? 'Disable admin' : 'Enable admin'}
                            >
                              <Ban size={16} strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              className="action-btn admin-action-btn admin-action-edit"
                              onClick={() => openEditModal(admin)}
                              disabled={isBusy || isCurrentUser}
                              aria-label="Edit admin"
                              title="Edit admin"
                            >
                              <Pencil size={16} strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              className="action-btn admin-action-btn admin-action-remove"
                              onClick={() => setShowDeleteConfirm({
                                uid: admin.uid,
                                label: admin.displayName || admin.email || admin.uid,
                              })}
                              disabled={isBusy || isCurrentUser}
                              aria-label="Remove admin"
                              title="Remove admin"
                            >
                              <Trash2 size={16} strokeWidth={1.8} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {admins.length === 0 && (
                    <tr>
                      <td colSpan={5} className="attendance-empty-row">No admins found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <form className="modal-content add-member-modal admin-create-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleCreateAdmin}>
            <div className="modal-header">
              <h3>Create Admin</h3>
              <button className="modal-close" type="button" onClick={closeCreateModal} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body add-member-modal-body admin-create-modal-body">
              <div className="form-group">
                <label htmlFor="admin-display-name">Name</label>
                <input
                  id="admin-display-name"
                  type="text"
                  value={formState.displayName}
                  onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
                  placeholder="Guild Officer"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin-email">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  value={formState.email}
                  onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                  placeholder="admin@example.com"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={formState.password}
                  onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                  placeholder="At least 6 characters"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin-password-confirm">Confirm Password</label>
                <input
                  id="admin-password-confirm"
                  type="password"
                  value={formState.confirmPassword}
                  onChange={(event) => setFormState((current) => ({ ...current, confirmPassword: event.target.value }))}
                  placeholder="Repeat password"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin-role">Role</label>
                <select
                  id="admin-role"
                  value={formState.role}
                  onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value as ManagedAdminRole }))}
                  disabled={submitting}
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {actionError && <p className="admin-modal-error">{actionError}</p>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeCreateModal} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingAdmin && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <form className="modal-content add-member-modal admin-create-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSaveAdminProfile}>
            <div className="modal-header">
              <h3>Edit Admin</h3>
              <button className="modal-close" type="button" onClick={closeEditModal} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body add-member-modal-body admin-create-modal-body">
              <div className="form-group">
                <label htmlFor="edit-admin-display-name">Name</label>
                <input
                  id="edit-admin-display-name"
                  type="text"
                  value={editingAdmin.displayName}
                  onChange={(event) => setEditingAdmin((current) => current ? { ...current, displayName: event.target.value } : current)}
                  placeholder="Guild Officer"
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-admin-email">Email</label>
                <input
                  id="edit-admin-email"
                  type="email"
                  value={editingAdmin.email}
                  onChange={(event) => setEditingAdmin((current) => current ? { ...current, email: event.target.value } : current)}
                  placeholder="admin@example.com"
                  disabled={submitting}
                />
              </div>

              {actionError && <p className="admin-modal-error">{actionError}</p>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeEditModal} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Remove Admin</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(null)} aria-label="Close">
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Remove admin account for <span className="admin-confirm-name">{showDeleteConfirm.label}</span>?
              </p>
              <p className="confirm-warning">This removes the Firebase Authentication user and deletes the matching admin record.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(null)} disabled={activeRowUid === showDeleteConfirm.uid}>Cancel</button>
              <button className="btn btn-danger" onClick={() => void handleDeleteAdmin(showDeleteConfirm.uid)} disabled={activeRowUid === showDeleteConfirm.uid}>
                {activeRowUid === showDeleteConfirm.uid ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageAdminsPage;