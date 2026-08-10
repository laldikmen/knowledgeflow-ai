import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import './ActionTracker.css';
import { ConfirmationModal } from '../components/ConfirmationModal';

type TaskStatus = 'draft' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
type TaskRisk = 'low' | 'medium' | 'high';
type ProjectFilter = 'all' | 'alpha' | 'beta';

interface ProjectOption {
  id: Exclude<ProjectFilter, 'all'>;
  shortName: string;
  fullName: string;
  totalTasks: number;
}

interface Task {
  id: number;
  title: string;
  projectId: Exclude<ProjectFilter, 'all'>;
  projectName: string;
  ownerInitials: string;
  ownerName: string;
  dueDate?: string;
  status: TaskStatus;
  risk?: TaskRisk;
  overdue?: boolean;
}

interface BoardColumn {
  status: TaskStatus;
  label: string;
  tasks: Task[];
}

interface ActionTrackerProps {
  currentUserName?: string;
}

const PROJECTS: ProjectOption[] = [
  {
    id: 'alpha',
    shortName: 'Alpha',
    fullName: 'Project Alpha',
    totalTasks: 42,
  },
  {
    id: 'beta',
    shortName: 'Beta',
    fullName: 'Project Beta',
    totalTasks: 18,
  },
];

const TASKS: Task[] = [
  {
    id: 1,
    title: 'Prepare frontend wireframe',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'I',
    ownerName: 'Inci',
    status: 'draft',
    risk: 'high',
  },
  {
    id: 2,
    title: 'Draft API rate-limit policy',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'JL',
    ownerName: 'Jordan Lee',
    status: 'draft',
    risk: 'low',
  },
  {
    id: 3,
    title: 'Create upload API',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'I',
    ownerName: 'Inci',
    dueDate: 'Jul 20',
    status: 'confirmed',
    risk: 'medium',
  },
  {
    id: 4,
    title: 'Set up S3 buckets',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'JL',
    ownerName: 'Jordan Lee',
    dueDate: 'Jul 22',
    status: 'confirmed',
    risk: 'low',
  },
  {
    id: 5,
    title: 'Prepare frontend wireframe',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'I',
    ownerName: 'Inci',
    dueDate: 'Jul 8',
    status: 'in-progress',
    risk: 'high',
    overdue: true,
  },
  {
    id: 6,
    title: 'Write API integration tests',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'JL',
    ownerName: 'Jordan Lee',
    dueDate: 'Jul 24',
    status: 'in-progress',
    risk: 'medium',
  },
  {
    id: 7,
    title: 'Define API schema',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'I',
    ownerName: 'Inci',
    status: 'completed',
    risk: 'medium',
  },
  {
    id: 8,
    title: 'Storage vendor review',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'AM',
    ownerName: 'Alex Morgan',
    status: 'completed',
    risk: 'low',
  },
  {
    id: 9,
    title: 'Evaluate Azure Blob',
    projectId: 'alpha',
    projectName: 'Project Alpha',
    ownerInitials: 'JL',
    ownerName: 'Jordan Lee',
    status: 'cancelled',
    risk: 'low',
  },
  {
    id: 10,
    title: 'Review vendor SLA',
    projectId: 'beta',
    projectName: 'Project Beta',
    ownerInitials: 'AM',
    ownerName: 'Alex Morgan',
    status: 'draft',
    risk: 'high',
  },
  {
    id: 11,
    title: 'Define data-retention rules',
    projectId: 'beta',
    projectName: 'Project Beta',
    ownerInitials: 'I',
    ownerName: 'Inci',
    dueDate: 'Jul 25',
    status: 'confirmed',
    risk: 'medium',
  },
  {
    id: 12,
    title: 'Migrate audit logs',
    projectId: 'beta',
    projectName: 'Project Beta',
    ownerInitials: 'AM',
    ownerName: 'Alex Morgan',
    dueDate: 'Jul 10',
    status: 'in-progress',
    risk: 'high',
    overdue: true,
  },
  {
    id: 13,
    title: 'Approve CRM access matrix',
    projectId: 'beta',
    projectName: 'Project Beta',
    ownerInitials: 'JL',
    ownerName: 'Jordan Lee',
    status: 'completed',
    risk: 'low',
  },
];

const COLUMN_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const BOARD_STATUSES: TaskStatus[] = [
  'draft',
  'confirmed',
  'in-progress',
  'completed',
  'cancelled',
];

