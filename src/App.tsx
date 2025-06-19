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

  // 🚀 Simple requests without optimistic updates - just real-time data
  const mergedRequests = useMemo(() => {
    console.log('🔀 App: Using real requests only:', {
      realRequests: requests.length,
      titles: requests.map(r => r.title)
    });

    return requests; // Just use real requests from database
  }, [requests]);



  // SUPABASE CONNECTION TEST
  useEffect(() => {
    const testSupabaseConnection = async () => {
      console.log('🔍 Testing Supabase connection...');
      console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      try {
        const { data, error } = await supabase
          .from('requests')
          .select('id')
          .limit(1);
        
        if (error) {
          console.error('❌ Supabase connection failed:', error);
        } else {
          console.log('✅ Supabase connection successful!');
        }
      } catch (connectionError) {
        console.error('❌ Connection test failed:', connectionError);
      }
    };
    
    setTimeout(testSupabaseConnection, 1000);
  }, []);

  // Global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled Promise Rejection:', event.reason);
      
      const errorMessage = event.reason?.message || String(event.reason);
      if (errorMessage.includes('aborted') || 
          errorMessage.includes('Component unmounted') ||
          errorMessage.includes('channel closed')) {
        event.preventDefault();
        return;
      }
      
      if (errorMessage.includes('Failed to fetch') || 
          errorMessage.includes('NetworkError') || 
          errorMessage.includes('network')) {
        toast.error('Network connection issue. Please check your internet connection.');
        event.preventDefault();
        return;
      }
      
      toast.error('An error occurred. Please try again later.');
      event.preventDefault();
    };

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
      reconnectRequests();
      refreshSetLists();
      toast.success('Network connection restored');
    };

    const handleOffline = () => {
      console.log('🌐 Network connection lost');
      setIsOnline(false);
      toast.error('Network connection lost. You can still view cached content.');
    };

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsAppActive(isVisible);
      
      if (isVisible) {
        console.log('📱 App is now active. Refreshing data...');
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
        const hasAuth = localStorage.getItem('backendAuth') === 'true';
        setIsAdmin(hasAuth);
        
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
      if (!user.name.trim()) {
        toast.error('Please enter your name');
        return;
      }

      setCurrentUser(user);
      
      try {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (e) {
        console.error('Error saving user to localStorage:', e);
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

  // 🚀 UPDATED: Simple song request submission without optimistic updates
  const handleSubmitRequest = useCallback(async (data: RequestFormData): Promise<boolean> => {
    if (requestInProgressRef.current) {
      console.log('Request already in progress, please wait...');
      toast.error('A request is already being processed. Please wait a moment and try again.');
      return false;
    }
    
    requestInProgressRef.current = true;

    try {
      // Check if the song is already requested
      const { data: existingRequest, error: checkError } = await supabase
        .from('requests')
        .select('id, title')
        .eq('title', data.title)
        .eq('is_played', false)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let requestId: string;

      if (existingRequest) {
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

      requestRetriesRef.current = 0;
      toast.success('Your request has been added to the queue!');
      return true;
    } catch (error) {
      console.error('Error submitting request:', error);
      
      // Handle retries for network errors
      if (error instanceof Error && 
          (error.message.includes('channel') || 
           error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError'))) {
        
        reconnectRequests();
        
        if (requestRetriesRef.current < MAX_REQUEST_RETRIES) {
          requestRetriesRef.current++;
          
          const delay = Math.pow(2, requestRetriesRef.current) * 1000;
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
      
      requestRetriesRef.current = 0;
      return false;
    } finally {
      requestInProgressRef.current = false;
    }
  }, [reconnectRequests, currentUser]);

  // 🚀 UPDATED: Enhanced vote handler with atomic database function and optimistic updates
  const handleVoteRequest = useCallback(async (id: string): Promise<boolean> => {
    if (!isOnline) {
      toast.error('Cannot vote while offline. Please check your internet connection.');
      return false;
    }
    
    try {
      if (!currentUser) {
        throw new Error('You must be logged in to vote');
      }

      // Don't allow voting on temporary requests
      if (id.startsWith('temp_')) {
        toast.error('Please wait for the request to be processed before voting');
        return false;
      }

      // INSTANT UI UPDATE - Optimistically increment vote
      const currentRequest = requests.find(r => r.id === id);
      const currentVotes = optimisticVotes.get(id) ?? currentRequest?.votes ?? 0;
      setOptimisticVotes(prev => new Map([...prev, [id, currentVotes + 1]]));
      console.log(`📊 Optimistically incremented vote for request ${id}: ${currentVotes} -> ${currentVotes + 1}`);

      // Use the atomic database function for voting
      const { data, error } = await supabase.rpc('add_vote', {
        p_request_id: id,
        p_user_id: currentUser.id || currentUser.name
      });

      if (error) throw error;

      if (data === true) {
        toast.success('Vote added!');
        
        // Keep optimistic vote for a moment, then let real data take over
        setTimeout(() => {
          if (mountedRef.current) {
            console.log(`🧹 Removing optimistic vote for request ${id}`);
            setOptimisticVotes(prev => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
            });
          }
        }, 1500);
        
        return true;
      } else {
        // Revert optimistic update if already voted
        setOptimisticVotes(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });
        
        toast.error('You have already voted for this request');
        return false;
      }
    } catch (error) {
      console.error('Error voting for request:', error);
      
      // Revert optimistic update on error
      setOptimisticVotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      
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
      const requestToUpdate = mergedRequests.find(r => r.id === id);
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
  }, [mergedRequests, isOnline]);

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
      
      // No optimistic votes to clear
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
      const { songs, ...setListData } = newSetList;
      
      const dbSetListData = {
        name: setListData.name,
        date: setListData.date,
        notes: setListData.notes,
        is_active: setListData.isActive || false
      };
      
      const { data, error } = await supabase
        .from('set_lists')
        .insert(dbSetListData)
        .select();
        
      if (error) throw error;
      
      if (data && songs && songs.length > 0) {
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
      refreshSetLists();
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
      
      const dbSetListData = {
        name: setListData.name,
        date: setListData.date,
        notes: setListData.notes,
        is_active: setListData.isActive || false
      };
      
      const { error } = await supabase
        .from('set_lists')
        .update(dbSetListData)
        .eq('id', id);
        
      if (error) throw error;
      
      const { error: deleteError } = await supabase
        .from('set_list_songs')
        .delete()
        .eq('set_list_id', id);
        
      if (deleteError) throw deleteError;
      
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
      refreshSetLists();
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
      const setList = setLists.find(sl => sl.id === id);
      if (!setList) return;
      
      const newActiveState = !setList.isActive;
      console.log(`Setting set list ${id} active state to: ${newActiveState}`);
      
      const { error } = await supabase
        .from('set_lists')
        .update({ is_active: newActiveState })
        .eq('id', id);
        
      if (error) throw error;
      
      toast.success(newActiveState 
        ? 'Set list activated successfully' 
        : 'Set list deactivated successfully');
        
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

  // Show kiosk page if accessing /kiosk with proper props
  if (isKiosk) {
    return (
      <ErrorBoundary>
        <KioskPage 
          songs={songs}
          requests={mergedRequests} // 🚀 Now passing merged requests with optimistic updates
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
    const lockedRequest = mergedRequests.find(r => r.isLocked && !r.isPlayed);
    
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
                      requests={mergedRequests} // 🚀 Now passing merged requests with optimistic updates
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

  // Show main frontend with merged requests
  return (
    <ErrorBoundary>
      <UserFrontend 
        songs={songs}
        requests={mergedRequests} // 🚀 Now passing merged requests with optimistic updates
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