import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import './ProjectDetail.css';

type ProjectRole = 'Manager' | 'Contributor' | 'Viewer';
type RiskLevel = 'Low' | 'Medium' | 'High';
type ProjectTab =
  | 'overview'
  | 'documents'
  | 'tasks'
  | 'members'
  | 'activity'
  | 'risk';
type MemberRole = 'Manager' | 'Contributor' | 'Viewer';
type TaskStatus = 'Confirmed' | 'In Progress' | 'Completed' | 'Overdue';

interface ProjectMember {
  id: number;
  name: string;
  email: string;
  initials: string;
  role: MemberRole;
  avatarTone: 'sand' | 'gold' | 'peach' | 'sage' | 'blue';
}

interface ProjectDocument {
  id: number;
  name: string;
  kind: 'Document' | 'Meeting';
  uploadedAt: string;
  uploadedBy: string;
  status: 'Ready' | 'Processing';
}

interface ProjectTask {
  id: number;
  title: string;
  owner: string;
  dueDate: string;
  status: TaskStatus;
}

interface ProjectActivity {
  id: number;
  title: string;
  detail: string;
  time: string;
  type: 'document' | 'decision' | 'task' | 'member';
}

interface ProjectDetailData {
  id: number;
  name: string;
  department: string;
  workstream: string;
  role: ProjectRole;
  risk: RiskLevel;
  description: string;
  manager: string;
  createdAt: string;
  documents: number;
  processingDocuments: number;
  confirmedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  members: ProjectMember[];
  recentDocuments: ProjectDocument[];
  tasks: ProjectTask[];
  activity: ProjectActivity[];
  riskSummary: string;
  riskFactors: string[];
  mitigationActions: string[];
}

interface ProjectDetailProps {
  currentUserRole?: string;
  currentUserName?: string;
}




const TABS: Array<{ id: ProjectTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents & Meetings' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Recent Activity' },
  { id: 'risk', label: 'Risk' },
];

// Normalize a backend project_role ('manager') to the display MemberRole ('Manager').
const toMemberRole = (role?: string): MemberRole => {
  const r = (role || '').toLowerCase();
  if (r === 'manager') return 'Manager';
  if (r === 'viewer') return 'Viewer';
  return 'Contributor';
};

const normalizedRoleAllowsMemberManagement = (role: string) => {
  const normalized = role.trim().toLowerCase();
  return [
    'admin',
    'administrator',
    'project manager',
    'manager',
  ].includes(normalized);
};