export const ActionTracker: React.FC<ActionTrackerProps> = ({
  currentUserName = 'Alex Morgan',
}) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectFilter>('alpha');
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: 'confirm' | 'reject';
    taskId: number;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await client.get('/tasks');
        const tasksData = response.data.map((task: any) => ({
          id: task.id,
          title: task.title,
          projectId: task.project_id || 'alpha',
          projectName: task.project_name,
          ownerInitials: task.owner_name
            .split(/\s+/)
            .map((part: string) => part[0])
            .join('')
            .toUpperCase()
            .slice(0, 2),
          ownerName: task.owner_name,
          dueDate: task.deadline,
          status: task.status || 'draft',
          risk: task.risk_level || 'medium',
          overdue: task.overdue_days && task.overdue_days > 0,
        }));
        setTasks(tasksData);
      } catch (error) {
        console.error('Failed to load tasks', error);
        setTasks(TASKS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesProject =
        selectedProjectId === 'all' || task.projectId === selectedProjectId;
      const matchesRisk = !highRiskOnly || task.risk === 'high';
      const matchesAssignee = !assignedToMe || task.ownerName === currentUserName;
      const matchesOverdue = !overdueOnly || task.overdue === true;

      return matchesProject && matchesRisk && matchesAssignee && matchesOverdue;
    });
  }, [assignedToMe, currentUserName, highRiskOnly, overdueOnly, selectedProjectId, tasks]);

  const boardColumns = useMemo<BoardColumn[]>(() => {
    return BOARD_STATUSES.map((status) => ({
      status,
      label: COLUMN_LABELS[status],
      tasks: visibleTasks.filter((task) => task.status === status),
    }));
  }, [visibleTasks]);

  const selectedProject = PROJECTS.find((project) => project.id === selectedProjectId);
  const allProjectTaskCount = PROJECTS.reduce(
    (total, project) => total + project.totalTasks,
    0,
  );

  const pageSubtitle =
    selectedProjectId === 'all'
      ? `${allProjectTaskCount} tasks across ${PROJECTS.length} projects`
      : `${selectedProject?.fullName ?? 'Project'} · ${selectedProject?.totalTasks ?? 0} tasks`;

  const renderRisk = (risk?: TaskRisk) => {
    if (!risk) return null;

    return (
      <span className={`tracker-priority tracker-priority--${risk}`}>
        <span className="tracker-priority-dot" />
        {risk.charAt(0).toUpperCase() + risk.slice(1)}
      </span>
    );
  };

  const renderTaskCard = (task: Task) => (
    <article
      key={task.id}
      className={`tracker-task-card tracker-task-card--${task.status} ${
        task.overdue ? 'tracker-task-card--overdue' : ''
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Open task: ${task.title}`}
      onClick={() => navigate(`/tasks/${task.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/tasks/${task.id}`);
        }
      }}
    >
      {task.overdue && (
        <div className="tracker-overdue-label">
          <span className="tracker-overdue-dot" />
          Overdue
        </div>
      )}

      <h3 className="tracker-task-title">{task.title}</h3>

      <div className="tracker-task-meta">
        <span className="tracker-avatar" title={task.ownerName}>
          {task.ownerInitials}
        </span>

        {task.dueDate && (
          <span className={task.overdue ? 'tracker-date tracker-date--overdue' : 'tracker-date'}>
            {task.dueDate}
          </span>
        )}

        {renderRisk(task.risk)}

        {task.status === 'completed' && (
          <span className="tracker-state-pill tracker-state-pill--completed">Completed</span>
        )}

        {task.status === 'cancelled' && (
          <span className="tracker-state-pill tracker-state-pill--cancelled">Cancelled</span>
        )}
      </div>

      {task.status === 'draft' && (
        <div className="tracker-draft-actions">
          <button
            type="button"
            className="tracker-draft-action tracker-draft-action--confirm"
            onClick={(event) => {
              event.stopPropagation();
              setActionReason('');
              setPendingAction({ type: 'confirm', taskId: task.id });
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            className="tracker-draft-action tracker-draft-action--reject"
            onClick={(event) => {
              event.stopPropagation();
              setActionReason('');
              setPendingAction({ type: 'reject', taskId: task.id });
            }}
          >
            Reject
          </button>
        </div>
      )}
    </article>
  );

  const pendingTask = pendingAction
    ? tasks.find((task) => task.id === pendingAction.taskId) ?? null
    : null;

  const closeConfirmation = () => {
    setPendingAction(null);
    setActionReason('');
  };

  const confirmPendingAction = () => {
    if (!pendingAction || !pendingTask) return;

    if (pendingAction.type === 'confirm') {
      setTasks((current) =>
        current.map((task) =>
          task.id === pendingTask.id ? { ...task, status: 'confirmed' } : task,
        ),
      );
    } else {
      setTasks((current) =>
        current.filter((task) => task.id !== pendingTask.id),
      );
    }

    closeConfirmation();
  };

  if (isLoading) {
    return <div className="action-tracker">Loading tasks...</div>;
  }

  return (
    <div className="action-tracker">
      <div className="tracker-page-header">
        <div>
          <h1>Action Tracker</h1>
          <p>{pageSubtitle}</p>
        </div>

        <div className="tracker-view-toggle" aria-label="Action tracker view">
          <button
            type="button"
            className={viewMode === 'board' ? 'active' : ''}
            aria-pressed={viewMode === 'board'}
            onClick={() => setViewMode('board')}
          >
            Board
          </button>
          <button
            type="button"
            className={viewMode === 'table' ? 'active' : ''}
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
        </div>
      </div>

      <div className="tracker-filter-row" aria-label="Action tracker filters">
        <label className="tracker-project-filter">
          <span className="tracker-visually-hidden">Filter by project</span>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value as ProjectFilter)}
            aria-label="Filter tasks by project"
          >
            <option value="all">Project: All</option>
            {PROJECTS.map((project) => (
              <option key={project.id} value={project.id}>
                Project: {project.shortName}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`tracker-filter ${highRiskOnly ? 'tracker-filter--active' : ''}`}
          aria-pressed={highRiskOnly}
          onClick={() => setHighRiskOnly((current) => !current)}
        >
          Risk: high
        </button>

        <button
          type="button"
          className={`tracker-filter ${assignedToMe ? 'tracker-filter--active' : ''}`}
          aria-pressed={assignedToMe}
          onClick={() => setAssignedToMe((current) => !current)}
        >
          Assigned to me
        </button>

        <button
          type="button"
          className={`tracker-filter tracker-filter--overdue ${overdueOnly ? 'active' : ''}`}
          aria-pressed={overdueOnly}
          onClick={() => setOverdueOnly((current) => !current)}
        >
          Overdue only
        </button>
      </div>

      {viewMode === 'board' ? (
        <div className="tracker-board">
          {boardColumns.map((column) => (
            <section key={column.status} className={`tracker-column tracker-column--${column.status}`}>
              <div className="tracker-column-header">
                <div className="tracker-column-title-wrap">
                  <span className={`tracker-column-dot tracker-column-dot--${column.status}`} />
                  <h2>{column.label}</h2>
                </div>
                <span className="tracker-column-count">{column.tasks.length}</span>
              </div>

              <div className="tracker-column-tasks">
                {column.tasks.map(renderTaskCard)}

                {column.status === 'cancelled' && column.tasks.length > 0 && (
                  <div className="tracker-empty-card">No other cancelled tasks</div>
                )}

                {column.tasks.length === 0 && (
                  <div className="tracker-empty-card">No matching tasks</div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Due date</th>
                <th>Risk</th>
              </tr>
            </thead>
            <tbody>
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <tr
                    key={task.id}
                    tabIndex={0}
                    aria-label={`Open task: ${task.title}`}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/tasks/${task.id}`);
                      }
                    }}
                  >
                    <td>{task.title}</td>
                    <td>{task.projectName}</td>
                    <td>{COLUMN_LABELS[task.status]}</td>
                    <td>{task.ownerName}</td>
                    <td>{task.dueDate ?? '—'}</td>
                    <td>{task.risk ? renderRisk(task.risk) : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="tracker-table-empty">
                    No tasks match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(pendingAction && pendingTask)}
        title={
          pendingAction?.type === 'reject'
            ? 'Reject this action item?'
            : 'Confirm this action item?'
        }
        description={
          pendingTask ? (
            pendingAction?.type === 'reject' ? (
              <p>
                “{pendingTask.title}” will be marked <strong>Rejected</strong> and
                will not become a tracked task. It will remain available in the
                source document history.
              </p>
            ) : (
              <p>
                “{pendingTask.title}” will become a <strong>Confirmed</strong>{' '}
                task in {pendingTask.projectName} and can then be started by its
                owner.
              </p>
            )
          ) : null
        }
        confirmLabel={pendingAction?.type === 'reject' ? 'Reject item' : 'Confirm task'}
        cancelLabel="Back"
        tone={pendingAction?.type === 'reject' ? 'danger' : 'default'}
        inputLabel={pendingAction?.type === 'reject' ? 'Reason (optional)' : undefined}
        inputPlaceholder={
          pendingAction?.type === 'reject'
            ? 'Duplicate of an existing task...'
            : undefined
        }
        inputValue={actionReason}
        onInputChange={setActionReason}
        onClose={closeConfirmation}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
};
