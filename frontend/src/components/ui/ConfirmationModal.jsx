import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import './ConfirmationModal.css';

const ConfirmationModal = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  badgeLabel = 'Confirmation',
  showCancel = true,
  showConfirm = true,
  closeOnOverlay = true,
  children,
  onConfirm,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;

    // Handle key down interactions.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Handle confirm interactions.
  const handleConfirm = () => {
    onConfirm?.();
  };

  return (
    <div className="confirmation-modal__overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div
        className="confirmation-modal__card confirmation-modal__card--enter"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
      >
        <div className="confirmation-modal__content">
          <button
            type="button"
            className="confirmation-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <XMarkIcon className="confirmation-modal__close-icon" />
          </button>

          <span className={`confirmation-modal__badge confirmation-modal__badge--${variant}`}>
            {badgeLabel}
          </span>

          <h2 id="confirmation-modal-title" className="confirmation-modal__title">
            {title}
          </h2>

          {message ? <p className="confirmation-modal__message">{message}</p> : null}
          {children ? <div className="confirmation-modal__body">{children}</div> : null}

          <div className="confirmation-modal__actions">
            {showCancel && (
              <button
                type="button"
                className="confirmation-modal__button confirmation-modal__button--secondary"
                onClick={onClose}
              >
                {cancelLabel}
              </button>
            )}
            {showConfirm && (
              <button
                type="button"
                className={`confirmation-modal__button confirmation-modal__button--primary confirmation-modal__button--${variant}`}
                onClick={handleConfirm}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
