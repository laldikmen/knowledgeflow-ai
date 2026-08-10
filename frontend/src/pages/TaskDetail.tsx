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

  useEffect(() => {
    const fetchTask = async () => {
      setIsLoading(true);
      try {
        const response = await client.get(`/tasks/${numericTaskId}`);
        const data = response.data;

        const extractInitials = (name: string): string => {
          const parts = name.trim().split(/\s+/).filter(Boolean);
          if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
          }
          return parts[0]?.slice(0, 2).toUpperCase() || 'U';
        };

        const taskData: TaskDetailData = {
          id: data.id,
          title: data.title,
          description: data.description,
          projectName: data.project_name,
          ownerName: data.owner_name,
          ownerInitials: extractInitials(data.owner_name),
          deadline: data.deadline,
          risk: data.risk_level || 'low',
          status: data.status,
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
          history: buildHistory(data.status, data.owner_name),
        };

        setTask(taskData);
      } catch (error) {
        console.error('Failed to load task', error);
        setTask(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (numericTaskId) {
      fetchTask();
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

  const confirmPendingAction = () => {
    if (!pendingAction) return;

    const statusByAction: Record<PendingTaskAction, TaskStatus> = {
      confirm: 'confirmed',
      reject: 'rejected',
      start: 'in-progress',
      complete: 'completed',
      cancel: 'cancelled',
    };

    setTask((current) => {
      if (!current) return current;

      const trimmedNote = actionNote.trim();
      const nextStatus = statusByAction[pendingAction];
      const nextHistoryId =
        current.history.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      const nextNoteId =
        current.notes.reduce((max, item) => Math.max(max, item.id), 0) + 1;

      const historyContent: Record<PendingTaskAction, { title: string; detail: string }> = {
        confirm: {
          title: `Confirmed by ${currentUserName}`,
          detail: `Assigned to ${current.ownerName}`,
        },
        reject: {
          title: `Rejected by ${currentUserName}`,
          detail: trimmedNote || 'AI extraction rejected',
        },
        start: {
          title: `Started by ${currentUserName}`,
          detail: trimmedNote || 'Work moved to In Progress',
        },
        complete: {
          title: `Completed by ${currentUserName}`,
          detail: trimmedNote || 'Task marked complete',
        },
        cancel: {
          title: `Cancelled by ${currentUserName}`,
          detail: trimmedNote || 'Task was no longer required',
        },
      };

      const shouldAddNote =
        Boolean(trimmedNote) && ['start', 'complete'].includes(pendingAction);

      return {
        ...current,
        status: nextStatus,
        overdueDays: ['completed', 'cancelled', 'rejected'].includes(nextStatus)
          ? undefined
          : current.overdueDays,
        notes: shouldAddNote
          ? [
              ...current.notes,
              {
                id: nextNoteId,
                author: currentUserName,
                initials:
                  currentUserName
                    .split(/\s+/)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'U',
                text: trimmedNote,
                date: 'Today',
              },
            ]
          : current.notes,
        history: [
          ...current.history,
          {
            id: nextHistoryId,
            status: nextStatus,
            title: historyContent[pendingAction].title,
            detail: historyContent[pendingAction].detail,
            date: 'Today',
          },
        ],
      };
    });

    closeActionModal();
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

  const saveTaskEdit = (values: TaskEditValues) => {
    setTask((current) => {
      if (!current) return current;

      const ownerParts = values.owner.split(/\s+/).filter(Boolean);
      const ownerInitials =
        ownerParts.length > 1
          ? `${ownerParts[0][0]}${ownerParts[ownerParts.length - 1][0]}`.toUpperCase()
          : ownerParts[0]?.slice(0, 2).toUpperCase() || current.ownerInitials;
      const nextHistoryId =
        current.history.reduce((max, item) => Math.max(max, item.id), 0) + 1;

      return {
        ...current,
        title: values.title,
        description: values.description,
        sourceReference: values.sourceContext,
        ownerName: values.owner,
        ownerInitials,
        deadline: values.deadline || undefined,
        risk: values.risk,
        projectName: values.projectName,
        status: 'draft',
        history: [
          ...current.history,
          {
            id: nextHistoryId,
            status: 'draft',
            title: `Draft edited by ${currentUserName}`,
            detail: 'Task details updated and returned to Draft',
            date: 'Today',
          },
        ],
      };
    });

    setShowEditModal(false);
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
