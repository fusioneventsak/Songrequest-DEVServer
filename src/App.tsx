import React, { useState, useEffect, useCallback } from 'react';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './utils/supabase'; 
import type { Song, SongRequest, RequestFormData, SetList, User } from './types';
import { LandingPage } from './components/LandingPage';
import { UserFrontend } from './components/UserFrontend';
import { BackendLogin } from './components/BackendLogin'; 
import { SongLibrary } from './components/SongLibrary';
import { SetListManager } from './components/SetListManager';
import { QueueView } from './components/QueueView';
import { TickerManager } from './components/TickerManager';
import { LogoManager } from './components/LogoManager';
import { ColorCustomizer } from './components/ColorCustomizer';
import { SettingsManager } from './components/SettingsManager';
import { BackendTabs } from './components/BackendTabs';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { useRequestSync } from './hooks/useRequestSync';
import { useSongSync } from './hooks/useSongSync';
import { useSetListSync } from './hooks/useSetListSync';
import { useUiSettings } from './hooks/useUiSettings';
import { useLogoHandling } from './hooks/useLogoHandling';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { LogOut } from 'lucide-react';
import { Logo } from './components/shared/Logo';
import { KioskPage } from './components/KioskPage';
import toast from 'react-hot-toast';

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
  
  // Voting states
  const [votingStates, setVotingStates] = useState<Set<string>>(new Set());
  
  // User state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Online state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Request processing state
  const requestInProgressRef = useRef(false);
  const requestRetriesRef = useRef(0);
  const mountedRef = useRef(true);
  
  // Optimistic updates state
  const [optimisticVotes, setOptimisticVotes] = useState<Map<string, number>>(new Map());

  // Use custom hooks for data syncing
  const { reconnectRequests } = useRequestSync({
    requests,
    setRequests,
    isOnline,
    currentUser
  });

  const { reconnectSongs } = useSongSync({
    songs,
    setSongs,
    isOnline
  });

  const { reconnectSetLists } = useSetListSync({
    setLists,
    setSetLists,
    isOnline
  });

  const { settings, loading: settingsLoading, updateSettings } = useUiSettings();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Online/offline status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('📶 Connection restored');
      toast.success('Connection restored');
      
      // Reconnect all sync hooks
      reconnectRequests();
      reconnectSongs();
      reconnectSetLists();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('📵 Connection lost');
      toast.error('Connection lost. Working in offline mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reconnectRequests, reconnectSongs, reconnectSetLists]);

  // Handle browser navigation
  useEffect(() => {
    const checkPath = () => {
      const path = window.location.pathname;
      
      if (path.includes(BACKEND_PATH)) {
        setIsBackend(true);
        setIsKiosk(false);
      } else if (path.includes(KIOSK_PATH)) {
        setIsKiosk(true);
        setIsBackend(false);
      } else {
        setIsBackend(false);
        setIsKiosk(false);
      }
    };

    checkPath();

    const checkPathSpecialCases = () => {
      checkPath();
    };

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
    const active = setLists?.find(sl => sl?.isActive);
    
    if (active) {
      console.log(`Active set list updated in App: ${active.name} (${active.id})`);
    } else if (setLists?.length > 0) {
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
  
  // Handle user update
  const handleUserUpdate = useCallback((user: User) => {
    try {
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

  // Enhanced request submission with retry logic and optimistic updates
  const handleSubmitRequest = useCallback(async (data: RequestFormData): Promise<boolean> => {
    if (!isOnline) {
      toast.error('Cannot submit requests while offline. Please check your internet connection.');
      return false;
    }
    
    if (requestInProgressRef.current) {
      console.log('Request already in progress, skipping...');
      return false;
    }

    requestInProgressRef.current = true;

    try {
      if (!currentUser) {
        throw new Error('You must set up your profile first');
      }

      const requestId = crypto.randomUUID();
      
      const newRequest = {
        id: requestId,
        title: data.title,
        artist: data.artist,
        votes: 0,
        isLocked: false,
        isPlayed: false,
        createdAt: new Date().toISOString(),
        requesters: [{
          id: crypto.randomUUID(),
          requestId: requestId,
          name: currentUser.name,
          photo: currentUser.photo,
          message: data.message || '',
          timestamp: new Date().toISOString()
        }]
      };

      const { error } = await supabase
        .from('requests')
        .insert([{
          id: requestId,
          title: data.title,
          artist: data.artist,
          votes: 0,
          is_locked: false,
          is_played: false,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      const { error: requesterError } = await supabase
        .from('requesters')
        .insert([{
          id: crypto.randomUUID(),
          request_id: requestId,
          name: currentUser.name,
          photo: currentUser.photo,
          message: data.message || '',
          timestamp: new Date().toISOString()
        }]);

      if (requesterError) throw requesterError;

      requestRetriesRef.current = 0;
      console.log('✅ Request submitted successfully');
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
  }, [reconnectRequests, currentUser, isOnline]);

  // Enhanced vote handler with atomic database function and optimistic updates
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
        p_user_id: currentUser.name // Use name instead of id since user object doesn't have id
      });

      if (error) throw error;

      if (data === true) {
        toast.success('Vote added!');
        
        // Keep optimistic vote for a moment, then let real data take over
        setTimeout(() => {
          if (mountedRef.current) {
            setOptimisticVotes(prev => {
              const newMap = new Map(prev);
              newMap.delete(id);
              return newMap;
            });
          }
        }, 1500);
        
        return true;
      } else {
        // Revert optimistic update if voting failed
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
      
      if (error instanceof Error && error.message.includes('already voted')) {
        toast.error(error.message);
      } else if (error instanceof Error && (
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
  }, [currentUser, isOnline, requests, optimisticVotes]);

  // Handle locking a request (marking it as next)
  const handleLockRequest = useCallback(async (requestId: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return false;
    }

    try {
      console.log(`🔒 Locking request: ${requestId}`);
      
      const { error } = await supabase.rpc('lock_request', { request_id: requestId });

      if (error) throw error;

      toast.success('Request locked as next!');
      return true;
    } catch (error) {
      console.error('Error locking request:', error);
      toast.error('Failed to lock request. Please try again.');
      return false;
    }
  }, [isOnline]);

  // Handle unlocking a request
  const handleUnlockRequest = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return false;
    }

    try {
      console.log(`🔓 Unlocking request: ${id}`);
      
      const { error } = await supabase.rpc('unlock_request', { request_id: id });

      if (error) throw error;

      toast.success('Request unlocked!');
      return true;
    } catch (error) {
      console.error('Error unlocking request:', error);
      toast.error('Failed to unlock request. Please try again.');
      return false;
    }
  }, [isOnline]);

  // Handle marking a request as played
  const handleMarkAsPlayed = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return false;
    }

    try {
      console.log(`✅ Marking request as played: ${id}`);
      
      const { error } = await supabase
        .from('requests')
        .update({ 
          is_played: true,
          is_locked: false
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Request marked as played!');
      return true;
    } catch (error) {
      console.error('Error marking request as played:', error);
      toast.error('Failed to mark request as played. Please try again.');
      return false;
    }
  }, [isOnline]);

  // Handle removing a request
  const handleRemoveRequest = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot remove requests while offline. Please check your internet connection.');
      return false;
    }

    try {
      console.log(`🗑️ Removing request: ${id}`);
      
      // Delete requesters first (foreign key constraint)
      const { error: requestersError } = await supabase
        .from('requesters')
        .delete()
        .eq('request_id', id);

      if (requestersError) throw requestersError;

      // Delete user votes
      const { error: votesError } = await supabase
        .from('user_votes')
        .delete()
        .eq('request_id', id);

      if (votesError) throw votesError;

      // Delete the request
      const { error: requestError } = await supabase
        .from('requests')
        .delete()
        .eq('id', id);

      if (requestError) throw requestError;

      toast.success('Request removed!');
      return true;
    } catch (error) {
      console.error('Error removing request:', error);
      toast.error('Failed to remove request. Please try again.');
      return false;
    }
  }, [isOnline]);

  // Create merged requests with optimistic updates
  const mergedRequests = useMemo(() => {
    return requests.map(req => ({
      ...req,
      votes: optimisticVotes.get(req.id) ?? req.votes ?? 0
    }));
  }, [requests, optimisticVotes]);

  // Show loading screen
  if (isInitializing) {
    return <LoadingSpinner />;
  }

  // Show kiosk mode
  if (isKiosk) {
    return (
      <KioskPage
        songs={songs}
        requests={mergedRequests}
        activeSetList={activeSetList}
        onSubmitRequest={handleSubmitRequest}
        onVoteRequest={handleVoteRequest}
        logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
      />
    );
  }

  // Show backend interface if in backend mode
  if (isBackend) {
    if (!isAdmin) {
      return (
        <ErrorBoundary>
          <BackendLogin onLogin={handleAdminLogin} />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-900 text-white">
          {/* Header */}
          <div className="bg-gray-800 border-b border-gray-700">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center space-x-4">
                <Logo 
                  url={settings?.band_logo_url || DEFAULT_BAND_LOGO} 
                  className="h-8" 
                />
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={navigateToFrontend}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                >
                  View Frontend
                </button>
                <button
                  onClick={navigateToKiosk}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  Kiosk Mode
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="flex items-center space-x-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <BackendTabs 
            activeTab={activeBackendTab} 
            onTabChange={setActiveBackendTab} 
          />

          {/* Content */}
          <div className="p-6">
            {activeBackendTab === 'requests' && (
              <QueueView
                requests={mergedRequests}
                onLockRequest={handleLockRequest}
                onUnlockRequest={handleUnlockRequest}
                onMarkAsPlayed={handleMarkAsPlayed}
                onRemoveRequest={handleRemoveRequest}
                isOnline={isOnline}
              />
            )}
            {activeBackendTab === 'setlists' && (
              <SetListManager
                setLists={setLists}
                songs={songs}
                onSetListsChange={setSetLists}
                isOnline={isOnline}
              />
            )}
            {activeBackendTab === 'songs' && (
              <SongLibrary
                songs={songs}
                onSongsChange={setSongs}
                isOnline={isOnline}
              />
            )}
            {activeBackendTab === 'settings' && (
              <div className="space-y-8">
                <SettingsManager />
                <LogoManager />
                <ColorCustomizer />
                <TickerManager isAdmin={true} />
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Show frontend interface
  return (
    <ErrorBoundary>
      <UserFrontend 
        currentUser={currentUser}
        songs={songs}
        requests={mergedRequests}
        activeSetList={activeSetList}
        onUpdateUser={handleUserUpdate}
        onSubmitRequest={handleSubmitRequest}
        onVoteRequest={handleVoteRequest}
        onBackendAccess={navigateToBackend}
        isAdmin={isAdmin}
        isOnline={isOnline}
        logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
      />
    </ErrorBoundary>
  );
}

export default App;