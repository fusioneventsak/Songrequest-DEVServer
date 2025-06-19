import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { RealtimeManager } from '../utils/realtimeManager';
import type { Song } from '../types';

const SONGS_CACHE_KEY = 'songs:all';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second base delay

export function useSongSync(onUpdate: (songs: Song[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const subscriptionRef = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgressRef = useRef(false);

  // Fetch songs with simple error handling
  const fetchSongs = useCallback(async (bypassCache = false) => {
    // Don't allow concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }
    
    fetchInProgressRef.current = true;
    
    try {
      if (!mountedRef.current) return;
      
      setIsLoading(true);
      setError(null);

      // Check cache first unless bypassing
      if (!bypassCache) {
        const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
        if (cachedSongs?.length > 0) {
          console.log('Using cached songs');
          if (mountedRef.current) {
            onUpdate(cachedSongs);
            setIsLoading(false);
          }
          return;
        }
      }

      // Fetch songs
      console.log('Fetching songs...');
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          artist,
          genre,
          key,
          notes,
          "albumArtUrl",
          created_at,
          updated_at
        `)
        .order('title');

      if (songsError) throw songsError;

      if (songsData && mountedRef.current) {
        cacheService.setSongs(SONGS_CACHE_KEY, songsData);
        onUpdate(songsData);
        setRetryCount(0); // Reset retry count on success
      }
    } catch (error) {
      console.error('Error fetching songs:', error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Use cached data if available
        const cachedSongs = cacheService.get<Song[]>(SONGS_CACHE_KEY);
        if (cachedSongs) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedSongs);
        }
        
        // Retry with exponential backoff
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          const delay = RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          
          if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
          }
          
          fetchTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              setRetryCount(prev => prev + 1);
              fetchSongs(true);
            }
          }, delay);
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      fetchInProgressRef.current = false;
    }
  }, [onUpdate, retryCount]);

  // Setup realtime subscription
  useEffect(() => {
    mountedRef.current = true;
    
    // Initialize RealtimeManager
    RealtimeManager.init();
    
    // Setup subscription
    const setupSubscription = () => {
      try {
        const subscription = RealtimeManager.createSubscription(
          'songs',
          (payload) => {
            console.log('Songs changed:', payload.eventType);
            fetchSongs(true);
          }
        );
        
        subscriptionRef.current = subscription;
      } catch (error) {
        console.error('Error setting up realtime subscription:', error);
      }
    };
    
    // Initial fetch and subscription setup
    fetchSongs();
    setupSubscription();
    
    // REMOVED: Periodic polling interval setup
    // No more setInterval for polling every 5 minutes
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      // Clear any pending timeouts
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Remove subscription
      if (subscriptionRef.current) {
        RealtimeManager.removeSubscription(subscriptionRef.current);
      }
    };
  }, [fetchSongs]);

  return { 
    isLoading, 
    error, 
    refetch: () => fetchSongs(true) 
  };
}