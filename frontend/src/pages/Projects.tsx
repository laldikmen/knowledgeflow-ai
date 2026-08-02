import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import client from '../api/client';

interface Project {
  id: number;
  name: string;
  description: string | null;
}

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        // Use mock data if API fails
        setTimeout(() => {
          setProjects([
            {
              id: 1,
              name: 'Project Alpha',
              description: 'Mobile app redesign and infrastructure upgrade',
            },
            {
              id: 2,
              name: 'Onboarding Initiative',
              description: 'New employee onboarding process automation',
            },
            {
              id: 3,
              name: 'Q4 Planning',
              description: 'Strategic planning for Q4 product roadmap',
            },
          ]);
          setError(null);
        }, 500);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  if (isLoading) {
    return <div className="projects">Loading projects...</div>;
  }

  if (error && projects.length === 0) {
    return (
      <div className="projects">
        <div className="projects-error">
          <p>{error}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="projects">
        <div className="projects-empty">
          <h2>No projects yet</h2>
          <p>Create a project to get started</p>
          <Button variant="primary">Create Project</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="projects">
      <div className="projects-header">
        <h2>Projects</h2>
        <Button variant="primary">Create Project</Button>
      </div>

      <div className="projects-grid">
        {projects.map((project) => (
          <Card key={project.id} className="project-card">
            <h3 className="project-name">{project.name}</h3>
            {project.description && (
              <p className="project-description">{project.description}</p>
            )}
            <Button variant="secondary" size="small" fullWidth>
              View Project
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
};
