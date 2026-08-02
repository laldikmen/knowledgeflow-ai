import React, { useState, useRef, useEffect } from 'react';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import './AIChat.css';

interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
}

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      type: 'assistant',
      content:
        'Welcome! I\'m the KnowledgeFlow AI Assistant. I can help you search through your project documents, answer questions about decisions made, find action items, and more. What would you like to know?',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedProject, setSelectedProject] = useState('all');

  const projects = [
    { id: 'all', name: 'All Projects' },
    { id: 'alpha', name: 'Project Alpha' },
    { id: 'beta', name: 'Project Beta' },
    { id: 'migration', name: 'Data Migration' },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: messages.length + 1,
      type: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        {
          content:
            'Based on the Project Alpha Weekly Meeting, the team decided to use Amazon S3 for document storage as it\'s the simplest path for the MVP. You should find the meeting transcript in your Documents section for more details.',
          sources: ['Project Alpha Weekly Meeting', 'MVP Scope.docx'],
        },
        {
          content:
            'There are currently 3 high-priority action items in Project Alpha: 1) Prepare frontend wireframe (Inci, due Jul 8), 2) Create upload API (Jordan Lee, due Jul 20), and 3) Define API schema (Alex Morgan, due Jul 9).',
          sources: ['Action Tracker Board'],
        },
        {
          content:
            'The upload API endpoints should handle PDF, Word, PowerPoint, and meeting transcript files. The maximum file size is 50 MB per file, and we\'re using AWS S3 with CloudFront for distribution.',
          sources: ['API Design v2.pdf', 'Project Alpha Weekly Meeting'],
        },
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];

      const assistantMessage: ChatMessage = {
        id: messages.length + 2,
        type: 'assistant',
        content: response.content,
        timestamp: new Date().toLocaleTimeString(),
        sources: response.sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="ai-chat">
      <div className="chat-header">
        <div>
          <h2>AI Chat Assistant</h2>
          <p className="chat-subtitle">Ask questions about your projects and documents</p>
        </div>

        <div className="chat-project-filter">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="project-select"
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map(message => (
            <div key={message.id} className={`message ${message.type}`}>
              <div className="message-avatar">
                {message.type === 'user' ? 'You' : 'AI'}
              </div>
              <div className="message-content">
                <p>{message.content}</p>
                {message.sources && message.sources.length > 0 && (
                  <div className="message-sources">
                    <span className="sources-label">Sources:</span>
                    {message.sources.map((source, idx) => (
                      <a key={idx} href="#" className="source-link">
                        {source}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <span className="message-time">{message.timestamp}</span>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <div className="message-avatar">AI</div>
              <div className="message-content typing">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <Card className="chat-input-area">
          <div className="chat-suggestions">
            <p className="suggestions-title">Try asking:</p>
            <div className="suggestion-chips">
              <button className="suggestion-chip">What decisions were made in Project Alpha?</button>
              <button className="suggestion-chip">What are the overdue action items?</button>
              <button className="suggestion-chip">Who owns the upload API task?</button>
            </div>
          </div>

          <div className="chat-input-group">
            <textarea
              className="chat-input"
              placeholder="Ask about your documents, decisions, or tasks..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={3}
            />
            <Button
              variant="primary"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
            >
              Send
            </Button>
          </div>

          <p className="chat-note">
            💡 I can only access documents and information from the projects you have access to.
          </p>
        </Card>
      </div>
    </div>
  );
};
