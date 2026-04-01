

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import App from './App';

if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
  const NativeResizeObserver = window.ResizeObserver;

  window.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.observer = new NativeResizeObserver((entries, observer) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }

    observe(target, options) {
      this.observer.observe(target, options);
    }

    unobserve(target) {
      this.observer.unobserve(target);
    }

    disconnect() {
      this.observer.disconnect();
    }
  };
}

// Suppress browser extension warnings in development
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  const originalWarn = console.warn;
  const isIgnoredRuntimeMessage = (message) =>
    typeof message === 'string' &&
    (
      message.includes('chrome-extension://') ||
      message.includes('chrome-extension') ||
      message.includes('elementFromPoint') ||
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('ResizeObserver loop completed with undelivered notifications.') ||
      message.includes('ResizeObserver loop limit exceeded')
    );
  
  // Filter extension warnings for the current result.
  const filterExtensionWarnings = (args) => {
    const message = args[0];
    if (isIgnoredRuntimeMessage(message)) {
      return true; // Filter out
    }
    return false; // Don't filter
  };
  
  console.error = (...args) => {
    if (!filterExtensionWarnings(args)) {
      originalError.apply(console, args);
    }
  };
  
  console.warn = (...args) => {
    if (!filterExtensionWarnings(args)) {
      originalWarn.apply(console, args);
    }
  };

  const suppressResizeObserverOverlay = (event) => {
    const message = event?.message || '';
    if (isIgnoredRuntimeMessage(message)) {
      event.preventDefault?.();
      event.stopImmediatePropagation();
      return false;
    }
    return undefined;
  };

  window.addEventListener('error', suppressResizeObserverOverlay, true);
  window.onerror = (message, source, lineno, colno, error) => {
    if (isIgnoredRuntimeMessage(String(message || error?.message || ''))) {
      return true;
    }
    return false;
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const app = process.env.NODE_ENV === 'development' ? <App /> : (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

root.render(app);



