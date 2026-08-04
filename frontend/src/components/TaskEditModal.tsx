import React, { useEffect, useMemo, useState } from 'react';
import './TaskEditModal.css';

export type TaskRiskValue = 'low' | 'medium' | 'high';

export interface TaskEditValues {
  title: string;
  description: string;
  sourceContext: string;
  owner: string;
  deadline: string;
  risk: TaskRiskValue;
  projectName: string;
}

interface TaskEditModalProps {
  isOpen: boolean;
  initialValues: TaskEditValues;
  onClose: () => void;
  onSave: (values: TaskEditValues) => void;
  projectOptions?: string[];
  ownerOptions?: string[];
}

const DEFAULT_PROJECTS = [
  'Project Alpha',
  'Project Beta',
  'Data Migration',
  'Mobile App v3',
];

const DEFAULT_OWNERS = ['Inci', 'Alex Morgan', 'Jordan Lee', 'Maya Patel'];

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  isOpen,
  initialValues,
  onClose,
  onSave,
  projectOptions = DEFAULT_PROJECTS,
  ownerOptions = DEFAULT_OWNERS,
}) => {
  const [form, setForm] = useState<TaskEditValues>(initialValues);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialValues);
    setError('');
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const projects = useMemo(
    () => Array.from(new Set([initialValues.projectName, ...projectOptions].filter(Boolean))),
    [initialValues.projectName, projectOptions],
  );

  const owners = useMemo(
    () => Array.from(new Set([initialValues.owner, ...ownerOptions].filter(Boolean))),
    [initialValues.owner, ownerOptions],
  );

  if (!isOpen) return null;

  const updateField = <K extends keyof TaskEditValues>(
    field: K,
    value: TaskEditValues[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.owner.trim() ||
      !form.projectName.trim()
    ) {
      setError('Task title, description, owner, and project are required.');
      return;
    }

    onSave({
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      sourceContext: form.sourceContext.trim(),
      owner: form.owner.trim(),
      deadline: form.deadline.trim(),
      projectName: form.projectName.trim(),
    });
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
        aria-labelledby="task-edit-modal-title"
        onSubmit={handleSubmit}
      >
        <header className="task-edit-modal-header">
          <div>
            <span>Draft action item</span>
            <h2 id="task-edit-modal-title">Edit task details</h2>
            <p>Review the AI suggestion before confirming it as a tracked task.</p>
          </div>
          <button type="button" aria-label="Close task editor" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="task-edit-modal-body">
          <label className="task-edit-field task-edit-field--full">
            <span>Task title</span>
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              autoFocus
            />
          </label>

          <label className="task-edit-field task-edit-field--full">
            <span>Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
            />
          </label>

          <label className="task-edit-field task-edit-field--full">
            <span>Source context</span>
            <textarea
              rows={3}
              value={form.sourceContext}
              onChange={(event) => updateField('sourceContext', event.target.value)}
              placeholder="Source excerpt or extraction context"
            />
          </label>

          <div className="task-edit-modal-grid">
            <label className="task-edit-field">
              <span>Assigned owner</span>
              <select
                value={form.owner}
                onChange={(event) => updateField('owner', event.target.value)}
              >
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>

            <label className="task-edit-field">
              <span>Deadline</span>
              <input
                value={form.deadline}
                onChange={(event) => updateField('deadline', event.target.value)}
                placeholder="Jul 20, 2026"
              />
            </label>

            <label className="task-edit-field">
              <span>Risk level</span>
              <select
                value={form.risk}
                onChange={(event) =>
                  updateField('risk', event.target.value as TaskRiskValue)
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="task-edit-field">
              <span>Project association</span>
              <select
                value={form.projectName}
                onChange={(event) => updateField('projectName', event.target.value)}
              >
                {projects.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="task-edit-modal-error">{error}</div>}

          <p className="task-edit-modal-note">
            Saving keeps this item in Draft until it is explicitly confirmed.
          </p>
        </div>

        <footer className="task-edit-modal-actions">
          <button type="button" className="task-edit-button task-edit-button--secondary" onClick={onClose}>
            Back
          </button>
          <button type="submit" className="task-edit-button task-edit-button--primary">
            Save changes
          </button>
        </footer>
      </form>
    </div>
  );
};
