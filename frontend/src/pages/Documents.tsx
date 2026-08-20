import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import client from '../api/client';
import { ConfirmationModal } from '../components/ConfirmationModal';
import './Documents.css';

type DocumentType = 'pdf' | 'doc' | 'ppt' | 'transcript';
type DocumentStatus = 'processed' | 'processing' | 'uploaded' | 'failed';

interface DocumentItem {
  id: number;
  name: string;
  projectName: string;
  projectId: number;
  description: string;
  type: DocumentType;
  uploadedBy: string;
  uploadedDate: string;
  status: DocumentStatus;
  details: string;
  canManage: boolean;
}

const TYPE_FILTERS: Array<{ value: 'all' | DocumentType; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'transcript', label: 'Meeting transcript' },
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Word' },
  { value: 'ppt', label: 'PowerPoint' },
];

const getTypeLabel = (type: DocumentType) => {
  const labels: Record<DocumentType, string> = {
    pdf: 'PDF',
    doc: 'Word',
    ppt: 'PowerPoint',
    transcript: 'Meeting transcript',
  };

  return labels[type];
};

const DocumentIcon: React.FC<{ type: DocumentType; failed?: boolean }> = ({
  type,
  failed = false,
}) => {
  if (type === 'transcript') {
    return (
      <span className="document-table-icon document-table-icon--transcript">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </span>
    );
  }

  if (failed) {
    return (
      <span className="document-table-icon document-table-icon--failed">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" />
          <path d="M12 8.5v4.5" />
          <path d="M12 16.5h.01" />
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`document-table-icon document-table-icon--${type}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24">
        <path d="M7 3.5h6l4 4V20H7z" />
        <path d="M13 3.5V8h4" />
      </svg>
    </span>
  );
};

export const Documents: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | DocumentType>('all');
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim().toLowerCase() ?? '';

  // Edit / delete state
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<DocumentItem | null>(null);

  const loadDocuments = async () => {
    try {
      const response = await client.get('/documents');
      const docs = response.data.map((doc: any) => ({
        id: doc.id,
        name: doc.title || doc.name,
        projectName: doc.project_name || '—',
        projectId: doc.project_id,
        description: doc.description || '',
        type: doc.document_type || 'pdf',
        uploadedBy: doc.uploaded_by || doc.created_by,
        uploadedDate: new Date(doc.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        status: doc.status || 'uploaded',
        details:
          doc.file_size_kb && doc.file_size_kb > 0
            ? `${(doc.file_size_kb / 1024).toFixed(1)} MB`
            : doc.description || '',
        canManage: Boolean(doc.can_edit),
      }));
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    client
      .get('/projects')
      .then((r) =>
        setProjects((r.data || []).map((p: any) => ({ id: p.id, name: p.name }))),
      )
      .catch(() => setProjects([]));
  }, []);

  const openEdit = (doc: DocumentItem) => {
    setEditingDoc(doc);
    setEditTitle(doc.name);
    setEditDescription(doc.description);
    setEditProjectId(String(doc.projectId));
    setEditError('');
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingDoc) return;
    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }
    setIsSaving(true);
    try {
      await client.patch(`/documents/${editingDoc.id}`, {
        title: editTitle.trim(),
        description: editDescription,
        project_id: Number(editProjectId),
      });
      setEditingDoc(null);
      await loadDocuments();
    } catch (error: any) {
      setEditError(error.response?.data?.error || 'Could not save the document.');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDoc) return;
    try {
      await client.delete(`/documents/${deletingDoc.id}`);
      setDeletingDoc(null);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document', error);
      setDeletingDoc(null);
    }
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesType = filterType === 'all' || document.type === filterType;
      const searchableText = [
        document.name,
        document.projectName,
        getTypeLabel(document.type),
        document.uploadedBy,
        document.status,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = !searchQuery || searchableText.includes(searchQuery);
      return matchesType && matchesSearch;
    });
  }, [documents, filterType, searchQuery]);

  const openDocument = (documentId: number) => {
    navigate(`/documents/${documentId}`);
  };

  const handleDocumentKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    documentId: number,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDocument(documentId);
    }
  };

  if (isLoading) {
    return <div className="documents documents-loading">Loading documents...</div>;
  }

  return (
    <div className="documents">
      <div className="documents-toolbar" aria-label="Document filters">
        <div className="documents-type-filters">
          {TYPE_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.value}
              className={`documents-filter-pill ${
                filterType === filter.value ? 'active' : ''
              }`}
              onClick={() => setFilterType(filter.value)}
            >
              {filter.label}
            </button>
          ))}

          <span className="documents-filter-divider" aria-hidden="true" />

          <button
            type="button"
            className="documents-filter-pill documents-status-filter"
            aria-label="Status filter: all"
          >
            Status: all
          </button>
        </div>
      </div>

      <div className="documents-table" role="table" aria-label="Documents and meetings">
        <div className="documents-table-header" role="row">
          <div role="columnheader">Name</div>
          <div role="columnheader">Project</div>
          <div role="columnheader">Type</div>
          <div role="columnheader">Uploaded by</div>
          <div role="columnheader">Date</div>
          <div role="columnheader">Status</div>
          <div role="columnheader">Actions</div>
        </div>

        <div className="documents-table-body">
          {filteredDocuments.length === 0 ? (
            <div className="documents-empty">
              <h2>No documents found</h2>
              <p>Try another search or document type.</p>
            </div>
          ) : (
            filteredDocuments.map((document) => {
              const isFailed = document.status === 'failed';
              const isProcessing = document.status === 'processing';

              return (
                <div
                  key={document.id}
                  className={`document-table-row ${isFailed ? 'document-table-row--failed' : ''}`}
                  role="row"
                  tabIndex={0}
                  aria-label={`Open ${document.name}`}
                  onClick={() => openDocument(document.id)}
                  onKeyDown={(event) => handleDocumentKeyDown(event, document.id)}
                >
                  <div className="document-table-name-cell" role="cell">
                    <DocumentIcon type={document.type} failed={isFailed} />

                    <div className="document-table-name-content">
                      <h3>{document.name}</h3>
                      <p className={isFailed ? 'document-table-error-text' : ''}>
                        {document.details}
                      </p>
                    </div>
                  </div>

                  <div className="document-table-cell" role="cell">
                    <span className="document-table-project">{document.projectName}</span>
                  </div>

                  <div className="document-table-cell" role="cell">
                    {getTypeLabel(document.type)}
                  </div>

                  <div className="document-table-cell" role="cell">
                    {document.uploadedBy}
                  </div>

                  <div className="document-table-cell" role="cell">
                    {document.uploadedDate}
                  </div>

                  <div className="document-table-cell" role="cell">
                    <span
                      className={`document-table-status document-table-status--${document.status}`}
                    >
                      {isProcessing && <span className="document-processing-ring" />}
                      {document.status !== 'processing' && (
                        <span className="document-status-dot" />
                      )}
                      {document.status === 'processed' && 'Processed'}
                      {document.status === 'processing' && 'Processing...'}
                      {document.status === 'uploaded' && 'Uploaded'}
                      {document.status === 'failed' && 'Failed'}
                    </span>
                  </div>

                  <div className="document-table-actions" role="cell">
                    {document.canManage ? (
                      <>
                        <button
                          type="button"
                          className="document-table-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(document);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="document-table-action document-table-action--danger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeletingDoc(document);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="document-table-readonly">View only</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingDoc && (
        <div
          className="documents-edit-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingDoc(null);
          }}
        >
          <form className="documents-edit-modal" onSubmit={saveEdit} role="dialog" aria-modal="true">
            <div className="documents-edit-header">
              <div>
                <span>Document</span>
                <h2>Edit document</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="documents-edit-close"
                onClick={() => setEditingDoc(null)}
              >
                ×
              </button>
            </div>

            <label className="documents-edit-field">
              <span>Project</span>
              <select
                value={editProjectId}
                onChange={(event) => setEditProjectId(event.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="documents-edit-field">
              <span>Title</span>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                autoFocus
              />
            </label>

            <label className="documents-edit-field">
              <span>Description</span>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                placeholder="Optional description"
              />
            </label>

            {editError && <div className="documents-edit-error">{editError}</div>}

            <div className="documents-edit-actions">
              <button
                type="button"
                className="documents-edit-button documents-edit-button--secondary"
                onClick={() => setEditingDoc(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="documents-edit-button documents-edit-button--primary"
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmationModal
        isOpen={deletingDoc !== null}
        title="Delete this document?"
        description={
          deletingDoc ? (
            <p>
              “{deletingDoc.name}” and its extracted text, summary, decisions, and
              AI-drafted action items will be permanently deleted. This can't be
              undone.
            </p>
          ) : null
        }
        confirmLabel="Delete document"
        cancelLabel="Keep"
        tone="danger"
        onClose={() => setDeletingDoc(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
