import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import './TaskEditModal.css';

export type TaskRiskValue = 'low' | 'medium' | 'high';

interface Option {
  id: number;
  name: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  projects: Option[];
  users: Option[];
  onClose: () => void;
  onCreated: () => void;
}

// Same rule as AI extraction: within 3 days = high, within 7 = medium, else low.
const riskFromDeadline = (deadline: string): TaskRiskValue => {
  if (!deadline) return 'low';
  const due = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'low';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days <= 3) return 'high';
  if (days <= 7) return 'medium';
  return 'low';
};

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  projects,
  users,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [risk, setRisk] = useState<TaskRiskValue>('low');
  const [riskTouched, setRiskTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset the form each time the modal opens; default to the first project.
  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setDescription('');
    setProjectId(projects[0] ? String(projects[0].id) : '');
    setOwnerId('');
    setDeadline('');
    setRisk('low');
    setRiskTouched(false);
    setError('');
  }, [isOpen, projects]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const projectOptions = useMemo(() => projects, [projects]);

  if (!isOpen) return null;

  const handleDeadlineChange = (value: string) => {
    setDeadline(value);
    // Suggest a risk level from the deadline until the user overrides it.
    if (!riskTouched) setRisk(riskFromDeadline(value));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }
    if (!projectId) {
      setError('Choose a project.');
      return;
    }

    setSaving(true);
    try {
      await client.post('/tasks', {
        projectId: Number(projectId),
        task_title: title.trim(),
        description: description.trim() || undefined,
        assigned_to_user_id: ownerId ? Number(ownerId) : undefined,
        deadline: deadline || undefined,
        risk_level: risk,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="task-edit-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="task-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-modal-title"
        onSubmit={handleSubmit}
      >
        <header className="task-edit-modal-header">
          <div>
            <span>Manual task</span>
            <h2 id="create-task-modal-title">Create a task</h2>
            <p>Add a task directly, without AI document extraction.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="task-edit-modal-body">
          <label className="task-edit-field task-edit-field--full">
            <span>Task title</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setError('');
              }}
              placeholder="Prepare the Q4 rollout plan"
              autoFocus
            />
          </label>

          <label className="task-edit-field task-edit-field--full">
            <span>Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to be done and why…"
            />
          </label>

          <div className="task-edit-modal-grid">
            <label className="task-edit-field">
              <span>Project</span>
              <select
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setError('');
                }}
              >
                <option value="">Select a project…</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="task-edit-field">
              <span>Assigned owner</span>
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="task-edit-field">
              <span>Deadline</span>
              <input
                type="date"
                value={deadline}
                onChange={(event) => handleDeadlineChange(event.target.value)}
              />
            </label>

            <label className="task-edit-field">
              <span>Risk level</span>
              <select
                value={risk}
                onChange={(event) => {
                  setRisk(event.target.value as TaskRiskValue);
                  setRiskTouched(true);
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          {error && <div className="task-edit-modal-error">{error}</div>}

          <p className="task-edit-modal-note">
            The task is created as <strong>Confirmed</strong> and appears in the
            Action Tracker right away.
          </p>
        </div>

        <footer className="task-edit-modal-actions">
          <button
            type="button"
            className="task-edit-button task-edit-button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="task-edit-button task-edit-button--primary"
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </footer>
      </form>
    </div>
  );
};
