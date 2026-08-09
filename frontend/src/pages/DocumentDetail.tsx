import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './DocumentDetail.css';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TaskEditModal, type TaskEditValues } from '../components/TaskEditModal';

type DocumentStatus = 'processed' | 'processing' | 'uploaded' | 'failed';
type ReviewStatus = 'draft' | 'confirmed' | 'rejected';
type Priority = 'Low' | 'Medium' | 'High';
type SourceKind = 'plain' | 'decision' | 'action';

interface SourceExcerpt {
  id: number;
  label: string;
  speaker?: string;
  text: string;
  kind: SourceKind;
}

interface AiSummary {
  text: string;
  confidence: number;
  status: ReviewStatus;
}

interface ExtractedDecision {
  id: number;
  text: string;
  source: string;
  confidence: number;
  status: ReviewStatus;
  confirmedBy?: string;
  confirmedDate?: string;
}

interface ExtractedActionItem {
  id: number;
  taskId?: number;
  title: string;
  owner: string;
  ownerSuggested?: boolean;
  deadline: string;
  deadlineSuggested?: boolean;
  priority: Priority;
  source: string;
  confidence: number;
  status: ReviewStatus;
  overdueDays?: number;
  description?: string;
  projectName?: string;
  rejectionReason?: string;
}

interface DocumentDetailData {
  id: number;
  name: string;
  projectName: string;
  typeLabel: string;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedDate: string;
  analyzedIn?: string;
  fileSize?: string;
  processingProgress?: number;
  processingStage?: string;
  errorMessage?: string;
  sourceTitle: string;
  sourceExcerpts: SourceExcerpt[];
  summary?: AiSummary;
  decisions: ExtractedDecision[];
  actionItems: ExtractedActionItem[];
}

type EditingTarget =
  | { kind: 'summary' }
  | { kind: 'decision'; id: number }
  | null;

