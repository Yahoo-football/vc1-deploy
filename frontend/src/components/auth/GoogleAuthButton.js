import React, { useEffect, useRef, useState } from 'react';
import authService from '../../services/authService';

const EMBEDDED_GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GOOGLE_NOT_CONFIGURED_MESSAGE = 'Google sign-in is not configured yet.';

const resolveGoogleClientId = async () => {
  if (EMBEDDED_GOOGLE_CLIENT_ID) {
    return EMBEDDED_GOOGLE_CLIENT_ID;
  }

  const response = await authService.getGoogleAuthConfig();
  const clientId = String(response.data?.clientId || '').trim();

  if (response.success && response.data?.enabled && clientId) {
    return clientId;
  }

  throw new Error(GOOGLE_NOT_CONFIGURED_MESSAGE);
};

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Sign-In is only available in the browser.'));
      return;
    }

    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In.')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google Sign-In.'));
    document.head.appendChild(script);
  });

const GoogleAuthButton = ({ onCredential, onError, disabled = false, text = 'continue_with' }) => {
  const buttonRef = useRef(null);
  const initializedRef = useRef(false);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    if (!buttonRef.current) {
      return;
    }

    if (initializedRef.current) {
      setReady(true);
      return;
    }

    let active = true;
    setLoadError('');
    setReady(false);

    Promise.all([resolveGoogleClientId(), loadGoogleScript()])
      .then(([clientId, google]) => {
        if (!active || !google?.accounts?.id || !buttonRef.current || initializedRef.current) return;

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onCredentialRef.current?.(response.credential);
              return;
            }
            onErrorRef.current?.('Google sign-in did not return a credential.');
          }
        });

        buttonRef.current.innerHTML = '';
        google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: Math.min(buttonRef.current.offsetWidth || 320, 360)
        });

        initializedRef.current = true;
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        const message = error?.message || 'Failed to load Google sign-in.';
        setLoadError(message);
        onErrorRef.current?.(message);
      });

    return () => {
      active = false;
    };
  }, [text]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {loadError}
      </div>
    );
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
      <div ref={buttonRef} className="flex min-h-[44px] justify-center" />
      {!ready ? <div className="mt-2 text-center text-xs text-slate-500">Loading Google sign-in...</div> : null}
    </div>
  );
};

export default GoogleAuthButton;
