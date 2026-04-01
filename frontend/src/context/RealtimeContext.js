import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import realtimeService from '../services/realtimeService';

const RealtimeContext = createContext({ version: 0, connected: false });

export const RealtimeProvider = ({ children }) => {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  const bumpTimerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((message) => {
      if (message?.event === 'sse:open' || message?.event === 'sse:connected') {
        setConnected(true);
        return;
      }

      if (message?.event === 'sse:ping') {
        setConnected(true);
        return;
      }

      if (message?.event === 'app:refresh') {
        setConnected(true);
        if (bumpTimerRef.current) return;
        bumpTimerRef.current = window.setTimeout(() => {
          bumpTimerRef.current = null;
          setVersion((prev) => prev + 1);
        }, 120);
      }
    });

    return () => {
      if (bumpTimerRef.current) {
        window.clearTimeout(bumpTimerRef.current);
        bumpTimerRef.current = null;
      }
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ version, connected }), [version, connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => useContext(RealtimeContext);
