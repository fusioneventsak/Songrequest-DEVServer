import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
          ? 'Too many requests. Please wait a moment before submitting again.'
          : error.message.includes('duplicate')
          ? 'This song has already been requested.'
          : 'Failed to submit request. Please try again.';
        
        toast.error(errorMsg);
      } else {
        toast.error('Failed to submit request. Please try again.');
      }
      
      return false;
    } finally {
      requestInProgressRef.current = false;
    }
  }, [isOnline, currentUser, reconnectRequests]);

  // Enhanced vote handling with optimistic updates
  const handleVoteRequest = useCallback(async (id: string): Promise<boolean> => {
    if (!isOnline) {
      toast.error('Cannot vote while offline. Please check your internet connection.');
      return false;
    }

    if (!currentUser) {
      toast.error('You must set up your profile first');
      return false;
    }

    if (votingStates.has(id)) {
      console.log('Vote already in progress for request:', id);
      return false;
    }

    setVotingStates(prev => new Set([...prev, id]));

    // Optimistic update
    const originalVotes = optimisticVotes.get(id) || 0;
    setOptimisticVotes(prev => new Map(prev.set(id, originalVotes + 1)));

    try {
      console.log(`🗳️ Voting for request: ${id}`);
      
      // Check if user has already voted
      const { data: existingVote, error: voteCheckError } = await supabase
        .from('user_votes')
        .select('id')
        .eq('request_id', id)
        .eq('user_id', currentUser.id)
        .single();

      if (voteCheckError && voteCheckError.code !== 'PGRST116') {
        throw voteCheckError;
      }

      if (existingVote) {
        throw new Error('You have already voted for this song');
      }

      // Record the vote
      const { error: insertError } = await supabase
        .from('user_votes')
        .insert([{
          id: crypto.randomUUID(),
          request_id: id,
          user_id: currentUser.id,
          created_at: new Date().toISOString()
        }]);

      if (insertError) throw insertError;

      // Increment the vote count
      const { error: updateError } = await supabase.rpc('increment_vote', { 
        request_id: id 
      });

      if (updateError) throw updateError;

      console.log('✅ Vote submitted successfully');
      toast.success('Vote cast successfully!');
      return true;
    } catch (error) {
      console.error('Error voting for request:', error);
      
      // Revert optimistic update
      setOptimisticVotes(prev => {
        const newMap = new Map(prev);
        newMap.set(id, originalVotes);
        return newMap;
      });
      
      if (error instanceof Error) {
        const errorMsg = error.message.includes('already voted')
          ? 'You have already voted for this song.'
          : error.message.includes('rate limit')
          ? 'Too many votes. Please wait a moment before voting again.'
          : 'Failed to vote for this request. Please try again.';
        
        toast.error(errorMsg);
      } else {
        toast.error('Failed to vote for this request. Please try again.');
      }
      
      return false;
    } finally {
      setVotingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, [isOnline, currentUser, votingStates, optimisticVotes]);

  // Handle locking a request
  const handleLockRequest = useCallback(async (id: string) => {
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return false;
    }

    try {
      console.log(`🔒 Locking request: ${id}`);
      
      const { error } = await supabase.rpc('lock_request', { request_id: id });

      if (error) throw error;

      toast.success('Request locked and ready to play!');
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

  // Enhanced logo handling with validation and data URL support
  const { logoUrl, logoLoading, logoError, handleLogoUpdate } = useLogoHandling({
    defaultLogo: DEFAULT_BAND_LOGO,
    maxFileSize: MAX_PHOTO_SIZE,
    settings
  });

  // Frontend merged requests with optimistic updates
  const mergedRequests = useMemo(() => {
    if (!requests?.length) return [];
    
    return requests.map(request => ({
      ...request,
      votes: optimisticVotes.get(request.id) ?? request.votes
    }));
  }, [requests, optimisticVotes]);

  // Handle kiosk logo click
  const handleKioskLogoClick = useCallback(() => {
    if (isKiosk) {
      navigateToFrontend();
    }
  }, [isKiosk, navigateToFrontend]);

  // Frontend backend access handler
  const handleBackendAccess = useCallback(() => {
    if (isAdmin) {
      navigateToBackend();
    } else {
      // Redirect to login page
      window.location.href = '/login';
    }
  }, [isAdmin, navigateToBackend]);

  // If still initializing, show loading
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Initializing uRequest Live...</p>
        </div>
      </div>
    );
  }

  // Kiosk mode
  if (isKiosk) {
    return (
      <ErrorBoundary>
        <KioskPage
          requests={mergedRequests}
          songs={songs}
          activeSetList={activeSetList}
          logoUrl={logoUrl}
          onLogoClick={handleKioskLogoClick}
          onBackendAccess={handleBackendAccess}
          isAdmin={isAdmin}
        />
      </ErrorBoundary>
    );
  }

  // Backend mode
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
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800">
          {/* Backend Header */}
          <div className="border-b border-purple-700/50 bg-purple-900/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div className="flex items-center space-x-6">
                  <Logo
                    url={logoUrl}
                    isLoading={logoLoading}
                    hasError={logoError}
                    onClick={navigateToFrontend}
                    className="h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity"
                  />
                  <h1 className="text-2xl font-bold text-white">Backend Dashboard</h1>
                </div>
                
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={navigateToFrontend}
                    className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-md flex items-center transition-colors"
                  >
                    <span>Public View</span>
                  </button>
                  <button 
                    onClick={navigateToKiosk}
                    className="neon-button"
                  >
                    Kiosk Mode
                  </button>
                  <button
                    onClick={handleAdminLogout}
                    className="flex items-center text-red-400 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Backend Tabs */}
          <BackendTabs 
            activeTab={activeBackendTab} 
            onTabChange={setActiveBackendTab}
          />

          {/* Backend Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activeBackendTab === 'requests' && (
              <QueueView
                requests={mergedRequests}
                songs={songs}
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
                isOnline={isOnline}
              />
            )}
            
            {activeBackendTab === 'songs' && (
              <SongLibrary
                songs={songs}
                isOnline={isOnline}
              />
            )}
            
            {activeBackendTab === 'settings' && (
              <div className="space-y-8">
                <SettingsManager />
                <LogoManager
                  currentLogo={logoUrl}
                  onLogoUpdate={handleLogoUpdate}
                  isLoading={logoLoading}
                  error={logoError}
                />
                <ColorCustomizer />
                <TickerManager />
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // Frontend mode
  if (!currentUser) {
    return (
      <ErrorBoundary>
        <LandingPage
          onUserSetup={handleUserUpdate}
          logoUrl={logoUrl}
          onLogoClick={handleKioskLogoClick}
          onBackendAccess={handleBackendAccess}
          isAdmin={isAdmin}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <UserFrontend
        songs={songs}
        requests={mergedRequests}
        activeSetList={activeSetList}
        currentUser={currentUser}
        onSubmitRequest={handleSubmitRequest}
        onVoteRequest={handleVoteRequest}
        onUpdateUser={handleUserUpdate}
        logoUrl={logoUrl}
        isAdmin={isAdmin}
        onLogoClick={handleKioskLogoClick}
        onBackendAccess={handleBackendAccess}
      />
    </ErrorBoundary>
  );
}

export default App;