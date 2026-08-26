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

// A ChatSession mirrors one backend conversation. `conversationId` is null only
// for a brand-new, not-yet-sent chat; `loaded` tracks whether its messages have
// been fetched (they load lazily when the conversation is opened).
interface ChatSession {
  id: number;
  conversationId: number | null;
  projectId: string;
  title: string;
  time: string;
  messages: ChatMessage[];
  loaded: boolean;
}

interface ChatProject {
  id: string;
  name: string;
}

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

const parseSources = (raw: any): ChatSource[] => {
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((s: any) => ({ title: s.title || s.document_title, meta: s.meta || s.excerpt }))
    .filter((s: ChatSource) => !!s.title);
};

// Short, human label for when a conversation was last active.
const formatWhen = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Flatten a backend conversation's messages into the alternating user/assistant
// bubbles the thread renders.
const toMessages = (rows: any[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  rows.forEach((row) => {
    const rid = Number(row.id);
    out.push({ id: rid * 2, type: 'user', content: row.question || '' });
    out.push({
      id: rid * 2 + 1,
      type: 'assistant',
      content: row.answer || '',
      sources: parseSources(row.sources),
      unavailable: false,
    });
  });
  return out;
};

export const AIChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number>(0);
  const [selectedProject, setSelectedProject] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // null = unknown/loading; false = the selected project has no documents.
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await client.get('/projects');
        const projectsData = (response.data as any[]).map((proj: any) => ({
          id: proj.id.toString(),
          name: proj.name,
        }));
        setProjects(projectsData);
        if (projectsData.length > 0) setSelectedProject(projectsData[0].id);
      } catch (error) {
        console.error('Failed to load projects', error);
        setProjects([]);
      }
    };
    fetchProjects();
  }, []);

  // Fetch and cache the messages for one conversation the first time it's opened.
  const loadMessagesFor = async (session: ChatSession) => {
    if (session.loaded || !session.conversationId) return;
    try {
      const res = await client.get(
        `/ai/chat/${session.projectId}/conversations/${session.conversationId}`,
      );
      const data: any = res.data;
      const msgs = toMessages(Array.isArray(data?.messages) ? data.messages : []);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id
            ? { ...s, messages: msgs, loaded: true, title: data?.title || s.title }
            : s,
        ),
      );
    } catch (error) {
      console.error('Failed to load conversation', error);
    }
  };

  // Load this user's conversations (one row each — not one per message) for the
  // selected project whenever the scope changes.
  useEffect(() => {
    if (!selectedProject) return;

    const loadConversations = async () => {
      try {
        const response = await client.get(`/ai/chat/${selectedProject}/conversations`);
        const rows: any[] = Array.isArray(response.data) ? response.data : [];
        const loaded: ChatSession[] = rows.map((row) => ({
          id: Number(row.id),
          conversationId: Number(row.id),
          projectId: selectedProject,
          title: row.title || 'Conversation',
          time: formatWhen(row.updated_at || row.created_at),
          messages: [],
          loaded: false,
        }));

        setSessions((prev) => [
          ...loaded,
          ...prev.filter((s) => s.projectId !== selectedProject),
        ]);

        if (loaded[0]) {
          setActiveSessionId(loaded[0].id);
          loadMessagesFor(loaded[0]);
        } else {
          setActiveSessionId(0);
        }
      } catch (error) {
        console.error('Failed to load conversations', error);
      }
    };

    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Track whether the selected project has any documents, so the empty state can
  // explain that an empty project can't answer questions (vs. looking broken).
  useEffect(() => {
    if (!selectedProject) {
      setHasDocuments(null);
      return;
    }
    let cancelled = false;
    setHasDocuments(null);
    client
      .get(`/projects/${selectedProject}`)
      .then((res) => {
        if (!cancelled) setHasDocuments(Number((res.data as any)?.document_count) > 0);
      })
      .catch(() => {
        if (!cancelled) setHasDocuments(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  const selectedProjectName = useMemo(
    () => projects.find((project) => project.id === selectedProject)?.name ?? '',
    [projects, selectedProject],
  );

  const projectSessions = useMemo(
    () => sessions.filter((session) => session.projectId === selectedProject),
    [sessions, selectedProject],
  );

  const activeSession = useMemo(
    () => projectSessions.find((session) => session.id === activeSessionId) ?? null,
    [projectSessions, activeSessionId],
  );

  const messages = activeSession?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId);
    setInputValue('');
    setIsLoading(false);
  };

  const handleSelectSession = (sessionId: number) => {
    setActiveSessionId(sessionId);
    setInputValue('');
    setIsLoading(false);
    const target = sessions.find((s) => s.id === sessionId);
    if (target) loadMessagesFor(target);
  };

  const handleNewChat = () => {
    // Reuse an existing empty draft rather than stacking blank chats.
    const existingDraft = projectSessions.find(
      (s) => s.conversationId === null && s.messages.length === 0,
    );
    if (existingDraft) {
      setActiveSessionId(existingDraft.id);
      setInputValue('');
      setIsLoading(false);
      return;
    }

    const tempId = -Date.now();
    setSessions((prev) => [
      {
        id: tempId,
        conversationId: null,
        projectId: selectedProject,
        title: 'New chat',
        time: 'Just now',
        messages: [],
        loaded: true,
      },
      ...prev,
    ]);
    setActiveSessionId(tempId);
    setInputValue('');
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    const question = inputValue.trim();
    if (!question || isLoading) return;

    // Resolve the session to post into — create a fresh draft if none is active.
    let session = activeSession;
    let sessionKey = session?.id;
    if (!session) {
      sessionKey = -Date.now();
      session = {
        id: sessionKey,
        conversationId: null,
        projectId: selectedProject,
        title: 'New chat',
        time: 'Just now',
        messages: [],
        loaded: true,
      };
      setSessions((prev) => [session as ChatSession, ...prev]);
      setActiveSessionId(sessionKey);
    }

    const conversationId = session.conversationId;
    const userMessage: ChatMessage = { id: Date.now(), type: 'user', content: question };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionKey
          ? { ...s, messages: [...s.messages, userMessage], time: 'Just now', loaded: true }
          : s,
      ),
    );
    setInputValue('');
    setIsLoading(true);

    let answer: Omit<ChatMessage, 'id' | 'type'>;
    let newConversationId: number | null = null;
    let newTitle = '';
    try {
      const response = await client.post(`/ai/chat/${selectedProject}`, {
        question,
        conversation_id: conversationId ?? undefined,
      });
      const data = (response.data as any).data ?? response.data;
      answer = { content: data.answer || data.content, sources: parseSources(data.sources), unavailable: false };
      newConversationId = Number(data.conversation_id) || null;
      newTitle = data.conversation_title || '';
    } catch (error) {
      console.error('Failed to get AI response:', error);
      answer = {
        content: 'I could not process your question at this time. Please try again.',
        unavailable: true,
      };
    }

    const assistantMessage: ChatMessage = { id: Date.now() + 2, type: 'assistant', ...answer };

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionKey) return s;
        const promotedId = s.conversationId ? s.id : newConversationId ?? s.id;
        return {
          ...s,
          id: promotedId,
          conversationId: s.conversationId ?? newConversationId,
          title: s.conversationId ? s.title : newTitle || s.title,
          messages: [...s.messages, assistantMessage],
          loaded: true,
        };
      }),
    );

    // If this was a brand-new conversation, follow it under its real id.
    if (!conversationId && newConversationId) setActiveSessionId(newConversationId);
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
              onChange={(event) => handleProjectChange(event.target.value)}
            >
              {projects.map((project) => (
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
            {projectSessions.map((session) => (
              <button
                type="button"
                key={session.id}
                className={`kf-chat-history-item ${
                  activeSessionId === session.id ? 'is-active' : ''
                }`}
                onClick={() => handleSelectSession(session.id)}
              >
                <span className="kf-chat-history-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1-5.6A8.5 8.5 0 1 1 21 11.5Z" />
                  </svg>
                </span>
                <span className="kf-chat-history-text">
                  <span>{session.title}</span>
                  <small>{session.time}</small>
                </span>
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
            <p>Grounded in the documents of {selectedProjectName || 'your project'}</p>
          </div>
        </header>

        <div className="kf-chat-thread">
          {messages.length === 0 && (
            <div className="kf-chat-empty-state">
              <div className="kf-chat-brand-mark" aria-hidden="true">
                <span />
              </div>
              {hasDocuments === false ? (
                <>
                  <h2>No documents in {selectedProjectName || 'this project'}</h2>
                  <p>This project has no documents yet — upload one or switch projects.</p>
                </>
              ) : (
                <>
                  <h2>Ask about {selectedProjectName || 'this project'}</h2>
                  <p>
                    I answer only from the documents in this project, and cite what I used.
                    Try asking about a decision, deadline, or action item.
                  </p>
                </>
              )}
            </div>
          )}

          {messages.map((message) => (
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
                  <span className="kf-chat-answer-avatar" aria-hidden="true">
                    <span />
                  </span>

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
                                  <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                                  <path d="M5 3h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
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
                <span className="kf-chat-answer-avatar" aria-hidden="true">
                  <span />
                </span>
                <div className="kf-chat-typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </article>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="kf-chat-composer-wrap">
          <div className="kf-chat-composer">
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask about ${selectedProjectName || 'your documents'}…`}
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
          <p className="kf-chat-composer-hint">
            Answers come only from this project's documents.
          </p>
        </div>
      </div>
    </section>
  );
};
