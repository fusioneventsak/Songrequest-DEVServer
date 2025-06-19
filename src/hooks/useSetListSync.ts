import { useEffect, useCallback, useState, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { cacheService } from '../utils/cache';
import { RealtimeManager } from '../utils/realtimeManager';
import type { SetList } from '../types';

const SET_LISTS_CACHE_KEY = 'set_lists:all';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second base delay

export function useSetListSync(onUpdate: (setLists: SetList[]) => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const setListsSubscriptionRef = useRef<string | null>(null);
  const setListSongsSubscriptionRef = useRef<string | null>(null);
  const setListActivationSubscriptionRef = useRef<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchInProgressRef = useRef(false);

  // Fetch set lists with simple error handling
  const fetchSetLists = useCallback(async (bypassCache = false) => {
    // Don't allow concurrent fetches
    if (fetchInProgressRef.current) {
      console.log('Fetch already in progress, skipping');
      return;
    }
    
    // Debounce frequent calls (but allow bypass for critical updates)
    const now = Date.now();
    if (!bypassCache && now - lastFetchTimeRef.current < 300) { // 300ms debounce
      console.log('Debouncing set list fetch...');
      
      // Clear any existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Set a new timeout to fetch after debounce period
      fetchTimeoutRef.current = setTimeout(() => {
        fetchSetLists(bypassCache);
      }, 300);
      
      return;
    }
    
    lastFetchTimeRef.current = now;
    fetchInProgressRef.current = true;
    
    try {
      if (!mountedRef.current) return;
      
      setIsLoading(true);
      setError(null);

      // Check cache first unless bypassing
      if (!bypassCache) {
        const cachedSetLists = cacheService.get<SetList[]>(SET_LISTS_CACHE_KEY);
        if (cachedSetLists?.length > 0) {
          console.log('Using cached set lists');
          if (mountedRef.current) {
            onUpdate(cachedSetLists);
            setIsLoading(false);
          }
          return;
        }
      }

      // First, let's check what columns actually exist in the songs table
      console.log('Checking songs table structure...');

      // Fetch set lists with songs - use wildcard to get all song columns
      console.log('Fetching set lists with songs...');
      const { data: setListsData, error: setListsError } = await supabase
        .from('set_lists')
        .select(`
          id,
          name,
          date,
          notes,
          is_active,
          created_at,
          set_list_songs (
            id,
            position,
            songs (
              id,
              title,
              artist,
              genre,
              key,
              notes,
              "albumArtUrl"
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (setListsError) throw setListsError;

      if (setListsData && mountedRef.current) {
        // Format the data to match our SetList type
        const formattedSetLists = setListsData.map(setList => ({
          id: setList.id,
          name: setList.name,
          date: setList.date,
          isActive: setList.is_active || false,
          notes: setList.notes || '',
          createdAt: setList.created_at || '',
          songs: (setList.set_list_songs || [])
            .sort((a: any, b: any) => a.position - b.position)
            .map((sls: any) => {
              const song = sls.songs;
              console.log('Processing song from setlist:', song.title, 'Album art:', song.albumArtUrl);
              return {
                ...song,
                // Use the standardized albumArtUrl field
                albumArtUrl: song.albumArtUrl || null,
                position: sls.position,
                setListSongId: sls.id
              };
            })
        }));

        // Log active set list for debugging
        const activeSetList = formattedSetLists.find(sl => sl.isActive);
        if (activeSetList) {
          console.log(`Active set list found: ${activeSetList.name} (${activeSetList.id})`);
          console.log(`Active setlist songs with album art: ${activeSetList.songs?.filter(s => s.albumArtUrl).length}/${activeSetList.songs?.length}`);
          if (activeSetList.songs?.length > 0) {
            console.log('First active setlist song:', activeSetList.songs[0]);
          }
        } else {
          console.log('No active set list found');
        }
        
        cacheService.setSetLists(SET_LISTS_CACHE_KEY, formattedSetLists);
        onUpdate(formattedSetLists);
        setRetryCount(0); // Reset retry count on success
      }
    } catch (error) {
      console.error('Error fetching set lists:', error);
      
      if (mountedRef.current) {
        setError(error instanceof Error ? error : new Error(String(error)));
        
        // Use cached data if available
        const cachedSetLists = cacheService.get<SetList[]>(SET_LISTS_CACHE_KEY);
        if (cachedSetLists) {
          console.warn('Using stale cache due to fetch error');
          onUpdate(cachedSetLists);
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
              fetchSetLists(true);
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

  // Setup realtime subscriptions
  useEffect(() => {
    mountedRef.current = true;
    
    // Initialize RealtimeManager
    RealtimeManager.init();
    
    // Setup subscriptions
    const setupSubscriptions = () => {
      try {
        // Subscribe to set_lists table
        const setListsSub = RealtimeManager.createSubscription(
          'set_lists',
          (payload) => {
            console.log('Set lists changed:', payload.eventType);
            fetchSetLists(true);
          }
        );
        
        // Subscribe to set_list_songs table
        const setListSongsSub = RealtimeManager.createSubscription(
          'set_list_songs',
          (payload) => {
            console.log('Set list songs changed:', payload.eventType);
            fetchSetLists(true);
          }
        );
        // Subscribe specifically to set list activation changes
        const setListActivationSub = RealtimeManager.createSubscription(
          'set_lists',
          (payload) => {
            console.log('🔔 Set list activation changed:', payload);
            // If this is an update and is_active changed, fetch immediately with high priority
            if (payload.eventType === 'UPDATE' && 
                payload.new && payload.old && 
                payload.new.is_active !== payload.old.is_active) {
              console.log('⚡ Set list activation state changed - immediate update');
              // Clear cache and fetch fresh data
              cacheService.del(SET_LISTS_CACHE_KEY);
              fetchSetLists(true);
            }
          },
          { event: 'UPDATE', schema: 'public', table: 'set_lists', filter: `is_active=eq.true` }
        );
        
        setListsSubscriptionRef.current = setListsSub;
        setListSongsSubscriptionRef.current = setListSongsSub;
        setListActivationSubscriptionRef.current = setListActivationSub;
      } catch (error) {
        console.error('Error setting up realtime subscriptions:', error);
      }
    };
    
    // Initial fetch and subscription setup
    fetchSetLists();
    setupSubscriptions();
    
    // REMOVED: Periodic polling interval setup
    // No more setInterval for polling every 5 minutes
    // Add a polling interval as a fallback for production environments
    // where realtime might be less reliable
    const pollingInterval = setInterval(() => {
      console.log('Polling for set list updates...');
      fetchSetLists(true);
    }, 10000); // Poll every 10 seconds
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      
      // Clear any pending timeouts
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      // Clear polling interval
      clearInterval(pollingInterval);
      
      // Remove subscriptions
      if (setListsSubscriptionRef.current) {
        RealtimeManager.removeSubscription(setListsSubscriptionRef.current);
      }
      
      if (setListSongsSubscriptionRef.current) {
        RealtimeManager.removeSubscription(setListSongsSubscriptionRef.current);
      }
      if (setListActivationSubscriptionRef.current) {
        RealtimeManager.removeSubscription(setListActivationSubscriptionRef.current);
      }
    };
  }, [fetchSetLists]);

  return { 
    isLoading, 
    error, 
    refetch: () => fetchSetLists(true) 
  };
}