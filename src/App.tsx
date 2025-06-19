// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './utils/supabase';
import { UserFrontend } from './components/UserFrontend';
import { BackendLogin } from './components/BackendLogin';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { useUiSettings } from './hooks/useUiSettings';
import { useSongSync } from './hooks/useSongSync';
import { useRequestSync } from './hooks/useRequestSync';
import { useSetListSync } from './hooks/useSetListSync';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Song, SongRequest, RequestFormData, SetList, User } from './types';
import { generateDefaultAvatar } from './utils/photoStorage';
import { LogOut } from 'lucide-react';

// Import the backend components
import { SongLibrary } from './components/SongLibrary';
import { SetListManager } from './components/SetListManager';
import { QueueView } from './components/QueueView';
import { SettingsManager } from './components/SettingsManager';
import { LogoManager } from './components/LogoManager';
import { ColorCustomizer } from './components/ColorCustomizer';
import { LogoDebugger } from './components/LogoDebugger';
import { TickerManager } from './components/TickerManager';
import { BackendTabs } from './components/BackendTabs';
import { LandingPage } from './components/LandingPage';
import { Logo } from './components/shared/Logo';
import { KioskPage } from './components/KioskPage';

const DEFAULT_BAND_LOGO = "https://www.fusion-events.ca/wp-content/uploads/2025/03/ulr-wordmark.png";
const BACKEND_PATH = "backend";
const KIOSK_PATH = "kiosk";
const MAX_PHOTO_SIZE = 250 * 1024; // 250KB limit for database storage
const MAX_REQUEST_RETRIES = 3;

