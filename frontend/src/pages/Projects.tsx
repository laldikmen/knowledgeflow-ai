import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import './Projects.css';

type ProjectRole = 'Manager' | 'Contributor' | 'Viewer';
type RiskLevel = 'Low' | 'Medium' | 'High';

interface Project {
  id: number;
  name: string;
  department: string;
  role: ProjectRole;
  confirmed: number;
  inProgress: number;
  overdue: number;
  documents: number;
  risk: RiskLevel;
}

const FALLBACK_PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Project Alpha',
    department: 'Software',
    role: 'Manager',
    confirmed: 24,
    inProgress: 9,
    overdue: 3,
    documents: 8,
    risk: 'Medium',
  },
  {
    id: 2,
    name: 'Project Beta',
    department: 'Software',
    role: 'Contributor',
    confirmed: 31,
    inProgress: 14,
    overdue: 7,
    documents: 12,
    risk: 'High',
  },
  {
    id: 3,
    name: 'Onboarding Revamp',
    department: 'People',
    role: 'Viewer',
    confirmed: 10,
    inProgress: 3,
    overdue: 0,
    documents: 5,
    risk: 'Low',
  },
  {
    id: 4,
    name: 'Data Migration',
    department: 'Software',
    role: 'Manager',
    confirmed: 18,
    inProgress: 6,
    overdue: 4,
    documents: 15,
    risk: 'High',
  },
  {
    id: 5,
    name: 'Mobile App v3',
    department: 'Product',
    role: 'Manager',
    confirmed: 21,
    inProgress: 8,
    overdue: 1,
    documents: 9,
    risk: 'Medium',
  },
  {
    id: 6,
    name: 'Q3 Compliance',
    department: 'Legal',
    role: 'Viewer',
    confirmed: 7,
    inProgress: 2,
    overdue: 0,
    documents: 6,
    risk: 'Low',
  },
];

const DEPARTMENTS = ['All departments', 'Software', 'Product', 'People', 'Legal'];

const hasProjectCardData = (value: unknown): value is Project[] => {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((project) => {
    if (!project || typeof project !== 'object') return false;

    return (
      'department' in project &&
      'role' in project &&
      'confirmed' in project &&
      'inProgress' in project &&
      'overdue' in project &&
      'documents' in project &&
      'risk' in project
    );
  });
};

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDepartment, setActiveDepartment] = useState('All departments');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await client.get('/projects');

        setProjects(
          hasProjectCardData(response.data)
            ? response.data
            : FALLBACK_PROJECTS,
        );
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setProjects(FALLBACK_PROJECTS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    if (activeDepartment === 'All departments') {
      return projects;
    }

    return projects.filter(
      (project) => project.department === activeDepartment,
    );
  }, [activeDepartment, projects]);

  if (isLoading) {
    return <div className="projects">Loading projects...</div>;
  }

  return (
    <section className="projects">
      <div className="projects-filters" aria-label="Filter projects by department">
        {DEPARTMENTS.map((department) => (
          <button
            type="button"
            key={department}
            className={`projects-filter ${
              activeDepartment === department ? 'active' : ''
            }`}
            onClick={() => setActiveDepartment(department)}
          >
            {department}
          </button>
        ))}
      </div>

      {filteredProjects.length > 0 ? (
        <div className="projects-grid">
          {filteredProjects.map((project) => (
            <article
              className="project-card"
              key={project.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${project.name}`}
              onClick={() => navigate(`/projects/${project.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/projects/${project.id}`);
                }
              }}
            >
              <div className="project-card-header">
                <div>
                  <h2 className="project-name">{project.name}</h2>
                  <p className="project-department">
                    {project.department} Department
                  </p>
                </div>

                <span
                  className={`project-role project-role--${project.role.toLowerCase()}`}
                >
                  {project.role}
                </span>
              </div>

              <div className="project-divider" />

              <div className="project-metrics">
                <div className="project-metric">
                  <strong>{project.confirmed}</strong>
                  <span>Confirmed</span>
                </div>

                <div className="project-metric">
                  <strong>{project.inProgress}</strong>
                  <span>In progress</span>
                </div>

                <div
                  className={`project-metric ${
                    project.overdue > 0 ? 'project-metric--overdue' : ''
                  }`}
                >
                  <strong>{project.overdue}</strong>
                  <span>Overdue</span>
                </div>
              </div>

              <div className="project-divider" />

              <div className="project-card-footer">
                <span>{project.documents} documents</span>

                <span
                  className={`project-risk project-risk--${project.risk.toLowerCase()}`}
                >
                  <span className="project-risk-dot" />
                  {project.risk}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="projects-empty">
          <h2>No projects found</h2>
          <p>There are no projects in this department.</p>
        </div>
      )}
    </section>
  );
};
