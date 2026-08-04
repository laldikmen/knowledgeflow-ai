import React, { useMemo, useState } from 'react';
import './Timeline.css';

type TimelineEventType = 'document' | 'decision' | 'task';
type TimelineFilter = 'all' | TimelineEventType;

interface ProjectOption {
  id: string;
  name: string;
}

interface TimelineEvent {
  id: number;
  projectId: string;
  date: string;
  time: string;
  title: string;
  description: string;
  type: TimelineEventType;
  icon: 'document' | 'check' | 'task' | 'play';
}

const projects: ProjectOption[] = [
  { id: 'alpha', name: 'Project Alpha' },
  { id: 'beta', name: 'Project Beta' },
  { id: 'migration', name: 'Data Migration' },
];

const events: TimelineEvent[] = [
  {
    id: 1,
    projectId: 'alpha',
    date: 'Jul 7, 2026',
    time: '09:41',
    title: 'Meeting transcript uploaded',
    description: 'Inci uploaded “Project Alpha Weekly Meeting” · AI processed in 48s',
    type: 'document',
    icon: 'document',
  },
  {
    id: 2,
    projectId: 'alpha',
    date: 'Jul 7, 2026',
    time: '10:03',
    title: 'Decision confirmed',
    description: 'Alex confirmed “Use Amazon S3 for document storage”',
    type: 'decision',
    icon: 'check',
  },
  {
    id: 3,
    projectId: 'alpha',
    date: 'Jul 7, 2026',
    time: '10:05',
    title: '2 tasks created & confirmed',
    description: '“Create upload API” (Inci, Jul 20) · “Prepare frontend wireframe” (Inci, Jul 8)',
    type: 'task',
    icon: 'task',
  },
  {
    id: 4,
    projectId: 'alpha',
    date: 'Jul 9, 2026',
    time: '14:22',
    title: 'Task started',
    description: 'Inci moved “Prepare frontend wireframe” to In Progress',
    type: 'task',
    icon: 'play',
  },
  {
    id: 5,
    projectId: 'alpha',
    date: 'Jul 9, 2026',
    time: '16:48',
    title: 'Task completed',
    description: 'Inci completed “Define API schema”',
    type: 'task',
    icon: 'check',
  },
  {
    id: 6,
    projectId: 'beta',
    date: 'Jul 10, 2026',
    time: '09:18',
    title: 'Requirements document uploaded',
    description: 'Mona uploaded “Project Beta Requirements v1” · AI processed in 36s',
    type: 'document',
    icon: 'document',
  },
  {
    id: 7,
    projectId: 'beta',
    date: 'Jul 10, 2026',
    time: '11:26',
    title: 'Architecture decision confirmed',
    description: 'The team confirmed PostgreSQL as the project database',
    type: 'decision',
    icon: 'check',
  },
  {
    id: 8,
    projectId: 'beta',
    date: 'Jul 11, 2026',
    time: '15:04',
    title: 'Task created',
    description: '“Prepare database schema” assigned to Jordan Lee',
    type: 'task',
    icon: 'task',
  },
  {
    id: 9,
    projectId: 'migration',
    date: 'Jul 12, 2026',
    time: '08:52',
    title: 'Migration plan uploaded',
    description: 'Alex uploaded “Data Migration Plan” · AI processed in 41s',
    type: 'document',
    icon: 'document',
  },
  {
    id: 10,
    projectId: 'migration',
    date: 'Jul 12, 2026',
    time: '10:17',
    title: 'Migration window confirmed',
    description: 'The production migration window was approved for Jul 25',
    type: 'decision',
    icon: 'check',
  },
  {
    id: 11,
    projectId: 'migration',
    date: 'Jul 13, 2026',
    time: '13:35',
    title: 'Validation task started',
    description: 'The data validation checklist moved to In Progress',
    type: 'task',
    icon: 'play',
  },
];

const filterOptions: Array<{ id: TimelineFilter; label: string }> = [
  { id: 'all', label: 'All events' },
  { id: 'document', label: 'Documents' },
  { id: 'task', label: 'Tasks' },
  { id: 'decision', label: 'Decisions' },
];

const EventIcon: React.FC<{ icon: TimelineEvent['icon'] }> = ({ icon }) => {
  if (icon === 'document') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.75h6.7L18 8.05V20.25H7z" />
        <path d="M13.5 3.75v4.5H18" />
      </svg>
    );
  }

  if (icon === 'task') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <path d="M9 10h6M9 14h4" />
      </svg>
    );
  }

  if (icon === 'play') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 7 7 5-7 5z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7.5 12.2 3 3 6-6.4" />
    </svg>
  );
};

export const Timeline: React.FC = () => {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0].id);
  const [selectedType, setSelectedType] = useState<TimelineFilter>('all');

  const selectedProject =
    projects.find(project => project.id === selectedProjectId) ?? projects[0];

  const filteredEvents = useMemo(
    () =>
      events.filter(
        event =>
          event.projectId === selectedProjectId &&
          (selectedType === 'all' || event.type === selectedType),
      ),
    [selectedProjectId, selectedType],
  );

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce<Array<{ date: string; events: TimelineEvent[] }>>(
      (groups, event) => {
        const currentGroup = groups[groups.length - 1];

        if (!currentGroup || currentGroup.date !== event.date) {
          groups.push({ date: event.date, events: [event] });
        } else {
          currentGroup.events.push(event);
        }

        return groups;
      },
      [],
    );
  }, [filteredEvents]);

  const handleProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProjectId(event.target.value);
    setSelectedType('all');
  };

  return (
    <section className="timeline-page" aria-labelledby="timeline-title">
      <header className="timeline-page-header">
        <div className="timeline-heading">
          <h1 id="timeline-title">{selectedProject.name} · Timeline</h1>
          <p>Every document, decision &amp; task event in order</p>
        </div>

        <div className="timeline-header-controls">
          <label className="timeline-project-filter">
            <span>Project</span>
            <select value={selectedProjectId} onChange={handleProjectChange}>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m6.5 8 3.5 3.5L13.5 8" />
            </svg>
          </label>

          <div className="timeline-filter-pills" aria-label="Filter timeline events">
            {filterOptions.map(filter => (
              <button
                key={filter.id}
                type="button"
                className={selectedType === filter.id ? 'active' : ''}
                onClick={() => setSelectedType(filter.id)}
                aria-pressed={selectedType === filter.id}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="timeline-panel">
        {groupedEvents.length === 0 ? (
          <div className="timeline-empty-state">
            <div className="timeline-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 3.75h6.7L18 8.05V20.25H7z" />
                <path d="M13.5 3.75v4.5H18" />
              </svg>
            </div>
            <h2>No events found</h2>
            <p>There are no {selectedType === 'all' ? '' : `${selectedType} `}events for this project.</p>
          </div>
        ) : (
          groupedEvents.map(group => (
            <section className="timeline-day" key={group.date}>
              <h2>{group.date}</h2>

              <div className="timeline-day-events">
                {group.events.map((event, index) => (
                  <article className={`timeline-event timeline-event--${event.icon}`} key={event.id}>
                    <div className="timeline-event-rail" aria-hidden="true">
                      <div className="timeline-event-icon">
                        <EventIcon icon={event.icon} />
                      </div>
                      {index < group.events.length - 1 && <span className="timeline-event-line" />}
                    </div>

                    <div className="timeline-event-body">
                      <h3>{event.title}</h3>
                      <p>{event.description}</p>
                    </div>

                    <time>{event.time}</time>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </section>
  );
};
