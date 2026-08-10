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
  source?: ChatSource;
  unavailable?: boolean;
}

interface ChatSession {
  id: number;
  projectId: string;
  title: string;
  time: string;
  messages: ChatMessage[];
}

const projects = [
  { id: 'alpha', name: 'Project Alpha' },
  { id: 'beta', name: 'Project Beta' },
  { id: 'migration', name: 'Data Migration' },
];

const initialSessions: ChatSession[] = [];

const renderMessageText = (message: ChatMessage) => {
  if (!message.emphasis || !message.content.includes(message.emphasis)) {
    return message.content;
  }

  const [before, after] = message.content.split(message.emphasis);

  return (
    <>
      {before}
      <strong>{message.emphasis}</strong>
      {after}
    </>
  );
};

const createSessionTitle = (question: string) =>
  question.length > 34 ? `${question.slice(0, 34).trim()}…` : question;

export const AIChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState<number>(1);
  const [selectedProject, setSelectedProject] = useState('alpha');
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedProjectName = useMemo(
    () => projects.find(project => project.id === selectedProject)?.name ?? 'Project Alpha',
    [selectedProject],
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
      const response = await client.post('/chat', {
        question,
        project_id: projectId,
      });

      const data = response.data;
      return {
        content: data.answer || data.content,
        emphasis: data.emphasis,
        source: data.source ? {
          title: data.source.title,
          meta: data.source.meta,
        } : undefined,
        unavailable: data.unavailable || false,
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
                    <p className={message.unavailable ? 'kf-chat-unavailable-text' : ''}>
                      {renderMessageText(message)}
                    </p>

                    {message.source && (
                      <div className="kf-chat-source-block">
                        <span className="kf-chat-source-label">Source</span>
                        <button type="button" className="kf-chat-source-card">
                          <span className="kf-chat-source-icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="7" />
                              <path d="M12 8v4l3 2" />
                            </svg>
                          </span>
                          <span>
                            <strong>{message.source.title}</strong>
                            {message.source.meta && <small>{message.source.meta}</small>}
                          </span>
                        </button>
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