export const ProjectDetail: React.FC<ProjectDetailProps> = ({
  currentUserRole = 'Viewer',
  currentUserName = 'User',
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('Contributor');
  const [memberError, setMemberError] = useState('');

  const loadProject = async () => {
      setIsLoading(true);
      try {
        const response = await client.get(`/projects/${projectId}`);
        const data = response.data;

        const extractInitials = (name: string): string => {
          const parts = name.trim().split(/\s+/).filter(Boolean);
          if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
          }
          return parts[0]?.slice(0, 2).toUpperCase() || 'U';
        };

        const projectData: ProjectDetailData = {
          id: data.id,
          name: data.name,
          department: data.department,
          workstream: data.workstream,
          role: data.role || 'Viewer',
          risk: data.risk_level || 'Low',
          description: data.description,
          manager: data.manager_name,
          createdAt: new Date(data.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          documents: Number(data.document_count) || 0,
          processingDocuments: Number(data.processing_document_count) || 0,
          confirmedTasks: Number(data.confirmed_task_count) || 0,
          inProgressTasks: Number(data.in_progress_task_count) || 0,
          overdueTasks: Number(data.overdue_task_count) || 0,
          members: data.members?.map((member: any) => ({
            id: member.id,
            name: member.name,
            email: member.email,
            initials: extractInitials(member.name),
            role: toMemberRole(member.project_role || member.role),
            avatarTone: (member.avatar_tone || 'blue') as ProjectMember['avatarTone'],
          })) || [],
          recentDocuments: data.recent_documents?.map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            kind: doc.kind,
            uploadedAt: new Date(doc.uploaded_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            uploadedBy: doc.uploaded_by,
            status: doc.status,
          })) || [],
          tasks: data.tasks?.map((task: any) => ({
            id: task.id,
            title: task.title,
            owner: task.owner,
            dueDate: new Date(task.due_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            status: task.status,
          })) || [],
          activity: data.activity?.map((act: any) => ({
            id: act.id,
            title: act.title,
            detail: act.detail,
            time: act.time,
            type: act.type,
          })) || [],
          riskSummary: data.risk_summary,
          riskFactors: data.risk_factors || [],
          mitigationActions: data.mitigation_actions || [],
        };

        setProject(projectData);
        setMembers(projectData.members);
      } catch (error) {
        console.error('Failed to load project', error);
        setProject(null);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
    setActiveTab('overview');
    setIsMemberPanelOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Load the full user list so members can be picked from real accounts.
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await client.get('/users');
        setAllUsers(
          (response.data || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email })),
        );
      } catch (error) {
        console.error('Failed to load users', error);
        setAllUsers([]);
      }
    };
    fetchUsers();
  }, []);

  const canManageMembers = useMemo(() => {
    if (!project) return false;

    return (
      normalizedRoleAllowsMemberManagement(currentUserRole) ||
      project.role === 'Manager'
    );
  }, [currentUserRole, project]);

  if (isLoading) {
    return (
      <section className="project-detail project-detail--missing">
        <div className="project-detail-empty-card">
          <h1>Loading project...</h1>
        </div>
      </section>
    );
  }

  if (!project) {
    return (
      <section className="project-detail project-detail--missing">
        <div className="project-detail-empty-card">
          <span className="project-detail-empty-icon" aria-hidden="true">
            ?
          </span>
          <h1>Project not found</h1>
          <p>The selected project does not exist.</p>
          <button type="button" onClick={() => navigate('/projects')}>
            Back to projects
          </button>
        </div>
      </section>
    );
  }

  const visibleMemberAvatars = members.slice(0, 3);
  const additionalMemberCount = Math.max(members.length - visibleMemberAvatars.length, 0);

  // Map the display role to the backend's lowercase project_role.
  const toProjectRole = (role: MemberRole): string => role.toLowerCase();

  const handleAddMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMemberError('');

    if (!newMemberUserId) {
      setMemberError('Choose a user to add.');
      return;
    }

    try {
      await client.post(`/projects/${projectId}/members`, {
        user_id: Number(newMemberUserId),
        project_role: toProjectRole(newMemberRole),
      });
      await loadProject();
      setNewMemberUserId('');
      setNewMemberRole('Contributor');
    } catch (error: any) {
      setMemberError(error.response?.data?.error || 'Could not add the member.');
    }
  };

  // Changing a role re-posts the membership (backend upserts on conflict).
  const handleRoleChange = async (memberId: number, role: MemberRole) => {
    try {
      await client.post(`/projects/${projectId}/members`, {
        user_id: memberId,
        project_role: toProjectRole(role),
      });
      await loadProject();
    } catch (error) {
      console.error('Failed to change member role', error);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await client.delete(`/projects/${projectId}/members/${memberId}`);
      await loadProject();
    } catch (error) {
      console.error('Failed to remove member', error);
    }
  };

  const renderMembersList = (compact = false) => (
    <div className={`project-member-list ${compact ? 'project-member-list--compact' : ''}`}>
      {members.map((member) => (
        <div className="project-member-row" key={member.id}>
          <span
            className={`project-member-avatar project-member-avatar--${member.avatarTone}`}
            aria-hidden="true"
          >
            {member.initials}
          </span>

          <div className="project-member-copy">
            <strong>{member.name}</strong>
            <span>{member.email}</span>
          </div>

          {canManageMembers && !compact ? (
            <div className="project-member-controls">
              <select
                value={member.role}
                onChange={(event) =>
                  handleRoleChange(member.id, event.target.value as MemberRole)
                }
                aria-label={`Role for ${member.name}`}
              >
                <option value="Manager">Manager</option>
                <option value="Contributor">Contributor</option>
                <option value="Viewer">Viewer</option>
              </select>
              <button
                type="button"
                className="project-member-remove"
                onClick={() => handleRemoveMember(member.id)}
                aria-label={`Remove ${member.name}`}
              >
                Remove
              </button>
            </div>
          ) : (
            <span
              className={`project-member-role project-member-role--${member.role.toLowerCase()}`}
            >
              {member.role}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const renderOverview = () => (
    <div className="project-overview">
      <div className="project-metric-grid">
        <article className="project-detail-metric">
          <span>Documents</span>
          <div>
            <strong>{project.documents}</strong>
            {project.processingDocuments > 0 && (
              <small>{project.processingDocuments} processing</small>
            )}
          </div>
        </article>

        <article className="project-detail-metric">
          <span>Confirmed tasks</span>
          <div>
            <strong>{project.confirmedTasks}</strong>
          </div>
        </article>

        <article className="project-detail-metric">
          <span>In progress</span>
          <div>
            <strong>{project.inProgressTasks}</strong>
          </div>
        </article>

        <article className="project-detail-metric project-detail-metric--dark">
          <div className="project-detail-metric-heading">
            <span>Overdue</span>
            <small>{project.risk} risk</small>
          </div>
          <div>
            <strong>{project.overdueTasks}</strong>
          </div>
        </article>
      </div>

      <div className="project-overview-lower-grid">
        <article className="project-detail-panel project-about-panel">
          <h2>About this project</h2>
          <p>{project.description}</p>

          <div className="project-about-meta">
            <div>
              <span>Manager</span>
              <strong>{project.manager}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{project.createdAt}</strong>
            </div>
            <div>
              <span>Members</span>
              <strong>{members.length} people</strong>
            </div>
          </div>
        </article>

        <article className="project-detail-panel project-members-panel">
          <div className="project-detail-panel-heading">
            <h2>Members</h2>
            {canManageMembers && (
              <button type="button" onClick={() => setIsMemberPanelOpen(true)}>
                Manage
              </button>
            )}
          </div>
          {renderMembersList(true)}
        </article>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="project-tab-section">
      <div className="project-tab-heading">
        <div>
          <h2>Documents & Meetings</h2>
          <p>Files and meeting records available inside this project.</p>
        </div>
        <button type="button" className="project-tab-primary-action">
          Upload file
        </button>
      </div>

      <div className="project-table-card">
        <div className="project-table project-document-table">
          <div className="project-table-header">
            <span>Name</span>
            <span>Type</span>
            <span>Uploaded by</span>
            <span>Status</span>
          </div>
          {project.recentDocuments.map((document) => (
            <div className="project-table-row" key={document.id}>
              <div className="project-file-name">
                <span className="project-file-icon" aria-hidden="true">
                  {document.kind === 'Meeting' ? '◷' : '▤'}
                </span>
                <div>
                  <strong>{document.name}</strong>
                  <small>{document.uploadedAt}</small>
                </div>
              </div>
              <span>{document.kind}</span>
              <span>{document.uploadedBy}</span>
              <span
                className={`project-status-badge project-status-badge--${document.status.toLowerCase()}`}
              >
                {document.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTasks = () => (
    <div className="project-tab-section">
      <div className="project-tab-heading">
        <div>
          <h2>Tasks</h2>
          <p>Confirmed project work, owners, deadlines, and current status.</p>
        </div>
        <button type="button" className="project-tab-primary-action">
          Add task
        </button>
      </div>

      <div className="project-task-list">
        {project.tasks.map((task) => (
          <article className="project-task-card" key={task.id}>
            <div>
              <span className="project-task-label">Task</span>
              <h3>{task.title}</h3>
            </div>
            <div className="project-task-meta">
              <span>
                Owner <strong>{task.owner}</strong>
              </span>
              <span>
                Due <strong>{task.dueDate}</strong>
              </span>
            </div>
            <span
              className={`project-task-status project-task-status--${task.status
                .toLowerCase()
                .replace(/\s+/g, '-')}`}
            >
              {task.status}
            </span>
          </article>
        ))}
      </div>
    </div>
  );

  const renderMembers = () => (
    <div className="project-tab-section">
      <div className="project-tab-heading">
        <div>
          <h2>Project members</h2>
          <p>People who can access this project and their current project roles.</p>
        </div>
        {canManageMembers && (
          <button
            type="button"
            className="project-tab-primary-action"
            onClick={() => setIsMemberPanelOpen(true)}
          >
            Manage members
          </button>
        )}
      </div>

      <div className="project-detail-panel project-full-members-panel">
        {renderMembersList(false)}
      </div>
    </div>
  );

  const renderActivity = () => (
    <div className="project-tab-section">
      <div className="project-tab-heading">
        <div>
          <h2>Recent activity</h2>
          <p>The latest document, decision, task, and membership events.</p>
        </div>
      </div>

      <div className="project-activity-card">
        {project.activity.map((activity, index) => (
          <div className="project-activity-row" key={activity.id}>
            <div className="project-activity-rail" aria-hidden="true">
              <span className={`project-activity-icon project-activity-icon--${activity.type}`}>
                {activity.type === 'document'
                  ? '▤'
                  : activity.type === 'decision'
                    ? '✓'
                    : activity.type === 'task'
                      ? '□'
                      : '+'}
              </span>
              {index < project.activity.length - 1 && <i />}
            </div>
            <div className="project-activity-copy">
              <strong>{activity.title}</strong>
              <p>{activity.detail}</p>
            </div>
            <time>{activity.time}</time>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRisk = () => (
    <div className="project-tab-section">
      <div className="project-tab-heading">
        <div>
          <h2>Project risk</h2>
          <p>Current risk level, contributing signals, and mitigation actions.</p>
        </div>
      </div>

      <div className="project-risk-layout">
        <article className="project-risk-summary-card">
          <div>
            <span>Current risk</span>
            <strong>{project.risk}</strong>
          </div>
          <p>{project.riskSummary}</p>
        </article>

        <article className="project-detail-panel">
          <h2>Risk factors</h2>
          <ul className="project-risk-list">
            {project.riskFactors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </article>

        <article className="project-detail-panel">
          <h2>Recommended actions</h2>
          <ul className="project-risk-list project-risk-list--actions">
            {project.mitigationActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'documents':
        return renderDocuments();
      case 'tasks':
        return renderTasks();
      case 'members':
        return renderMembers();
      case 'activity':
        return renderActivity();
      case 'risk':
        return renderRisk();
      case 'overview':
      default:
        return renderOverview();
    }
  };

  return (
    <section className="project-detail">
      <header className="project-detail-header">
        <div className="project-detail-header-copy">
          <button
            type="button"
            className="project-detail-breadcrumb"
            onClick={() => navigate('/projects')}
          >
            Projects
          </button>
          <span aria-hidden="true">/</span>
          <span>{project.name}</span>

          <div className="project-detail-title-row">
            <h1>{project.name}</h1>
            <span className={`project-detail-risk-chip project-detail-risk-chip--${project.risk.toLowerCase()}`}>
              <i />
              {project.risk}
            </span>
            <span className={`project-detail-role-chip project-detail-role-chip--${project.role.toLowerCase()}`}>
              {project.role}
            </span>
          </div>
          <p>
            {project.department} Department · {project.workstream}
          </p>
        </div>

        <div className="project-detail-header-actions">
          <div className="project-detail-avatar-stack" aria-label={`${members.length} project members`}>
            {visibleMemberAvatars.map((member) => (
              <span
                className={`project-detail-stack-avatar project-member-avatar--${member.avatarTone}`}
                key={member.id}
                title={member.name}
              >
                {member.initials}
              </span>
            ))}
            {additionalMemberCount > 0 && (
              <span className="project-detail-stack-avatar project-detail-stack-avatar--more">
                +{additionalMemberCount}
              </span>
            )}
          </div>

          {canManageMembers && (
            <button
              type="button"
              className="project-detail-manage-button"
              onClick={() => setIsMemberPanelOpen(true)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="8" r="3" />
                <path d="M4 19c.5-3.1 2.2-4.8 5-4.8 1.3 0 2.4.4 3.2 1" />
                <path d="M17 11v6M14 14h6" />
              </svg>
              Manage members
            </button>
          )}
        </div>
      </header>

      <nav className="project-detail-tabs" aria-label="Project detail sections">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="project-detail-content">{renderActiveTab()}</div>

      {isMemberPanelOpen && canManageMembers && (
        <div
          className="project-member-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsMemberPanelOpen(false);
          }}
        >
          <section
            className="project-member-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-members-title"
          >
            <div className="project-member-modal-header">
              <div>
                <span>Project access</span>
                <h2 id="manage-members-title">Manage members</h2>
                <p>{project.name}</p>
              </div>
              <button
                type="button"
                className="project-member-modal-close"
                onClick={() => setIsMemberPanelOpen(false)}
                aria-label="Close member management"
              >
                ×
              </button>
            </div>

            <form className="project-member-add-form" onSubmit={handleAddMember}>
              <label>
                User
                <select
                  value={newMemberUserId}
                  onChange={(event) => setNewMemberUserId(event.target.value)}
                >
                  <option value="">Select a user…</option>
                  {allUsers
                    .filter((u) => !members.some((m) => m.id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Project role
                <select
                  value={newMemberRole}
                  onChange={(event) => setNewMemberRole(event.target.value as MemberRole)}
                >
                  <option value="Manager">Manager</option>
                  <option value="Contributor">Contributor</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </label>
              <button type="submit">Add member</button>
            </form>
            {memberError && <div className="project-member-add-error">{memberError}</div>}

            <div className="project-member-modal-list-heading">
              <strong>Current members</strong>
              <span>{members.length} people</span>
            </div>
            <div className="project-member-modal-list">{renderMembersList(false)}</div>

            <div className="project-member-modal-footer">
              <span>Signed in as {currentUserName}.</span>
              <button type="button" onClick={() => setIsMemberPanelOpen(false)}>
                Done
              </button>
            </div>
          </section>
        </div>
      )}

    </section>
  );
};
