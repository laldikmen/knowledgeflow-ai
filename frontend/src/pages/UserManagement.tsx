import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import './UserManagement.css';
import { ConfirmationModal } from '../components/ConfirmationModal';

// The platform has exactly two system-level roles (see spec: System Administrator
// or Member). Project-level roles (Manager/Contributor/Viewer) are assigned
// separately through project membership.
type UserRole = 'System Administrator' | 'Member';

// Project-level roles are assigned per project (see spec).
type ProjectRole = 'manager' | 'contributor' | 'viewer';

const PROJECT_ROLES: ProjectRole[] = ['manager', 'contributor', 'viewer'];

const projectRoleLabel = (role: ProjectRole) =>
  role.charAt(0).toUpperCase() + role.slice(1);

type AccountStatus = 'active' | 'inactive';

interface ProjectOption {
  id: string;
  name: string;
  shortName: string;
}

interface ManagedUser {
  id: number;
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  projectIds: string[];
  memberships: Record<string, ProjectRole>;
  status: AccountStatus;
}

interface UserFormState {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  // Map of projectId -> project role for the memberships being edited.
  memberships: Record<string, ProjectRole>;
}

const ROLES: UserRole[] = ['System Administrator', 'Member'];

const EMPTY_FORM: UserFormState = {
  fullName: '',
  email: '',
  password: '',
  role: 'Member',
  memberships: {},
};

// Turn the form's membership map into the API payload.
const membershipsPayload = (memberships: Record<string, ProjectRole>) =>
  Object.entries(memberships).map(([project_id, project_role]) => ({
    project_id: Number(project_id),
    project_role,
  }));

// Map between the database system_role ('admin' | 'member') and the display role.
const toDisplayRole = (systemRole: string): UserRole =>
  systemRole === 'admin' ? 'System Administrator' : 'Member';

const toSystemRole = (role: UserRole): 'admin' | 'member' =>
  role === 'System Administrator' ? 'admin' : 'member';

