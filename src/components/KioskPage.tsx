import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Search, Music4, ThumbsUp, Users, Clock, Zap } from 'lucide-react';
import { Logo } from './shared/Logo';
import { generateDefaultAvatar } from '../utils/photoStorage';
import { supabase } from '../utils/supabase';
import toast from 'react-hot-toast';
import type { Song, SongRequest, RequestFormData, SetList } from '../types';

interface KioskPageProps {
  songs: Song[];
  requests: SongRequest[];
  activeSetList: SetList | null;
  onSubmitRequest: (data: RequestFormData) => Promise<boolean>;
  onVoteRequest: (id: string) => Promise<boolean>;
  logoUrl: string;
}

export function KioskPage({
  songs,
  requests,
  activeSetList,
  onSubmitRequest,
  onVoteRequest,
  logoUrl
}: KioskPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [userName, setUserName] = useState('');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'request' | 'vote'>('request');
  
  // Optimistic update states for instant UI feedback
  const [optimisticRequests, setOptimisticRequests] = useState<Map<string, Partial<SongRequest>>>(new Map());
  const [optimisticVotes, setOptimisticVotes] = useState<Map<string, number>>(new Map());
  const [votingStates, setVotingStates] = useState<Set<string>>(new Set());
  
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Create merged requests with optimistic updates for instant feedback
  const mergedRequests = useMemo(() => {
    // Start with real requests and apply optimistic vote updates
    const realRequests = requests.map(req => ({
      ...req,
      votes: optimisticVotes.get(req.id) ?? req.votes ?? 0
    }));

    // Add any optimistic new requests
    const optimisticRequestsList = Array.from(optimisticRequests.values())
      .filter(req => req.id?.startsWith('temp_'));

    return [...realRequests, ...optimisticRequestsList].filter(req => !req.isPlayed);
  }, [requests, optimisticRequests, optimisticVotes]);

  // Filter songs based on active set list and search
  const displaySongs = useMemo(() => {
    let songsToShow = activeSetList?.songs || songs;
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      songsToShow = songsToShow.filter(song =>
        song.title.toLowerCase().includes(search) ||
        (song.artist && song.artist.toLowerCase().includes(search))
      );
    }
    
    return songsToShow;
  }, [songs, activeSetList, searchTerm]);

  // Enhanced request submission with optimistic updates
  const handleSubmitRequest = useCallback(async () => {
    if (!selectedSong || !userName.trim()) {
      setError('Please select a song and enter your name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const trimmedName = userName.trim();

    // Create optimistic request data for instant UI feedback
    const optimisticRequest: SongRequest = {
      id: tempId,
      title: selectedSong.title,
      artist: selectedSong.artist || '',
      votes: 0,
      isLocked: false,
      isPlayed: false,
      status: 'pending',
      createdAt: new Date().toISOString(),
      requesters: [{
        id: tempId,
        name: trimmedName,
        photo: generateDefaultAvatar(trimmedName),
        message: '',
        timestamp: new Date().toISOString()
      }]
    };

    // INSTANT UI UPDATE - Add to optimistic state immediately
    setOptimisticRequests(prev => new Map([...prev, [tempId, optimisticRequest]]));

    try {
      const requestData: RequestFormData = {
        title: selectedSong.title,
        artist: selectedSong.artist || '',
        requestedBy: trimmedName,
        userPhoto: generateDefaultAvatar(trimmedName),
        message: ''
      };

      const success = await onSubmitRequest(requestData);
      
      if (success) {
        // Clear form and show success
        setSelectedSong(null);
        setUserName('');
        setSearchTerm('');
        
        // Remove optimistic request after real data arrives
        setTimeout(() => {
          if (mountedRef.current) {
            setOptimisticRequests(prev => {
              const newMap = new Map(prev);
              newMap.delete(tempId);
              return newMap;
            });
          }
        }, 2000);
        
        toast.success(`🎵 "${selectedSong.title}" has been added to the queue!`, {
          duration: 3000,
          style: {
            background: '#10B981',
            color: '#fff',
            fontSize: '16px'
          }
        });
      } else {
        // Remove failed optimistic request
        setOptimisticRequests(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
        setError('Failed to submit request. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      
      // Remove failed optimistic request
      setOptimisticRequests(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });
      
      const errorMessage = error instanceof Error && error.message.includes('rate limit')
        ? 'Too many requests. Please try again later.'
        : 'Failed to submit request. Please try again.';
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedSong, userName, onSubmitRequest]);

  // Enhanced vote handler with atomic database function and optimistic updates
  const handleVote = useCallback(async (requestId: string) => {
    if (votingStates.has(requestId)) {
      return; // Already voting
    }

    setVotingStates(prev => new Set([...prev, requestId]));

    // Find current vote count for optimistic update
    const currentRequest = requests.find(r => r.id === requestId);
    const currentVotes = optimisticVotes.get(requestId) ?? currentRequest?.votes ?? 0;

    // INSTANT UI UPDATE - Optimistically increment vote immediately
    setOptimisticVotes(prev => new Map([...prev, [requestId, currentVotes + 1]]));

    try {
      // Use atomic database function for instant voting (kiosk allows anonymous voting)
      const { data, error } = await supabase.rpc('add_vote', {
        p_request_id: requestId,
        p_user_id: `kiosk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      if (error) throw error;

      if (data === true) {
        toast.success('🔥 Vote added!', {
          duration: 2000,
          style: {
            background: '#8B5CF6',
            color: '#fff',
            fontSize: '16px'
          }
        });
        
        // Keep optimistic vote for a moment, then let real data take over
        setTimeout(() => {
          if (mountedRef.current) {
            setOptimisticVotes(prev => {
              const newMap = new Map(prev);
              newMap.delete(requestId);
              return newMap;
            });
          }
        }, 1500);
      } else {
        // Revert optimistic update if voting failed
        setOptimisticVotes(prev => {
          const newMap = new Map(prev);
          newMap.delete(requestId);
          return newMap;
        });
        
        toast.error('Unable to vote at this time. Please try again.');
      }
    } catch (error) {
      console.error('Error voting for request:', error);
      
      // Revert optimistic update on error
      setOptimisticVotes(prev => {
        const newMap = new Map(prev);
        newMap.delete(requestId);
        return newMap;
      });
      
      toast.error('Failed to vote. Please try again.');
    } finally {
      setVotingStates(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  }, [requests, optimisticVotes, votingStates]);

  // Reset error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Sort requests by priority for voting view
  const sortedRequests = useMemo(() => {
    return mergedRequests.sort((a, b) => {
      // Locked requests go first
      if (a.isLocked && !b.isLocked) return -1;
      if (!a.isLocked && b.isLocked) return 1;
      
      // Then by total priority (requester count + votes)
      const priorityA = (a.requesters?.length || 0) + (a.votes || 0);
      const priorityB = (b.requesters?.length || 0) + (b.votes || 0);
      
      return priorityB - priorityA;
    });
  }, [mergedRequests]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center">
            <Logo url={logoUrl} className="h-16 mr-6" />
            <div className="text-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Request Station
              </h1>
              <p className="text-lg text-gray-300 mt-2">
                Request your favorite songs or vote for what's already queued!
              </p>
              {activeSetList && (
                <p className="text-sm text-purple-300 mt-1">
                  Playing from: {activeSetList.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-2 bg-black/30 rounded-xl p-2 max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('request')}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 rounded-lg transition-all text-lg font-medium ${
                activeTab === 'request'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/50'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Music4 className="w-6 h-6" />
              <span>Request Song</span>
            </button>
            
            <button
              onClick={() => setActiveTab('vote')}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 rounded-lg transition-all text-lg font-medium ${
                activeTab === 'vote'
                  ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/50'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <ThumbsUp className="w-6 h-6" />
              <span>Vote on Requests</span>
            </button>
          </div>
        </div>

        {activeTab === 'request' ? (
          // Request Tab
          <div className="space-y-8">
            {/* Name Input */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
              <label className="block text-lg font-medium mb-3 text-purple-300">
                Your Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                maxLength={50}
              />
            </div>

            {/* Search */}
            <div className="bg-black/40 backdrop-blur-sm rounded-xl p-6 border border-purple-500/30">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for songs..."
                  className="w-full bg-gray-900/50 border border-gray-600 rounded-lg pl-12 pr-4 py-4 text-white text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Selected Song */}
            {selectedSong && (
              <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-xl p-6 border border-purple-400/50">
                <h3 className="text-xl font-bold text-purple-300 mb-2">Selected Song</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">{selectedSong.title}</p>
                    {selectedSong.artist && (
                      <p className="text-lg text-gray-300">by {selectedSong.artist}</p>
                    )}
                  </div>
                  <button
                    onClick={handleSubmitRequest}
                    disabled={isSubmitting || !userName.trim()}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Request Now!</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-600/20 border border-red-500/50 rounded-xl p-4">
                <p className="text-red-300 text-lg font-medium">{error}</p>
              </div>
            )}

            {/* Song Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displaySongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => setSelectedSong(song)}
                  className={`p-6 rounded-xl border-2 transition-all text-left transform hover:scale-105 ${
                    selectedSong?.id === song.id
                      ? 'bg-purple-600/30 border-purple-400 shadow-lg shadow-purple-600/30'
                      : 'bg-black/40 border-gray-600/50 hover:border-purple-400/50 hover:bg-purple-600/10'
                  }`}
                >
                  <h3 className="font-bold text-lg text-white mb-2">{song.title}</h3>
                  {song.artist && (
                    <p className="text-gray-300">{song.artist}</p>
                  )}
                </button>
              ))}
            </div>

            {displaySongs.length === 0 && searchTerm && (
              <div className="text-center py-12">
                <Music4 className="mx-auto h-16 w-16 text-gray-500 mb-4" />
                <p className="text-xl text-gray-400">No songs found matching "{searchTerm}"</p>
                <p className="text-gray-500 mt-2">Try a different search term</p>
              </div>
            )}
          </div>
        ) : (
          // Vote Tab
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-pink-300 mb-2">Current Request Queue</h2>
              <p className="text-gray-300 text-lg">Vote for the songs you want to hear!</p>
            </div>

            {sortedRequests.length === 0 ? (
              <div className="text-center py-16">
                <Music4 className="mx-auto h-20 w-20 text-gray-500 mb-6" />
                <p className="text-2xl text-gray-400 mb-2">No requests yet!</p>
                <p className="text-gray-500 text-lg">Be the first to request a song</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {sortedRequests.map((request, index) => {
                  const isVoting = votingStates.has(request.id);
                  const requesters = Array.isArray(request.requesters) ? request.requesters : [];
                  const votes = request.votes || 0;
                  
                  return (
                    <div
                      key={request.id}
                      className={`relative overflow-hidden rounded-xl p-6 border-2 transition-all ${
                        request.isLocked 
                          ? 'bg-gradient-to-r from-yellow-600/30 to-orange-600/30 border-yellow-400 shadow-lg shadow-yellow-600/30' 
                          : 'bg-black/40 border-gray-600/50 hover:border-pink-400/50'
                      }`}
                    >
                      {/* Priority Badge */}
                      <div className="absolute top-4 left-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          index === 0 && !request.isLocked
                            ? 'bg-green-600 text-white'
                            : request.isLocked
                            ? 'bg-yellow-600 text-white'
                            : 'bg-gray-600 text-gray-300'
                        }`}>
                          {request.isLocked ? '🔒 Next Up' : `#${index + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-8">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-1">{request.title}</h3>
                          {request.artist && (
                            <p className="text-lg text-gray-300 mb-3">by {request.artist}</p>
                          )}
                          
                          {/* Requesters */}
                          <div className="flex items-center space-x-4 text-sm text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4" />
                              <span>{requesters.length} requester{requesters.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <ThumbsUp className="w-4 h-4" />
                              <span>{votes} vote{votes !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleVote(request.id)}
                          disabled={isVoting || request.isLocked}
                          className="ml-6 px-6 py-3 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-pink-700 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center space-x-2"
                        >
                          {isVoting ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                              <span>Voting...</span>
                            </>
                          ) : (
                            <>
                              <ThumbsUp className="w-5 h-5" />
                              <span>Vote</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}