const MOCK_DOCUMENTS: Record<number, DocumentDetailData> = {
  1: {
    id: 1,
    name: 'Project Alpha Weekly Meeting',
    projectName: 'Project Alpha',
    typeLabel: 'Meeting transcript',
    status: 'processed',
    uploadedBy: 'Inci',
    uploadedDate: 'Jul 7, 2026',
    analyzedIn: '48s',
    sourceTitle: 'Transcript',
    sourceExcerpts: [
      {
        id: 1,
        label: '00:02',
        speaker: 'Alex',
        text: 'The main focus today is confirming the MVP scope and finalizing the API design before implementation begins.',
        kind: 'plain',
      },
      {
        id: 2,
        label: '04:18',
        speaker: 'Jordan',
        text: "...let's just use Amazon S3 for document storage, it's the simplest path for the MVP.",
        kind: 'decision',
      },
      {
        id: 3,
        label: '06:41',
        speaker: 'Inci',
        text: 'I can complete the frontend wireframes after the upload flow and document states are finalized.',
        kind: 'plain',
      },
      {
        id: 4,
        label: '09:12',
        speaker: 'Alex',
        text: 'Inci, can you create the upload API by the 20th? And the frontend wireframe was due last week.',
        kind: 'action',
      },
    ],
    summary: {
      text: 'The meeting focused on MVP scope and API design. The team agreed on a storage approach and assigned two immediate engineering tasks.',
      confidence: 0.91,
      status: 'draft',
    },
    decisions: [
      {
        id: 1,
        text: 'Use Amazon S3 for document storage.',
        source: '“...let’s just use Amazon S3 for document storage.” — 04:18',
        confidence: 0.95,
        status: 'confirmed',
        confirmedBy: 'Alex',
        confirmedDate: 'Jul 7',
      },
    ],
    actionItems: [
      {
        id: 1,
        taskId: 3,
        title: 'Create upload API',
        owner: 'Inci',
        deadline: 'Jul 20',
        priority: 'Medium',
        source: '“can you create the upload API by the 20th?” — 09:12',
        confidence: 0.93,
        status: 'confirmed',
      },
      {
        id: 2,
        taskId: 1,
        title: 'Prepare frontend wireframe',
        owner: 'Inci',
        ownerSuggested: true,
        deadline: 'Jul 8',
        deadlineSuggested: true,
        priority: 'High',
        source: '“the frontend wireframe was due last week.” — 09:12',
        confidence: 0.88,
        status: 'draft',
        overdueDays: 11,
      },
    ],
  },
  2: {
    id: 2,
    name: 'API Design v2.pdf',
    projectName: 'Project Alpha',
    typeLabel: 'PDF',
    status: 'processing',
    uploadedBy: 'Inci',
    uploadedDate: 'Jul 7, 2026',
    fileSize: '1.8 MB',
    processingProgress: 64,
    processingStage: 'Extracting decisions and action items',
    sourceTitle: 'Document preview',
    sourceExcerpts: [
      {
        id: 1,
        label: 'Page 2',
        text: 'The upload endpoint accepts PDF, Word, PowerPoint, and plain-text meeting transcripts.',
        kind: 'plain',
      },
      {
        id: 2,
        label: 'Page 4',
        text: 'Files are stored in Amazon S3 and the resulting metadata is recorded in the project database.',
        kind: 'plain',
      },
    ],
    decisions: [],
    actionItems: [],
  },
  3: {
    id: 3,
    name: 'MVP Scope.docx',
    projectName: 'Project Alpha',
    typeLabel: 'Word document',
    status: 'processed',
    uploadedBy: 'Alex Morgan',
    uploadedDate: 'Jul 5, 2026',
    analyzedIn: '31s',
    fileSize: '640 KB',
    sourceTitle: 'Document excerpts',
    sourceExcerpts: [
      {
        id: 1,
        label: 'Section 2.1',
        text: 'The MVP will support document upload, AI summaries, decision extraction, action-item extraction, and project-scoped question answering.',
        kind: 'decision',
      },
      {
        id: 2,
        label: 'Section 3.2',
        text: 'External integrations, mobile support, and advanced knowledge graph features are deferred to a later release.',
        kind: 'plain',
      },
      {
        id: 3,
        label: 'Section 5.1',
        text: 'The project manager must approve extracted tasks before they appear in the shared action tracker.',
        kind: 'action',
      },
    ],
    summary: {
      text: 'The document defines the KnowledgeFlow AI MVP, its included document-processing and project-assistant capabilities, and the features deferred beyond the first release.',
      confidence: 0.94,
      status: 'confirmed',
    },
    decisions: [
      {
        id: 1,
        text: 'Limit the first release to document processing, task extraction, and project-scoped AI assistance.',
        source: 'MVP Scope, Section 2.1',
        confidence: 0.96,
        status: 'confirmed',
        confirmedBy: 'Alex Morgan',
        confirmedDate: 'Jul 5',
      },
      {
        id: 2,
        text: 'Defer external integrations and advanced knowledge-graph features.',
        source: 'MVP Scope, Section 3.2',
        confidence: 0.9,
        status: 'draft',
      },
    ],
    actionItems: [
      {
        id: 1,
        taskId: 14,
        title: 'Define the human review workflow',
        owner: 'Alex Morgan',
        ownerSuggested: true,
        deadline: 'Jul 12',
        deadlineSuggested: true,
        priority: 'Medium',
        source: 'MVP Scope, Section 5.1',
        confidence: 0.86,
        status: 'draft',
      },
    ],
  },
  4: {
    id: 4,
    name: 'Kickoff Deck.pptx',
    projectName: 'Project Alpha',
    typeLabel: 'PowerPoint',
    status: 'uploaded',
    uploadedBy: 'Jordan Lee',
    uploadedDate: 'Jul 8, 2026',
    fileSize: '3.2 MB',
    sourceTitle: 'Slide preview',
    sourceExcerpts: [
      {
        id: 1,
        label: 'Slide 1',
        text: 'KnowledgeFlow AI — Project kickoff and delivery roadmap.',
        kind: 'plain',
      },
      {
        id: 2,
        label: 'Slide 4',
        text: 'Phase one focuses on upload, metadata, summarization, action extraction, and the action tracker.',
        kind: 'plain',
      },
    ],
    decisions: [],
    actionItems: [],
  },
  5: {
    id: 5,
    name: 'Legacy Notes.pdf',
    projectName: 'Project Alpha',
    typeLabel: 'PDF',
    status: 'failed',
    uploadedBy: 'Inci',
    uploadedDate: 'Jul 6, 2026',
    fileSize: '2.4 MB',
    errorMessage: 'The file could not be processed because text extraction and OCR both failed.',
    sourceTitle: 'Document preview',
    sourceExcerpts: [],
    decisions: [],
    actionItems: [],
  },
};

