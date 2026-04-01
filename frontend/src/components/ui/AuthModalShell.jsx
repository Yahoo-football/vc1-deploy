import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import './ConfirmationModal.css';

const AuthModalShell = ({
  badgeLabel,
  title,
  description,
  children,
  maxWidth = 460,
  homeLinkState
}) => {
  const navigate = useNavigate();

  return (
    <div className="confirmation-modal__overlay">
      <div
        className="confirmation-modal__card confirmation-modal__card--enter"
        style={{
          width: `min(100%, ${maxWidth}px)`,
          display: 'flex',
          flexDirection: 'column'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div
          className="confirmation-modal__content"
          style={{ overflowY: 'auto' }}
        >
          <button
            type="button"
            className="confirmation-modal__close"
            onClick={() => navigate(-1)}
            aria-label="Close modal"
          >
            <XMarkIcon className="confirmation-modal__close-icon" />
          </button>

          <div className="mb-3 text-center sm:mb-4">
            <Link
              to="/"
              state={homeLinkState}
              className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 sm:px-4 sm:py-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-600 text-sm font-bold text-white sm:h-9 sm:w-9">
                FB
              </span>
            </Link>
          </div>

          <span className="confirmation-modal__badge confirmation-modal__badge--default">
            {badgeLabel}
          </span>

          <h2 id="auth-modal-title" className="confirmation-modal__title">
            {title}
          </h2>

          {description ? <p className="confirmation-modal__message">{description}</p> : null}

          <div className="confirmation-modal__body">{children}</div>
        </div>
      </div>
    </div>
  );
};

export default AuthModalShell;
