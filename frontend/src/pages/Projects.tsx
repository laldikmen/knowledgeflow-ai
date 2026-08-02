import { useEffect, useState } from 'react';
import client from '../api/client';

interface Project {
  id: number;
  name: string;
  description: string | null;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await client.get('/projects');
        setProjects(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch projects');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return (
    <div className="projects-page">
      <h2>Projects</h2>

      {loading && <p>Loading projects...</p>}
      {error && <p className="error">{error}</p>}

      {projects.length === 0 && !loading && !error && (
        <div className="empty-state">
          <p>No projects yet. Create one to get started!</p>
        </div>
      )}

      {projects.length > 0 && (
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <h3>{project.name}</h3>
              {project.description && <p>{project.description}</p>}
              <button className="btn-primary">View Project</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
