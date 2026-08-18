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


const DEPARTMENTS = ['All departments', 'Software', 'Product', 'People', 'Legal'];

const toRole = (role?: string): ProjectRole => {
  if (role === 'contributor') return 'Contributor';
  if (role === 'viewer') return 'Viewer';
  return 'Manager';
};

// Map a raw project record from the backend into the card shape used here.
const mapProject = (raw: any): Project => ({
  id: raw.id,
  name: raw.name,
  department: raw.department_name || '—',
  role: toRole(raw.project_role),
  confirmed: Number(raw.confirmed_task_count ?? 0),
  inProgress: Number(raw.in_progress_task_count ?? 0),
  overdue: Number(raw.overdue_task_count ?? 0),
  documents: Number(raw.document_count ?? 0),
  risk: (raw.risk_level as RiskLevel) || 'Low',
});

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDepartment, setActiveDepartment] = useState('All departments');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await client.get('/projects');
        const list = Array.isArray(response.data) ? response.data : [];
        setProjects(list.map(mapProject));
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setProjects([]);
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
