import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import './DocumentDetail.css';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TaskEditModal, type TaskEditValues } from '../components/TaskEditModal';
import { formatDateOnly } from '../utils/date';

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
}) => {
  const navigate = useNavigate();
  const { documentId } = useParams<{ documentId: string }>();
  const numericDocumentId = Number(documentId);
  const [document, setDocument] = useState<DocumentDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [editText, setEditText] = useState('');
  const [pendingActionReview, setPendingActionReview] = useState<{
    type: 'confirm' | 'reject';
    id: number;
  } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const canReview = canReviewAiContent(currentUserRole);

  const loadDocument = async () => {
      setIsLoading(true);
      try {
        const response = await client.get(`/documents/${numericDocumentId}`);
        const data = response.data;

        const documentData: DocumentDetailData = {
          id: data.id,
          name: data.title || data.name,
          projectName: data.project_name,
          typeLabel: data.document_type || 'Document',
          status: data.status || 'uploaded',
          uploadedBy: data.uploaded_by || data.created_by,
          uploadedDate: new Date(data.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          analyzedIn: data.processed_in,
          fileSize: data.file_size_kb ? `${(data.file_size_kb / 1024).toFixed(1)} MB` : undefined,
          processingProgress: data.processing_progress,
          processingStage: data.processing_stage,
          errorMessage: data.error_message,
          sourceTitle: data.source_title || 'Source',
          sourceExcerpts: data.source_excerpts?.map((excerpt: any) => ({
            id: excerpt.id,
            label: excerpt.label,
            speaker: excerpt.speaker,
            text: excerpt.text,
            kind: excerpt.kind,
          })) || [],
          summary: data.summary
            ? {
                text: data.summary.text,
                confidence: Number(data.summary.confidence) || 0,
                status: data.summary.status || 'draft',
              }
            : undefined,
          decisions: data.decisions?.map((decision: any) => ({
            id: decision.id,
            text: decision.text,
            source: decision.source,
            confidence: Number(decision.confidence) || 0,
            status: decision.status || 'draft',
            confirmedBy: decision.confirmed_by,
            confirmedDate: decision.confirmed_date,
          })) || [],
          actionItems: data.action_items?.map((item: any) => ({
            id: item.id,
            taskId: item.task_id,
            title: item.title,
            owner: item.owner,
            ownerSuggested: item.owner_suggested,
            deadline: item.deadline ? formatDateOnly(item.deadline) : undefined,
            deadlineSuggested: item.deadline_suggested,
            priority: (item.priority || 'Medium').charAt(0).toUpperCase() + (item.priority || 'medium').slice(1) as Priority,
            source: item.source,
            confidence: Number(item.confidence) || 0,
            status: item.status || 'draft',
            overdueDays: item.overdue_days,
            description: item.description,
            projectName: item.project_name,
            rejectionReason: item.rejection_reason,
          })) || [],
        };

        setDocument(documentData);
      } catch (error) {
        console.error('Failed to load document', error);
        setDocument(null);
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    if (numericDocumentId) {
      loadDocument();
    }
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

  if (isLoading) {
    return (
      <section className="document-detail document-detail-not-found">
        <div className="document-detail-empty-card">
          <h1>Loading document...</h1>
        </div>
      </section>
    );
  }

  if (!document) {
    return (
      <section className="document-detail document-detail-not-found">
        <div className="document-detail-empty-card">
          <span className="document-detail-empty-icon" aria-hidden="true">?</span>
          <h1>Document not found</h1>
          <p>The selected document does not exist.</p>
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

  // Human review of the AI-generated summary (admin/manager only). Confirm marks
  // it an official record; reject sends it back. Persisted, then re-fetched.
  const updateSummaryStatus = async (status: ReviewStatus) => {
    if (status !== 'confirmed' && status !== 'rejected') return;
    try {
      await client.post(`/ai/summary/${numericDocumentId}/review`, {
        review_status: status,
      });
      await loadDocument();
    } catch (error) {
      console.error('Failed to review summary', error);
    }
  };

  const updateDecisionStatus = async (id: number, status: ReviewStatus) => {
    if (status !== 'confirmed' && status !== 'rejected') return;
    try {
      await client.post(`/ai/decision/${id}/review`, {
        review_status: status,
      });
      await loadDocument();
    } catch (error) {
      console.error('Failed to review decision', error);
    }
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
    const blob = new Blob([sourceText || document.name], {
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
                            {(item.owner || 'U').charAt(0).toUpperCase()}
                          </span>
                          <span>
                            {item.owner || 'Unassigned'}
                            {item.ownerSuggested ? ' (suggested)' : ''}
                          </span>
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
