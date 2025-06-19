import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Music4, ThumbsUp, UserCircle, Settings } from 'lucide-react';
import { Logo } from './shared/Logo';
import { SongList } from './SongList';
import { UpvoteList } from './UpvoteList';
import { RequestModal } from './RequestModal';
import { LandingPage } from './LandingPage';
import { Ticker } from './Ticker';
import { useUiSettings } from '../hooks/useUiSettings';
import toast from 'react-hot-toast';
import type { Song, SongRequest, User, RequestFormData } from '../types';

interface UserFrontendProps {
  songs: Song[];
  requests: SongRequest[];
  activeSetList: {
    id: string;
    name: string;
    songs: Song[];
  } | null;
  currentUser: User;
  onSubmitRequest: (data: RequestFormData) => Promise<boolean>;
  onVoteRequest: (id: string) => Promise<boolean>;
  onUpdateUser: (user: User) => void;
  logoUrl: string;
  isAdmin: boolean;
  onLogoClick: () => void;
  onBackendAccess: () => void;
}

export function UserFrontend({
  songs,
  requests, // This is already merged requests from App.tsx
  activeSetList,
  currentUser,
  onSubmitRequest,
  onVoteRequest,
  onUpdateUser,
  logoUrl,
  isAdmin,
  onLogoClick,
  onBackendAccess
}: UserFrontendProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'requests' | 'upvote'>('requests');
  
  // Local state for UI feedback only
  const [submittingStates, setSubmittingStates] = useState<Set<string>>(new Set());
  const [votingStates, setVotingStates] = useState<Set<string>>(new Set());
  
  const mountedRef = useRef(true);
  const { settings } = useUiSettings();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Get colors from settings
  const navBgColor = settings?.nav_bg_color || '#0f051d';
  const highlightColor = settings?.highlight_color || '#ff00ff';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';

  // Get the locked request for the ticker (using passed requests)
  const lockedRequest = useMemo(() => {
    return requests.find(r => r.isLocked && !r.isPlayed);
  }, [requests]);

  // Find the locked song for ticker
  const lockedSong = useMemo(() => {
    if (!lockedRequest) return null;
    return songs.find(s => s.title === lockedRequest.title);
  }, [lockedRequest, songs]);

  // Get available songs (from set list or all songs)
  const availableSongs = useMemo(() => {
    return activeSetList?.songs || songs;
  }, [activeSetList, songs]);

  // Filter songs based on search
  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) return availableSongs;
    
    const searchLower = searchTerm.toLowerCase();
    return availableSongs.filter(song => {
      return (
        song.title.toLowerCase().includes(searchLower) ||
        song.artist.toLowerCase().includes(searchLower) ||
        (song.genre?.toLowerCase() || '').includes(searchLower)
      );
    });
  }, [availableSongs, searchTerm]);

  // Simplified song request handler - App.tsx handles optimistic updates
  const handleRequestSong = useCallback(async (song: Song) => {
    if (!currentUser) {
      toast.error('Please set up your profile first');
      return;
    }

    setSubmittingStates(prev => new Set([...prev, song.id]));

    try {
      const requestData: RequestFormData = {
        title: song.title,
        artist: song.artist || '',
        requestedBy: currentUser.name,
        userPhoto: currentUser.photo,
        message: ''
      };

      const success = await onSubmitRequest(requestData);
      
      if (success) {
        toast.success(`"${song.title}" has been added to the queue!`);
        setSelectedSong(null);
        setIsRequestModalOpen(false);
      }
    } catch (error) {
      console.error('Error requesting song:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setSubmittingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(song.id);
        return newSet;
      });
    }
  }, [currentUser, onSubmitRequest]);

  // Simplified vote handler - no temporary request validation needed
  const handleVote = useCallback(async (requestId: string): Promise<boolean> => {
    if (!currentUser) {
      toast.error('Please set up your profile first');
      return false;
    }

    if (votingStates.has(requestId)) {
      return false; // Already voting
    }

    setVotingStates(prev => new Set([...prev, requestId]));

    try {
      const success = await onVoteRequest(requestId);
      return success;
    } catch (error) {
      console.error('Error voting for request:', error);
      toast.error('Failed to vote for this request. Please try again.');
      return false;
    } finally {
      setVotingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  }, [currentUser, onVoteRequest, votingStates]);

  const handleSongSelect = (song: Song) => {
    console.log('🎵 Song selected:', song.title);
    console.log('🎵 Setting selectedSong and opening modal');
    setSelectedSong(song);
    setIsRequestModalOpen(true);
    console.log('🎵 Modal should now be open');
  };

  const handleProfileUpdate = (updatedUser: User) => {
    onUpdateUser(updatedUser);
    setIsEditingProfile(false);
  };

  // Show profile editing page when isEditingProfile is true OR no currentUser
  if (isEditingProfile || !currentUser || !currentUser.name) {
    return (
      <LandingPage 
        onComplete={handleProfileUpdate}
        initialUser={currentUser}
      />
    );
  }

  return (
    <div className="frontend-container min-h-screen">
      {/* Thin top bar for user profile and admin */}
      <div 
        className="h-8 border-b border-neon-purple/20 flex justify-between items-center px-4"
        style={{ backgroundColor: navBgColor }}
      >
        <button 
          onClick={() => setIsEditingProfile(true)}
          className="user-profile flex items-center group"
          title="Edit Profile"
        >
          <img 
            src={currentUser.photo} 
            alt={currentUser.name} 
            className="w-5 h-5 rounded-full object-cover border group-hover:border-opacity-100 border-opacity-75 transition-all mr-2"
            style={{ borderColor: highlightColor }}
            onError={(e) => {
              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
            }}
          />
          <span className="text-white text-xs">{currentUser.name}</span>
        </button>

        {isAdmin && (
          <button
            onClick={onBackendAccess}
            className="text-xs px-2 py-1 rounded-md border"
            style={{ 
              borderColor: accentColor,
              color: accentColor 
            }}
          >
            Admin
          </button>
        )}
      </div>

      {/* Main header with logo */}
      <header 
        className="px-6 pt-10 pb-4 text-center relative border-b border-neon-purple/20"
        style={{ backgroundColor: settings?.frontend_header_bg || '#13091f' }}
      >
        <Logo 
          url={logoUrl}
          onClick={onLogoClick}
          className="h-24 mx-auto mb-6"
        />
        <h1 
          className="text-3xl font-bold mb-2"
          style={{ color: accentColor, textShadow: `0 0 10px ${accentColor}` }}
        >
          {settings?.band_name || 'Band Request Hub'}
        </h1>
        
        {activeSetList && (
          <div className="mb-2 inline-flex items-center py-1 px-4 rounded-full"
            style={{ 
              backgroundColor: `${accentColor}15`,
              border: `1px solid ${accentColor}30`
            }}
          >
            <span className="text-sm" style={{ color: accentColor }}>
              Now playing songs from: <span className="font-bold">{activeSetList.name}</span>
            </span>
          </div>
        )}
      </header>

      {/* Ticker */}
      <Ticker
        nextSong={lockedRequest ? {
          title: lockedRequest.title,
          artist: lockedRequest.artist,
          albumArtUrl: lockedSong?.albumArtUrl
        } : undefined}
        customMessage={settings?.custom_message}
        isActive={!!settings?.custom_message || !!lockedRequest}
      />

      {/* Main content */}
      <main className="flex-1 px-6 py-4">
        {/* Tab content */}
        <div className="pb-20">
          {activeTab === 'requests' ? (
            <>
              {/* Search bar */}
              <div className="relative mb-6">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search songs by title, artist, or genre..."
                  className="w-full pl-4 pr-4 py-3 bg-neon-purple/10 border border-neon-purple/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                />
              </div>

              {filteredSongs.length > 0 ? (
                <SongList
                  songs={filteredSongs}
                  onSongSelect={handleSongSelect}
                />
              ) : (
                <div className="text-center py-12">
                  <Music4 className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                  <p className="text-gray-400 text-lg">
                    {searchTerm.trim() 
                      ? `No songs found matching "${searchTerm}"`
                      : 'No songs available'
                    }
                  </p>
                </div>
              )}
            </>
          ) : (
            <UpvoteList
              requests={requests} // Using passed requests with optimistic updates
              onVote={handleVote}
              currentUserId={currentUser.id || currentUser.name}
              votingStates={votingStates}
            />
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-opacity-95 backdrop-blur-sm border-t border-neon-purple/20 px-6 py-3"
        style={{ backgroundColor: navBgColor }}
      >
        <div className="flex justify-center space-x-1">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 max-w-xs flex flex-col items-center py-2 px-4 rounded-lg transition-all ${
              activeTab === 'requests' 
                ? 'bg-neon-purple/20 border border-neon-pink/50' 
                : ''
            }`}
          >
            <Music4 
              className="w-6 h-6 mb-1" 
              style={{ color: activeTab === 'requests' ? accentColor : highlightColor }}
            />
            <span 
              className="text-xs font-medium"
              style={{ color: activeTab === 'requests' ? accentColor : highlightColor }}
            >
              Request Songs
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('upvote')}
            className={`flex-1 max-w-xs flex flex-col items-center py-2 px-4 rounded-lg transition-all ${
              activeTab === 'upvote' 
                ? 'bg-neon-purple/20 border border-neon-pink/50' 
                : ''
            }`}
          >
            <ThumbsUp 
              className="w-6 h-6 mb-1" 
              style={{ color: activeTab === 'upvote' ? accentColor : highlightColor }}
            />
            <span 
              className="text-xs font-medium"
              style={{ color: activeTab === 'upvote' ? accentColor : highlightColor }}
            >
              Vote on Requests
            </span>
          </button>
        </div>
      </nav>

      {/* Request Modal */}
      {(() => {
        console.log('🔍 Modal render check:', {
          selectedSong: selectedSong?.title,
          isRequestModalOpen,
          shouldRender: selectedSong && isRequestModalOpen
        });
        return selectedSong && isRequestModalOpen;
      })() && (
        <RequestModal
          isOpen={isRequestModalOpen}
          onClose={() => {
            console.log('🔐 Modal close called');
            setIsRequestModalOpen(false);
            setSelectedSong(null);
          }}
          song={selectedSong}
          onSubmit={async (data) => {
            console.log('📝 Modal onSubmit called with:', data);
            // The modal passes the form data, use onSubmitRequest directly
            return await onSubmitRequest(data);
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}