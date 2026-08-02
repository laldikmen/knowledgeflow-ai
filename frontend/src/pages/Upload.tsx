import React, { useState, useRef } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import './Upload.css';

interface UploadFile {
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
}

export const Upload: React.FC = () => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [documentType, setDocumentType] = useState<'pdf' | 'doc' | 'ppt' | 'transcript'>('pdf');
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      processFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (fileList: FileList) => {
    const newFiles: UploadFile[] = Array.from(fileList).map(file => ({
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending',
    }));

    setFiles(prev => [...prev, ...newFiles]);

    newFiles.forEach((file, index) => {
      simulateUpload(index + files.length);
    });
  };

  const simulateUpload = (fileIndex: number) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[fileIndex].status = 'uploading';
      return updated;
    });

    const interval = setInterval(() => {
      setFiles(prev => {
        const updated = [...prev];
        if (updated[fileIndex].progress < 100) {
          updated[fileIndex].progress += Math.random() * 30;
          if (updated[fileIndex].progress > 100) {
            updated[fileIndex].progress = 100;
          }
        } else {
          updated[fileIndex].status = 'success';
          clearInterval(interval);
        }
        return updated;
      });
    }, 500);
  };

  const handleUpload = async () => {
    if (!title || !projectId || files.length === 0) {
      alert('Please fill in all fields and select at least one file');
      return;
    }

    // TODO: Replace with real API call
    // await client.post('/documents/upload', {
    //   title,
    //   projectId,
    //   documentType,
    //   files
    // });

    console.log('Uploading:', { title, projectId, documentType, files });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalFiles = files.length;
  const uploadedFiles = files.filter(f => f.status === 'success').length;

  return (
    <div className="upload">
      <div className="upload-header">
        <h2>Upload Center</h2>
        <p className="upload-subtitle">Add documents or meeting transcripts for AI processing</p>
      </div>

      <div className="upload-content">
        {/* Upload Form */}
        <Card className="upload-form-card">
          <h3>Upload Details</h3>

          <div className="form-group">
            <Input
              type="text"
              label="Document Title"
              placeholder="e.g., Project Alpha Weekly Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Document Type</label>
              <select
                className="form-select"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as any)}
              >
                <option value="pdf">PDF Document</option>
                <option value="doc">Word Document</option>
                <option value="ppt">PowerPoint Presentation</option>
                <option value="transcript">Meeting Transcript</option>
              </select>
            </div>

            <div className="form-group">
              <Input
                type="text"
                label="Project"
                placeholder="Select project..."
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Drag and Drop Area */}
        <div
          className={`upload-dropzone ${dragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.vtt"
          />
          <div className="dropzone-content">
            <div className="dropzone-icon">📄</div>
            <h3>Drag and drop files here</h3>
            <p>or click to browse</p>
            <p className="dropzone-info">PDF, Word, PowerPoint, or Transcript files up to 50 MB</p>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <Card className="upload-files-card">
            <h3>
              Files ({uploadedFiles}/{totalFiles} uploaded)
            </h3>
            <div className="upload-files-list">
              {files.map((file, index) => (
                <div key={index} className="upload-file-item">
                  <div className="file-info">
                    <div className="file-icon">📎</div>
                    <div className="file-details">
                      <div className="file-name">{file.name}</div>
                      <div className="file-size">{formatFileSize(file.size)}</div>
                    </div>
                  </div>
                  <div className="file-progress">
                    {file.status === 'uploading' && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                    {file.status === 'success' && (
                      <span className="status-badge success">✓ Done</span>
                    )}
                    {file.status === 'error' && (
                      <span className="status-badge error">✕ Failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="upload-actions">
        <Button variant="secondary" onClick={() => setFiles([])}>
          Clear All
        </Button>
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={files.length === 0 || !title || !projectId}
        >
          Upload & Process ({totalFiles} files)
        </Button>
      </div>

      <Card className="upload-info">
        <h4>What AI will extract:</h4>
        <ul>
          <li>Document summary</li>
          <li>Key decisions</li>
          <li>Action items with owners and deadlines</li>
          <li>Searchable full text</li>
        </ul>
      </Card>
    </div>
  );
};
