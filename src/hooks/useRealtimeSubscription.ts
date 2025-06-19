import { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeManager } from '../utils/realtimeManager';

/**
 * Custom hook for managing Supabase realtime subscriptions
 * with improved error handling and reconnection logic
 */
export function useRealtimeSubscription<T>(
  table: string,
  onData: (payload: T) => void,
  filter?: any,
  enabled: boolean = true
) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const callbackRef = useRef(onData);
  
  // Update callback ref when onData changes
  useEffect(() => {
    callbackRef.current = onData;
  }, [onData]);
  
  // Wrapper for callback to ensure it's safe
  const safeCallback = useCallback((payload: any) => {
    if (mountedRef.current) {
      try {
        callbackRef.current(payload);
      } catch (error) {
        console.error('Error in subscription callback:', error);
      }
    }
  }, []);
  
  // Setup subscription
  const subscribe = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Create subscription
      const subscriptionId = await RealtimeManager.createSubscription(
        table,
        safeCallback,
        filter
      );
      
      if (mountedRef.current) {
        subscriptionIdRef.current = subscriptionId;
        setIsSubscribed(true);
        setError(null);
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [table, safeCallback, filter, enabled]);
  
  // Cleanup subscription
  const unsubscribe = useCallback(async () => {
    if (subscriptionIdRef.current) {
      try {
        await RealtimeManager.removeSubscription(subscriptionIdRef.current);
      } catch (error) {
        console.warn('Error removing subscription:', error);
      }
      subscriptionIdRef.current = null;
    }
    setIsSubscribed(false);
  }, []);
  
  // Force reconnection
  const reconnect = useCallback(async () => {
    await unsubscribe();
    await subscribe();
  }, [unsubscribe, subscribe]);
  
  // Setup and teardown
  useEffect(() => {
    mountedRef.current = true;
    
    // Add connection listener
    const handleConnectionEvent = (event: string) => {
      if (!mountedRef.current) return;
      
      if (event === 'connected') {
        // Resubscribe if needed
        if (!isSubscribed && enabled) {
          subscribe();
        }
      } else if (event === 'disconnected') {
        setIsSubscribed(false);
      }
    };
    
    RealtimeManager.addConnectionListener(handleConnectionEvent);
    
    // Initial subscription
    if (enabled) {
      subscribe();
    }
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      RealtimeManager.removeConnectionListener(handleConnectionEvent);
      unsubscribe();
    };
  }, [subscribe, unsubscribe, enabled, isSubscribed]);
  
  // Handle changes to enabled state
  useEffect(() => {
    if (enabled && !isSubscribed) {
      subscribe();
    } else if (!enabled && isSubscribed) {
      unsubscribe();
    }
  }, [enabled, isSubscribed, subscribe, unsubscribe]);
  
  return {
    isSubscribed,
    isLoading,
    error,
    reconnect
  };
}