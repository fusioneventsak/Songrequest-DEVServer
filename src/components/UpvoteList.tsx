import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Music4, ThumbsUp, UserCircle, Users, Crown, Zap } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import type { SongRequest } from '../types';
import toast from 'react-hot-toast';

interface UpvoteListProps {
  requests: SongRequest[];
  onVote: (id: string) => Promise<boolean>;
  currentUserId: string | undefined;
  votingStates?: Set<string>;
}

export function UpvoteList({ requests, onVote, currentUserId, votingStates = new Set() }: UpvoteListProps) {
  const { settings } = useUiSettings();
  const songBorderColor = settings?.song_border_color || settings?.frontend_accent_color || '#ff00ff';
  const accentColor = settings?.frontend_accent_color || '#ff00ff';

  // Simple filtering - show requests that aren't marked as played
  const activeRequests = useMemo(() => {
    if (!requests || !Array.isArray(requests)) {
      return [];
    }

    // Filter out played requests
    const filtered = requests.filter(request => !request.isPlayed);

    // Sort by priority: locked first, then by total engagement (votes + requesters)
    return filtered.sort((a, b) => {
      // Locked requests go first
      if (a.isLocked && !b.isLocked) return -1;
      if (!a.isLocked && b.isLocked) return 1;
      
      // Then by total engagement (votes + requester count)
      const engagementA = (a.votes || 0) + (a.requesters?.length || 0);
      const engagementB = (b.votes || 0) + (b.requesters?.length || 0);
      
      if (engagementA !== engagementB) {
        return engagementB - engagementA;
      }
      
      // If engagement is equal, sort by creation time (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [requests]);

  const handleVote = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();

    if ((!currentUserId && !currentUserId) || votingStates.has(id)) {
      return;
    }

    try {
      const success = await onVote(id);
      
      if (success) {
    }
  };

  if (activeRequests.length === 0) {
    return (
      <div className="text-center py-16">
        <Music4 className="mx-auto h-16 w-16 text-gray-500 mb-6" />
        <p className="text-gray-400 text-xl mb-2">No active requests to vote on</p>
        <p className="text-gray-500 text-lg">
          {requests?.length > 0 
            ? `Found ${requests.length} total requests, but ${requests.filter(r => r.isPlayed).length} are marked as played`
            : 'No requests found - be the first to request a song!'
          }
        </p>
        
        {/* DEBUG INFO */}
        <div className="bg-gray-800 p-4 rounded mt-4 text-xs text-left max-w-md mx-auto">
          <div className="text-gray-300 mb-2">Debug Info:</div>
          <div>Total requests received: {requests?.length || 0}</div>
          <div>Current user ID: {currentUserId || 'None'}</div>
          {requests?.length > 0 && (
            <div className="mt-2">
              <div>Request statuses:</div>
              {requests.slice(0, 5).map(r => (
                <div key={r.id} className="ml-2 text-gray-400">
                  • {r.title}: isPlayed={String(r.isPlayed)}, votes={r.votes || 0}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold neon-text mb-2">Vote for Your Favorites</h2>
        <p className="text-gray-400">Help decide what gets played next!</p>
      </div>

      <div className="grid gap-6">
        {activeRequests.map((request, index) => {
          const isVoting = votingStates.has(request.id);
          const requesters = Array.isArray(request.requesters) ? request.requesters : [];
          const mainRequester = requesters[0];
          const additionalCount = Math.max(0, requesters.length - 1);
          const votes = request.votes || 0;
          const totalEngagement = votes + requesters.length;
          
          // Determine if this is a highly requested song
          const isHotTrack = totalEngagement >= 5;
          const isTopRequest = index === 0 && !request.isLocked;

          return (
            <div
              key={request.id}
              className={`
                relative overflow-hidden rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.02]
                ${request.isLocked 
                  ? 'bg-gradient-to-r from-yellow-900/40 to-orange-900/40 ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/30' 
                  : isHotTrack
                  ? 'bg-gradient-to-r from-red-900/30 to-pink-900/30 ring-2 ring-red-400/50 shadow-lg shadow-red-400/20'
                  : isTopRequest
                  ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 ring-2 ring-green-400/50 shadow-lg shadow-green-400/20'
                  : 'bg-gray-900/80 hover:bg-gray-800/80 border border-gray-700/50'
                }
                backdrop-blur-sm
              `}
              style={{
                borderColor: request.isLocked ? '#FBBF24' : isHotTrack ? '#EF4444' : isTopRequest ? '#10B981' : songBorderColor,
              }}
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                {request.isLocked ? (
                  <div className="flex items-center space-x-1 px-3 py-1 bg-yellow-600 text-yellow-100 rounded-full text-sm font-bold">
                    <Crown className="w-4 h-4" />
                    <span>Next Up</span>
                  </div>
                ) : isHotTrack ? (
                  <div className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-red-100 rounded-full text-sm font-bold">
                    <Zap className="w-4 h-4" />
                    <span>Hot Track</span>
                  </div>
                ) : isTopRequest ? (
                  <div className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-green-100 rounded-full text-sm font-bold">
                    <Crown className="w-4 h-4" />
                    <span>Top Request</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 bg-gray-600 text-gray-200 rounded-full text-sm font-medium">
                    #{index + 1}
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between pr-24">
                {/* Song Info */}
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">{request.title}</h3>
                  {request.artist && (
                    <p className="text-gray-300 mb-3">{request.artist}</p>
                  )}
                  
                  {/* Requester Info */}
                  {mainRequester && (
                    <div className="flex items-center space-x-3 mb-3">
                      {mainRequester.photo ? (
                        <img
                          src={mainRequester.photo}
                          alt={mainRequester.name}
                          className="w-8 h-8 rounded-full object-cover border-2 border-purple-400/50"
                        />
                      ) : (
                        <UserCircle className="w-8 h-8 text-purple-400" />
                      )}
                      <div className="text-sm">
                        <span className="font-medium text-white">
                          Requested by {mainRequester.name}
                        </span>
                        {additionalCount > 0 && (
                          <span className="text-gray-400 ml-2">
                            + {additionalCount} other{additionalCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>{requesters.length} requester{requesters.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{votes} vote{votes !== 1 ? 's' : ''}</span>
                    </div>
                    {totalEngagement > 0 && (
                      <div className="flex items-center space-x-2 text-purple-400 font-medium">
                        <Zap className="w-4 h-4" />
                        <span>{totalEngagement} total engagement</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vote Button */}
              <div className="mt-4 flex justify-end">
                {request.id.startsWith('temp_') ? (
                  <div className="px-6 py-3 rounded-lg bg-gray-600/50 text-gray-400 flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => handleVote(request.id, e)}
                    disabled={isVoting || request.isLocked}
                    className={`
                      px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 disabled:transform-none
                      flex items-center space-x-2 min-w-[120px] justify-center
                      ${request.isLocked
                        ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                        : isVoting
                        ? 'bg-purple-600/50 text-purple-200 cursor-wait'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl'
                      }
                    `}
                    style={{
                      backgroundColor: !request.isLocked && !isVoting ? undefined : undefined,
                      backgroundImage: !request.isLocked && !isVoting ? `linear-gradient(to right, ${accentColor}, ${secondaryColor})` : undefined
                    }}
                  >
                    {isVoting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Voting...</span>
                      </>
                    ) : request.isLocked ? (
                      <>
                        <Crown className="w-5 h-5" />
                        <span>Locked</span>
                      </>
                    ) : (
                      <>
                        <ThumbsUp className="w-5 h-5" />
                        <span>Vote</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Progress Bar for Engagement */}
              {!request.isLocked && totalEngagement > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-700/50 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, (totalEngagement / 10) * 100)}%` 
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-center">
                    {totalEngagement}/10 engagement to boost priority
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* DEBUG INFO at bottom */}
      <div className="mt-8 bg-gray-800 p-4 rounded text-xs">
        <div className="text-gray-300 mb-2">UpvoteList Debug:</div>
        <div>Requests received: {requests?.length || 0}</div>
        <div>Active requests: {activeRequests.length}</div>
        <div>Current user: {currentUserId || 'None'}</div>
        <div>Voting states: {votingStates.size}</div>
      </div>
    </div>
  );
}