const getInitials = (name: string) => {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'U';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

const roleClassName = (role: UserRole) =>
  role.toLowerCase().replace(/\s+/g, '-');

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [pendingCreate, setPendingCreate] = useState<UserFormState | null>(null);
  const [pendingStatusUser, setPendingStatusUser] = useState<ManagedUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    try {
      const response = await client.get('/users');
      const managedUsers = response.data.map((user: any) => {
        const memberships: Record<string, ProjectRole> = {};
        (user.memberships || []).forEach((m: any) => {
          memberships[String(m.project_id)] = m.project_role;
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          initials: getInitials(user.name),
          role: toDisplayRole(user.system_role),
          projectIds: (user.project_ids || []).map(String),
          memberships,
          status: (user.status || 'active') as AccountStatus,
        };
      });
      setUsers(managedUsers);
    } catch (error) {
      console.error('Failed to load users', error);
      setUsers([]);
    }

    try {
      const projectsResponse = await client.get('/projects');
      const projectOptions = projectsResponse.data.map((proj: any) => ({
        id: proj.id.toString(),
        name: proj.name,
        shortName: proj.name,
      }));
      setProjects(projectOptions);
    } catch (error) {
      console.error('Failed to load projects', error);
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status === 'active').length,
    [users],
  );

  const openCreateModal = () => {
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: ManagedUser) => {
    setEditingUserId(user.id);
    setForm({
      fullName: user.name,
      email: user.email,
      password: '',
      role: user.role,
      memberships: { ...user.memberships },
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Set (or clear, when role is '') a project's membership role in the form.
  const setProjectRole = (projectId: string, role: ProjectRole | '') => {
    setForm((current) => {
      const next = { ...current.memberships };
      if (role === '') {
        delete next[projectId];
      } else {
        next[projectId] = role;
      }
      return { ...current, memberships: next };
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const updateRole = (role: UserRole) => {
    setForm((current) => ({ ...current, role }));
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();

    if (!fullName || !email) {
      setFormError('Full name and work email are required.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFormError('Enter a valid work email address.');
      return;
    }

    const duplicateEmail = users.some(
      (user) => user.email.toLowerCase() === email && user.id !== editingUserId,
    );

    if (duplicateEmail) {
      setFormError('A user with this email already exists.');
      return;
    }

    // Admins have global access, so they carry no explicit project memberships.
    const memberships =
      form.role === 'System Administrator'
        ? []
        : membershipsPayload(form.memberships);

    // Editing an existing account — update it directly.
    if (editingUserId !== null) {
      setIsSaving(true);
      try {
        await client.put(`/users/${editingUserId}`, {
          name: fullName,
          email,
          system_role: toSystemRole(form.role),
        });
        await client.put(`/users/${editingUserId}/memberships`, { memberships });
        await fetchData();
        closeModal();
      } catch (error: any) {
        setFormError(
          error.response?.data?.error || 'Could not update the user. Try again.',
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Creating a new account requires an initial password.
    if (form.password.trim().length < 6) {
      setFormError('Set a temporary password of at least 6 characters.');
      return;
    }

    setPendingCreate({
      fullName,
      email,
      password: form.password,
      role: form.role,
      memberships: { ...form.memberships },
    });
    setFormError('');
    setIsModalOpen(false);
  };

  const confirmCreateUser = async () => {
    if (!pendingCreate) return;

    const memberships =
      pendingCreate.role === 'System Administrator'
        ? []
        : membershipsPayload(pendingCreate.memberships);

    setIsSaving(true);
    try {
      const created = await client.post('/users', {
        name: pendingCreate.fullName,
        email: pendingCreate.email,
        password: pendingCreate.password,
        system_role: toSystemRole(pendingCreate.role),
      });

      // Sync the new user's project memberships (skip if none / admin).
      const newUserId = created.data?.id;
      if (newUserId && memberships.length > 0) {
        await client.put(`/users/${newUserId}/memberships`, { memberships });
      }

      await fetchData();
      setPendingCreate(null);
      setEditingUserId(null);
      setForm(EMPTY_FORM);
      setFormError('');
    } catch (error: any) {
      // Surface the error back on the form.
      setFormError(
        error.response?.data?.error || 'Could not create the user. Try again.',
      );
      setPendingCreate(null);
      setIsModalOpen(true);
    } finally {
      setIsSaving(false);
    }
  };

  const returnToCreateForm = () => {
    setPendingCreate(null);
    setIsModalOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusUser) return;

    const nextStatus =
      pendingStatusUser.status === 'active' ? 'inactive' : 'active';

    setIsSaving(true);
    try {
      await client.patch(`/users/${pendingStatusUser.id}/status`, {
        status: nextStatus,
      });
      await fetchData();
    } catch (error) {
      console.error('Failed to update user status', error);
    } finally {
      setIsSaving(false);
      setPendingStatusUser(null);
    }
  };

  const getProjectNames = (user: ManagedUser) => {
    if (user.role === 'System Administrator') return 'All projects';
    if (user.projectIds.length === 0) return 'No projects assigned';

    return user.projectIds
      .map((projectId) =>
        projects.find((project) => project.id === projectId)?.shortName,
      )
      .filter(Boolean)
      .join(', ');
  };

  return (
    <section className="user-management">
      <header className="user-management-header">
        <div>
          <h1>User Management</h1>
          <p>
            {users.length} users · {activeUsers} active · {projects.length} projects
          </p>
        </div>

        <button
          type="button"
          className="user-management-create-button"
          onClick={openCreateModal}
        >
          <span aria-hidden="true">+</span>
          Create User
        </button>
      </header>

      <div className="user-management-table-wrap">
        <table className="user-management-table">
          <thead>
            <tr>
              <th>User</th>
              <th>System role</th>
              <th>Projects</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user, index) => (
              <tr key={user.id} className={user.status === 'inactive' ? 'is-inactive' : ''}>
                <td>
                  <div className="user-management-person">
                    <span
                      className={`user-management-avatar user-management-avatar--${(index % 5) + 1}`}
                      aria-hidden="true"
                    >
                      {user.initials}
                    </span>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                </td>

                <td>
                  <span
                    className={`user-management-role user-management-role--${roleClassName(user.role)}`}
                  >
                    {user.role}
                  </span>
                </td>

                <td>
                  <span className="user-management-projects">
                    {getProjectNames(user)}
                  </span>
                </td>

                <td>
                  <span
                    className={`user-management-status user-management-status--${user.status}`}
                  >
                    <span aria-hidden="true" />
                    {user.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </td>

                <td>
                  <div className="user-management-actions">
                    <button type="button" onClick={() => openEditModal(user)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={
                        user.status === 'active'
                          ? 'user-management-action--danger'
                          : 'user-management-action--success'
                      }
                      onClick={() => setPendingStatusUser(user)}
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="user-management-empty">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div
          className="user-management-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div
            className="user-management-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-management-modal-title"
          >
            <div className="user-management-modal-header">
              <h2 id="user-management-modal-title">
                {editingUserId === null ? 'Create user' : 'Edit user'}
              </h2>
              <button
                type="button"
                className="user-management-modal-close"
                aria-label="Close user form"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={saveUser}>
              <div className="user-management-form-grid">
                <label className="user-management-field">
                  <span>Full name</span>
                  <input
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    placeholder="Taylor Kim"
                    autoFocus
                  />
                </label>

                <label className="user-management-field">
                  <span>Work email</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="taylor.kim@acme.com"
                  />
                </label>
              </div>

              {editingUserId === null && (
                <label className="user-management-field user-management-field--full">
                  <span>Temporary password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="At least 6 characters"
                  />
                </label>
              )}

              <label className="user-management-field user-management-field--full">
                <span>System role</span>
                <select
                  value={form.role}
                  onChange={(event) => updateRole(event.target.value as UserRole)}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              {form.role === 'System Administrator' ? (
                <p className="user-management-role-hint">
                  System Administrators have global access to every project.
                </p>
              ) : (
                <fieldset className="user-management-project-fieldset">
                  <legend>Project roles</legend>
                  <p>Choose this member’s role in each project. Leave as “No access” to exclude them.</p>

                  {projects.length === 0 && (
                    <p className="user-management-role-hint">No projects available yet.</p>
                  )}

                  <div className="user-management-project-options">
                    {projects.map((project) => (
                      <div key={project.id} className="user-management-project-row">
                        <span>{project.name}</span>
                        <select
                          value={form.memberships[project.id] ?? ''}
                          onChange={(event) =>
                            setProjectRole(
                              project.id,
                              event.target.value as ProjectRole | '',
                            )
                          }
                        >
                          <option value="">No access</option>
                          {PROJECT_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {projectRoleLabel(role)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}

              {formError && <div className="user-management-form-error">{formError}</div>}

              <div className="user-management-modal-actions">
                <button
                  type="button"
                  className="user-management-button user-management-button--secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="user-management-button user-management-button--primary"
                  disabled={isSaving}
                >
                  {editingUserId === null ? 'Create user' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={pendingCreate !== null}
        title="Create this user?"
        description={
          pendingCreate ? (
            <p>
              An active account will be created for <strong>{pendingCreate.fullName}</strong>{' '}
              ({pendingCreate.email}).
            </p>
          ) : null
        }
        details={
          pendingCreate ? (
            <div className="user-management-confirm-summary">
              <div><span>System role</span><strong>{pendingCreate.role}</strong></div>
            </div>
          ) : null
        }
        confirmLabel="Create user"
        cancelLabel="Back"
        tone="default"
        onClose={returnToCreateForm}
        onConfirm={confirmCreateUser}
      />

      <ConfirmationModal
        isOpen={pendingStatusUser !== null}
        title={
          pendingStatusUser?.status === 'active'
            ? `Deactivate ${pendingStatusUser.name}?`
            : `Activate ${pendingStatusUser?.name}?`
        }
        description={
          pendingStatusUser?.status === 'active' ? (
            <p>
              They’ll lose access immediately and won’t appear in assignment
              lists. You can reactivate them later.
            </p>
          ) : (
            <p>
              Their workspace access and project memberships will become active
              again, and they will reappear in assignment lists.
            </p>
          )
        }
        confirmLabel={
          pendingStatusUser?.status === 'active' ? 'Deactivate' : 'Activate user'
        }
        cancelLabel={
          pendingStatusUser?.status === 'active' ? 'Keep active' : 'Keep inactive'
        }
        tone={pendingStatusUser?.status === 'active' ? 'danger' : 'success'}
        onClose={() => setPendingStatusUser(null)}
        onConfirm={confirmStatusChange}
      />
    </section>
  );
};
