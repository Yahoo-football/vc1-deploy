import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import ConfirmationModal from './ConfirmationModal';

const DialogContext = createContext(null);

const DIALOG_STYLES = {
  confirm: {
    title: 'Please Confirm',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    badgeLabel: 'Confirmation',
    variant: 'default',
    showCancel: true
  },
  alert: {
    title: 'Notice',
    confirmText: 'OK',
    cancelText: 'Cancel',
    badgeLabel: 'Notice',
    variant: 'default',
    showCancel: false
  }
};

export const DialogProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState(null);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    const currentDialog = resolverRef.current ? dialogState : null;

    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }

    setDialogState(null);

    if (result) {
      currentDialog?.onConfirm?.();
      return;
    }

    currentDialog?.onClose?.();
  }, [dialogState]);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        type: 'confirm',
        title: options.title || DIALOG_STYLES.confirm.title,
        message,
        confirmText: options.confirmText || DIALOG_STYLES.confirm.confirmText,
        cancelText: options.cancelText || DIALOG_STYLES.confirm.cancelText,
        badgeLabel: options.badgeLabel || DIALOG_STYLES.confirm.badgeLabel,
        variant: options.variant || DIALOG_STYLES.confirm.variant,
        showCancel: true,
        onConfirm: options.onConfirm,
        onClose: options.onClose
      });
    });
  }, []);

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialogState({
        type: 'alert',
        title: options.title || DIALOG_STYLES.alert.title,
        message,
        confirmText: options.confirmText || DIALOG_STYLES.alert.confirmText,
        cancelText: options.cancelText || DIALOG_STYLES.alert.cancelText,
        badgeLabel: options.badgeLabel || DIALOG_STYLES.alert.badgeLabel,
        variant: options.variant || DIALOG_STYLES.alert.variant,
        showCancel: false,
        onConfirm: options.onConfirm,
        onClose: options.onClose
      });
    });
  }, []);

  const contextValue = useMemo(() => ({ confirm, showAlert }), [confirm, showAlert]);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      <ConfirmationModal
        isOpen={Boolean(dialogState)}
        title={dialogState?.title}
        message={dialogState?.message}
        confirmLabel={dialogState?.confirmText}
        cancelLabel={dialogState?.cancelText}
        badgeLabel={dialogState?.badgeLabel}
        variant={dialogState?.variant || 'default'}
        showCancel={dialogState?.showCancel}
        onConfirm={() => closeDialog(true)}
        onClose={() => closeDialog(false)}
      />
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};
