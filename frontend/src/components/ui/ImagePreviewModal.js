import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

// Render the image preview modal modal.
const ImagePreviewModal = ({ open, imageUrl, title = 'Image preview', onClose }) => {
  useEffect(() => {
    if (!open) return undefined;

    // Handle key down interactions.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close image preview"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="bg-slate-100 p-4">
          <img src={imageUrl} alt={title} className="max-h-[75vh] w-full rounded-2xl object-contain" />
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;
