import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import './Documents.css';

interface Document {
  id: number;
  name: string;
  type: 'pdf' | 'doc' | 'ppt' | 'transcript';
  uploadedBy: string;
  uploadedDate: string;
  status: 'processed' | 'processing' | 'failed';
}

export const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'doc' | 'ppt' | 'transcript'>('all');

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        // TODO: Replace with real API call
        // const response = await client.get('/documents');

        await new Promise(resolve => setTimeout(resolve, 500));

        setDocuments([
          {
            id: 1,
            name: 'Project Alpha Weekly Meeting',
            type: 'transcript',
            uploadedBy: 'Inci',
            uploadedDate: 'Jul 7, 2026',
            status: 'processed',
          },
          {
            id: 2,
            name: 'API Design v2.pdf',
            type: 'pdf',
            uploadedBy: 'Inci',
            uploadedDate: 'Jul 7, 2026',
            status: 'processed',
          },
          {
            id: 3,
            name: 'MVP Scope.docx',
            type: 'doc',
            uploadedBy: 'Alex Morgan',
            uploadedDate: 'Jul 5, 2026',
            status: 'processed',
          },
          {
            id: 4,
            name: 'Kickoff Deck.pptx',
            type: 'ppt',
            uploadedBy: 'Jordan Lee',
            uploadedDate: 'Jul 8, 2026',
            status: 'processed',
          },
          {
            id: 5,
            name: 'Legacy Notes.pdf',
            type: 'pdf',
            uploadedBy: 'Inci',
            uploadedDate: 'Jul 6, 2026',
            status: 'failed',
          },
        ]);
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || doc.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      pdf: 'PDF',
      doc: 'Word',
      ppt: 'PowerPoint',
      transcript: 'Transcript',
    };
    return labels[type] || type;
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      processed: 'status-processed',
      processing: 'status-processing',
      failed: 'status-failed',
    };
    return classes[status] || '';
  };

  if (isLoading) {
    return <div className="documents">Loading documents...</div>;
  }

  return (
    <div className="documents">
      <div className="documents-header">
        <div className="documents-title-section">
          <h2>Documents & Meetings</h2>
          <p className="documents-subtitle">{filteredDocuments.length} files</p>
        </div>
        <Button variant="primary">Upload Document</Button>
      </div>

      <Card className="documents-filters">
        <div className="documents-filter-group">
          <Input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="documents-type-filters">
          {(['all', 'pdf', 'doc', 'ppt', 'transcript'] as const).map((type) => (
            <button
              key={type}
              className={`filter-btn ${filterType === type ? 'active' : ''}`}
              onClick={() => setFilterType(type)}
            >
              {type === 'all' ? 'All types' : getTypeLabel(type)}
            </button>
          ))}
        </div>
      </Card>

      <div className="documents-list">
        {filteredDocuments.length === 0 ? (
          <Card className="documents-empty">
            <p>No documents found</p>
          </Card>
        ) : (
          filteredDocuments.map((doc) => (
            <div key={doc.id} className="document-row">
              <div className="document-info">
                <div className="document-icon">{doc.type.substring(0, 1).toUpperCase()}</div>
                <div className="document-details">
                  <h4 className="document-name">{doc.name}</h4>
                  <p className="document-meta">
                    {getTypeLabel(doc.type)} • Uploaded by {doc.uploadedBy} on {doc.uploadedDate}
                  </p>
                </div>
              </div>
              <div className={`document-status ${getStatusClass(doc.status)}`}>
                {doc.status === 'processed' && '✓ Processed'}
                {doc.status === 'processing' && '⟳ Processing'}
                {doc.status === 'failed' && '✕ Failed'}
              </div>
              <Button variant="secondary" size="small">
                {doc.status === 'failed' ? 'Retry' : 'Open'}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
