import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const ALPHA_MEMBERS: ProjectMember[] = [
  {
    id: 1,
    name: 'Alex Morgan',
    email: 'alex.morgan@acme.com',
    initials: 'AM',
    role: 'Manager',
    avatarTone: 'sand',
  },
  {
    id: 2,
    name: 'Jordan Lee',
    email: 'jordan.lee@acme.com',
    initials: 'JL',
    role: 'Contributor',
    avatarTone: 'gold',
  },
  {
    id: 3,
    name: 'Inci',
    email: 'inci@acme.com',
    initials: 'I',
    role: 'Contributor',
    avatarTone: 'peach',
  },
  {
    id: 4,
    name: 'Maya Chen',
    email: 'maya.chen@acme.com',
    initials: 'MC',
    role: 'Viewer',
    avatarTone: 'sage',
  },
  {
    id: 5,
    name: 'Sam Rivera',
    email: 'sam.rivera@acme.com',
    initials: 'SR',
    role: 'Viewer',
    avatarTone: 'blue',
  },
];

const buildDocuments = (
  projectName: string,
  meetingName: string,
): ProjectDocument[] => [
  {
    id: 1,
    name: `${meetingName} transcript`,
    kind: 'Meeting',
    uploadedAt: 'Jul 7, 2026 · 09:41',
    uploadedBy: 'Inci',
    status: 'Ready',
  },
  {
    id: 2,
    name: `${projectName} scope and requirements`,
    kind: 'Document',
    uploadedAt: 'Jul 6, 2026 · 15:20',
    uploadedBy: 'Alex Morgan',
    status: 'Ready',
  },
  {
    id: 3,
    name: 'API design notes',
    kind: 'Document',
    uploadedAt: 'Jul 5, 2026 · 11:05',
    uploadedBy: 'Jordan Lee',
    status: 'Ready',
  },
  {
    id: 4,
    name: 'Architecture draft',
    kind: 'Document',
    uploadedAt: 'Jul 4, 2026 · 16:45',
    uploadedBy: 'Inci',
    status: 'Processing',
  },
];

