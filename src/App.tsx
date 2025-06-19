// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './utils/supabase';
import { UserFrontend } from './components/UserFrontend';
import { BackendLogin } from './components/BackendLogin';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { LoadingSpinner } from './components/shared/LoadingSpinner';
import { useUiSettings } from './hooks/useUiSettings';
import { useSongSync } from './hooks/useSongSync';
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
      newRequests.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req.title} (id: ${req.id}, played: ${req.isPlayed}, locked: ${req.isLocked})`);
      });
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
  
  // 🚀 SIMPLIFIED: Remove optimistic vote states, keep only optimistic requests
  const [optimisticRequests, setOptimisticRequests] = useState<Map<string, Partial<SongRequest>>>(new Map());
  
  // Ref to track if component is mounted
  const mountedRef = useRef<boolean>(true);
  const requestInProgressRef = useRef(false);
  const requestRetriesRef = useRef(0);
  
  // UI Settings
  const { settings, updateSettings } = useUiSettings();
  
  // Initialize data synchronization with enhanced real-time
  const { isLoading: isFetchingSongs } = useSongSync(setSongs);
  const { isLoading: isFetchingSetLists, refetch: refreshSetLists } = useSetListSync(setSetLists);

  // 🚀 ENHANCED: Replace useRequestSync with direct real-time implementation
  const [isFetchingRequests, setIsFetchingRequests] = useState(true);
  const reconnectRequests = useCallback(async () => {
    console.log('🔄 Manual reconnect triggered - fetching latest requests...');
    
    try {
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select(`
          id,
          title,
          artist,
          votes,
          status,
          is_locked,
          is_played,
          created_at,
          requesters (
            id,
            name,
            photo,
            message,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('❌ Error fetching requests:', requestsError);
        return;
      }

      if (requestsData) {
        const formattedRequests: SongRequest[] = requestsData.map(request => ({
          id: request.id,
          title: request.title,
          artist: request.artist || '',
          requesters: (request.requesters || []).map((requester: any) => ({
            id: requester.id,
            name: requester.name,
            photo: requester.photo || '',
            message: requester.message || '',
            timestamp: new Date(requester.created_at)
          })),
          votes: request.votes || 0,
          status: request.status as any,
          isLocked: request.is_locked || false,
          isPlayed: request.is_played || false,
          createdAt: new Date(request.created_at)
        }));

        console.log('✅ Manual fetch completed:', formattedRequests.length, 'requests');
        console.log('📊 Request status breakdown:', {
          total: formattedRequests.length,
          active: formattedRequests.filter(r => !r.isPlayed).length,
          played: formattedRequests.filter(r => r.isPlayed).length,
          locked: formattedRequests.filter(r => r.isLocked).length
        });
        setRequests(formattedRequests);
      }
    } catch (error) {
      console.error('❌ Manual fetch error:', error);
    }
  }, []);

  // 🚀 SIMPLIFIED: mergedRequests without optimistic vote complications
  const mergedRequests = useMemo(() => {
    console.log('🔀 App: Creating simplified merged requests:', {
      realRequests: requests.length,
      optimisticRequests: optimisticRequests.size
    });

    // Start with real requests - no optimistic vote modifications
    const realRequests = requests.map(req => ({
      ...req,
      // Ensure proper structure
      id: req.id || 'unknown',
      title: req.title || 'Unknown Song',
      artist: req.artist || '',
      requesters: Array.isArray(req.requesters) ? req.requesters : [],
      votes: req.votes || 0, // Use real vote count only
      isLocked: Boolean(req.isLocked),
      isPlayed: Boolean(req.isPlayed),
      status: req.status || 'pending',
      createdAt: req.createdAt ? new Date(req.createdAt) : new Date()
    }));

    // Clean up optimistic requests that now exist in real data
    const realTitles = new Set(realRequests.map(r => r.title.toLowerCase()));
    const validOptimisticRequests = Array.from(optimisticRequests.values())
      .filter(req => {
        if (!req.id?.startsWith('temp_')) return false;
        
        // Remove optimistic request if real version exists
        const hasRealVersion = realTitles.has(req.title?.toLowerCase() || '');
        if (hasRealVersion) {
          console.log(`🧹 Removing optimistic request "${req.title}" - real version exists`);
          // Clean up the optimistic state
          setTimeout(() => {
            setOptimisticRequests(prev => {
              const newMap = new Map(prev);
              newMap.delete(req.id!);
              return newMap;
            });
          }, 100);
          return false;
        }
        
        return true;
      })
      .map(req => ({
        // Ensure optimistic requests have proper structure
        ...req,
        isPlayed: false, // Critical: optimistic requests are never played
        votes: req.votes ?? 0,
        requesters: req.requesters || [],
        status: 'pending',
        createdAt: req.createdAt || new Date()
      })) as SongRequest[];

    // Combine and filter out played requests
    const merged = [...realRequests, ...validOptimisticRequests].filter(req => {
      const shouldInclude = !req.isPlayed;
      return shouldInclude;
    });

    console.log('✅ Simplified merged requests created:', {
      total: merged.length,
      fromReal: realRequests.filter(r => !r.isPlayed).length,
      fromOptimistic: validOptimisticRequests.length,
      titles: merged.map(r => r.title)
    });

    return merged;
  }, [requests, optimisticRequests]);

  // Add debugging for when requests change
  useEffect(() => {
    console.log('🔄 App: requests state changed:', {
      length: requests.length,
      optimisticLength: optimisticRequests.size,
      requests: requests.map(r => ({
        id: r.id,
        title: r.title,
        isPlayed: r.isPlayed,
        isLocked: r.isLocked,
        votes: r.votes
      })),
      optimistic: Array.from(optimisticRequests.entries()).map(([id, req]) => ({
        id,
        title: req.title,
        isPlayed: req.isPlayed
      }))
    });
  }, [requests, optimisticRequests]);

  // Add debugging for when mergedRequests change with special focus on locked requests
  useEffect(() => {
    const lockedRequests = mergedRequests.filter(r => r.isLocked);
    const activeLockedRequest = lockedRequests.find(r => !r.isPlayed);
    
    console.log('🔄 App: mergedRequests changed - TICKER UPDATE CHECK:', {
      totalRequests: mergedRequests.length,
      totalLocked: lockedRequests.length,
      activeLockedRequest: activeLockedRequest ? {
        id: activeLockedRequest.id,
        title: activeLockedRequest.title,
        artist: activeLockedRequest.artist,
        isLocked: activeLockedRequest.isLocked,
        isPlayed: activeLockedRequest.isPlayed
      } : null,
      allRequests: mergedRequests.map(r => ({
        id: r.id,
        title: r.title,
        isPlayed: r.isPlayed,
        isLocked: r.isLocked,
        votes: r.votes
      }))
    });
    
    // Log ticker state change
    if (activeLockedRequest) {
      console.log('🎯 TICKER SHOULD SHOW:', `"${activeLockedRequest.title}" by ${activeLockedRequest.artist || 'Unknown Artist'}`);
    } else {
      console.log('🎯 TICKER SHOULD BE EMPTY: No locked requests found');
    }
  }, [mergedRequests]);

  // Enhanced real-time subscription setup with INSTANT updates
  useEffect(() => {
    console.log('🚀 Setting up INSTANT real-time subscriptions...');
    
    // Initial fetch
    reconnectRequests();
    setIsFetchingRequests(false);
    
    // Real-time subscription with ZERO delay for critical changes
    const requestsChannel = supabase
      .channel('instant_requests_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests'
        },
        (payload) => {
          console.log('🚨 INSTANT REAL-TIME: Request change detected', {
            event: payload.eventType,
            title: payload.new?.title || payload.old?.title,
            id: payload.new?.id || payload.old?.id,
            isPlayed: payload.new?.is_played,
            wasPlayed: payload.old?.is_played,
            isLocked: payload.new?.is_locked,
            wasLocked: payload.old?.is_locked,
            votes: payload.new?.votes,
            oldVotes: payload.old?.votes
          });
          
          // INSTANT updates for ALL changes - no delays
          if (payload.eventType === 'DELETE') {
            console.log('🚨 DELETE detected - clearing queue across all users');
            reconnectRequests(); // INSTANT
          } else if (payload.eventType === 'UPDATE') {
            // Check for lock changes
            if (payload.old?.is_locked !== payload.new?.is_locked) {
              console.log('🚨 LOCK STATUS CHANGED - updating ticker instantly');
              reconnectRequests(); // INSTANT for ticker
            }
            // Check for vote changes
            else if (payload.old?.votes !== payload.new?.votes) {
              console.log('🚨 VOTE COUNT CHANGED - updating instantly');
              reconnectRequests(); // INSTANT for votes
            }
            // Check for played status
            else if (payload.old?.is_played !== payload.new?.is_played) {
              console.log('🚨 PLAYED STATUS CHANGED - updating instantly');
              reconnectRequests(); // INSTANT
            }
            else {
              reconnectRequests(); // INSTANT for any other updates
            }
          } else if (payload.eventType === 'INSERT') {
            console.log('🚨 NEW REQUEST INSERTED - updating instantly');
            reconnectRequests(); // INSTANT
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requesters'
        },
        (payload) => {
          console.log('🚨 INSTANT REAL-TIME: Requester change detected', {
            event: payload.eventType,
            name: payload.new?.name || payload.old?.name,
            requestId: payload.new?.request_id || payload.old?.request_id
          });
          
          // INSTANT update for requester changes
          reconnectRequests();
        }
      )
      .subscribe((status) => {
        console.log('📡 INSTANT subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ INSTANT real-time is ACTIVE');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ INSTANT real-time ERROR - will retry');
          // Immediate retry
          setTimeout(() => {
            console.log('🔄 Retrying INSTANT real-time subscription...');
            requestsChannel.unsubscribe();
          }, 500); // Faster retry
        }
      });

    return () => {
      console.log('🧹 Cleaning up INSTANT real-time subscription');
      requestsChannel.unsubscribe();
    };
  }, [reconnectRequests]);

  // DEBUG: Real-time subscription test
  useEffect(() => {
    console.log('🔧 Setting up debug real-time subscription...');
    
    const debugChannel = supabase
      .channel('debug_requests_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests'
        },
        (payload) => {
          console.log('🚨 DEBUG: Real-time request change detected!', {
            event: payload.eventType,
            table: payload.table,
            hasNew: !!payload.new,
            hasOld: !!payload.old,
            newData: payload.new,
            oldData: payload.old
          });
          
          if (payload.eventType === 'INSERT') {
            console.log('📥 New request inserted:', payload.new?.title);
          }
          if (payload.eventType === 'UPDATE') {
            console.log('📝 Request updated:', payload.new?.title);
            if (payload.old?.is_played !== payload.new?.is_played) {
              console.log('🎯 PLAYED STATUS CHANGED:', {
                from: payload.old?.is_played,
                to: payload.new?.is_played,
                title: payload.new?.title
              });
            }
          }
          if (payload.eventType === 'DELETE') {
            console.log('🗑️ Request deleted');
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 DEBUG channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ DEBUG real-time subscription is active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ DEBUG real-time subscription error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ DEBUG real-time subscription timed out');
        } else if (status === 'CLOSED') {
          console.warn('🔌 DEBUG real-time subscription closed');
        }
      });

    return () => {
      console.log('🧹 Cleaning up debug real-time subscription');
      debugChannel.unsubscribe();
    };
  }, []);

  // Environment analysis
  useEffect(() => {
    console.log('🌍 Environment Analysis:', {
      isDev: window.location.hostname === 'localhost',
      isStackBlitz: window.location.hostname.includes('stackblitz'),
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      userAgent: navigator.userAgent.substring(0, 50)
    });
    
    // Test if this is a different Supabase instance
    const prodPattern = /\.supabase\.co$/;
    const devPattern = /localhost|stackblitz|gitpod/;
    
    const url = import.meta.env.VITE_SUPABASE_URL || '';
    console.log('🔍 Supabase URL Analysis:', {
      url: url,
      isProdUrl: prodPattern.test(url),
      isDevEnvironment: devPattern.test(window.location.hostname),
      urlHost: new URL(url).hostname
    });
  }, []);

  // Fallback polling for dev environment (as backup)
  useEffect(() => {
    const isDev = window.location.hostname === 'localhost' || 
                 window.location.hostname.includes('stackblitz');
    
    if (!isDev) return; // Only run in development
    
    console.log('🔧 Setting up development fallback polling...');
    
    let lastKnownCount = requests.length;
    
    const pollForChanges = setInterval(async () => {
      try {
        const { count, error } = await supabase
          .from('requests')
          .select('*', { count: 'exact', head: true });
          
        if (!error && count !== null && count !== lastKnownCount) {
          console.log(`📊 DEV POLLING: Count changed ${lastKnownCount} → ${count}`);
          lastKnownCount = count;
          reconnectRequests();
        }
      } catch (error) {
        console.warn('⚠️ Polling error (non-critical):', error);
      }
    }, 1500); // Check every 1.5 seconds in dev
    
    return () => {
      console.log('🧹 Cleaning up dev polling');
      clearInterval(pollForChanges);
    };
  }, [requests.length, reconnectRequests]);

  // Test the Supabase real-time connection status
  useEffect(() => {
    const checkRealtimeStatus = () => {
      console.log('📡 Real-time connection status:', {
        isConnected: supabase.realtime.isConnected(),
        channels: supabase.realtime.channels.length,
        connectionState: supabase.realtime.connectionState(),
        reconnectAttempts: supabase.realtime.reconnectAttempts || 0
      });
    };
    
    // Check immediately
    checkRealtimeStatus();
    
    // Check every 5 seconds
    const statusInterval = setInterval(checkRealtimeStatus, 5000);
    
    return () => clearInterval(statusInterval);
  }, []);

  // SUPABASE CONNECTION TEST
  useEffect(() => {
    const testSupabaseConnection = async () => {
      console.log('🔍 Testing Supabase connection...');
      console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      
      try {
        // Test basic connection
        const { data, error } = await supabase
          .from('requests')
          .select('count(*)', { count: 'exact', head: true });
        
        if (error) {
          console.error('❌ Supabase connection failed:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          });
        } else {
          console.log('✅ Supabase connection successful!');
          console.log('Request count:', data);
          
          // Test fetching actual requests
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

  // 🚀 Enhanced song request submission with optimistic updates (KioskPage pattern)
  const handleSubmitRequest = useCallback(async (data: RequestFormData): Promise<boolean> => {
    console.log('🎵 Submitting request with optimistic updates:', data);
    
    if (requestInProgressRef.current) {
      console.log('Request already in progress, please wait...');
      toast.error('A request is already being processed. Please wait a moment and try again.');
      return false;
    }
    
    requestInProgressRef.current = true;

    // Create optimistic request for instant UI feedback (same as KioskPage)
    const tempId = `temp_${Date.now()}`;
    const optimisticRequest: Partial<SongRequest> = {
      id: tempId,
      title: data.title,
      artist: data.artist || '',
      votes: 0,
      isLocked: false,
      isPlayed: false, // CRITICAL: ensure this is explicitly false
      status: 'pending',
      createdAt: new Date(),
      requesters: [{
        id: tempId,
        name: data.requestedBy,
        photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
        message: data.message?.trim() || '',
        timestamp: new Date()
      }]
    };

    // INSTANT UI UPDATE - Add to optimistic state immediately (same as KioskPage)
    setOptimisticRequests(prev => new Map([...prev, [tempId, optimisticRequest]]));
    console.log('✨ Added optimistic request for instant UI update');

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
        console.log('🔄 Adding to existing request:', existingRequest.id);
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
        console.log('✨ Creating new request for:', data.title);
        
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

      // DON'T remove optimistic request automatically - let real-time data replace it
      // The real-time subscription will handle updating the UI when the actual request arrives
      console.log('✅ Request submitted successfully - letting real-time data handle UI updates');

      requestRetriesRef.current = 0;
      console.log('✅ Request submitted successfully:', requestId);
      toast.success('Your request has been added to the queue!');
      return true;
    } catch (error) {
      console.error('❌ Error submitting request:', error);
      
      // Remove failed optimistic request (same as KioskPage)
      setOptimisticRequests(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });
      
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
  }, [reconnectRequests]);

  // 🚀 SIMPLIFIED: Remove optimistic vote states causing processing loops
  const handleVoteRequest = useCallback(async (id: string): Promise<boolean> => {
    return handleUserVote(id, false); // false = not kiosk user
  }, []);

  // Kiosk vote handler (unlimited votes)
  const handleKioskVote = useCallback(async (id: string): Promise<boolean> => {
    return handleUserVote(id, true); // true = kiosk user
  }, []);

  // 🚀 FIXED: Direct vote handler without atomic functions 
  const handleUserVote = useCallback(async (id: string, isKioskUser: boolean): Promise<boolean> => {
    console.log('👍 DIRECT VOTE for request:', id, 'User type:', isKioskUser ? 'kiosk' : 'logged-in');
    console.log('👤 Current user:', currentUser);
    
    if (!isOnline) {
      toast.error('Cannot vote while offline. Please check your internet connection.');
      return false;
    }
    
    try {
      // For kiosk users, we don't need login check
      if (!isKioskUser && !currentUser) {
        console.error('❌ No current user for logged-in vote');
        toast.error('Please set up your profile first');
        return false;
      }

      // Don't allow voting on temporary requests
      if (id.startsWith('temp_')) {
        toast.error('Please wait for the request to be processed before voting');
        return false;
      }

      let success = false;

      if (isKioskUser) {
        // Kiosk users: Direct increment without user tracking
        console.log('🏪 Kiosk vote - direct database increment');
        
        const currentRequest = requests.find(r => r.id === id);
        const newVoteCount = (currentRequest?.votes || 0) + 1;
        
        const { error } = await supabase
          .from('requests')
          .update({ 
            votes: newVoteCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) {
          console.error('❌ Kiosk vote failed:', error);
          throw error;
        }
        success = true;
        console.log('✅ Kiosk vote successful');
      } else {
        // Logged-in users: Direct database operations without atomic functions
        console.log('🔄 Logged-in user vote - checking existing votes...');
        const userId = currentUser!.id || currentUser!.name;
        
        try {
          // Try to check user_votes table first
          const { data: existingVote, error: voteCheckError } = await supabase
            .from('user_votes')
            .select('id')
            .eq('request_id', id)
            .eq('user_id', userId)
            .maybeSingle();

          if (voteCheckError && voteCheckError.code !== 'PGRST116') {
            console.warn('user_votes table access failed:', voteCheckError);
            // Table might not exist, proceed with direct increment
          }

          if (existingVote) {
            console.log('❌ User already voted');
            success = false;
          } else {
            // Increment vote count directly
            console.log('📊 Adding vote directly...');
            const currentRequest = requests.find(r => r.id === id);
            const newVoteCount = (currentRequest?.votes || 0) + 1;
            
            const { error: updateError } = await supabase
              .from('requests')
              .update({ 
                votes: newVoteCount,
                updated_at: new Date().toISOString()
              })
              .eq('id', id);

            if (updateError) {
              console.error('❌ Vote update failed:', updateError);
              throw updateError;
            }

            // Try to insert vote record if table exists
            try {
              const { error: insertError } = await supabase
                .from('user_votes')
                .insert({
                  request_id: id,
                  user_id: userId,
                  created_at: new Date().toISOString()
                });

              if (insertError) {
                console.warn('user_votes insert failed (table might not exist):', insertError);
                // This is okay - we still incremented the vote count
              }
            } catch (insertError) {
              console.warn('user_votes insert error (continuing anyway):', insertError);
            }

            success = true;
            console.log('✅ Logged-in vote successful');
          }
        } catch (fallbackError) {
          console.error('❌ Vote process failed:', fallbackError);
          throw fallbackError;
        }
      }

      if (success) {
        console.log('✅ Vote successful - real-time subscription will update UI instantly');
        toast.success(isKioskUser ? '🔥 Vote added!' : 'Vote added!');
        return true;
      } else {
        console.log('❌ Vote rejected - already voted');
        toast.error('You have already voted for this request');
        return false;
      }
    } catch (error) {
      console.error('❌ Error voting for request:', error);
      
      if (error instanceof Error && (
        error.message.includes('Failed to fetch') || 
        error.message.includes('NetworkError') ||
        error.message.includes('network'))
      ) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Failed to vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      return false;
    }
  }, [currentUser, isOnline, requests]);

  // 🚀 FIXED: Lock handler without atomic functions (they don't exist)
  const handleLockRequest = useCallback(async (id: string) => {
    console.log('🔒 DIRECT LOCK: Toggling lock for request:', id);
    
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return;
    }
    
    try {
      const requestToUpdate = mergedRequests.find(r => r.id === id);
      if (!requestToUpdate) {
        console.error('Request not found:', id);
        return;
      }
      
      // Toggle the locked status
      const newLockedState = !requestToUpdate.isLocked;
      console.log(`🎯 DIRECT LOCK: Setting lock state to: ${newLockedState} for "${requestToUpdate.title}"`);
      
      // Direct database update without atomic functions
      if (newLockedState) {
        // When locking, unlock all others first, then lock this one
        console.log('🔄 DIRECT: Unlocking all requests first...');
        await supabase
          .from('requests')
          .update({ 
            is_locked: false,
            updated_at: new Date().toISOString()
          })
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        console.log('🔄 DIRECT: Locking target request...');
        const { error: lockError } = await supabase
          .from('requests')
          .update({ 
            is_locked: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (lockError) throw lockError;
      } else {
        // When unlocking, just unlock this one
        console.log('🔄 DIRECT: Unlocking request...');
        const { error: unlockError } = await supabase
          .from('requests')
          .update({ 
            is_locked: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (unlockError) throw unlockError;
      }
      
      // Show success message immediately
      if (newLockedState) {
        toast.success(`🔒 "${requestToUpdate.title}" locked as next up!`);
        console.log('🎯 TICKER UPDATE: Song locked - real-time will update ticker instantly across all users');
      } else {
        toast.success(`🔓 "${requestToUpdate.title}" unlocked`);
        console.log('🎯 TICKER UPDATE: Song unlocked - real-time will clear ticker instantly across all users');
      }
      
      console.log('✅ DIRECT LOCK: Lock state updated - real-time subscription will handle UI updates');
      
    } catch (error) {
      console.error('❌ Error toggling request lock:', error);
      toast.error(`Failed to update request: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Force a refresh only on error
      reconnectRequests();
    }
  }, [mergedRequests, isOnline, reconnectRequests]);

  // 🚀 CRITICAL FIX: Enhanced mark as played with immediate persistence
  const handleMarkPlayed = useCallback(async (id: string) => {
    console.log('✅ Marking request as played:', id);
    
    if (!isOnline) {
      toast.error('Cannot update requests while offline. Please check your internet connection.');
      return;
    }
    
    try {
      console.log('🎯 Updating request in database...');
      
      // Use a more explicit update to ensure it persists
      const { data, error } = await supabase
        .from('requests')
        .update({ 
          is_played: true,
          is_locked: false,
          status: 'played',
          updated_at: new Date().toISOString() // Add timestamp to ensure update is registered
        })
        .eq('id', id)
        .select(); // Return the updated record to verify

      if (error) {
        console.error('❌ Database update failed:', error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log('✅ Request marked as played in database:', data[0]);
        console.log('Database confirms is_played =', data[0].is_played);
        
        // Force immediate refresh to ensure UI reflects the change
        setTimeout(() => {
          console.log('🔄 Forcing immediate refresh after marking played...');
          reconnectRequests();
        }, 100);
        
        toast.success('Request marked as played!');
      } else {
        console.warn('⚠️ Update succeeded but no data returned');
        throw new Error('No data returned from update');
      }

    } catch (error) {
      console.error('❌ Error marking request as played:', error);
      toast.error('Failed to update request. Please try again.');
      
      // Force a refresh to get the current state
      reconnectRequests();
    }
  }, [isOnline, reconnectRequests]);

  // 🚀 INSTANT CLEAR: Handle resetting the request queue with immediate global updates
  const handleResetQueue = useCallback(async () => {
    console.log('🗑️ INSTANT CLEAR: Resetting request queue for ALL users');
    
    if (!isOnline) {
      toast.error('Cannot reset queue while offline. Please check your internet connection.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to clear all requests? This cannot be undone.')) {
      return;
    }

    try {
      console.log('🚨 EXECUTING INSTANT CLEAR - this will trigger real-time updates for all users');
      
      // Delete all requests - this will trigger real-time DELETE events for all users
      const { error } = await supabase
        .from('requests')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
      
      // Clear local optimistic requests immediately
      setOptimisticRequests(new Map());
      
      console.log('✅ INSTANT CLEAR executed - real-time subscriptions will update all users instantly');
      toast.success('🗑️ Queue cleared for all users!');
      
      // The real-time subscription will handle updating the UI for all users
      // No manual refresh needed - DELETE events will trigger instant updates
      
    } catch (error) {
      console.error('❌ Error clearing queue:', error);
      toast.error('Failed to clear queue. Please try again.');
      
      // Force refresh on error
      reconnectRequests();
    }
  }, [isOnline, reconnectRequests]);

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
          requests={mergedRequests}
          activeSetList={activeSetList}
          onSubmitRequest={handleSubmitRequest}
          onVoteRequest={handleKioskVote}
          logoUrl={settings?.band_logo_url || DEFAULT_BAND_LOGO}
        />
      </ErrorBoundary>
    );
  }

  // Show backend if accessing /backend and authenticated
  if (isBackend && isAdmin) {
    const lockedRequest = mergedRequests.find(r => r.isLocked && !r.isPlayed);
    console.log('🎯 Backend: Looking for locked request...', {
      totalRequests: mergedRequests.length,
      lockedRequest: lockedRequest ? {
        id: lockedRequest.id,
        title: lockedRequest.title,
        artist: lockedRequest.artist,
        isLocked: lockedRequest.isLocked,
        isPlayed: lockedRequest.isPlayed
      } : null
    });
    
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
        lockedRequest={frontendLockedRequest} // Pass locked request for ticker
      />
    </ErrorBoundary>
  );
}

export default App;