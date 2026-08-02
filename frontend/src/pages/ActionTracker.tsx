import React, { useState } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import './ActionTracker.css';

interface Task {
  id: number;
  title: string;
  project: string;
  owner: string;
  ownerInitials: string;
  dueDate: string;
  status: 'draft' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  risk?: 'low' | 'medium' | 'high';
}

export const ActionTracker: React.FC = () => {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filterStatus, setFilterStatus] = useState<'all' | Task['status']>('all');

  const tasks: Task[] = [
    {
      id: 1,
      title: 'Prepare frontend wireframe',
      project: 'Project Alpha',
      owner: 'Inci',
      ownerInitials: 'I',
      dueDate: 'Jul 8, 2026',
      status: 'in-progress',
      priority: 'high',
      risk: 'high',
    },
    {
      id: 2,
      title: 'Create upload API',
      project: 'Project Alpha',
      owner: 'Jordan Lee',
      ownerInitials: 'JL',
      dueDate: 'Jul 20',
      status: 'confirmed',
      priority: 'medium',
    },
    {
      id: 3,
      title: 'Setup S3 buckets',
      project: 'Project Alpha',
      owner: 'Alex Morgan',
      ownerInitials: 'AM',
      dueDate: 'Jul 22',
      status: 'confirmed',
      priority: 'low',
    },
    {
      id: 4,
      title: 'Define API schema',
      project: 'Project Alpha',
      owner: 'Alex Morgan',
      ownerInitials: 'AM',
      dueDate: 'Jul 9',
      status: 'completed',
      priority: 'high',
    },
    {
      id: 5,
      title: 'Write API integration tests',
      project: 'Project Alpha',
      owner: 'Jordan Lee',
      ownerInitials: 'JL',
      dueDate: 'Jul 24',
      status: 'confirmed',
      priority: 'medium',
    },
    {
      id: 6,
      title: 'Evaluate Azure Blob',
      project: 'Project Alpha',
      owner: 'Alex Morgan',
      ownerInitials: 'AM',
      dueDate: 'Jul 15',
      status: 'cancelled',
      priority: 'low',
    },
  ];

  const filteredTasks = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  const getStatusColor = (status: Task['status']) => {
    const colors: Record<Task['status'], string> = {
      draft: '#e0e0e0',
      confirmed: '#fff3e0',
      'in-progress': '#e3f2fd',
      completed: '#e8f5e9',
      cancelled: '#ffebee',
    };
    return colors[status];
  };

  const getStatusLabel = (status: Task['status']) => {
    const labels: Record<Task['status'], string> = {
      draft: 'Draft',
      confirmed: 'Confirmed',
      'in-progress': 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status];
  };

  const getPriorityColor = (priority: Task['priority']) => {
    const colors: Record<Task['priority'], string> = {
      low: '#4CAF50',
      medium: '#FFC107',
      high: '#F44336',
    };
    return colors[priority];
  };

  const getBoardColumns = () => {
    const statuses: Task['status'][] = ['draft', 'confirmed', 'in-progress', 'completed'];
    return statuses.map(status => ({
      status,
      label: getStatusLabel(status),
      tasks: tasks.filter(t => t.status === status),
    }));
  };

  return (
    <div className="action-tracker">
      <div className="tracker-header">
        <div>
          <h2>Action Tracker</h2>
          <p className="tracker-subtitle">{filteredTasks.length} tasks</p>
        </div>
        <div className="tracker-controls">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              Board
            </button>
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      <Card className="tracker-filters">
        <div className="filter-chips">
          {(['all', 'draft', 'confirmed', 'in-progress', 'completed'] as const).map(status => (
            <button
              key={status}
              className={`chip ${filterStatus === status ? 'active' : ''}`}
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'All Tasks' : getStatusLabel(status as Task['status'])}
            </button>
          ))}
        </div>
      </Card>

      {viewMode === 'board' ? (
        <div className="tracker-board">
          {getBoardColumns().map(column => (
            <div key={column.status} className="board-column">
              <div className="column-header">
                <h3>{column.label}</h3>
                <span className="column-count">{column.tasks.length}</span>
              </div>
              <div className="column-tasks">
                {column.tasks.map(task => (
                  <div
                    key={task.id}
                    className="task-card"
                    style={{ borderTopColor: getPriorityColor(task.priority) }}
                  >
                    <div className="task-header">
                      <h4 className="task-title">{task.title}</h4>
                      <span
                        className="priority-dot"
                        style={{ backgroundColor: getPriorityColor(task.priority) }}
                        title={task.priority}
                      />
                    </div>
                    <p className="task-project">{task.project}</p>
                    <div className="task-footer">
                      <div className="task-owner">
                        <div className="avatar" title={task.owner}>
                          {task.ownerInitials}
                        </div>
                        <span>{task.owner}</span>
                      </div>
                      <span className="task-date">{task.dueDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="tracker-list">
          {filteredTasks.map(task => (
            <div key={task.id} className="list-item">
              <div className="list-item-content">
                <div className="list-item-header">
                  <h4 className="task-title">{task.title}</h4>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(task.status) }}
                  >
                    {getStatusLabel(task.status)}
                  </span>
                </div>
                <p className="task-meta">
                  {task.project} • Due {task.dueDate}
                </p>
              </div>
              <div className="list-item-actions">
                <span
                  className="priority-dot"
                  style={{ backgroundColor: getPriorityColor(task.priority) }}
                  title={task.priority}
                />
                <div className="avatar">{task.ownerInitials}</div>
                <Button variant="secondary" size="small">
                  View
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