const PROJECTS: Record<string, ProjectDetailData> = {
  '1': {
    id: 1,
    name: 'Project Alpha',
    department: 'Software',
    workstream: 'MVP scope & API design workstream',
    role: 'Manager',
    risk: 'Medium',
    description:
      'Project Alpha delivers the MVP of the document-ingestion service. Current focus is finalizing API design and the upload pipeline. Latest meeting captured decisions on storage and scope; AI-extracted action items are pending review.',
    manager: 'Alex Morgan',
    createdAt: 'Jun 12, 2026',
    documents: 8,
    processingDocuments: 1,
    confirmedTasks: 24,
    inProgressTasks: 9,
    overdueTasks: 3,
    members: ALPHA_MEMBERS,
    recentDocuments: buildDocuments('Project Alpha', 'Project Alpha Weekly Meeting'),
    tasks: [
      {
        id: 1,
        title: 'Prepare frontend wireframes',
        owner: 'Inci',
        dueDate: 'Jul 8, 2026',
        status: 'In Progress',
      },
      {
        id: 2,
        title: 'Create upload API',
        owner: 'Jordan Lee',
        dueDate: 'Jul 20, 2026',
        status: 'Confirmed',
      },
      {
        id: 3,
        title: 'Define API schema',
        owner: 'Inci',
        dueDate: 'Jul 9, 2026',
        status: 'Completed',
      },
      {
        id: 4,
        title: 'Review document access rules',
        owner: 'Alex Morgan',
        dueDate: 'Jul 6, 2026',
        status: 'Overdue',
      },
    ],
    activity: [
      {
        id: 1,
        title: 'Meeting transcript uploaded',
        detail: 'Inci uploaded Project Alpha Weekly Meeting.',
        time: 'Jul 7 · 09:41',
        type: 'document',
      },
      {
        id: 2,
        title: 'Decision confirmed',
        detail: 'Alex confirmed the use of Amazon S3 for document storage.',
        time: 'Jul 7 · 10:03',
        type: 'decision',
      },
      {
        id: 3,
        title: 'Two tasks created',
        detail: 'Create upload API and Prepare frontend wireframes were confirmed.',
        time: 'Jul 7 · 10:05',
        type: 'task',
      },
      {
        id: 4,
        title: 'Member role updated',
        detail: 'Maya Chen was changed to Viewer.',
        time: 'Jul 6 · 16:18',
        type: 'member',
      },
    ],
    riskSummary:
      'The project is progressing, but three overdue tasks and an unfinished upload API create moderate schedule risk.',
    riskFactors: [
      'Three overdue tasks are affecting the delivery buffer.',
      'Upload API implementation is still awaiting final schema confirmation.',
      'One document is still processing and may require manual review.',
    ],
    mitigationActions: [
      'Prioritize the upload API and access-rule review this sprint.',
      'Reassign overdue work if owners cannot complete it this week.',
      'Review document-processing failures during the next stand-up.',
    ],
  },
  '2': {
    id: 2,
    name: 'Project Beta',
    department: 'Software',
    workstream: 'Search relevance & knowledge retrieval workstream',
    role: 'Contributor',
    risk: 'High',
    description:
      'Project Beta improves enterprise search quality and document retrieval. The team is validating relevance scoring, citation coverage, and permission-aware search across shared project content.',
    manager: 'Maya Chen',
    createdAt: 'May 28, 2026',
    documents: 12,
    processingDocuments: 2,
    confirmedTasks: 31,
    inProgressTasks: 14,
    overdueTasks: 7,
    members: [
      ALPHA_MEMBERS[3],
      ALPHA_MEMBERS[0],
      ALPHA_MEMBERS[1],
      ALPHA_MEMBERS[2],
    ],
    recentDocuments: buildDocuments('Project Beta', 'Search Quality Review'),
    tasks: [
      {
        id: 1,
        title: 'Tune retrieval thresholds',
        owner: 'Maya Chen',
        dueDate: 'Jul 10, 2026',
        status: 'Overdue',
      },
      {
        id: 2,
        title: 'Validate source citations',
        owner: 'Inci',
        dueDate: 'Jul 15, 2026',
        status: 'In Progress',
      },
      {
        id: 3,
        title: 'Prepare search evaluation set',
        owner: 'Jordan Lee',
        dueDate: 'Jul 16, 2026',
        status: 'Confirmed',
      },
    ],
    activity: [
      {
        id: 1,
        title: 'Evaluation document uploaded',
        detail: 'The search benchmark dataset was added.',
        time: 'Jul 10 · 13:14',
        type: 'document',
      },
      {
        id: 2,
        title: 'Task moved to overdue',
        detail: 'Tune retrieval thresholds passed its due date.',
        time: 'Jul 10 · 18:00',
        type: 'task',
      },
    ],
    riskSummary:
      'Search-quality validation is behind schedule, with seven overdue tasks and unresolved relevance issues.',
    riskFactors: [
      'Seven overdue tasks are concentrated in the evaluation phase.',
      'Citation accuracy has not reached the target threshold.',
      'Two source files remain in processing.',
    ],
    mitigationActions: [
      'Reduce the evaluation scope to the highest-value document types.',
      'Assign a second reviewer to citation validation.',
      'Create a daily checkpoint until overdue tasks are reduced.',
    ],
  },
  '3': {
    id: 3,
    name: 'Onboarding Revamp',
    department: 'People',
    workstream: 'Employee onboarding content & workflow redesign',
    role: 'Viewer',
    risk: 'Low',
    description:
      'Onboarding Revamp centralizes policies, learning material, and onboarding tasks so new employees can find accurate information and managers can monitor progress.',
    manager: 'Sam Rivera',
    createdAt: 'Jun 20, 2026',
    documents: 5,
    processingDocuments: 0,
    confirmedTasks: 10,
    inProgressTasks: 3,
    overdueTasks: 0,
    members: [ALPHA_MEMBERS[4], ALPHA_MEMBERS[3], ALPHA_MEMBERS[2]],
    recentDocuments: buildDocuments('Onboarding Revamp', 'People Operations Sync'),
    tasks: [
      {
        id: 1,
        title: 'Review first-week checklist',
        owner: 'Sam Rivera',
        dueDate: 'Jul 22, 2026',
        status: 'In Progress',
      },
      {
        id: 2,
        title: 'Approve policy links',
        owner: 'Maya Chen',
        dueDate: 'Jul 24, 2026',
        status: 'Confirmed',
      },
    ],
    activity: [
      {
        id: 1,
        title: 'Checklist updated',
        detail: 'The first-week onboarding checklist was revised.',
        time: 'Jul 12 · 10:40',
        type: 'document',
      },
    ],
    riskSummary:
      'The workstream is on track with no overdue tasks and stable document coverage.',
    riskFactors: ['Final policy approval is still pending.'],
    mitigationActions: ['Complete the policy review before the pilot group starts.'],
  },
  '4': {
    id: 4,
    name: 'Data Migration',
    department: 'Software',
    workstream: 'Legacy content migration & validation workstream',
    role: 'Manager',
    risk: 'High',
    description:
      'Data Migration moves legacy project records into the new knowledge platform. The team is validating metadata, permissions, file integrity, and migration exception handling.',
    manager: 'Alex Morgan',
    createdAt: 'Apr 18, 2026',
    documents: 15,
    processingDocuments: 4,
    confirmedTasks: 18,
    inProgressTasks: 6,
    overdueTasks: 4,
    members: [ALPHA_MEMBERS[0], ALPHA_MEMBERS[1], ALPHA_MEMBERS[2], ALPHA_MEMBERS[4]],
    recentDocuments: buildDocuments('Data Migration', 'Migration Readiness Review'),
    tasks: [
      {
        id: 1,
        title: 'Validate migrated permissions',
        owner: 'Alex Morgan',
        dueDate: 'Jul 12, 2026',
        status: 'Overdue',
      },
      {
        id: 2,
        title: 'Resolve failed file imports',
        owner: 'Jordan Lee',
        dueDate: 'Jul 18, 2026',
        status: 'In Progress',
      },
      {
        id: 3,
        title: 'Approve migration report',
        owner: 'Inci',
        dueDate: 'Jul 21, 2026',
        status: 'Confirmed',
      },
    ],
    activity: [
      {
        id: 1,
        title: 'Migration batch completed',
        detail: 'The third legacy-document batch finished processing.',
        time: 'Jul 11 · 15:06',
        type: 'document',
      },
      {
        id: 2,
        title: 'Exception task created',
        detail: 'Resolve failed file imports was assigned to Jordan Lee.',
        time: 'Jul 11 · 15:20',
        type: 'task',
      },
    ],
    riskSummary:
      'Four overdue tasks and several failed file imports create high delivery and data-quality risk.',
    riskFactors: [
      'Four documents are still processing.',
      'Permission validation is overdue.',
      'Legacy metadata contains inconsistent owner values.',
    ],
    mitigationActions: [
      'Complete permission validation before the next migration batch.',
      'Quarantine failed imports for manual review.',
      'Run metadata normalization before final acceptance.',
    ],
  },
  '5': {
    id: 5,
    name: 'Mobile App v3',
    department: 'Product',
    workstream: 'Mobile experience, release planning & feedback',
    role: 'Manager',
    risk: 'Medium',
    description:
      'Mobile App v3 coordinates product decisions, release tasks, customer feedback, and supporting design documents for the next mobile application release.',
    manager: 'Alex Morgan',
    createdAt: 'Jun 2, 2026',
    documents: 9,
    processingDocuments: 1,
    confirmedTasks: 21,
    inProgressTasks: 8,
    overdueTasks: 1,
    members: [ALPHA_MEMBERS[0], ALPHA_MEMBERS[3], ALPHA_MEMBERS[2]],
    recentDocuments: buildDocuments('Mobile App v3', 'Mobile Product Review'),
    tasks: [
      {
        id: 1,
        title: 'Finalize release scope',
        owner: 'Alex Morgan',
        dueDate: 'Jul 19, 2026',
        status: 'In Progress',
      },
      {
        id: 2,
        title: 'Review usability findings',
        owner: 'Maya Chen',
        dueDate: 'Jul 17, 2026',
        status: 'Overdue',
      },
    ],
    activity: [
      {
        id: 1,
        title: 'Product decision confirmed',
        detail: 'Offline reading was included in the release scope.',
        time: 'Jul 13 · 11:32',
        type: 'decision',
      },
    ],
    riskSummary:
      'The release remains achievable, but one overdue research review may affect final scope decisions.',
    riskFactors: ['Usability findings have not been fully reviewed.'],
    mitigationActions: ['Complete the research review before release-scope sign-off.'],
  },
  '6': {
    id: 6,
    name: 'Q3 Compliance',
    department: 'Legal',
    workstream: 'Quarterly policy review & evidence collection',
    role: 'Viewer',
    risk: 'Low',
    description:
      'Q3 Compliance organizes policy evidence, review meetings, decisions, and follow-up actions needed for the quarterly compliance assessment.',
    manager: 'Maya Chen',
    createdAt: 'Jul 1, 2026',
    documents: 6,
    processingDocuments: 0,
    confirmedTasks: 7,
    inProgressTasks: 2,
    overdueTasks: 0,
    members: [ALPHA_MEMBERS[3], ALPHA_MEMBERS[0], ALPHA_MEMBERS[4]],
    recentDocuments: buildDocuments('Q3 Compliance', 'Compliance Review Meeting'),
    tasks: [
      {
        id: 1,
        title: 'Collect approval evidence',
        owner: 'Maya Chen',
        dueDate: 'Jul 25, 2026',
        status: 'In Progress',
      },
      {
        id: 2,
        title: 'Confirm policy owners',
        owner: 'Sam Rivera',
        dueDate: 'Jul 28, 2026',
        status: 'Confirmed',
      },
    ],
    activity: [
      {
        id: 1,
        title: 'Evidence document added',
        detail: 'The latest policy approval register was uploaded.',
        time: 'Jul 14 · 09:22',
        type: 'document',
      },
    ],
    riskSummary:
      'The compliance review is on track with no overdue actions and complete core evidence.',
    riskFactors: ['Two policy-owner confirmations remain open.'],
    mitigationActions: ['Confirm remaining owners before the final evidence review.'],
  },
};

