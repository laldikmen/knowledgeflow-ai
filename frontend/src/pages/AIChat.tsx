import React, { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import './AIChat.css';

interface ChatSource {
  title: string;
  meta?: string;
}

interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  emphasis?: string;
  sources?: ChatSource[];
  unavailable?: boolean;
}

interface ChatSession {
  id: number;
  projectId: string;
  title: string;
  time: string;
  messages: ChatMessage[];
}

interface ChatProject {
  id: string;
  name: string;
}

const initialSessions: ChatSession[] = [];

// Render a line's inline markdown: **bold** and [Document N] citation chips.
const renderInline = (text: string, keyBase: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]*\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <span key={`${keyBase}-c${i}`} className="kf-chat-citation">
          {token.slice(1, -1)}
        </span>,
      );
    }
    last = match.index + token.length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

// Lightweight markdown renderer for assistant answers: paragraphs, numbered and
// bulleted lists, bold, and inline document citations.
const MarkdownAnswer: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const numbered = (l: string) => /^\s*\d+\.\s+/.test(l);
  const bulleted = (l: string) => /^\s*[-*•]\s+/.test(l);

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i += 1;
      continue;
    }

    if (numbered(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && numbered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`k${key++}`} className="kf-chat-list">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${key}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (bulleted(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && bulleted(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`k${key++}`} className="kf-chat-list">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ul${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !numbered(lines[i]) && !bulleted(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={`k${key++}`}>{renderInline(para.join(' '), `p${key}`)}</p>);
  }

  return <>{blocks}</>;
};

const createSessionTitle = (question: string) =>
  question.length > 34 ? `${question.slice(0, 34).trim()}…` : question;

export const AIChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number>(1);
  const [selectedProject, setSelectedProject] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await client.get('/projects');
        const projectsData = response.data.map((proj: any) => ({
          id: proj.id.toString(),
          name: proj.name,
        }));
        setProjects(projectsData);
        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0].id);
        }
      } catch (error) {
        console.error('Failed to load projects', error);
        setProjects([]);
      }
    };

    fetchProjects();
  }, []);

  // Load this user's persisted chat history for the selected project so past
  // conversations survive reloads (backend returns only the caller's own).
  useEffect(() => {
    if (!selectedProject) return;

    const loadHistory = async () => {
      try {
        const response = await client.get(`/ai/chat/${selectedProject}/my-history`);
        const rows: any[] = Array.isArray(response.data) ? response.data : [];

        const parseSources = (raw: any): ChatSource[] => {
          let arr = raw;
          if (typeof raw === 'string') {
            try { arr = JSON.parse(raw); } catch { return []; }
          }
          if (!Array.isArray(arr)) return [];
          return arr
            .map((s: any) => ({
              title: s.title || s.document_title,
              meta: s.meta || s.excerpt,
            }))
            .filter((s: ChatSource) => !!s.title);
        };

        const loaded: ChatSession[] = rows.map((row) => {
          const rid = Number(row.id);
          return {
            id: rid,
            projectId: selectedProject,
            title: createSessionTitle(row.question || 'Conversation'),
            time: row.created_at
              ? new Date(row.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : '',
            messages: [
              { id: rid * 2, type: 'user', content: row.question || '' },
              {
                id: rid * 2 + 1,
                type: 'assistant',
                content: row.answer || '',
                sources: parseSources(row.sources),
              },
            ],
          };
        });
        // Newest first.
        loaded.sort((a, b) => b.id - a.id);

        // Replace this project's sessions with the loaded history; keep any other project's.
        setSessions((prev) => [
          ...loaded,
          ...prev.filter((s) => s.projectId !== selectedProject),
        ]);
        setActiveSessionId(loaded[0]?.id ?? 0);
      } catch (error) {
        console.error('Failed to load chat history', error);
      }
    };

    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const selectedProjectName = useMemo(
    () => projects.find(project => project.id === selectedProject)?.name ?? '',
    [projects, selectedProject],
  );

  const projectSessions = useMemo(
    () => sessions.filter(session => session.projectId === selectedProject),
    [sessions, selectedProject],
  );

  const activeSession = useMemo(
    () => projectSessions.find(session => session.id === activeSessionId) ?? null,
    [projectSessions, activeSessionId],
  );

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    if (activeSession) return;

    const firstSession = projectSessions[0];
    if (firstSession) {
      setActiveSessionId(firstSession.id);
      return;
    }

    setActiveSessionId(0);
  }, [activeSession, projectSessions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchAssistantResponse = async (
    question: string,
    projectId: string,
  ): Promise<Omit<ChatMessage, 'id' | 'type'>> => {
    try {
      const response = await client.post(`/ai/chat/${projectId}`, {
        question,
      });

      const data = response.data.data ?? response.data;
      const sources: ChatSource[] = Array.isArray(data.sources)
        ? data.sources
            .map((s: any) => ({
              title: s.document_title || s.title,
              meta: s.excerpt || s.meta,
            }))
            .filter((s: ChatSource) => !!s.title)
        : [];
      return {
        content: data.answer || data.content,
        sources,
        unavailable: false,
      };
    } catch (error) {
      console.error('Failed to get AI response:', error);
      return {
        content: 'I could not process your question at this time. Please try again.',
        unavailable: true,
      };
    }
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setInputValue('');
    setIsLoading(false);

    const firstSessionForProject = sessions.find(session => session.projectId === projectId);
    setActiveSessionId(firstSessionForProject?.id ?? 0);
  };

  const handleSelectSession = (sessionId: number) => {
    setActiveSessionId(sessionId);
    setInputValue('');
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      type: 'user',
      content: question,
    };

    let targetSessionId = activeSession?.id;

    if (!targetSessionId) {
      targetSessionId = Date.now() + 1;
      const newSession: ChatSession = {
        id: targetSessionId,
        projectId: selectedProject,
        title: createSessionTitle(question),
        time: 'Just now',
        messages: [userMessage],
      };

      setSessions(previous => [
        newSession,
        ...previous.map(session =>
          session.projectId === selectedProject && session.time === 'Just now'
            ? { ...session, time: 'Earlier today' }
            : session,
        ),
      ]);
      setActiveSessionId(targetSessionId);
    } else {
      setSessions(previous =>
        previous.map(session => {
          if (session.id !== targetSessionId) return session;

          const shouldRename = session.title === 'New conversation' && session.messages.length === 0;

          return {
            ...session,
            title: shouldRename ? createSessionTitle(question) : session.title,
            time: 'Just now',
            messages: [...session.messages, userMessage],
          };
        }),
      );
    }

    const responseSessionId = targetSessionId;

    setInputValue('');
    setIsLoading(true);

    const response = await fetchAssistantResponse(question, selectedProject);

    setSessions(previous =>
      previous.map(session =>
        session.id === responseSessionId
          ? {
              ...session,
              messages: [
                ...session.messages,
                {
                  id: Date.now() + 2,
                  type: 'assistant',
                  ...response,
                },
              ],
            }
          : session,
      ),
    );
    setIsLoading(false);
  };

  const handleNewChat = () => {
    const nextId = Date.now();

    const newSession: ChatSession = {
      id: nextId,
      projectId: selectedProject,
      title: 'New conversation',
      time: 'Just now',
      messages: [],
    };

    setSessions(previous => [
      newSession,
      ...previous.map(session =>
        session.projectId === selectedProject && session.time === 'Just now'
          ? { ...session, time: 'Earlier today' }
          : session,
      ),
    ]);
    setActiveSessionId(nextId);
    setInputValue('');
    setIsLoading(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section className="kf-chat-page" aria-label="Knowledge Assistant">
      <aside className="kf-chat-rail">
        <div className="kf-chat-scope">
          <label htmlFor="chat-project">Scope</label>
          <div className="kf-chat-select-wrap">
            <select
              id="chat-project"
              value={selectedProject}
              onChange={event => handleProjectChange(event.target.value)}
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m8 10 4 4 4-4" />
            </svg>
          </div>
        </div>

        <button type="button" className="kf-chat-new" onClick={handleNewChat}>
          <span aria-hidden="true">+</span>
          New chat
        </button>

        <div className="kf-chat-history">
          <p className="kf-chat-rail-label">History</p>
          <div className="kf-chat-history-list">
            {projectSessions.map(session => (
              <button
                type="button"
                key={session.id}
                className={`kf-chat-history-item ${
                  activeSessionId === session.id ? 'is-active' : ''
                }`}
                onClick={() => handleSelectSession(session.id)}
              >
                <span>{session.title}</span>
                <small>{session.time}</small>
              </button>
            ))}

            {projectSessions.length === 0 && (
              <p className="kf-chat-history-empty">No conversations yet.</p>
            )}
          </div>
        </div>
      </aside>

      <div className="kf-chat-workspace">
        <header className="kf-chat-workspace-header">
          <div className="kf-chat-brand-mark" aria-hidden="true">
            <span />
          </div>
          <div>
            <h1>Knowledge Assistant</h1>
            <p>Searching documents in {selectedProjectName}</p>
          </div>
        </header>

        <div className="kf-chat-thread">
          {messages.length === 0 && (
            <div className="kf-chat-empty-state">
              <div className="kf-chat-brand-mark" aria-hidden="true">
                <span />
              </div>
              <h2>Start a new conversation</h2>
              <p>Ask a question about the documents, decisions, or tasks in {selectedProjectName}.</p>
            </div>
          )}

          {messages.map(message => (
            <article
              key={message.id}
              className={`kf-chat-message kf-chat-message--${message.type}`}
            >
              {message.type === 'user' ? (
                <div className="kf-chat-user-bubble">{message.content}</div>
              ) : (
                <div
                  className={`kf-chat-assistant-card ${
                    message.unavailable ? 'kf-chat-assistant-card--compact' : ''
                  }`}
                >
                  {message.unavailable && (
                    <span className="kf-chat-answer-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="6" />
                        <path d="m16 16 4 4" />
                      </svg>
                    </span>
                  )}

                  <div className="kf-chat-answer-content">
                    {message.unavailable ? (
                      <p className="kf-chat-unavailable-text">{message.content}</p>
                    ) : (
                      <div className="kf-chat-answer-body">
                        <MarkdownAnswer text={message.content} />
                      </div>
                    )}

                    {message.sources && message.sources.length > 0 && (
                      <div className="kf-chat-source-block">
                        <span className="kf-chat-source-label">
                          {message.sources.length > 1 ? 'Sources' : 'Source'}
                        </span>
                        <div className="kf-chat-source-list">
                          {message.sources.map((source, index) => (
                            <button
                              type="button"
                              className="kf-chat-source-card"
                              key={`${source.title}-${index}`}
                            >
                              <span className="kf-chat-source-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="7" />
                                  <path d="M12 8v4l3 2" />
                                </svg>
                              </span>
                              <span>
                                <strong>{source.title}</strong>
                                {source.meta && <small>{source.meta}</small>}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}

          {isLoading && (
            <article className="kf-chat-message kf-chat-message--assistant">
              <div className="kf-chat-assistant-card kf-chat-assistant-card--typing">
                <span />
                <span />
                <span />
              </div>
            </article>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="kf-chat-composer-wrap">
          <div className="kf-chat-composer">
            <textarea
              value={inputValue}
              onChange={event => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your documents..."
              rows={1}
              aria-label="Ask about your documents"
            />
            <button
              type="button"
              className="kf-chat-send"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h13" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
