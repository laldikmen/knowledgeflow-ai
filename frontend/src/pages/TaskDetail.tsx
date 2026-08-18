import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import './TaskDetail.css';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TaskEditModal, type TaskEditValues } from '../components/TaskEditModal';

type TaskStatus =
  | 'draft'
  | 'confirmed'
  | 'in-progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';
type TaskRisk = 'low' | 'medium' | 'high';
type PendingTaskAction = 'confirm' | 'reject' | 'start' | 'complete' | 'cancel';

interface TaskNote {
  id: number;
  author: string;
  initials: string;
  text: string;
  date: string;
}

interface TaskHistoryItem {
  id: number;
  status: TaskStatus;
  title: string;
  detail: string;
  date: string;
}

interface TaskDetailData {
  id: number;
  title: string;
  description: string;
  projectName: string;
  ownerName: string;
  ownerInitials: string;
  deadline?: string;
  risk: TaskRisk;
  status: TaskStatus;
  overdueDays?: number;
  sourceDocumentId?: number;
  sourceDocument: string;
  sourceReference: string;
  sourceConfidence?: number;
  notes: TaskNote[];
  history: TaskHistoryItem[];
}

interface TaskDetailProps {
  currentUserName?: string;
  currentUserRole?: string;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const normalise = (value: string) => value.trim().toLowerCase();

const canManageTasks = (role: string) =>
  [
    'system administrator',
    'administrator',
    'admin',
    'project manager',
    'manager',
  ].includes(normalise(role));

const buildHistory = (
  status: TaskStatus,
  ownerName: string,
  projectManager = 'Alex Morgan',
): TaskHistoryItem[] => {
  const history: TaskHistoryItem[] = [
    {
      id: 1,
      status: 'draft',
      title: 'Draft created by AI',
      detail: 'From meeting transcript',
      date: 'Jul 7',
    },
  ];

  if (status !== 'draft' && status !== 'rejected') {
    history.push({
      id: 2,
      status: 'confirmed',
      title: `Confirmed by ${projectManager}`,
      detail: `Assigned to ${ownerName}`,
      date: 'Jul 7',
    });
  }

  if (['in-progress', 'completed', 'cancelled'].includes(status)) {
    history.push({
      id: 3,
      status: 'in-progress',
      title: `Started by ${ownerName}`,
      detail: 'Work moved to In Progress',
      date: 'Jul 9',
    });
  }

  if (status === 'completed') {
    history.push({
      id: 4,
      status: 'completed',
      title: `Completed by ${ownerName}`,
      detail: 'Work marked complete',
      date: 'Jul 18',
    });
  }

  if (status === 'cancelled') {
    history.push({
      id: 4,
      status: 'cancelled',
      title: `Cancelled by ${projectManager}`,
      detail: 'Task no longer required',
      date: 'Jul 18',
    });
  }

  if (status === 'rejected') {
    history.push({
      id: 2,
      status: 'rejected',
      title: `Rejected by ${projectManager}`,
      detail: 'AI extraction did not represent a real task',
      date: 'Jul 7',
    });
  }

  return history;
};


const TaskStatusBadge: React.FC<{ status: TaskStatus }> = ({ status }) => (
  <span className={`task-detail-status task-detail-status--${status}`}>
    <span className="task-detail-dot" />
    {STATUS_LABELS[status]}
  </span>
);

export const TaskDetail: React.FC<TaskDetailProps> = ({
  currentUserName = 'User',
  currentUserRole = 'Viewer',
}) => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const numericTaskId = Number(taskId);
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingTaskAction | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await client.get('/users');
        setUsers((response.data || []).map((u: any) => ({ id: u.id, name: u.name })));
      } catch (error) {
        console.error('Failed to load users', error);
        setUsers([]);
      }
    };
    fetchUsers();
  }, []);

  const loadTask = async () => {
    setIsLoading(true);
    try {
      const response = await client.get(`/tasks/${numericTaskId}`);
      const data = response.data;

      const extractInitials = (name: string): string => {
        const parts = (name || '').trim().split(/\s+/).filter(Boolean);
        if (parts.length > 1) {
          return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        }
        return parts[0]?.slice(0, 2).toUpperCase() || 'U';
      };

      // Backend stores in_progress with an underscore; the UI uses a hyphen.
      const normalizedStatus = (data.status || 'draft').replace('_', '-');

      const taskData: TaskDetailData = {
        id: data.id,
        title: data.title || data.task_title,
        description: data.description,
        projectName: data.project_name,
        ownerName: data.owner_name,
        ownerInitials: extractInitials(data.owner_name),
        deadline: data.deadline,
        risk: data.risk_level || 'low',
        status: normalizedStatus,
        overdueDays: data.overdue_days,
        sourceDocumentId: data.source_document_id,
        sourceDocument: data.source_document_title || 'Source Document',
        sourceReference: data.source_reference || 'Extracted from source',
        sourceConfidence: data.confidence_score,
        notes: data.notes?.map((note: any) => ({
          id: note.id,
          author: note.author,
          initials: extractInitials(note.author),
          text: note.text,
          date: new Date(note.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        })) || [],
        // Real status history recorded by the backend (task_status_history).
        history: Array.isArray(data.status_history) && data.status_history.length > 0
          ? data.status_history.map((row: any) => {
              const status = (row.new_status || 'draft').replace('_', '-') as TaskStatus;
              const who = row.changed_by_name || 'Someone';
              const titleByStatus: Record<string, string> = {
                confirmed: `Confirmed by ${who}`,
                'in-progress': `Started by ${who}`,
                completed: `Completed by ${who}`,
                cancelled: `Cancelled by ${who}`,
                rejected: `Rejected by ${who}`,
                draft: 'Created',
              };
              return {
                id: row.id,
                status,
                title: titleByStatus[status] || `Moved to ${status}`,
                detail:
                  row.change_note ||
                  `${(row.previous_status || 'new').replace('_', '-')} → ${status}`,
                date: new Date(row.changed_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };
            })
          : buildHistory(normalizedStatus, data.owner_name),
      };

      setTask(taskData);
    } catch (error) {
      console.error('Failed to load task', error);
      setTask(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (numericTaskId) {
      loadTask();
    }
    setNoteText('');
    setPendingAction(null);
    setActionNote('');
    setShowEditModal(false);
  }, [numericTaskId]);

  const canManage = canManageTasks(currentUserRole);
  const isOwner = task ? normalise(task.ownerName) === normalise(currentUserName) : false;
  const canExecute = canManage || isOwner;
  const canViewHistory = canManage || isOwner;


  if (isLoading) {
    return (
      <section className="task-detail task-detail-not-found">
        <div className="task-detail-empty-card">
          <h1>Loading task...</h1>
        </div>
      </section>
    );
  }

  if (!task) {
    return (
      <section className="task-detail task-detail-not-found">
        <div className="task-detail-empty-card">
          <span aria-hidden="true">?</span>
          <h1>Task not found</h1>
          <p>The selected task does not exist.</p>
          <button type="button" className="task-detail-button task-detail-button--primary" onClick={() => navigate('/action-tracker')}>
            Back to Action Tracker
          </button>
        </div>
      </section>
    );
  }

  const closeActionModal = () => {
    setPendingAction(null);
    setActionNote('');
  };

  const openActionModal = (action: PendingTaskAction) => {
    setActionNote('');
    setPendingAction(action);
  };

  const addProgressNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    setTask((current) =>
      current
        ? {
            ...current,
            notes: [
              ...current.notes,
              {
                id: Date.now(),
                author: currentUserName,
                initials:
                  currentUserName
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'U',
                text: trimmed,
                date: 'Today',
              },
            ],
          }
        : current,
    );
    setNoteText('');
  };

  const confirmPendingAction = async () => {
    if (!pendingAction || !task) return;

    const trimmedNote = actionNote.trim();

    try {
      if (pendingAction === 'confirm' || pendingAction === 'reject') {
        // Human review of an AI-drafted task (admin/manager only).
        await client.post(`/ai/action-item/${task.id}/review`, {
          review_status: pendingAction === 'confirm' ? 'confirmed' : 'rejected',
          review_note: trimmedNote || undefined,
        });
      } else {
        // Lifecycle transition. Backend uses in_progress with an underscore and
        // records the change in task_status_history.
        const statusByAction: Record<'start' | 'complete' | 'cancel', string> = {
          start: 'in_progress',
          complete: 'completed',
          cancel: 'cancelled',
        };

        await client.put(`/tasks/${task.id}`, {
          status: statusByAction[pendingAction],
          completion_note: pendingAction === 'complete' ? trimmedNote || undefined : undefined,
          cancel_reason: pendingAction === 'cancel' ? trimmedNote || undefined : undefined,
        });
      }

      await loadTask();
    } catch (error) {
      console.error('Failed to update task', error);
    } finally {
      closeActionModal();
    }
  };

  const taskEditValues: TaskEditValues = {
    title: task.title,
    description: task.description,
    sourceContext: task.sourceReference,
    owner: task.ownerName,
    deadline: task.deadline ?? '',
    risk: task.risk,
    projectName: task.projectName,
  };

  const saveTaskEdit = async (values: TaskEditValues) => {
    if (!task) return;

    // Resolve the selected owner name to a real user id so the task is assigned
    // to an actual account (unassigned if the name doesn't match a user).
    const matchedUser = users.find(
      (u) => u.name.trim().toLowerCase() === values.owner.trim().toLowerCase(),
    );

    try {
      await client.put(`/tasks/${task.id}`, {
        task_title: values.title,
        description: values.description,
        assigned_to_user_id: matchedUser ? matchedUser.id : null,
        deadline: values.deadline || null,
        risk_level: values.risk,
      });
      await loadTask();
    } catch (error) {
      console.error('Failed to save task', error);
    } finally {
      setShowEditModal(false);
    }
  };

  const showStart = task.status === 'confirmed' && canExecute;
  const showComplete = ['confirmed', 'in-progress'].includes(task.status) && canExecute;
  const showCancel = ['confirmed', 'in-progress'].includes(task.status) && canManage;
  const showDraftActions = task.status === 'draft' && canManage;
  const canAddNotes = ['confirmed', 'in-progress'].includes(task.status) && canExecute;

  return (
    <section className="task-detail">
      <header className="task-detail-header">
        <button type="button" className="task-detail-breadcrumb" onClick={() => navigate('/action-tracker')}>
          Action Tracker <span>/</span> <strong>{task.title}</strong>
        </button>

        <div className="task-detail-title-row">
          <h1>{task.title}</h1>
          <TaskStatusBadge status={task.status} />
          {task.overdueDays && (
            <span className="task-detail-overdue-badge">
              <span className="task-detail-dot" />
              Overdue · {task.overdueDays}d
            </span>
          )}
        </div>
      </header>

      <div className="task-detail-layout">
        <div className="task-detail-main-column">
          <article className="task-detail-card task-detail-description-card">
            <h2>Description</h2>
            <p>{task.description}</p>

            <button
              type="button"
              className="task-detail-source-card"
              onClick={() =>
                task.sourceDocumentId
                  ? navigate(`/documents/${task.sourceDocumentId}`)
                  : navigate('/documents')
              }
            >
              <span className="task-detail-source-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="7.5" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
              </span>
              <span className="task-detail-source-copy">
                <strong>Source: {task.sourceDocument}</strong>
                <small>{task.sourceReference}</small>
              </span>
              <span className="task-detail-source-open">Open →</span>
            </button>
          </article>

          <article className="task-detail-card task-detail-notes-card">
            <h2>Progress notes</h2>

            {task.notes.length > 0 ? (
              <div className="task-detail-notes-list">
                {task.notes.map((note) => (
                  <div className="task-detail-note" key={note.id}>
                    <span className="task-detail-avatar">{note.initials}</span>
                    <div>
                      <p>{note.text}</p>
                      <small>{note.author} · {note.date}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="task-detail-empty-text">No progress notes have been added yet.</p>
            )}

            {canAddNotes && (
              <div className="task-detail-note-editor">
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="Add a progress or completion note..."
                />
                <button
                  type="button"
                  className="task-detail-button task-detail-button--secondary"
                  onClick={addProgressNote}
                  disabled={!noteText.trim()}
                >
                  Add note
                </button>
              </div>
            )}
          </article>
        </div>

        <aside className="task-detail-side-column">
          <article className="task-detail-card task-detail-meta-card">
            <dl className="task-detail-meta-list">
              <div>
                <dt>Owner</dt>
                <dd>
                  <span className="task-detail-avatar">{task.ownerInitials}</span>
                  {task.ownerName}
                </dd>
              </div>
              <div>
                <dt>Deadline</dt>
                <dd className={task.overdueDays ? 'task-detail-danger-text' : ''}>
                  {task.deadline ?? 'Not set'}
                </dd>
              </div>
              <div>
                <dt>Risk level</dt>
                <dd>
                  <span className={`task-detail-risk task-detail-risk--${task.risk}`}>
                    <span className="task-detail-dot" />
                    {task.risk.charAt(0).toUpperCase() + task.risk.slice(1)}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd><TaskStatusBadge status={task.status} /></dd>
              </div>
            </dl>

            {(showStart || showComplete || showCancel || showDraftActions) && (
              <div className={`task-detail-actions ${showDraftActions ? 'task-detail-actions--draft' : ''}`}>
                {showDraftActions && (
                  <>
                    <button
                      type="button"
                      className="task-detail-button task-detail-button--primary"
                      onClick={() => openActionModal('confirm')}
                    >
                      Confirm task
                    </button>
                    <button
                      type="button"
                      className="task-detail-button task-detail-button--secondary"
                      onClick={() => setShowEditModal(true)}
                    >
                      Edit task
                    </button>
                    <button
                      type="button"
                      className="task-detail-button task-detail-button--danger"
                      onClick={() => openActionModal('reject')}
                    >
                      Reject task
                    </button>
                  </>
                )}

                {showStart && (
                  <button
                    type="button"
                    className="task-detail-button task-detail-button--primary"
                    onClick={() => openActionModal('start')}
                  >
                    Start task
                  </button>
                )}

                {showComplete && (
                  <button type="button" className="task-detail-button task-detail-button--primary" onClick={() => openActionModal('complete')}>
                    Mark complete
                  </button>
                )}

                {showCancel && (
                  <button type="button" className="task-detail-button task-detail-button--danger" onClick={() => openActionModal('cancel')}>
                    Cancel task
                  </button>
                )}
              </div>
            )}
          </article>

          <article className="task-detail-card task-detail-history-card">
            <h2>Status history</h2>

            {canViewHistory ? (
              <div className="task-detail-history-list">
                {task.history.map((item) => (
                  <div className="task-detail-history-item" key={item.id}>
                    <span className={`task-detail-history-dot task-detail-history-dot--${item.status}`} />
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.date} · {item.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="task-detail-empty-text">Detailed task history is not available for this role.</p>
            )}
          </article>
        </aside>
      </div>

      <ConfirmationModal
        isOpen={pendingAction !== null}
        title={
          pendingAction === 'confirm'
            ? 'Confirm this action item?'
            : pendingAction === 'reject'
              ? 'Reject this action item?'
              : pendingAction === 'start'
                ? 'Start this task?'
                : pendingAction === 'complete'
                  ? 'Mark this task complete?'
                  : 'Cancel this task?'
        }
        description={
          pendingAction === 'confirm' ? (
            <p>
              “{task.title}” will become a <strong>Confirmed</strong> task and can
              then be started by {task.ownerName}.
            </p>
          ) : pendingAction === 'reject' ? (
            <p>
              “{task.title}” will be marked <strong>Rejected</strong> and will not
              become a tracked task. It will remain visible in the source
              document history.
            </p>
          ) : pendingAction === 'start' ? (
            <p>
              “{task.title}” will move to <strong>In Progress</strong> and begin
              counting as active work for {task.ownerName}.
            </p>
          ) : pendingAction === 'complete' ? (
            <p>
              “{task.title}” will move to <strong>Completed</strong> and leave the
              active workload and overdue counts.
            </p>
          ) : (
            <p>
              “{task.title}” will move to <strong>Cancelled</strong> and drop out
              of active workload and overdue counts. This cannot be undone in
              this mock flow.
            </p>
          )
        }
        confirmLabel={
          pendingAction === 'confirm'
            ? 'Confirm task'
            : pendingAction === 'reject'
              ? 'Reject item'
              : pendingAction === 'start'
                ? 'Start task'
                : pendingAction === 'complete'
                  ? 'Mark complete'
                  : 'Cancel task'
        }
        cancelLabel={pendingAction === 'cancel' ? 'Keep task' : 'Back'}
        tone={
          pendingAction === 'reject' || pendingAction === 'cancel'
            ? 'danger'
            : pendingAction === 'complete'
              ? 'success'
              : 'default'
        }
        inputLabel={
          pendingAction === 'reject' || pendingAction === 'cancel'
            ? 'Reason (optional)'
            : pendingAction === 'start'
              ? 'Progress note (optional)'
              : pendingAction === 'complete'
                ? 'Completion note (optional)'
                : undefined
        }
        inputPlaceholder={
          pendingAction === 'reject'
            ? 'Duplicate of an existing task...'
            : pendingAction === 'cancel'
              ? 'No longer required...'
              : pendingAction === 'start'
                ? 'Starting implementation...'
                : pendingAction === 'complete'
                  ? 'Completed and verified...'
                  : undefined
        }
        inputValue={actionNote}
        onInputChange={setActionNote}
        onClose={closeActionModal}
        onConfirm={confirmPendingAction}
      />

      <TaskEditModal
        isOpen={showEditModal}
        initialValues={taskEditValues}
        onClose={() => setShowEditModal(false)}
        onSave={saveTaskEdit}
      />

    </section>
  );
};
