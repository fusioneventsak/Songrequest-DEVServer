import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { useRealtimeConnection } from './useRealtimeConnection';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import type { SongRequest } from '../types';

const REQUESTS_CACHE_KEY = 'requests:all';
const FETCH_DEBOUNCE_TIME = 25; // Further reduced to 25ms for faster normal updates
const FETCH_TIMEOUT = 15000; // 15 seconds

export function useRequestSyncWithHeartbeat(onUpdate: (requests: SongRequest[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const mountedRef = useRef(true);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchInProgressRef = useRef<boolean>(false);
  
  // Use the realtime connection hook
  const { isConnected, reconnect } = useRealtimeConnection();
  
  // Create a safe callback for realtime updates with INSTANT lock handling
  const handleRealtimeUpdate = useCallback((payload: any) => {
    console.log('Realtime update received:', payload.eventType, payload.table);
    
    // Check if this is a lock/unlock or status change - these need INSTANT updates
    const oldData = payload.old || {};
    const newData = payload.new || {};
    
    const isLockChange = oldData.is_locked !== newData.is_locked;
    const isStatusChange = oldData.status !== newData.status;
    const isPlayedChange = oldData.is_played !== newData.is_played;
    
    if (isLockChange || isStatusChange || isPlayedChange) {
      console.log('🚨 INSTANT UPDATE: Lock/Status/Played change detected');
      // For critical updates: NO debouncing, NO cache check, IMMEDIATE fetch
      fetchRequests(true, true); 
    } else {
      console.log('📥 Regular update - using normal flow');
      // For other updates: use normal debounced flow
      fetchRequests(true);
    }
  }, []);
  
  // Use the realtime subscription hook for requests
  const requestsSubscription = useRealtimeSubscription(
    'requests',
    handleRealtimeUpdate,
    { event: '*', schema: 'public', table: 'requests' },
    isOnline
  );
  
  // Use the realtime subscription hook for requesters
  const requestersSubscription = useRealtimeSubscription(
    'requesters',
    handleRealtimeUpdate,
    { event: '*', schema: 'public', table: 'requesters' },
    isOnline
  );
  
  // Create a fresh abort controller for fetch operations
  const createFreshAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      try {
        if (!abortControllerRef.current.signal.aborted) {
          abortControllerRef.current.abort();
        }
      } catch (err) {
        console.warn('Error aborting previous request:', err);
      }
    }
    
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);
  
  // Fetch requests with optional debouncing bypass for urgent updates
  const fetchRequests = useCallback(async (bypassCache = false, bypassDebounce = false) => {
    if (!mountedRef.current) return;
    
    // Don't allow concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }
    
    // Debounce frequent calls unless bypassed for urgent updates
    const now = Date.now();
    if (!bypassCache && !bypassDebounce && now - lastFetchTimeRef.current < FETCH_DEBOUNCE_TIME) {
      console.log('Debouncing request fetch...');
      
      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Set a new timeout to fetch after debounce period
      fetchTimeoutRef.current = setTimeout(() => {
        fetchRequests(bypassCache, false);
      }, FETCH_DEBOUNCE_TIME);
      
      return;
    }
    
    lastFetchTimeRef.current = now;
    fetchInProgressRef.current = true;
    
    // Create a fresh abort controller
    const signal = createFreshAbortController();
    
    // Set a timeout to abort long-running requests
    const timeoutId = setTimeout(() => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        console.warn(`Fetch operation timed out after ${FETCH_TIMEOUT}ms`);
        abortControllerRef.current.abort('Request timed out');
      }
    }, FETCH_TIMEOUT);
    
    try {
      setIsLoading(true);
      
      // Check cache first if not bypassing
      if (!bypassCache) {
        const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
        if (cachedRequests?.length > 0) {
          console.log('Using cached requests');
          if (mountedRef.current) {
            onUpdate(cachedRequests);
            setIsLoading(false);
          }
          return;
        }
      }
      
      // Fetch requests with requesters
      console.log('Fetching requests with requesters...');
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select(`
          *,
          requesters (
            id,
            name,
            photo,
            message,
            created_at
          )
        `)
        .order('created_at', { ascending: false })
        .abortSignal(signal);
      
      // Handle errors
      if (requestsError) {
        throw requestsError;
      }
      
      // Process results
      if (requestsData && mountedRef.current) {
        const formattedRequests = requestsData.map(request => ({
          id: request.id,
          title: request.title,
          artist: request.artist || '',
          votes: request.votes || 0,
          status: request.status || 'pending',
          isLocked: request.is_locked || false,
          isPlayed: request.is_played || false,
          createdAt: new Date(request.created_at).toISOString(),
          requesters: (request.requesters || []).map(requester => ({
            id: requester.id,
            name: requester.name,
            photo: requester.photo,
            message: requester.message || '',
            timestamp: new Date(requester.created_at).toISOString()
          }))
        }));
        
        // Update cache and state
        cacheService.setRequests(REQUESTS_CACHE_KEY, formattedRequests);
        onUpdate(formattedRequests);
        setError(null);
      }
    } catch (error) {
      // Skip AbortError logging if component is unmounting
      if (error instanceof Error && 
          (error.name === 'AbortError' || 
           error.message.includes('aborted') || 
           error.message.includes('Component unmounted')) && 
          !mountedRef.current) {
        console.log('Request aborted due to component unmount');
        return;
      }
      
      // Handle other errors
      if (mountedRef.current) {
        console.error('Error fetching requests:', error);
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Use cached data if available
        const cachedRequests = cacheService.get<SongRequest[]>(REQUESTS_CACHE_KEY);
        if (cachedRequests) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedRequests);
        }
      }
    } finally {
      clearTimeout(timeoutId);
      
      if (mountedRef.current) {
        setIsLoading(false);
      }
      
      fetchInProgressRef.current = false;
    }
  }, [onUpdate, createFreshAbortController]);
  
  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connection restored');
      setIsOnline(true);
      fetchRequests(true, true); // Bypass both cache and debounce when coming online
    };
    
    const handleOffline = () => {
      console.log('Network connection lost');
      setIsOnline(false);
      
      // Abort any in-flight requests
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort('Network connection lost');
      }
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchRequests]);
  
  // REMOVED: Periodic polling interval setup
  // Initial fetch only - no more polling timer
  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch only
    fetchRequests();
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      // Clear any pending timeouts
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Abort any in-flight requests
      if (abortControllerRef.current) {
        try {
          if (!abortControllerRef.current.signal.aborted) {
            abortControllerRef.current.abort('Component unmounted');
          }
        } catch (err) {
          console.warn('Error aborting request on unmount:', err);
        }
      }
    };
  }, [fetchRequests, isOnline]);
  
  // Manual reconnect function
  const manualReconnect = useCallback(async () => {
    console.log('Manual reconnection requested');
    
    // Abort any in-flight requests
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort('Manual reconnection requested');
    }
    
    // Reconnect realtime
    await reconnect();
    
    // Fetch fresh data with urgent priority
    fetchRequests(true, true);
  }, [reconnect, fetchRequests]);
  
  return {
    isLoading,
    error,
    isOnline,
    isConnected,
    refetch: (bypassCache = true) => fetchRequests(bypassCache, true), // Always bypass debounce for manual refetch
    reconnect: manualReconnect
  };
}