import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import client from '../api/client';
import './Upload.css';

interface ProjectOption {
  value: string;
  label: string;
}

type DocumentType = 'pdf' | 'doc' | 'ppt' | 'transcript';

type UploadStatus = 'pending' | 'processing' | 'success' | 'error';

interface UploadFile {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  // Keep the actual File so we can upload it. Reading it back from the hidden
  // <input> is unreliable — the input is cleared after selection and never
  // holds drag-and-dropped files.
  file: File;
}

const inferDocumentType = (fileName: string): DocumentType => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'pdf') return 'pdf';
  if (extension === 'doc' || extension === 'docx') return 'doc';
  if (extension === 'ppt' || extension === 'pptx') return 'ppt';
  return 'transcript';
};

interface UploadProps {
  currentUserRole?: string;
}

export const Upload: React.FC<UploadProps> = ({ currentUserRole = 'Viewer' }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('transcript');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // null while loading; true/false once we know if the user can upload anywhere.
  const [canUpload, setCanUpload] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUserRole.trim().toLowerCase() === 'admin';

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await client.get('/projects');
        const data = response.data || [];
        const options = data.map((proj: any) => ({
          value: proj.id.toString(),
          label: proj.name,
        }));
        setProjectOptions(options);
        if (options.length > 0) {
          setProjectId(options[0].value);
        }
        // A user can upload only if they're an admin or a manager/contributor in
        // at least one project. Viewers (everywhere) are read-only.
        const uploadable =
          isAdmin ||
          data.some((p: any) =>
            ['manager', 'contributor'].includes((p.project_role || '').toLowerCase()),
          );
        setCanUpload(uploadable);
      } catch (error) {
        console.error('Failed to load projects', error);
        setProjectOptions([]);
        setCanUpload(isAdmin);
      }
    };

    fetchProjects();
  }, [isAdmin]);

  const handleDrag = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFiles = (fileList: FileList) => {
    const selectedFiles = Array.from(fileList).map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      size: file.size,
      status: 'pending' as UploadStatus,
      file,
    }));

    if (selectedFiles.length === 0) return;

    setFiles((currentFiles) => [...currentFiles, ...selectedFiles]);

    const firstFile = fileList[0];
    setDocumentType(inferDocumentType(firstFile.name));

    if (!title.trim()) {
      const suggestedTitle = firstFile.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());

      setTitle(suggestedTitle);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files.length > 0) {
      processFiles(event.dataTransfer.files);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      processFiles(event.target.files);
      event.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((currentFiles) =>
      currentFiles.filter((file) => file.id !== fileId),
    );
  };

  const handleStartProcessing = async () => {
    if (!title.trim() || !projectId || files.length === 0) {
      return;
    }

    setIsProcessing(true);
    setFiles((currentFiles) =>
      currentFiles.map((file) => ({ ...file, status: 'processing' })),
    );

    // Snapshot the files being uploaded (from state — the real File objects).
    const pending = files;
    let anyFailed = false;

    for (const item of pending) {
      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('project_id', projectId);
        formData.append('document_type', documentType);
        formData.append('title', title);
        if (description.trim()) {
          formData.append('description', description);
        }

        const uploadResponse = await client.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Trigger AI processing on the new document. Upload already succeeded, so
        // a processing failure (e.g. no extractable text) must not fail the row.
        const documentId = uploadResponse.data?.id;
        if (documentId) {
          try {
            await client.post(`/ai/process/${documentId}`);
          } catch (processError) {
            console.error('AI processing failed (document still uploaded):', processError);
          }
        }

        setFiles((currentFiles) =>
          currentFiles.map((f) =>
            f.id === item.id ? { ...f, status: 'success' } : f,
          ),
        );
      } catch (error) {
        anyFailed = true;
        console.error('Upload failed:', error);
        setFiles((currentFiles) =>
          currentFiles.map((f) =>
            f.id === item.id ? { ...f, status: 'error' } : f,
          ),
        );
      }
    }

    setIsProcessing(false);
    // Only clear the form when everything uploaded, so a failed attempt keeps
    // the title/description for a retry.
    if (!anyFailed) {
      setTitle('');
      setDescription('');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value.toFixed(unitIndex === 0 ? 0 : 0)} ${units[unitIndex]}`;
  };

  const canStartProcessing =
    files.length > 0 && Boolean(projectId) && Boolean(title.trim());

  // Viewers (read-only everywhere) cannot upload — block the whole page.
  if (canUpload === false) {
    return (
      <div className="upload">
        <div className="upload-blocked" role="alert">
          <div className="upload-blocked-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </div>
          <h2>Viewers can't upload documents</h2>
          <p>
            Your role on these projects is <strong>Viewer</strong>, which is
            read-only. Uploading and AI processing are available to Contributors,
            Project Managers, and Administrators. Ask a Project Manager to change
            your role if you need to upload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="upload">
      <div className="upload-layout">
        <section className="upload-form-card">
          <div
            className={`upload-dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Choose files to upload"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="upload-file-input"
              accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.vtt,.srt"
            />

            <div className="upload-dropzone-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 16V4" />
                <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
                <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
              </svg>
            </div>

            <div className="upload-dropzone-title">
              Drag &amp; drop, or <span>browse files</span>
            </div>
            <div className="upload-dropzone-help">
              PDF, Word, PowerPoint or transcript · up to 50 MB
            </div>
          </div>

          {files.length > 0 && (
            <div className="upload-selected-files">
              {files.map((file) => (
                <div className="upload-file-row" key={file.id}>
                  <div className="upload-file-type-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      {documentType === 'transcript' ? (
                        <>
                          <circle cx="12" cy="12" r="7" />
                          <path d="M12 8v4l3 2" />
                        </>
                      ) : (
                        <>
                          <path d="M7 3h7l4 4v14H7z" />
                          <path d="M14 3v5h5" />
                        </>
                      )}
                    </svg>
                  </div>

                  <div className="upload-file-details">
                    <div className="upload-file-name">{file.name}</div>
                    <div className="upload-file-meta">
                      {formatFileSize(file.size)} ·{' '}
                      {documentType === 'transcript'
                        ? 'transcript'
                        : documentType.toUpperCase()}
                    </div>
                  </div>

                  {file.status === 'processing' && (
                    <span className="upload-file-state">Processing…</span>
                  )}

                  {file.status === 'success' && (
                    <span className="upload-file-state upload-file-state--success">
                      Ready
                    </span>
                  )}

                  <button
                    type="button"
                    className="upload-file-remove"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeFile(file.id);
                    }}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="upload-form-grid">
            <div className="upload-field">
              <label htmlFor="upload-project">Project / Department</label>
              <select
                id="upload-project"
                className="upload-control"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                {projectOptions.map((project) => (
                  <option key={project.value} value={project.value}>
                    {project.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="upload-field">
              <label htmlFor="upload-document-type">Document type</label>
              <select
                id="upload-document-type"
                className="upload-control"
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as DocumentType)
                }
              >
                <option value="transcript">Meeting transcript</option>
                <option value="pdf">PDF document</option>
                <option value="doc">Word document</option>
                <option value="ppt">PowerPoint presentation</option>
              </select>
            </div>
          </div>

          <div className="upload-field upload-field--full">
            <label htmlFor="upload-title">Title</label>
            <input
              id="upload-title"
              className="upload-control"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Project Alpha Weekly Meeting"
            />
          </div>

          <div className="upload-field upload-field--full">
            <label htmlFor="upload-description">
              Description <span>(optional)</span>
            </label>
            <textarea
              id="upload-description"
              className="upload-control upload-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Standup covering MVP scope and API design decisions..."
            />
          </div>
        </section>

        <aside className="upload-ai-card">
          <h2>What AI will extract</h2>

          <ol className="upload-ai-list">
            <li>
              <span>1</span>
              <p>Summary of the document</p>
            </li>
            <li>
              <span>2</span>
              <p>Key decisions</p>
            </li>
            <li>
              <span>3</span>
              <p>Action items + suggested owners &amp; deadlines</p>
            </li>
          </ol>

          <Button
            variant="primary"
            size="large"
            fullWidth
            className="upload-process-button"
            onClick={handleStartProcessing}
            disabled={!canStartProcessing}
            loading={isProcessing}
          >
            Start AI Processing
          </Button>

          <p className="upload-ai-note">
            Extracted items start as <strong>Draft</strong> for human review.
          </p>
        </aside>
      </div>
    </div>
  );
};
