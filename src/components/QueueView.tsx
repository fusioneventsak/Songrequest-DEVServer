import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ThumbsUp, Lock, CheckCircle2, ChevronDown, ChevronUp, Users, UserCircle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useUiSettings } from '../hooks/useUiSettings';
import { AlbumArtDisplay } from './shared/AlbumArtDisplay';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { SongRequest } from '../types';

interface QueueViewProps {
  requests: SongRequest[];
  onLockRequest: (id: string) => void;
  onMarkPlayed: (id: string) => void;
  onResetQueue?: () => void;
}

const decodeTitle = (title: string) => {
  try {
    return decodeURIComponent(title);
  } catch (e) {
    return title;
  }
};

export function QueueView({ requests, onLockRequest, onMarkPlayed, onResetQueue }: QueueViewProps) {
  const [lockingStates, setLockingStates] = useState<Set<string>>(new Set());
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [isResetting, setIsResetting] = useState(false);
  const [optimisticLocks, setOptimisticLocks] = useState<Set<string>>(new Set());
  
  // Track if component is mounted
  const mountedRef = useRef(true);
  
  // Handle queue reset with confirmation
  const handleResetQueue = async () => {
    if (!onResetQueue) return;
    
    if (window.confirm('Are you sure you want to clear all pending requests and votes? This will also reset any rate limits.')) {
      setIsResetting(true);
      try {
        await onResetQueue();
      } finally {
        setIsResetting(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  // Debug log when requests change
  useEffect(() => {
    console.log('🔄 QueueView requests updated:', requests.length, requests.map(r => r.id));
  }, [requests]);
  
  // Clear optimistic locks when real data arrives
  useEffect(() => {
    // Get the current locked request from the server data
    const serverLockedIds = new Set(requests.filter(r => r.isLocked).map(r => r.id));
    const optimisticLockedIds = new Set(optimisticLocks);
    
    // If server state matches optimistic state, clear optimistic state
    const needsClear = Array.from(optimisticLockedIds).every(id => serverLockedIds.has(id)) &&
                      serverLockedIds.size <= 1; // Should only have 0 or 1 locked request
    
    if (needsClear && optimisticLocks.size > 0) {
      console.log('✅ Clearing optimistic locks - server state matches');
      setOptimisticLocks(new Set());
    }
  }, [requests, optimisticLocks]);
  
  const { settings } = useUiSettings();
  const accentColor = settings?.frontend_accent_color || '#ff00ff';
  
  // Auto-expand requests based on UI settings
  useEffect(() => {
    if (settings?.default_expanded_requesters) {
      const pendingIds = requests
        .filter(r => !r.isPlayed)
        .map(r => r.id);
      setExpandedRequests(new Set(pendingIds));
    }
  }, [requests, settings?.default_expanded_requesters]);

  // Log incoming requests for debugging
  useEffect(() => {
    console.log('QueueView - Received requests:', requests.map(r => ({
      id: r.id,
      title: r.title,
      requesters: r.requesters?.map(rq => ({
        name: rq.name,
        message: rq.message,
        timestamp: rq.timestamp
      }))
    })));
  }, [requests]);

  // Deduplicate requests by song title and combine requesters
  const deduplicatedRequests = useMemo(() => {
    console.log('Deduplicating requests...');
    const requestMap = new Map<string, SongRequest>();

    requests
      .filter(request => !request.isPlayed)
      .forEach(request => {
        const key = `${request.title.toLowerCase()}|${(request.artist || '').toLowerCase()}`;
        
        console.log(`Processing request: ${request.title}`, {
          id: request.id,
          hasRequesters: Array.isArray(request.requesters),
          requestersCount: request.requesters?.length || 0,
          firstRequester: request.requesters && request.requesters.length > 0 ? 
            { name: request.requesters[0].name, hasMessage: !!request.requesters[0].message } : null
        });
        
        if (requestMap.has(key)) {
          const existing = requestMap.get(key)!;
          
          // Combine requesters, ensuring we don't have duplicates by name
          let updateRequesters = existing.requesters ? [...existing.requesters] : [];
          
          if (Array.isArray(request.requesters) && request.requesters.length > 0) {
            const existingNames = new Set(updateRequesters.map(r => r.name));
            request.requesters.forEach(requester => {
              if (!existingNames.has(requester.name)) {
                updateRequesters.push(requester);
              } else {
                // If there's a duplicate name but this one has a message, add it anyway
                if (requester.message) {
                  updateRequesters.push(requester);
                }
              }
            });
          }
          
          requestMap.set(key, {
            ...existing,
            requesters: updateRequesters,
            votes: (existing.votes || 0) + (request.votes || 0),
            isLocked: existing.isLocked || request.isLocked
          });

          console.log(`Updated existing request: ${existing.title}`, {
            requestersCount: updateRequesters.length
          });
        } else {
          // Make sure requesters is a defined array
          const requesters = Array.isArray(request.requesters) ? request.requesters : [];
          
          requestMap.set(key, {
            ...request,
            requesters: requesters,
            votes: request.votes || 0
          });

          console.log(`Added new request: ${request.title}`, {
            requestersCount: requesters.length
          });
        }
      });

    const result = Array.from(requestMap.values());
    console.log('Deduplication complete. Results:', result.map(r => ({
      title: r.title,
      requestersCount: r.requesters?.length || 0,
      allHaveMessages: r.requesters?.every(req => !!req.message)
    })));
    
    return result;
  }, [requests]);

  // Sort deduplicated requests
  const sortedRequests = useMemo(() => {
    // Apply optimistic locks to the requests
    const requestsWithOptimisticLocks = deduplicatedRequests.map(request => ({
      ...request,
      // Use optimistic state if available, otherwise use database state
      isLocked: optimisticLocks.has(request.id) ? true : 
                optimisticLocks.size > 0 ? false : 
                request.isLocked
    }));
    
    return requestsWithOptimisticLocks.sort((a, b) => {
      // Locked requests always go first
      if (a.isLocked) return -1;
      if (b.isLocked) return 1;

      // Calculate priority based on requester count AND votes
      const priorityA = (a.requesters?.length || 0) + (a.votes || 0);
      const priorityB = (b.requesters?.length || 0) + (b.votes || 0);

      // First compare priority (requester count + upvotes)
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // If priority is the same, then compare requester count
      const requestersA = a.requesters?.length || 0;
      const requestersB = b.requesters?.length || 0;
      
      if (requestersA !== requestersB) {
        return requestersB - requestersA;
      }
      
      // If requester counts are also the same, sort by timestamp (most recent first)
      const latestA = Math.max(...(a.requesters?.length ? a.requesters.map(r => new Date(r.timestamp).getTime()) : [new Date(a.createdAt).getTime()]));
      const latestB = Math.max(...(b.requesters?.length ? b.requesters.map(r => new Date(r.timestamp).getTime()) : [new Date(b.createdAt).getTime()]));
      return latestB - latestA;
    });
  }, [deduplicatedRequests, optimisticLocks]);

  const handleLockRequest = useCallback(async (id: string) => {
    if (!mountedRef.current) return;
    
    setLockingStates(prev => new Set([...prev, id]));
    
    // Get the current request
    const request = requests.find(r => r.id === id);
    if (!request) return;
    
    // Toggle the locked status
    const newLockedState = !request.isLocked;
    
    // INSTANT OPTIMISTIC UPDATE - update UI immediately
    setOptimisticLocks(prev => {
      const newSet = new Set();
      if (newLockedState) {
        newSet.add(id); // Only this request is locked
      }
      return newSet;
    });
    
    try {
      // Use the atomic database function for better performance
      if (newLockedState) {
        // Lock this request (and unlock all others)
        const { error } = await supabase.rpc('lock_request', { request_id: id });
        if (error) throw error;
      } else {
        // Just unlock this request
        const { error } = await supabase.rpc('unlock_request', { request_id: id });
        if (error) throw error;
      }
      
      console.log('✅ Lock status updated in database');
      
      // Show success toast
      toast.success(newLockedState ? 'Request locked as next song' : 'Request unlocked');
    } catch (error) {
      console.error('❌ Error updating lock status:', error);
      
      // REVERT optimistic update on error
      setOptimisticLocks(new Set());

      // Show error toast
      if (typeof toast !== 'undefined') {
        toast.error('Failed to update request. Please try again.');
      } else {
        alert('Failed to update request. Please try again.');
      }
    } finally {
      setTimeout(() => {
        setLockingStates(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 300);
    }
  }, [requests, mountedRef]);
  
  // Toggle expanded/collapsed state for a request
  const toggleRequestExpanded = (id: string) => {
    setExpandedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold neon-text">Request Queue</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-400">
          Priority = Requesters + Upvotes
          </div>
          {onResetQueue && (
            <button
              onClick={handleResetQueue}
              disabled={isResetting}
              className={`px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors ${
                isResetting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isResetting ? 'Clearing...' : 'Clear Queue'}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-1">
        {sortedRequests.map((request) => {
          const isLocking = lockingStates.has(request.id);
          const isOptimisticallyLocked = optimisticLocks.has(request.id);
          const isActuallyLocked = request.isLocked && !optimisticLocks.size;
          const displayLocked = isOptimisticallyLocked || isActuallyLocked;
          
          // Check if requesters is a valid, populated array
          const hasRequesters = Array.isArray(request.requesters) && request.requesters.length > 0;
          // Get actual requester count, ensuring it's at least 1
          const requesterCount = Math.max(hasRequesters ? request.requesters.length : 0, 1);
          // Calculate priority as sum of requesters and votes
          const priority = requesterCount + (request.votes || 0);
          // Check if this request is currently expanded
          const isExpanded = expandedRequests.has(request.id);
          
          return (
            <div
              key={request.id}
              className={`glass-effect rounded-lg p-4 transition-all duration-300 ${
                displayLocked ? 'request-locked' : ''
              }`}
              style={{
                ...(displayLocked && {
                  borderColor: accentColor,
                  borderWidth: '2px',
                  animation: 'glow 2s ease-in-out infinite',
                  boxShadow: `0 0 20px ${accentColor}50`,
                })
              }}
            >
              <div className="flex flex-col">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-white truncate">
                      {decodeTitle(request.title)}
                    </h3>
                    {request.artist && (
                      <p className="text-gray-300 text-sm truncate">{request.artist}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-0.5">
                      <div className="flex items-center space-x-1 text-xs text-gray-400">
                        <Users className="w-3 h-3" />
                        <span>{requesterCount}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-400">
                        <ThumbsUp className="w-3 h-3" />
                        <span>{request.votes || 0}</span>
                      </div>
                      <div className="text-xs text-neon-pink">
                        Priority: {priority}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleLockRequest(request.id)}
                      disabled={isLocking}
                     className={`p-2 rounded-lg transition-all duration-200 flex items-center ${
                        displayLocked
                         ? 'bg-neon-pink text-white shadow-glow'
                         : 'bg-gray-700/50 text-gray-300 hover:bg-neon-pink/30 hover:text-white'
                     } ${isLocking ? 'animate-pulse' : ''}`}
                      title={displayLocked ? 'Unlock' : 'Lock as Next Song'}
                      style={displayLocked ? {
                       animation: 'pulse 2s ease-in-out infinite'
                      } : undefined}
                    >
                     <Lock className={`w-5 h-5 ${isLocking ? 'animate-spin' : ''} mr-1`} />
                      {isOptimisticallyLocked && !isActuallyLocked && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                      )}
                    </button>
                    <button
                      onClick={() => onMarkPlayed(request.id)}
                      className="p-2 rounded-lg transition-all duration-200 flex items-center bg-red-500 text-white hover:bg-red-600 shadow-lg"
                      style={{
                        boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)',
                      }}
                      title="Mark as Played"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Show requesters preview when collapsed */}
                {hasRequesters && !isExpanded && (
                  <div className="mt-2 flex items-center space-x-1 overflow-hidden">
                    <div className="flex -space-x-2">
                      {request.requesters.slice(0, 3).map((requester, idx) => (
                        <div key={`preview-${request.id}-${idx}`} className="relative">
                          <img 
                            src={requester.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E"} 
                            alt={requester.name} 
                            className="w-7 h-7 rounded-full border"
                            style={{ borderColor: accentColor }}
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    {request.requesters.length > 3 && (
                      <div className="bg-neon-purple/20 rounded-full w-7 h-7 flex items-center justify-center text-xs text-white">
                        +{request.requesters.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {/* Show full requester list when expanded */}
                {hasRequesters && isExpanded && (
                  <div className="mt-2 space-y-2 transition-all duration-300 overflow-hidden">
                    {request.requesters.map((requester, index) => (
                      <div
                        key={`${request.id}-requester-${index}-${requester.id}`}
                        className="flex items-center space-x-2 bg-neon-purple/10 rounded-lg p-2.5"
                      >
                        <div className="flex-shrink-0">
                          {requester.photo ? (
                            <img
                              src={requester.photo}
                              alt={requester.name || "Requester"}
                              className="w-8 h-8 rounded-full border-2"
                              style={{ borderColor: accentColor }}
                              title={requester.name || "Requester"}
                              onError={(e) => {
                                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                                e.currentTarget.className = "w-8 h-8 rounded-full bg-gray-700 p-0.5 text-white";
                              }}
                            />
                          ) : (
                            <UserCircle className="w-8 h-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between">
                            <span className="font-medium text-white text-sm truncate">
                              {requester.name || 'Anonymous'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {requester.timestamp ? format(new Date(requester.timestamp), 'h:mm a') : 'Unknown time'}
                            </span>
                          </div>
                          {requester.message && (
                            <p className="text-xs text-gray-300 italic mt-1 bg-neon-purple/5 p-1.5 rounded">
                              "{requester.message}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )} 

                {/* Show message if no requesters */}
                {!hasRequesters && (
                  <div className="mt-2 px-1 py-2 text-center text-gray-400 text-xs bg-neon-purple/5 rounded-md">
                    This request is in the queue but detailed requester information isn't available.
                  </div>
                )}
                
                {/* Dropdown button at the bottom center */}
                {hasRequesters && (
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={() => toggleRequestExpanded(request.id)}
                      className="p-1 text-gray-400 hover:text-white hover:bg-neon-purple/20 rounded-full transition-colors"
                      title={isExpanded ? "Hide requesters" : "Show requesters"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sortedRequests.length === 0 && (
          <div className="text-center py-4 text-gray-400 glass-effect rounded-lg">
            No pending requests in the queue
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px ${accentColor}50;
          }
          50% {
            box-shadow: 0 0 30px ${accentColor}80;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        .shadow-glow {
          box-shadow: 0 0 15px ${accentColor}70;
        }
      `}</style>
    </div>
  );
}