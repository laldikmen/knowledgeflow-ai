import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
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

const iconForEvent = (
  type: TimelineEventType,
  taskStatus?: string | null,
): TimelineEvent['icon'] => {
  if (type === 'document') return 'document';
  if (type === 'decision') return 'check';
  const status = taskStatus || '';
  if (status.includes('progress')) return 'play';
  if (status === 'completed' || status === 'confirmed') return 'check';
  return 'task';
};

export const Timeline: React.FC = () => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedType, setSelectedType] = useState<TimelineFilter>('all');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectsResponse = await client.get('/projects');
        const projectsData = projectsResponse.data.map((proj: any) => ({
          id: proj.id.toString(),
          name: proj.name,
        }));
        setProjects(projectsData);
        if (projectsData.length > 0) {
          setSelectedProjectId(projectsData[0].id);
        }
      } catch (error) {
        console.error('Failed to load projects', error);
        setProjects([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Load the activity feed whenever the selected project changes.
  useEffect(() => {
    if (!selectedProjectId) {
      setEvents([]);
      return;
    }

    const fetchTimeline = async () => {
      try {
        const response = await client.get(`/timeline/${selectedProjectId}`);
        const mapped: TimelineEvent[] = response.data.map(
          (row: any, index: number) => {
            const when = row.ts ? new Date(row.ts) : null;
            return {
              id: index,
              projectId: selectedProjectId,
              date: when
                ? when.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '',
              time: when
                ? when.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '',
              title: row.title,
              description: row.description,
              type: row.type as TimelineEventType,
              icon: iconForEvent(row.type, row.task_status),
            };
          },
        );
        setEvents(mapped);
      } catch (error) {
        console.error('Failed to load timeline', error);
        setEvents([]);
      }
    };

    fetchTimeline();
  }, [selectedProjectId]);

  const selectedProject =
    projects.find(project => project.id === selectedProjectId) ?? null;

  const filteredEvents = useMemo(
    () =>
      events.filter(
        event =>
          event.projectId === selectedProjectId &&
          (selectedType === 'all' || event.type === selectedType),
      ),
    [events, selectedProjectId, selectedType],
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

  // Early returns must come AFTER all hooks (Rules of Hooks).
  if (isLoading) {
    return <section className="timeline-page">Loading...</section>;
  }

  if (projects.length === 0) {
    return <section className="timeline-page">No projects available.</section>;
  }

  return (
    <section className="timeline-page" aria-labelledby="timeline-title">
      <header className="timeline-page-header">
        <div className="timeline-heading">
          <h1 id="timeline-title">{selectedProject?.name} · Timeline</h1>
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
