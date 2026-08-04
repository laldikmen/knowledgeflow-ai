import React, { useEffect } from 'react';
import './ConfirmationModal.css';

type ConfirmationTone = 'default' | 'danger' | 'success';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmationTone;
  icon?: React.ReactNode;
  details?: React.ReactNode;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Back',
  tone = 'default',
  icon,
  details,
  inputLabel,
  inputPlaceholder,
  inputValue = '',
  onInputChange,
  onClose,
  onConfirm,
  confirmDisabled = false,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fallbackIcon = tone === 'danger' ? '×' : tone === 'success' ? '✓' : '!';

  return (
    <div
      className="confirmation-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`confirmation-modal confirmation-modal--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
      >
        <span className="confirmation-modal-icon" aria-hidden="true">
          {icon ?? fallbackIcon}
        </span>

        <h2 id="confirmation-modal-title">{title}</h2>
        <div className="confirmation-modal-description">{description}</div>

        {details && <div className="confirmation-modal-details">{details}</div>}

        {inputLabel && onInputChange && (
          <label className="confirmation-modal-field">
            <span>{inputLabel}</span>
            <textarea
              rows={3}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={inputPlaceholder}
              autoFocus
            />
          </label>
        )}

        <div className="confirmation-modal-actions">
          <button
            type="button"
            className="confirmation-modal-button confirmation-modal-button--secondary"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirmation-modal-button confirmation-modal-button--${tone}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
};
