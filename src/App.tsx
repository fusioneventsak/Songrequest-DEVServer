import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './utils/supabase';
import { Song, SongRequest, SetList, User, UiSettings } from './types';
import { LandingPage } from './components/LandingPage';
import { UserFrontend } from './components/UserFrontend';
import BackendLogin from './components/BackendLogin'; 
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
import { mergeRequestsByTitle } from './utils/requestQueue';

const DEFAULT_BAND_LOGO = 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=400';

function App() {
  // Core state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showBackend, setShowBackend] = useState(false);
  const [activeBackendTab, setActiveBackendTab] = useState<'songs' | 'setlists' | 'requests' | 'settings'>('songs');

  // Ticker state
  const [isTickerActive, setIsTickerActive] = useState(false);
  const [tickerMessage, setTickerMessage] = useState('');

  // Custom hooks for data synchronization
  const { songs, loading: songsLoading, error: songsError, addSong, updateSong, deleteSong } = useSongSync();
  const { requests, loading: requestsLoading, error: requestsError, addRequest, updateRequest } = useRequestSync();
  const { setLists, activeSetList, loading: setListsLoading, error: setListsError, addSetList, updateSetList, deleteSetList } = useSetListSync();
  const { settings, loading: settingsLoading, updateSettings } = useUiSettings();
  const { handleLogoUpdate } = useLogoHandling();

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('bandRequestUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('bandRequestUser');
      }
    }
  }, []);

  // Merge requests by title to handle duplicates
  const mergedRequests = mergeRequestsByTitle(requests);

  // Find locked request for ticker
  const lockedRequest = mergedRequests.find(r => r.isLocked && !r.isPlayed);

  // Event handlers
  const handleUserUpdate = useCallback((user: User) => {
    setCurrentUser(user);
    localStorage.setItem('bandRequestUser', JSON.stringify(user));
  }, []);

  const handleSubmitRequest = useCallback(async (title: string, artist?: string, message?: string) => {
    if (!currentUser) return;

    try {
      await addRequest(title, artist, currentUser, message);
    } catch (error) {
      console.error('Error submitting request:', error);
      throw error;
    }
  }, [currentUser, addRequest]);

  const handleVoteRequest = useCallback(async (requestId: string) => {
    if (!currentUser) return;

    try {
      // Check if user has already voted
      const { data: existingVote } = await supabase
        .from('user_votes')
        .select('id')
        .eq('request_id', requestId)
        .eq('user_id', currentUser.name)
        .single();

      if (existingVote) {
        console.log('User has already voted for this request');
        return;
      }

      // Add vote
      const { error: voteError } = await supabase
        .from('user_votes')
        .insert({
          request_id: requestId,
          user_id: currentUser.name
        });

      if (voteError) throw voteError;

      // Update request votes count
      const { error: updateError } = await supabase
        .from('requests')
        .update({ votes: supabase.sql`votes + 1` })
        .eq('id', requestId);

      if (updateError) throw updateError;

    } catch (error) {
      console.error('Error voting for request:', error);
      throw error;
    }
  }, [currentUser]);

  const handleLockRequest = useCallback(async (requestId: string) => {
    try {
      // First unlock any currently locked requests
      await supabase
        .from('requests')
        .update({ is_locked: false })
        .eq('is_locked', true);

      // Then lock the selected request
      await supabase
        .from('requests')
        .update({ is_locked: true })
        .eq('id', requestId);

    } catch (error) {
      console.error('Error locking request:', error);
      throw error;
    }
  }, []);

  const handleMarkPlayed = useCallback(async (requestId: string) => {
    try {
      await supabase
        .from('requests')
        .update({ 
          is_played: true,
          is_locked: false,
          status: 'played'
        })
        .eq('id', requestId);
    } catch (error) {
      console.error('Error marking request as played:', error);
      throw error;
    }
  }, []);

  const handleResetQueue = useCallback(async () => {
    try {
      await supabase
        .from('requests')
        .update({ 
          is_played: false,
          is_locked: false,
          status: 'pending'
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all records
    } catch (error) {
      console.error('Error resetting queue:', error);
      throw error;
    }
  }, []);

  const navigateToBackend = useCallback(() => {
    setShowBackend(true);
  }, []);

  const onLogoClick = useCallback(() => {
    if (isAdmin) {
      setShowBackend(true);
      setActiveBackendTab('settings');
    }
  }, [isAdmin]);

  // Show loading state
  if (songsLoading || requestsLoading || setListsLoading || settingsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show error state
  if (songsError || requestsError || setListsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">
          Error loading data: {songsError || requestsError || setListsError}
        </div>
      </div>
    );
  }

  // Show backend interface
  if (showBackend) {
    if (!isAdmin) {
      return (
        <ErrorBoundary>
          <BackendLogin 
            onLogin={() => setIsAdmin(true)}
            onBack={() => setShowBackend(false)}
          />
        </ErrorBoundary>
      );
    }

    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold neon-text">Band Request Hub - Admin</h1>
              <button
                onClick={() => setShowBackend(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Back to Frontend
              </button>
            </div>

            <BackendTabs 
              activeTab={activeBackendTab}
              onTabChange={setActiveBackendTab}
            />

            <div className="mt-8">
              {activeBackendTab === 'songs' && (
                <ErrorBoundary>
                  <SongLibrary 
                    songs={songs}
                    onAddSong={addSong}
                    onUpdateSong={updateSong}
                    onDeleteSong={deleteSong}
                  />
                </ErrorBoundary>
              )}

              {activeBackendTab === 'setlists' && (
                <ErrorBoundary>
                  <SetListManager 
                    setLists={setLists}
                    songs={songs}
                    onAddSetList={addSetList}
                    onUpdateSetList={updateSetList}
                    onDeleteSetList={deleteSetList}
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

              {activeBackendTab === 'requests' && (
                <ErrorBoundary>
                  <div className="glass-effect rounded-lg p-6">
                    <h2 className="text-xl font-semibold neon-text mb-4">Current Request Queue</h2>
                    <QueueView 
                      requests={mergedRequests}
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

  // Show main frontend with merged requests and locked song for ticker
  const frontendLockedRequest = mergedRequests.find(r => r.isLocked && !r.isPlayed);
  console.log('🎯 Frontend: Looking for locked request for ticker...', {
    totalRequests: mergedRequests.length,
    lockedRequest: frontendLockedRequest ? {
      id: frontendLockedRequest.id,
      title: frontendLockedRequest.title,
      artist: frontendLockedRequest.artist,
      isLocked: frontendLockedRequest.isLocked,
      isPlayed: frontendLockedRequest.isPlayed
    } : null
  });

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
        logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
        isAdmin={isAdmin}
        onLogoClick={onLogoClick}
        onBackendAccess={navigateToBackend}
        lockedRequest={frontendLockedRequest}
      />
    </ErrorBoundary>
  );
}

export default App;