function App() {
  // Authentication state
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBackend, setIsBackend] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  
  // Backend tab state
  const [activeBackendTab, setActiveBackendTab] = useState<'requests' | 'setlists' | 'songs' | 'settings'>('requests');
  
  // App data state
  const [songs, setSongs] = useState<Song[]>([]);
  const [requests, setRequestsState] = useState<SongRequest[]>([]);
  
  // Debug wrapper for setRequests
  const setRequests = useCallback((newRequests: any) => {
    console.log('🔄 setRequests called with:', newRequests);
    if (Array.isArray(newRequests)) {
      console.log('📥 Setting requests to array of length:', newRequests.length);
    } else if (typeof newRequests === 'function') {
      console.log('📥 Setting requests with function');
    }
    setRequestsState(newRequests);
  }, []);
  
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [activeSetList, setActiveSetList] = useState<SetList | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tickerMessage, setTickerMessage] = useState<string>('');
  const [isTickerActive, setIsTickerActive] = useState(false);
  
  // Track network state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAppActive, setIsAppActive] = useState(true);
  
  // Ref to track if component is mounted
  const mountedRef = useRef<boolean>(true);
  const requestInProgressRef = useRef(false);
  const requestRetriesRef = useRef(0);
  
  // UI Settings
  const { settings, updateSettings } = useUiSettings();
  
  // Initialize data synchronization
  const { isLoading: isFetchingSongs } = useSongSync(setSongs);
  const { isLoading: isFetchingRequests, reconnect: reconnectRequests } = useRequestSync(setRequests);
  const { isLoading: isFetchingSetLists, refetch: refreshSetLists } = useSetListSync(setSetLists);

  // SUPABASE CONNECTION TEST
  useEffect(() => {
    const testSupabaseConnection = async () => {
      console.log('🔍 Testing Supabase connection...');
      console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      try {
        // Test basic connection with a simple select query
        const { data, error } = await supabase
          .from('requests')
          .select('id')
          .limit(1);
        
        if (error) {
          console.error('❌ Supabase connection failed:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          });
          
          // Check if it's a URL issue
          if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            console.error('🌐 This looks like a network/URL issue');
            console.log('Current URL being used:', import.meta.env.VITE_SUPABASE_URL);
            
            // Check if URL ends with .co instead of .com
            const url = import.meta.env.VITE_SUPABASE_URL;
            if (url && url.includes('.supabase.co')) {
              console.log('✅ URL looks correct (uses .supabase.co)');
            } else {
              console.log('⚠️ URL might be incorrect - should end with .supabase.co');
            }
          }
        } else {
          console.log('✅ Supabase connection successful!');
          console.log('Connection test result:', data ? 'Data accessible' : 'No data found');
          
          // Now test if we can fetch actual requests
          try {
            const { data: requestsData, error: requestsError } = await supabase
              .from('requests')
              .select('id, title, is_played')
              .limit(5);
              
            if (requestsError) {
              console.error('❌ Error fetching requests:', requestsError);
            } else {
              console.log('✅ Sample requests fetched:', requestsData?.length || 0);
              console.log('Sample data:', requestsData);
            }
          } catch (fetchError) {
            console.error('❌ Error in request fetch:', fetchError);
          }
        }
      } catch (connectionError) {
        console.error('❌ Connection test failed:', connectionError);
      }
    };
    
    // Run the test after a short delay
    setTimeout(testSupabaseConnection, 1000);
  }, []);

  // Environment Check
  console.log('🔧 Environment Check:', {
    hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
    urlLength: import.meta.env.VITE_SUPABASE_URL?.length || 0,
    urlPreview: import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) + '...',
    hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    keyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length || 0
  });

  // DEBUG REQUESTS FLOW
  useEffect(() => {
    const debugRequests = async () => {
      console.log('🔍 DEBUG: Checking requests in database...');
      
      try {
        // Check raw requests table
        const { data: rawRequests, error: rawError } = await supabase
          .from('requests')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (rawError) {
          console.error('❌ Error fetching raw requests:', rawError);
        } else {
          console.log('✅ Raw requests in database:', rawRequests?.length || 0);
          console.table(rawRequests);
        }
        
        // Check requests with requesters
        const { data: requestsWithRequesters, error: requestersError } = await supabase
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
          .order('created_at', { ascending: false });
        
        if (requestersError) {
          console.error('❌ Error fetching requests with requesters:', requestersError);
        } else {
          console.log('✅ Requests with requesters:', requestsWithRequesters?.length || 0);
          console.table(requestsWithRequesters);
        }
        
        // Check current state
        console.log('📊 Current App State:');
        console.log('- requests state length:', requests.length);
        console.log('- requests state data:', requests);
        
      } catch (error) {
        console.error('❌ Debug error:', error);
      }
    };
    
    // Run debug after 3 seconds to let other fetches complete
    setTimeout(debugRequests, 3000);
  }, [requests]);

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      
      // Don't show errors for aborted requests or unmounted components
      const errorMessage = event.reason?.message || String(event.reason);
      if (errorMessage.includes('aborted') || 
          errorMessage.includes('Component unmounted') ||
          errorMessage.includes('channel closed')) {
        // Silently handle these errors
        event.preventDefault();
        return;
      }
      
      // Show toast for network errors
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') || 
          errorMessage.includes('network')) {
        toast.error('Network connection issue. Please check your internet connection.');
        event.preventDefault();
        return;
      }
      
      // Show generic error for other unhandled errors
      toast.error('An error occurred. Please try again later.');
      event.preventDefault();
    };

    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Network connection restored');
      setIsOnline(true);
      
      // Attempt to reconnect and refresh data
      reconnectRequests();
      refreshSetLists();
      
      toast.success('Network connection restored');
    };

    const handleOffline = () => {
      console.log('🌐 Network connection lost');
      setIsOnline(false);
      toast.error('Network connection lost. You can still view cached content.');
    };

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsAppActive(isVisible);
      
      if (isVisible) {
        console.log('📱 App is now active. Refreshing data...');
        // Refresh data when app becomes visible again
        reconnectRequests();
        refreshSetLists();
      } else {
        console.log('📱 App is now inactive');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [reconnectRequests, refreshSetLists]);

  // Track component mounted state
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check if we should show the backend or kiosk view
  useEffect(() => {
    const checkPathSpecialCases = () => {
      const path = window.location.pathname.toLowerCase();
      const isBackendPath = path === `/${BACKEND_PATH}` || path.startsWith(`/${BACKEND_PATH}/`);
      const isKioskPath = path === `/${KIOSK_PATH}` || path.startsWith(`/${KIOSK_PATH}/`);
      setIsBackend(isBackendPath);
      setIsKiosk(isKioskPath);
    };

    checkPathSpecialCases();
    window.addEventListener('popstate', checkPathSpecialCases);

    return () => {
      window.removeEventListener('popstate', checkPathSpecialCases);
    };
  }, []);

  // Check auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check for backend auth in localStorage first
        const hasAuth = localStorage.getItem('backendAuth') === 'true';
        setIsAdmin(hasAuth);
        
        // Check for stored user
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          try {
            setCurrentUser(JSON.parse(savedUser));
          } catch (e) {
            console.error('Error parsing saved user:', e);
            localStorage.removeItem('currentUser');
          }
        }
      } finally {
        setIsInitializing(false);
      }
    };

    checkAuth();
  }, []);

  // Update active set list when set lists change
  useEffect(() => {
    const active = setLists.find(sl => sl.isActive);
    
    // Log active set list changes
    if (active) {
      console.log(`Active set list updated in App: ${active.name} (${active.id})`);
    } else if (setLists.length > 0) {
      console.log('No active set list found among', setLists.length, 'set lists');
    }
    
    setActiveSetList(active || null);
  }, [setLists]);

  // Handle navigation to backend
  const navigateToBackend = useCallback(() => {
    window.history.pushState({}, '', `/${BACKEND_PATH}`);
    setIsBackend(true);
    setIsKiosk(false);
  }, []);
  
  // Handle navigation to frontend
  const navigateToFrontend = useCallback(() => {
    window.history.pushState({}, '', '/');
    setIsBackend(false);
    setIsKiosk(false);
  }, []);

  // Handle navigation to kiosk mode
  const navigateToKiosk = useCallback(() => {
    window.history.pushState({}, '', `/${KIOSK_PATH}`);
    setIsBackend(false);
    setIsKiosk(true);
  }, []);

  // Handle admin login
  const handleAdminLogin = useCallback(() => {
    localStorage.setItem('backendAuth', 'true');
    setIsAdmin(true);
  }, []);

  // Handle admin logout
  const handleAdminLogout = useCallback(() => {
    localStorage.removeItem('backendAuth');
    localStorage.removeItem('backendUser');
    setIsAdmin(false);
    navigateToFrontend();
    toast.success('Logged out successfully');
  }, [navigateToFrontend]);
  
  // Handle user update with enhanced photo support
  const handleUserUpdate = useCallback(async (user: User) => {
    try {
      // Validate final user data
      if (!user.name.trim()) {
        toast.error('Please enter your name');
        return;
      }

      // Update user state and save to localStorage
      setCurrentUser(user);
      
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (e) {
        console.error('Error saving user to localStorage:', e);
        // Still proceed even if localStorage fails
        toast.warning('Profile updated but could not be saved locally');
      }
      
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update profile. Please try again.');
    }
  }, []);

  // Handle logo click
  const onLogoClick = useCallback(() => {
    // Empty function to handle logo clicks
  }, []);

  // Handle song request submission with retry logic and enhanced photo support
  const handleSubmitRequest = useCallback(async (data: RequestFormData): Promise<boolean> => {
    if (requestInProgressRef.current) {
      console.log('Request already in progress, please wait...');
      toast.error('A request is already being processed. Please wait a moment and try again.');
      return false;
    }
    
    requestInProgressRef.current = true;

    try {
      // First check if the song is already requested - use maybeSingle() instead of single()
      const { data: existingRequest, error: checkError } = await supabase
        .from('requests')
        .select('id, title')
        .eq('title', data.title)
        .eq('is_played', false)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // Not found is ok
        throw checkError;
      }

      let requestId: string;

      if (existingRequest) {
        // For kiosk mode, we always add a new requester even if song is already requested
        requestId = existingRequest.id;
        
        // Add requester to existing request
        const { error: requesterError } = await supabase
          .from('requesters')
          .insert({
            request_id: requestId,
            name: data.requestedBy,
            photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
            message: data.message?.trim().slice(0, 100) || '',
            created_at: new Date().toISOString()
          });

        if (requesterError) throw requesterError;
      } else {
        // Create new request
        const { data: newRequest, error: requestError } = await supabase
          .from('requests')
          .insert({
            title: data.title,
            artist: data.artist || '',
            votes: 0,
            status: 'pending',
            is_locked: false,
            is_played: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (requestError) throw requestError;
        if (!newRequest) throw new Error('Failed to create request');

        requestId = newRequest.id;

        // Add requester to the new request
        const { error: requesterError } = await supabase
          .from('requesters')
          .insert({
            request_id: requestId,
            name: data.requestedBy,
            photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
            message: data.message?.trim().slice(0, 100) || '',
            created_at: new Date().toISOString()
          });

        if (requesterError) throw requesterError;
      }

      // Reset retry count on success
      requestRetriesRef.current = 0;
      
      toast.success('Your request has been added to the queue!');
      return true;
    } catch (error) {
      console.error('Error submitting request:', error);
      
      // If we get channel closed errors, attempt to reconnect
      if (error instanceof Error && 
          (error.message.includes('channel') || 
           error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError'))) {
        
        reconnectRequests();
        
        // Try to retry the request automatically
        if (requestRetriesRef.current < MAX_REQUEST_RETRIES) {
          requestRetriesRef.current++;
          
          const delay = Math.pow(2, requestRetriesRef.current) * 1000; // Exponential backoff
          console.log(`Automatically retrying request in ${delay/1000} seconds (attempt ${requestRetriesRef.current}/${MAX_REQUEST_RETRIES})...`);
          
          setTimeout(() => {
            if (mountedRef.current) {
              requestInProgressRef.current = false;
              handleSubmitRequest(data).catch(console.error);
            }
          }, delay);
          
          return false;
        }
      }
      
      if (error instanceof Error) {
        const errorMsg = error.message.includes('rate limit') 
          ? 'Too many requests. Please try again later.'
          : error.message || 'Failed to submit request. Please try again.';
        toast.error(errorMsg);
      } else {
        toast.error('Failed to submit request. Please try again.');
      }
      
      // Reset retry count on giving up
      requestRetriesRef.current = 0;
      
      return false;
    } finally {
      requestInProgressRef.current = false;
    }
  }, [reconnectRequests]);

  // 🔧 FIXED - Handle request vote with atomic database function
  const handleVoteRequest = useCallback(async (id: string): Promise<boolean> => {
    if (!isOnline) {
      toast.error('Cannot vote while offline. Please check your internet connection.');
      return false;
    }
    
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to vote');
      }

      // Use the atomic database function for voting
      const { data, error } = await supabase.rpc('add_vote', {
        p_request_id: id,
        p_user_id: currentUser.id || currentUser.name
      });

      if (error) throw error;

      // The function returns true if vote was added, false if already voted
      if (data === true) {
        toast.success('Vote added!');
        return true;
      } else {
        toast.error('You have already voted for this request');
        return false;
      }
    } catch (error) {
      console.error('Error voting for request:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to vote for this request. Please try again.');
      }
      
      return false;
    }
  }, [currentUser, isOnline]);

  // Handle locking a request (marking it as next)
  const handleLockRequest = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return;
    }
    
    try {
      const requestToUpdate = requests.find(r => r.id === id);
      if (!requestToUpdate) return;
      
      // Toggle the locked status
      const newLockedState = !requestToUpdate.isLocked;
      
      // Use atomic database function for locking
      if (newLockedState) {
        const { error } = await supabase.rpc('lock_request', { request_id: id });
        if (error) throw error;
        toast.success('Request locked as next up!');
      } else {
        const { error } = await supabase.rpc('unlock_request', { request_id: id });
        if (error) throw error;
        toast.success('Request unlocked.');
      }
    } catch (error) {
      console.error('Error toggling request lock:', error);
      toast.error('Failed to update request. Please try again.');
    }
  }, [requests, isOnline]);

  // Handle marking a request as played
  const handleMarkPlayed = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          is_played: true,
          is_locked: false,
          status: 'played'
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Request marked as played!');
    } catch (error) {
      console.error('Error marking request as played:', error);
      toast.error('Failed to update request. Please try again.');
    }
  }, [isOnline]);

  // Handle resetting the request queue
  const handleResetQueue = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot reset queue while offline. Please check your internet connection.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to clear all requests? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      toast.success('Queue cleared successfully!');
    } catch (error) {
      console.error('Error clearing queue:', error);
      toast.error('Failed to clear queue. Please try again.');
    }
  }, [isOnline]);

  // Handle adding a new song
  const handleAddSong = useCallback((song: Omit<Song, 'id'>) => {
    setSongs(prev => [...prev, { ...song, id: uuidv4() }]);
  }, []);

  // Handle updating a song
  const handleUpdateSong = useCallback((updatedSong: Song) => {
    setSongs(prev => prev.map(song => 
      song.id === updatedSong.id ? updatedSong : song
    ));
  }, []);

  // Handle deleting a song
  const handleDeleteSong = useCallback((id: string) => {
    setSongs(prev => prev.filter(song => song.id !== id));
  }, []);

  // Handle creating a new set list
  const handleCreateSetList = useCallback(async (newSetList: Omit<SetList, 'id'>) => {
    if (!isOnline) {
      toast.error('Cannot create set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Extract songs from the set list to handle separately
      const { songs, ...setListData } = newSetList;
      
      // Convert camelCase to snake_case for database
      const dbSetListData = {
        name: setListData.name,
        date: setListData.date,
        notes: setListData.notes,
        is_active: setListData.isActive || false
      };
      
      // Insert the set list
      const { data, error } = await supabase
        .from('set_lists')
        .insert(dbSetListData)
        .select();
        
      if (error) throw error;
      
      if (data && songs && songs.length > 0) {
        // Insert songs with positions
        const songMappings = songs.map((song, index) => ({
          set_list_id: data[0].id,
          song_id: song.id,
          position: index
        }));
        
        const { error: songError } = await supabase
          .from('set_list_songs')
          .insert(songMappings);
          
        if (songError) throw songError;
      }
      
      toast.success('Set list created successfully');
      refreshSetLists(); // Refresh to get latest data
    } catch (error) {
      console.error('Error creating set list:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to create set list. Please try again.');
      }
    }
  }, [refreshSetLists, isOnline]);

  // Handle updating a set list
  const handleUpdateSetList = useCallback(async (updatedSetList: SetList) => {
    if (!isOnline) {
      toast.error('Cannot update set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      const { id, songs, ...setListData } = updatedSetList;
      
      // Convert camelCase to snake_case for database
      const dbSetListData = {
        name: setListData.name,
        date: setListData.date,
        notes: setListData.notes,
        is_active: setListData.isActive || false
      };
      
      // Update set list data
      const { error } = await supabase
        .from('set_lists')
        .update(dbSetListData)
        .eq('id', id);
        
      if (error) throw error;
      
      // Clear existing songs
      const { error: deleteError } = await supabase
        .from('set_list_songs')
        .delete()
        .eq('set_list_id', id);
        
      if (deleteError) throw deleteError;
      
      // Insert updated songs
      if (songs && songs.length > 0) {
        const songMappings = songs.map((song, index) => ({
          set_list_id: id,
          song_id: song.id,
          position: index
        }));
        
        const { error: insertError } = await supabase
          .from('set_list_songs')
          .insert(songMappings);
          
        if (insertError) throw insertError;
      }
      
      toast.success('Set list updated successfully');
      refreshSetLists(); // Refresh to get latest data
    } catch (error) {
      console.error('Error updating set list:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update set list. Please try again.');
      }
    }
  }, [refreshSetLists, isOnline]);

  // Handle deleting a set list
  const handleDeleteSetList = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot delete set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      // Set list songs will be deleted via cascade
      const { error } = await supabase
        .from('set_lists')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success('Set list deleted successfully');
    } catch (error) {
      console.error('Error deleting set list:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to delete set list. Please try again.');
      }
    }
  }, [isOnline]);

  // Handle activating/deactivating a set list
  const handleSetActive = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update set list while offline. Please check your internet connection.');
      return;
    }
    
    try {
      console.log(`Activating/deactivating set list ${id}`);
      // Get the current set list
      const setList = setLists.find(sl => sl.id === id);
      if (!setList) return;
      
      // Toggle active state
      const newActiveState = !setList.isActive;
      console.log(`Setting set list ${id} active state to: ${newActiveState}`);
      
      // Update in database (using snake_case for database field names)
      const { error } = await supabase
        .from('set_lists')
        .update({ is_active: newActiveState })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success(newActiveState 
        ? 'Set list activated successfully' 
        : 'Set list deactivated successfully');
        
      // Force refresh set lists to ensure we get latest data with proper isActive state
      refreshSetLists();
    } catch (error) {
      console.error('Error toggling set list active state:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update set list. Please try again.');
      }
    }
  }, [setLists, refreshSetLists, isOnline]);

  // Handle updating logo URL
  const handleLogoUpdate = useCallback(async (url: string) => {
    if (!isOnline) {
      toast.error('Cannot update logo while offline. Please check your internet connection.');
      return;
    }
    
    try {
      await updateSettings({
        band_logo_url: url,
        updated_at: new Date().toISOString()
      });
      
      toast.success('Logo updated successfully');
    } catch (error) {
      console.error('Error updating logo:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Failed to update logo. Please try again.');
      }
    }
  }, [updateSettings, isOnline]);

  // Determine what page to show
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-darker-purple flex items-center justify-center">
        <LoadingSpinner size="lg" message="Loading application..." />
      </div>
    );
  }

  // Show login page if accessing backend and not authenticated
  if (isBackend && !isAdmin) {
    return <BackendLogin onLogin={handleAdminLogin} />;
  }

  // 🔧 FIXED - Show kiosk page if accessing /kiosk with proper props
  if (isKiosk) {
    return (
      <ErrorBoundary>
        <KioskPage 
          songs={songs}
          requests={requests}
          activeSetList={activeSetList}
          onSubmitRequest={handleSubmitRequest}
          onVoteRequest={handleVoteRequest}
          logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
        />
      </ErrorBoundary>
    );
  }

  // Show backend if accessing /backend and authenticated
  if (isBackend && isAdmin) {
    // Define lockedRequest variable before using it
    const lockedRequest = requests.find(r => r.isLocked && !r.isPlayed);
    
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-darker-purple">
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <header className="mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div className="flex items-center mb-4 md:mb-0">
                  <Logo 
                    url={settings?.band_logo_url || DEFAULT_BAND_LOGO}
                    className="h-12 mr-4"
                  />
                  <h1 className="text-3xl font-bold neon-text mb-2">
                    Band Request Hub
                  </h1>
                </div>
                
                <div className="flex items-center space-x-4">
                  {!isOnline && (
                    <div className="px-3 py-1 bg-red-500/20 text-red-400 rounded-md text-sm flex items-center">
                      <span className="mr-1">●</span>
                      Offline Mode
                    </div>
                  )}
                  <button 
                    onClick={navigateToFrontend}
                    className="neon-button"
                  >
                    Exit to Public View
                  </button>
                  <button 
                    onClick={navigateToKiosk}
                    className="neon-button"
                  >
                    Kiosk View
                  </button>
                  <button 
                    onClick={handleAdminLogout}
                    className="px-4 py-2 text-red-400 hover:bg-red-400/20 rounded-md flex items-center"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
              
              <p className="text-gray-300 max-w-2xl mt-2 mb-4">
                Manage your set lists, song library, and customize the request system all in one place.
              </p>
            </header>

            <BackendTabs 
              activeTab={activeBackendTab}
              onTabChange={setActiveBackendTab}
            />

            <div className="space-y-8">
              {activeBackendTab === 'requests' && (
                <ErrorBoundary>
                  <div className="glass-effect rounded-lg p-6">
                    <h2 className="text-xl font-semibold neon-text mb-4">Current Request Queue</h2>
                    <QueueView 
                      requests={requests}
                      onLockRequest={handleLockRequest}
                      onMarkPlayed={handleMarkPlayed}
                      onResetQueue={handleResetQueue}
                    />
                  </div>

                  <ErrorBoundary>
                    <TickerManager 
                      nextSong={lockedRequest
                        ? {
                            title: lockedRequest.title,
                            artist: lockedRequest.artist
                          }
                        : undefined
                      }
                      isActive={isTickerActive}
                      customMessage={tickerMessage}
                      onUpdateMessage={setTickerMessage}
                      onToggleActive={() => setIsTickerActive(!isTickerActive)}
                    />
                  </ErrorBoundary>
                </ErrorBoundary>
              )}

              {activeBackendTab === 'setlists' && (
                <ErrorBoundary>
                  <SetListManager 
                    songs={songs}
                    setLists={setLists}
                    onCreateSetList={handleCreateSetList}
                    onUpdateSetList={handleUpdateSetList}
                    onDeleteSetList={handleDeleteSetList}
                    onSetActive={handleSetActive}
                  />
                </ErrorBoundary>
              )}

              {activeBackendTab === 'songs' && (
                <ErrorBoundary>
                  <SongLibrary 
                    songs={songs}
                    onAddSong={handleAddSong}
                    onUpdateSong={handleUpdateSong}
                    onDeleteSong={handleDeleteSong}
                  />
                </ErrorBoundary>
              )}

              {activeBackendTab === 'settings' && (
                <>
                  <ErrorBoundary>
                    <LogoManager 
                      isAdmin={isAdmin}
                      currentLogoUrl={settings?.band_logo_url || null}
                      onLogoUpdate={handleLogoUpdate}
                    />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <ColorCustomizer isAdmin={isAdmin} />
                  </ErrorBoundary>

                  <ErrorBoundary>
                    <SettingsManager />
                  </ErrorBoundary>
                </>
              )}
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Show landing page if no user is set up
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LandingPage onComplete={handleUserUpdate} />
      </ErrorBoundary>
    );
  }

  // 🔧 FIXED - Show main frontend with proper props
  return (
    <ErrorBoundary>
      <UserFrontend 
        songs={songs}
        requests={requests}
        activeSetList={activeSetList}
        currentUser={currentUser}
        onSubmitRequest={handleSubmitRequest}
        onVoteRequest={handleVoteRequest}
        onUpdateUser={handleUserUpdate}
        logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
        isAdmin={isAdmin}
        onLogoClick={onLogoClick}
        onBackendAccess={navigateToBackend}
      />
    </ErrorBoundary>
  );
}

export default App;