const TABS: Array<{ id: ProjectTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'documents', label: 'Documents & Meetings' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Recent Activity' },
  { id: 'risk', label: 'Risk' },
];

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

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
  const project = projectId ? PROJECTS[projectId] : undefined;

  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [members, setMembers] = useState<ProjectMember[]>(project?.members ?? []);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('Contributor');

  useEffect(() => {
    setActiveTab('overview');
    setMembers(project?.members ?? []);
    setIsMemberPanelOpen(false);
  }, [project]);

  const canManageMembers = useMemo(() => {
    if (!project) return false;

    return (
      normalizedRoleAllowsMemberManagement(currentUserRole) ||
      project.role === 'Manager'
    );
  }, [currentUserRole, project]);

  if (!project) {
    return (
      <section className="project-detail project-detail--missing">
        <div className="project-detail-empty-card">
          <span className="project-detail-empty-icon" aria-hidden="true">
            ?
          </span>
          <h1>Project not found</h1>
          <p>The selected project does not exist in the current mock data.</p>
          <button type="button" onClick={() => navigate('/projects')}>
            Back to projects
          </button>
        </div>
      </section>
    );
  }

  const visibleMemberAvatars = members.slice(0, 3);
  const additionalMemberCount = Math.max(members.length - visibleMemberAvatars.length, 0);

  const handleAddMember = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = newMemberName.trim();
    const trimmedEmail = newMemberEmail.trim();
    if (!trimmedName || !trimmedEmail) return;

    setMembers((currentMembers) => [
      ...currentMembers,
      {
        id: Date.now(),
        name: trimmedName,
        email: trimmedEmail,
        initials: getInitials(trimmedName),
        role: newMemberRole,
        avatarTone: 'blue',
      },
    ]);

    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberRole('Contributor');
  };

  const handleRoleChange = (memberId: number, role: MemberRole) => {
    setMembers((currentMembers) =>
      currentMembers.map((member) =>
        member.id === memberId ? { ...member, role } : member,
      ),
    );
  };

  const handleRemoveMember = (memberId: number) => {
    setMembers((currentMembers) =>
      currentMembers.filter((member) => member.id !== memberId),
    );
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
                Name
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="Full name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(event) => setNewMemberEmail(event.target.value)}
                  placeholder="name@company.com"
                />
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

            <div className="project-member-modal-list-heading">
              <strong>Current members</strong>
              <span>{members.length} people</span>
            </div>
            <div className="project-member-modal-list">{renderMembersList(false)}</div>

            <div className="project-member-modal-footer">
              <span>Signed in as {currentUserName}. Changes stay in this mock frontend session.</span>
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
