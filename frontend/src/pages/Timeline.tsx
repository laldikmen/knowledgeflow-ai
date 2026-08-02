import React, { useState } from 'react';
import { Card } from '../components/Card';
import './Timeline.css';

interface TimelineEvent {
  id: number;
  date: string;
  title: string;
  description: string;
  type: 'document' | 'decision' | 'task' | 'meeting';
  project: string;
  icon: string;
}

export const Timeline: React.FC = () => {
  const [selectedType, setSelectedType] = useState<'all' | TimelineEvent['type']>('all');

  const events: TimelineEvent[] = [
    {
      id: 1,
      date: 'Jul 7, 2026',
      title: 'Meeting transcript uploaded',
      description: 'Project Alpha Weekly Meeting',
      type: 'document',
      project: 'Project Alpha',
      icon: '📄',
    },
    {
      id: 2,
      date: 'Jul 7, 2026',
      title: 'Decision confirmed',
      description: '"Use Amazon S3 for document storage"',
      type: 'decision',
      project: 'Project Alpha',
      icon: '✓',
    },
    {
      id: 3,
      date: 'Jul 8, 2026',
      title: '2 tasks created & confirmed',
      description: '"Create upload API" and "Prepare frontend wireframe"',
      type: 'task',
      project: 'Project Alpha',
      icon: '✓',
    },
    {
      id: 4,
      date: 'Jul 9, 2026',
      title: 'Task started',
      description: 'Inci moved "Prepare frontend wireframe" to In Progress',
      type: 'task',
      project: 'Project Alpha',
      icon: '▶',
    },
    {
      id: 5,
      date: 'Jul 9, 2026',
      title: 'Task completed',
      description: 'Inci completed "Define API schema"',
      type: 'task',
      project: 'Project Alpha',
      icon: '✓',
    },
    {
      id: 6,
      date: 'Jul 5, 2026',
      title: 'Document uploaded',
      description: 'MVP Scope.docx',
      type: 'document',
      project: 'Project Alpha',
      icon: '📄',
    },
    {
      id: 7,
      date: 'Jul 6, 2026',
      title: 'Document upload failed',
      description: 'Legacy Notes.pdf - OCR failed',
      type: 'document',
      project: 'Project Alpha',
      icon: '⚠',
    },
    {
      id: 8,
      date: 'Jul 8, 2026',
      title: 'Document uploaded',
      description: 'Kickoff Deck.pptx',
      type: 'document',
      project: 'Project Alpha',
      icon: '📄',
    },
  ];

  const filteredEvents =
    selectedType === 'all' ? events : events.filter(e => e.type === selectedType);

  const getTypeLabel = (type: TimelineEvent['type']) => {
    const labels: Record<TimelineEvent['type'], string> = {
      document: 'Documents',
      decision: 'Decisions',
      task: 'Tasks',
      meeting: 'Meetings',
    };
    return labels[type];
  };

  const getTypeColor = (type: TimelineEvent['type']) => {
    const colors: Record<TimelineEvent['type'], string> = {
      document: '#e3f2fd',
      decision: '#fff3e0',
      task: '#f3e5f5',
      meeting: '#e8f5e9',
    };
    return colors[type];
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <div>
          <h2>Project Timeline</h2>
          <p className="timeline-subtitle">Complete history of all project events</p>
        </div>
      </div>

      <Card className="timeline-filters">
        <div className="filter-pills">
          {(['all', 'document', 'decision', 'task', 'meeting'] as const).map(type => (
            <button
              key={type}
              className={`pill ${selectedType === type ? 'active' : ''}`}
              onClick={() => setSelectedType(type)}
            >
              {type === 'all' ? 'All events' : getTypeLabel(type)}
            </button>
          ))}
        </div>
      </Card>

      <div className="timeline-container">
        {filteredEvents.length === 0 ? (
          <Card>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              No events found
            </p>
          </Card>
        ) : (
          <div className="timeline-line">
            {filteredEvents.map((event, index) => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-marker" style={{ backgroundColor: getTypeColor(event.type) }}>
                  <span className="marker-icon">{event.icon}</span>
                </div>

                <div className="timeline-content">
                  <div className="timeline-date">{event.date}</div>

                  <Card className="timeline-card">
                    <div className="card-header-section">
                      <h3 className="event-title">{event.title}</h3>
                      <span className="event-type" style={{ backgroundColor: getTypeColor(event.type) }}>
                        {getTypeLabel(event.type)}
                      </span>
                    </div>

                    <p className="event-description">{event.description}</p>

                    <p className="event-project">{event.project}</p>
                  </Card>
                </div>

                {index < filteredEvents.length - 1 && <div className="timeline-connector" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
