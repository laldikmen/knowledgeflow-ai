import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Documents.css';

type DocumentType = 'pdf' | 'doc' | 'ppt' | 'transcript';
type DocumentStatus = 'processed' | 'processing' | 'uploaded' | 'failed';

interface DocumentItem {
  id: number;
  name: string;
  type: DocumentType;
  uploadedBy: string;
  uploadedDate: string;
  status: DocumentStatus;
  details: string;
  action: 'Open' | 'Process' | 'Retry';
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
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | DocumentType>('all');
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim().toLowerCase() ?? '';

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        // TODO: Replace with the real API call.
        await new Promise((resolve) => setTimeout(resolve, 500));

        setDocuments([
          {
            id: 1,
            name: 'Project Alpha Weekly Meeting',
            type: 'transcript',
            uploadedBy: 'Inci',
            uploadedDate: 'Jul 7',
            status: 'processed',
            details: '3 action items · 2 decisions',
            action: 'Open',
          },
          {
            id: 2,
            name: 'API Design v2.pdf',
            type: 'pdf',
            uploadedBy: 'Inci',
            uploadedDate: 'Jul 7',
            status: 'processing',
            details: '1.8 MB',
            action: 'Open',
          },
          {
            id: 3,
            name: 'MVP Scope.docx',
            type: 'doc',
            uploadedBy: 'Alex Morgan',
            uploadedDate: 'Jul 5',
            status: 'processed',
            details: '640 KB',
            action: 'Open',
          },
          {
            id: 4,
            name: 'Kickoff Deck.pptx',
            type: 'ppt',
            uploadedBy: 'Jordan Lee',
            uploadedDate: 'Jul 8',
            status: 'uploaded',
            details: 'just uploaded',
            action: 'Process',
          },
          {
            id: 5,
            name: 'Legacy Notes.pdf',
            type: 'pdf',
            uploadedBy: 'Inci',
            uploadedDate: 'Jul 6',
            status: 'failed',
            details: 'Unreadable file — OCR failed',
            action: 'Retry',
          },
        ]);
      } catch (error) {
        console.error('Failed to load documents', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesType = filterType === 'all' || document.type === filterType;
      const searchableText = [
        document.name,
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
                    <button
                      type="button"
                      className="document-table-action"
                      disabled={isProcessing}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDocument(document.id);
                      }}
                    >
                      {document.action}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
