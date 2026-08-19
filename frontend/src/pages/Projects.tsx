import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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


const ALL_DEPARTMENTS = 'All departments';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeDepartment, setActiveDepartment] = useState(ALL_DEPARTMENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', department_name: '', description: '' });
  const [createError, setCreateError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    fetchProjects();
  }, []);

  // The header's "Create Project" button navigates here with ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreateModal();
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openCreateModal = () => {
    setCreateForm({ name: '', department_name: '', description: '' });
    setCreateError('');
    setIsCreateOpen(true);
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createForm.name.trim()) {
      setCreateError('Project name is required.');
      return;
    }
    setIsSaving(true);
    try {
      await client.post('/projects', {
        name: createForm.name.trim(),
        department_name: createForm.department_name.trim() || undefined,
        description: createForm.description.trim() || undefined,
      });
      await fetchProjects();
      setIsCreateOpen(false);
    } catch (error: any) {
      setCreateError(error.response?.data?.error || 'Could not create the project.');
    } finally {
      setIsSaving(false);
    }
  };

  // Header search filters the project list by name (live via the ?q= param).
  const searchQuery = searchParams.get('q')?.trim().toLowerCase() ?? '';

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesDepartment =
        activeDepartment === ALL_DEPARTMENTS ||
        project.department === activeDepartment;
      const matchesSearch =
        !searchQuery || project.name.toLowerCase().includes(searchQuery);
      return matchesDepartment && matchesSearch;
    });
  }, [activeDepartment, projects, searchQuery]);

  // Department filter pills are derived from the actual projects, so a project
  // created with a brand-new department name automatically gets its own pill.
  const departments = useMemo(() => {
    const unique = Array.from(
      new Set(
        projects
          .map((project) => project.department)
          .filter((department) => department && department !== '—'),
      ),
    ).sort((a, b) => a.localeCompare(b));
    return [ALL_DEPARTMENTS, ...unique];
  }, [projects]);

  if (isLoading) {
    return <div className="projects">Loading projects...</div>;
  }

  return (
    <section className="projects">
      <div className="projects-filters" aria-label="Filter projects by department">
        {departments.map((department) => (
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

      {isCreateOpen && (
        <div
          className="project-create-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCreateOpen(false);
          }}
        >
          <form className="project-create-modal" onSubmit={submitCreate} role="dialog" aria-modal="true">
            <div className="project-create-header">
              <h2>Create project</h2>
              <button type="button" aria-label="Close" onClick={() => setIsCreateOpen(false)}>×</button>
            </div>

            <label className="project-create-field">
              <span>Project name</span>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Project Gamma"
                autoFocus
              />
            </label>

            <label className="project-create-field">
              <span>Department</span>
              <input
                value={createForm.department_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, department_name: e.target.value }))}
                placeholder="Software"
              />
            </label>

            <label className="project-create-field">
              <span>Description</span>
              <textarea
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is this project about?"
              />
            </label>

            {createError && <div className="project-create-error">{createError}</div>}

            <div className="project-create-actions">
              <button type="button" className="project-create-btn project-create-btn--secondary" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="project-create-btn project-create-btn--primary" disabled={isSaving}>
                Create project
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