const normaliseRole = (role: string) => role.trim().toLowerCase();

const canReviewAiContent = (role: string) => {
  const normalised = normaliseRole(role);
  return [
    'system administrator',
    'administrator',
    'admin',
    'project manager',
  ].includes(normalised);
};

const cloneDocument = (document: DocumentDetailData): DocumentDetailData =>
  JSON.parse(JSON.stringify(document)) as DocumentDetailData;

const StatusBadge: React.FC<{ status: ReviewStatus }> = ({ status }) => (
  <span className={`document-detail-review-status document-detail-review-status--${status}`}>
    <span className="document-detail-status-dot" />
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

const AiMark: React.FC = () => (
  <span className="document-detail-ai-mark" aria-hidden="true">
    <span />
  </span>
);

interface ReviewActionsProps {
  status: ReviewStatus;
  onConfirm: () => void;
  onEdit: () => void;
  onReject: () => void;
  editLabel?: string;
}

const ReviewActions: React.FC<ReviewActionsProps> = ({
  status,
  onConfirm,
  onEdit,
  onReject,
  editLabel = 'Edit',
}) => (
  <div
    className="document-detail-review-actions"
    onClick={(event) => event.stopPropagation()}
  >
    {status !== 'confirmed' && (
      <button
        type="button"
        className="document-detail-button document-detail-button--primary"
        onClick={onConfirm}
      >
        Confirm
      </button>
    )}
    <button
      type="button"
      className="document-detail-button document-detail-button--secondary"
      onClick={onEdit}
    >
      {editLabel}
    </button>
    {status !== 'rejected' && (
      <button
        type="button"
        className="document-detail-button document-detail-button--danger"
        onClick={onReject}
      >
        Reject
      </button>
    )}
  </div>
);

interface DocumentDetailProps {
  currentUserRole?: string;
  currentUserName?: string;
}

export const DocumentDetail: React.FC<DocumentDetailProps> = ({
  currentUserRole = 'Viewer',
  currentUserName = 'User',
}) => {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const numericDocumentId = Number(documentId);
  const sourceDocument = MOCK_DOCUMENTS[numericDocumentId];
  const [document, setDocument] = useState<DocumentDetailData | null>(() =>
    sourceDocument ? cloneDocument(sourceDocument) : null,
  );
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [editText, setEditText] = useState('');
  const [pendingActionReview, setPendingActionReview] = useState<{
    type: 'confirm' | 'reject';
    id: number;
  } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const canReview = canReviewAiContent(currentUserRole);

  useEffect(() => {
    setDocument(sourceDocument ? cloneDocument(sourceDocument) : null);
    setEditingTarget(null);
    setPendingActionReview(null);
    setReviewReason('');
    setEditingActionId(null);
  }, [numericDocumentId]);

  const visibleDecisions = useMemo(() => {
    if (!document) return [];
    return canReview
      ? document.decisions
      : document.decisions.filter((decision) => decision.status === 'confirmed');
  }, [canReview, document]);

  const visibleActionItems = useMemo(() => {
    if (!document) return [];
    return canReview
      ? document.actionItems
      : document.actionItems.filter((item) => item.status === 'confirmed');
  }, [canReview, document]);

  if (!document) {
    return (
      <section className="document-detail document-detail-not-found">
        <div className="document-detail-empty-card">
          <span className="document-detail-empty-icon" aria-hidden="true">?</span>
          <h1>Document not found</h1>
          <p>The selected document does not exist in the current mock dataset.</p>
          <button
            type="button"
            className="document-detail-button document-detail-button--primary"
            onClick={() => navigate('/documents')}
          >
            Back to documents
          </button>
        </div>
      </section>
    );
  }

  const updateSummaryStatus = (status: ReviewStatus) => {
    setDocument((current) => {
      if (!current?.summary) return current;
      return { ...current, summary: { ...current.summary, status } };
    });
  };

  const updateDecisionStatus = (id: number, status: ReviewStatus) => {
    setDocument((current) => {
      if (!current) return current;
      return {
        ...current,
        decisions: current.decisions.map((decision) =>
          decision.id === id
            ? {
                ...decision,
                status,
                confirmedBy: status === 'confirmed' ? currentUserName : decision.confirmedBy,
                confirmedDate: status === 'confirmed' ? 'Today' : decision.confirmedDate,
              }
            : decision,
        ),
      };
    });
  };

  const updateActionStatus = (
    id: number,
    status: ReviewStatus,
    rejectionReason = '',
  ) => {
    setDocument((current) => {
      if (!current) return current;
      return {
        ...current,
        actionItems: current.actionItems.map((item) =>
          item.id === id
            ? {
                ...item,
                status,
                rejectionReason:
                  status === 'rejected' ? rejectionReason.trim() : undefined,
              }
            : item,
        ),
      };
    });
  };

  const startEditingSummary = () => {
    if (!document.summary) return;
    setEditText(document.summary.text);
    setEditingTarget({ kind: 'summary' });
  };

  const startEditingDecision = (id: number) => {
    const decision = document.decisions.find((item) => item.id === id);
    if (!decision) return;
    setEditText(decision.text);
    setEditingTarget({ kind: 'decision', id });
  };


  const saveEdit = () => {
    if (!editingTarget || !editText.trim()) return;

    setDocument((current) => {
      if (!current) return current;

      if (editingTarget.kind === 'summary' && current.summary) {
        return {
          ...current,
          summary: {
            ...current.summary,
            text: editText.trim(),
            status: 'draft',
          },
        };
      }

      if (editingTarget.kind === 'decision') {
        return {
          ...current,
          decisions: current.decisions.map((decision) =>
            decision.id === editingTarget.id
              ? { ...decision, text: editText.trim(), status: 'draft' }
              : decision,
          ),
        };
      }

      return current;
    });

    setEditingTarget(null);
  };

  const openActionReview = (type: 'confirm' | 'reject', id: number) => {
    setReviewReason('');
    setPendingActionReview({ type, id });
  };

  const closeActionReview = () => {
    setPendingActionReview(null);
    setReviewReason('');
  };

  const confirmActionReview = () => {
    if (!pendingActionReview) return;

    updateActionStatus(
      pendingActionReview.id,
      pendingActionReview.type === 'confirm' ? 'confirmed' : 'rejected',
      reviewReason,
    );
    closeActionReview();
  };

  const editingActionItem =
    editingActionId === null
      ? null
      : document.actionItems.find((item) => item.id === editingActionId) ?? null;

  const actionEditValues: TaskEditValues = editingActionItem
    ? {
        title: editingActionItem.title,
        description:
          editingActionItem.description ??
          `Complete “${editingActionItem.title}” and document the outcome for ${editingActionItem.projectName ?? document.projectName}.`,
        sourceContext: editingActionItem.source,
        owner: editingActionItem.owner,
        deadline: editingActionItem.deadline,
        risk: editingActionItem.priority.toLowerCase() as TaskEditValues['risk'],
        projectName: editingActionItem.projectName ?? document.projectName,
      }
    : {
        title: '',
        description: '',
        sourceContext: '',
        owner: '',
        deadline: '',
        risk: 'medium',
        projectName: document.projectName,
      };

  const saveActionEdit = (values: TaskEditValues) => {
    if (editingActionId === null) return;

    setDocument((current) => {
      if (!current) return current;

      return {
        ...current,
        actionItems: current.actionItems.map((item) =>
          item.id === editingActionId
            ? {
                ...item,
                title: values.title,
                description: values.description,
                source: values.sourceContext,
                owner: values.owner,
                deadline: values.deadline,
                priority: `${values.risk.charAt(0).toUpperCase()}${values.risk.slice(1)}` as Priority,
                projectName: values.projectName,
                ownerSuggested: false,
                deadlineSuggested: false,
                status: 'draft',
                rejectionReason: undefined,
              }
            : item,
        ),
      };
    });

    setEditingActionId(null);
  };

  const handleDownload = () => {
    const sourceText = document.sourceExcerpts
      .map((excerpt) =>
        [excerpt.label, excerpt.speaker, excerpt.text].filter(Boolean).join(' · '),
      )
      .join('\n\n');
    const blob = new Blob([sourceText || `Mock file: ${document.name}`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${document.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const startProcessing = () => {
    setDocument((current) =>
      current
        ? {
            ...current,
            status: 'processing',
            processingProgress: 12,
            processingStage: 'Preparing document for AI analysis',
            errorMessage: undefined,
          }
        : current,
    );
  };

  const statusText =
    document.status === 'processed'
      ? 'Processed'
      : document.status === 'processing'
        ? 'Processing'
        : document.status === 'uploaded'
          ? 'Uploaded'
          : 'Failed';

  const showReviewedSummary =
    document.summary && (canReview || document.summary.status === 'confirmed');

  return (
    <section className="document-detail">
      <header className="document-detail-header">
        <button
          type="button"
          className="document-detail-breadcrumb"
          onClick={() => navigate('/documents')}
        >
          Documents <span>/</span> <strong>{document.name}</strong>
        </button>

        <div className="document-detail-title-row">
          <h1>{document.name}</h1>
          <span className="document-detail-file-type">{document.typeLabel}</span>
          <span className={`document-detail-processing-status document-detail-processing-status--${document.status}`}>
            <span className="document-detail-status-dot" />
            {statusText}
          </span>
        </div>

        <p className="document-detail-meta">
          Uploaded by {document.uploadedBy} · {document.uploadedDate}
          {document.analyzedIn ? ` · analyzed in ${document.analyzedIn}` : ''}
          {document.fileSize ? ` · ${document.fileSize}` : ''}
        </p>
      </header>

      <div className="document-detail-layout">
        <article className="document-detail-source-card">
          <div className="document-detail-card-heading">
            <h2>{document.sourceTitle}</h2>
            <button
              type="button"
              className="document-detail-text-action"
              onClick={handleDownload}
            >
              Download
            </button>
          </div>

          {document.sourceExcerpts.length > 0 ? (
            <div className="document-detail-source-list">
              {document.sourceExcerpts.map((excerpt) => (
                <div
                  key={excerpt.id}
                  className={`document-detail-source-excerpt document-detail-source-excerpt--${excerpt.kind}`}
                >
                  <div className="document-detail-source-label">
                    {excerpt.label}
                    {excerpt.speaker ? ` · ${excerpt.speaker}` : ''}
                    {excerpt.kind === 'decision' && <span>↳ decision source</span>}
                    {excerpt.kind === 'action' && <span>↳ action item source</span>}
                  </div>
                  <p>“{excerpt.text}”</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="document-detail-source-empty">
              <span aria-hidden="true">!</span>
              <h3>Preview unavailable</h3>
              <p>{document.errorMessage ?? 'No source preview is available for this file.'}</p>
            </div>
          )}
        </article>

        <div className="document-detail-results">
          {document.status === 'processing' && (
            <article className="document-detail-result-card document-detail-processing-card">
              <div className="document-detail-processing-icon" aria-hidden="true" />
              <div>
                <h2>AI analysis is in progress</h2>
                <p>{document.processingStage ?? 'Processing the uploaded document.'}</p>
                <div className="document-detail-progress-row">
                  <div className="document-detail-progress-track">
                    <span style={{ width: `${document.processingProgress ?? 0}%` }} />
                  </div>
                  <strong>{document.processingProgress ?? 0}%</strong>
                </div>
              </div>
            </article>
          )}

          {document.status === 'uploaded' && (
            <article className="document-detail-result-card document-detail-state-card">
              <AiMark />
              <div>
                <h2>Ready for AI processing</h2>
                <p>Start processing to generate a summary, decisions, action items, suggested owners, deadlines, and source links.</p>
                {canReview && (
                  <button
                    type="button"
                    className="document-detail-button document-detail-button--primary"
                    onClick={startProcessing}
                  >
                    Start AI processing
                  </button>
                )}
              </div>
            </article>
          )}

          {document.status === 'failed' && (
            <article className="document-detail-result-card document-detail-state-card document-detail-state-card--error">
              <span className="document-detail-error-mark" aria-hidden="true">!</span>
              <div>
                <h2>Processing failed</h2>
                <p>{document.errorMessage}</p>
                {canReview && (
                  <button
                    type="button"
                    className="document-detail-button document-detail-button--primary"
                    onClick={startProcessing}
                  >
                    Retry processing
                  </button>
                )}
              </div>
            </article>
          )}

          {document.status === 'processed' && (
            <>
              <article className="document-detail-result-card document-detail-summary-card">
                <div className="document-detail-card-heading document-detail-card-heading--summary">
                  <div className="document-detail-heading-with-icon">
                    <AiMark />
                    <h2>AI Summary</h2>
                  </div>
                  {document.summary && <StatusBadge status={document.summary.status} />}
                </div>

                {showReviewedSummary ? (
                  <>
                    <p className="document-detail-summary-text">{document.summary?.text}</p>
                    <div className="document-detail-confidence-row">
                      <span>AI confidence</span>
                      <div className="document-detail-confidence-track">
                        <span style={{ width: `${(document.summary?.confidence ?? 0) * 100}%` }} />
                      </div>
                      <strong>{document.summary?.confidence.toFixed(2)}</strong>
                    </div>
                    {canReview && document.summary && (
                      <ReviewActions
                        status={document.summary.status}
                        onConfirm={() => updateSummaryStatus('confirmed')}
                        onEdit={startEditingSummary}
                        onReject={() => updateSummaryStatus('rejected')}
                      />
                    )}
                  </>
                ) : (
                  <div className="document-detail-readonly-pending">
                    The AI summary is awaiting manager review.
                  </div>
                )}
              </article>

              <article className="document-detail-result-card">
                <div className="document-detail-card-heading">
                  <h2>Extracted decisions</h2>
                  <span className="document-detail-item-count">{visibleDecisions.length} item{visibleDecisions.length === 1 ? '' : 's'}</span>
                </div>

                {visibleDecisions.length > 0 ? (
                  <div className="document-detail-review-list">
                    {visibleDecisions.map((decision) => (
                      <div
                        key={decision.id}
                        className={`document-detail-review-item document-detail-review-item--${decision.status}`}
                      >
                        <div className="document-detail-review-item-heading">
                          <h3>{decision.text}</h3>
                          <StatusBadge status={decision.status} />
                        </div>
                        <p className="document-detail-source-quote">{decision.source}</p>
                        <div className="document-detail-review-meta">
                          <span>confidence {decision.confidence.toFixed(2)}</span>
                          {decision.confirmedBy && decision.status === 'confirmed' && (
                            <span>· Confirmed by {decision.confirmedBy} · {decision.confirmedDate}</span>
                          )}
                        </div>
                        {canReview && (
                          <ReviewActions
                            status={decision.status}
                            onConfirm={() => updateDecisionStatus(decision.id, 'confirmed')}
                            onEdit={() => startEditingDecision(decision.id)}
                            onReject={() => updateDecisionStatus(decision.id, 'rejected')}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="document-detail-empty-result">No confirmed decisions are available.</div>
                )}
              </article>

              <article className="document-detail-result-card">
                <div className="document-detail-card-heading">
                  <h2>Extracted action items</h2>
                  <span className="document-detail-item-count">{visibleActionItems.length} item{visibleActionItems.length === 1 ? '' : 's'}</span>
                </div>

                {visibleActionItems.length > 0 ? (
                  <div className="document-detail-review-list">
                    {visibleActionItems.map((item) => (
                      <div
                        key={item.id}
                        className={`document-detail-review-item document-detail-action-item document-detail-review-item--${item.status} ${item.overdueDays ? 'document-detail-action-item--overdue' : ''} ${item.taskId ? 'document-detail-action-item--clickable' : ''}`}
                        role={item.taskId ? 'button' : undefined}
                        tabIndex={item.taskId ? 0 : undefined}
                        aria-label={item.taskId ? `Open task: ${item.title}` : undefined}
                        onClick={() => item.taskId && navigate(`/tasks/${item.taskId}`)}
                        onKeyDown={(event) => {
                          if (item.taskId && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            navigate(`/tasks/${item.taskId}`);
                          }
                        }}
                      >
                        <div className="document-detail-review-item-heading">
                          <h3>{item.title}</h3>
                          <div className="document-detail-action-statuses">
                            {item.overdueDays && (
                              <span className="document-detail-overdue-badge">
                                <span className="document-detail-status-dot" />
                                Overdue
                              </span>
                            )}
                            <StatusBadge status={item.status} />
                          </div>
                        </div>

                        <div className="document-detail-action-meta">
                          <span className="document-detail-owner-avatar">
                            {item.owner.charAt(0).toUpperCase()}
                          </span>
                          <span>{item.owner}{item.ownerSuggested ? ' (suggested)' : ''}</span>
                          <span className={item.overdueDays ? 'document-detail-overdue-text' : ''}>
                            Due {item.deadline}{item.overdueDays ? ` · ${item.overdueDays} days late` : ''}
                            {item.deadlineSuggested ? ' (suggested)' : ''}
                          </span>
                          <span className={`document-detail-priority document-detail-priority--${item.priority.toLowerCase()}`}>
                            <span className="document-detail-status-dot" />
                            {item.priority}
                          </span>
                        </div>

                        <p className="document-detail-source-quote">source: {item.source} · conf. {item.confidence.toFixed(2)}</p>

                        {canReview && (
                          <div
                            className="document-detail-review-actions"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {item.status !== 'confirmed' && (
                              <button
                                type="button"
                                className="document-detail-button document-detail-button--primary"
                                onClick={() => openActionReview('confirm', item.id)}
                              >
                                Confirm
                              </button>
                            )}
                            <button
                              type="button"
                              className="document-detail-button document-detail-button--secondary"
                              onClick={() => setEditingActionId(item.id)}
                            >
                              Edit task
                            </button>
                            {item.status !== 'rejected' && (
                              <button
                                type="button"
                                className="document-detail-button document-detail-button--danger"
                                onClick={() => openActionReview('reject', item.id)}
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="document-detail-empty-result">No confirmed action items are available.</div>
                )}
              </article>
            </>
          )}
        </div>
      </div>

      {editingTarget && (
        <div
          className="document-detail-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingTarget(null);
          }}
        >
          <div className="document-detail-modal" role="dialog" aria-modal="true" aria-labelledby="document-detail-edit-title">
            <div className="document-detail-modal-header">
              <div>
                <span className="document-detail-modal-eyebrow">AI review</span>
                <h2 id="document-detail-edit-title">
                  {editingTarget.kind === 'summary'
                    ? 'Edit summary'
                    : 'Edit decision'}
                </h2>
              </div>
              <button
                type="button"
                className="document-detail-modal-close"
                aria-label="Close edit dialog"
                onClick={() => setEditingTarget(null)}
              >
                ×
              </button>
            </div>

            <label className="document-detail-field">
              <span>Content</span>
              <textarea
                rows={editingTarget.kind === 'summary' ? 5 : 3}
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                autoFocus
              />
            </label>


            <p className="document-detail-modal-note">
              Saving an edit returns the item to Draft so it can be reviewed and confirmed again.
            </p>

            <div className="document-detail-modal-actions">
              <button
                type="button"
                className="document-detail-button document-detail-button--secondary"
                onClick={() => setEditingTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="document-detail-button document-detail-button--primary"
                onClick={saveEdit}
                disabled={!editText.trim()}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(pendingActionReview)}
        title={
          pendingActionReview?.type === 'reject'
            ? 'Reject this action item?'
            : 'Confirm this action item?'
        }
        description={
          pendingActionReview ? (
            pendingActionReview.type === 'reject' ? (
              <p>
                “{document.actionItems.find((item) => item.id === pendingActionReview.id)?.title}”
                will be marked <strong>Rejected</strong> and will not become a
                tracked task. It will remain visible in the document history.
              </p>
            ) : (
              <p>
                “{document.actionItems.find((item) => item.id === pendingActionReview.id)?.title}”
                will become a <strong>Confirmed</strong> task in{' '}
                {document.actionItems.find((item) => item.id === pendingActionReview.id)?.projectName ?? document.projectName}.
              </p>
            )
          ) : null
        }
        confirmLabel={
          pendingActionReview?.type === 'reject' ? 'Reject item' : 'Confirm task'
        }
        cancelLabel="Back"
        tone={pendingActionReview?.type === 'reject' ? 'danger' : 'default'}
        inputLabel={
          pendingActionReview?.type === 'reject' ? 'Reason (optional)' : undefined
        }
        inputPlaceholder={
          pendingActionReview?.type === 'reject'
            ? 'Duplicate of an existing task...'
            : undefined
        }
        inputValue={reviewReason}
        onInputChange={setReviewReason}
        onClose={closeActionReview}
        onConfirm={confirmActionReview}
      />

      <TaskEditModal
        isOpen={editingActionItem !== null}
        initialValues={actionEditValues}
        onClose={() => setEditingActionId(null)}
        onSave={saveActionEdit}
      />
    </section>
  );
};
