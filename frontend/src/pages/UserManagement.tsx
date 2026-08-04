import React, { useMemo, useState } from 'react';
import './UserManagement.css';
import { ConfirmationModal } from '../components/ConfirmationModal';

type UserRole =
  | 'System Administrator'
  | 'Project Manager'
  | 'Contributor'
  | 'Viewer';

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
  status: AccountStatus;
}

interface UserFormState {
  fullName: string;
  email: string;
  role: UserRole;
  projectIds: string[];
}

const PROJECTS: ProjectOption[] = [
  { id: 'alpha', name: 'Project Alpha', shortName: 'Alpha' },
  { id: 'beta', name: 'Project Beta', shortName: 'Beta' },
  { id: 'data-migration', name: 'Data Migration', shortName: 'Data Migration' },
  { id: 'mobile-v3', name: 'Mobile App v3', shortName: 'Mobile' },
];

const ROLES: UserRole[] = [
  'System Administrator',
  'Project Manager',
  'Contributor',
  'Viewer',
];

const INITIAL_USERS: ManagedUser[] = [
  {
    id: 1,
    name: 'Sam Rivera',
    email: 'sam.rivera@acme.com',
    initials: 'SR',
    role: 'System Administrator',
    projectIds: [],
    status: 'active',
  },
  {
    id: 2,
    name: 'Alex Morgan',
    email: 'alex.morgan@acme.com',
    initials: 'AM',
    role: 'Project Manager',
    projectIds: ['alpha', 'data-migration', 'mobile-v3'],
    status: 'active',
  },
  {
    id: 3,
    name: 'Jordan Lee',
    email: 'jordan.lee@acme.com',
    initials: 'JL',
    role: 'Contributor',
    projectIds: ['alpha', 'beta'],
    status: 'active',
  },
  {
    id: 4,
    name: 'Inci',
    email: 'inci@acme.com',
    initials: 'I',
    role: 'Contributor',
    projectIds: ['alpha'],
    status: 'active',
  },
  {
    id: 5,
    name: 'Riley Chen',
    email: 'riley.chen@acme.com',
    initials: 'RC',
    role: 'Viewer',
    projectIds: ['beta'],
    status: 'inactive',
  },
  {
    id: 6,
    name: 'Maya Patel',
    email: 'maya.patel@acme.com',
    initials: 'MP',
    role: 'Viewer',
    projectIds: ['data-migration'],
    status: 'active',
  },
];

const EMPTY_FORM: UserFormState = {
  fullName: '',
  email: '',
  role: 'Contributor',
  projectIds: [],
};

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
  const [users, setUsers] = useState<ManagedUser[]>(INITIAL_USERS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [pendingCreate, setPendingCreate] = useState<UserFormState | null>(null);
  const [pendingStatusUser, setPendingStatusUser] = useState<ManagedUser | null>(null);

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
      role: user.role,
      projectIds: [...user.projectIds],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const updateRole = (role: UserRole) => {
    setForm((current) => ({
      ...current,
      role,
      projectIds: role === 'System Administrator' ? [] : current.projectIds,
    }));
  };

  const toggleProject = (projectId: string) => {
    setForm((current) => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter((id) => id !== projectId)
        : [...current.projectIds, projectId],
    }));
  };

  const saveUser = (event: React.FormEvent) => {
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

    const normalisedForm: UserFormState = {
      fullName,
      email,
      role: form.role,
      projectIds:
        form.role === 'System Administrator' ? [] : [...form.projectIds],
    };

    if (editingUserId !== null) {
      setUsers((current) =>
        current.map((user) =>
          user.id === editingUserId
            ? {
                ...user,
                name: normalisedForm.fullName,
                email: normalisedForm.email,
                initials: getInitials(normalisedForm.fullName),
                role: normalisedForm.role,
                projectIds: normalisedForm.projectIds,
              }
            : user,
        ),
      );
      closeModal();
      return;
    }

    setPendingCreate(normalisedForm);
    setFormError('');
    setIsModalOpen(false);
  };

  const confirmCreateUser = () => {
    if (!pendingCreate) return;

    setUsers((current) => [
      ...current,
      {
        id: Math.max(0, ...current.map((user) => user.id)) + 1,
        name: pendingCreate.fullName,
        email: pendingCreate.email,
        initials: getInitials(pendingCreate.fullName),
        role: pendingCreate.role,
        projectIds: pendingCreate.projectIds,
        status: 'active',
      },
    ]);

    setPendingCreate(null);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const returnToCreateForm = () => {
    setPendingCreate(null);
    setIsModalOpen(true);
  };

  const confirmStatusChange = () => {
    if (!pendingStatusUser) return;

    setUsers((current) =>
      current.map((user) =>
        user.id === pendingStatusUser.id
          ? {
              ...user,
              status: user.status === 'active' ? 'inactive' : 'active',
            }
          : user,
      ),
    );
    setPendingStatusUser(null);
  };

  const getProjectNames = (user: ManagedUser) => {
    if (user.role === 'System Administrator') return 'All projects';
    if (user.projectIds.length === 0) return 'No projects assigned';

    return user.projectIds
      .map((projectId) =>
        PROJECTS.find((project) => project.id === projectId)?.shortName,
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
            {users.length} users · {activeUsers} active · {PROJECTS.length} projects
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
                      disabled={user.role === 'System Administrator'}
                      title={
                        user.role === 'System Administrator'
                          ? 'The mock primary administrator cannot be deactivated.'
                          : undefined
                      }
                    >
                      {user.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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

              <div className="user-management-role-options" aria-label="Select user role">
                {ROLES.map((role) => (
                  <button
                    type="button"
                    key={role}
                    className={form.role === role ? 'active' : ''}
                    aria-pressed={form.role === role}
                    onClick={() => updateRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>

              <fieldset
                className="user-management-project-fieldset"
                disabled={form.role === 'System Administrator'}
              >
                <legend>Project memberships</legend>
                <p>
                  {form.role === 'System Administrator'
                    ? 'System Administrators automatically have access to every project.'
                    : 'Choose the projects this user can access.'}
                </p>

                <div className="user-management-project-options">
                  {PROJECTS.map((project) => (
                    <label key={project.id}>
                      <input
                        type="checkbox"
                        checked={form.projectIds.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                      />
                      <span>{project.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

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
                >
                  {editingUserId === null ? 'Create & send invite' : 'Save changes'}
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
              and an invitation will be sent to {pendingCreate.email}.
            </p>
          ) : null
        }
        details={
          pendingCreate ? (
            <div className="user-management-confirm-summary">
              <div><span>System role</span><strong>{pendingCreate.role}</strong></div>
              <div>
                <span>Project access</span>
                <strong>
                  {pendingCreate.role === 'System Administrator'
                    ? 'All projects'
                    : pendingCreate.projectIds.length > 0
                      ? pendingCreate.projectIds
                          .map((projectId) =>
                            PROJECTS.find((project) => project.id === projectId)?.name,
                          )
                          .filter(Boolean)
                          .join(', ')
                      : 'No projects assigned'}
                </strong>
              </div>
            </div>
          ) : null
        }
        confirmLabel="Create & send invite"
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
