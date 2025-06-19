import { supabase } from './supabase';
import { nanoid } from 'nanoid';

// Connection state tracking
let connectionState = 'disconnected';
let isConnecting = false;
let activeConnectionCount = 0;
const activeChannels = new Map();
const connectionListeners = new Set();
const updateTimeouts = new Map();
const MAX_CONNECTIONS = 5; // Maximum number of concurrent connections

// Client identifier
const CLIENT_ID = nanoid(8);

// Debug flag for production environment
const IS_PRODUCTION = window.location.hostname !== 'localhost' && 
                      !window.location.hostname.includes('stackblitz') &&
                      !window.location.hostname.includes('127.0.0.1');

// Connection management
export const RealtimeManager = {
  /**
   * Get current connection state
   */
  getConnectionState: () => {
    return connectionState;
  },

  /**
   * Check if currently connected
   */
  isConnected: () => {
    return supabase.realtime.isConnected();
  },

  /**
   * Initialize realtime connection
   */
  init: async () => {
    if (isConnecting || RealtimeManager.isConnected()) {
      console.log('Realtime already connected or connecting, skipping initialization');
      return;
    }
    
    // Check if we've reached the maximum number of connections
    if (activeConnectionCount >= MAX_CONNECTIONS) {
      console.warn(`Maximum number of connections (${MAX_CONNECTIONS}) reached. Closing oldest connection.`);
      
      // Close the oldest channel
      const oldestChannelId = Array.from(activeChannels.keys())[0];
      if (oldestChannelId) {
        await RealtimeManager.removeSubscription(oldestChannelId);
      }
    }
    
    isConnecting = true;
    updateConnectionState('connecting');
    
    try {
      console.log('Initializing realtime connection...');
      await supabase.realtime.connect();
      
      // Check connection status after connect() call
      if (RealtimeManager.isConnected()) {
        console.log('✅ Realtime connection established successfully');
        updateConnectionState('connected');
        activeConnectionCount++;
        
        // Log successful connection
        try {
          await supabase
            .from('realtime_connection_logs')
            .insert({
              status: 'connected',
              client_id: CLIENT_ID,
              created_at: new Date().toISOString()
            });
          console.log('Connection logged successfully');
        } catch (logError) {
          console.warn('Failed to log connection:', logError);
        }
      } else {
        console.warn('❌ Failed to establish realtime connection');
        updateConnectionState('disconnected');
        
        // Log connection failure
        try {
          await supabase
            .from('realtime_connection_logs')
            .insert({
              status: 'disconnected',
              client_id: CLIENT_ID,
              error_message: 'Failed to establish connection',
              created_at: new Date().toISOString()
            });
        } catch (logError) {
          console.warn('Failed to log connection failure:', logError);
        }
      }
      
      // Set a timeout to verify connection status after a delay
      setTimeout(() => {
        if (connectionState === 'connecting') {
          console.warn('Connection timeout - still in connecting state');
          updateConnectionState('disconnected');
        }
      }, 10000); // 10 second timeout
    } catch (error) {
      console.error('Error connecting to realtime:', error);
      updateConnectionState('error', error instanceof Error ? error : new Error(String(error)));
      
      // Log connection error
      try {
        await supabase
          .from('realtime_connection_logs')
          .insert({
            status: 'error',
            client_id: CLIENT_ID,
            error_message: error instanceof Error ? error.message : String(error),
            created_at: new Date().toISOString()
          });
      } catch (logError) {
        console.warn('Failed to log connection error:', logError);
      }
    } finally {
      isConnecting = false;
    }
  },

  /**
   * Create a subscription to a table with optimized event handling
   */
  createSubscription: (table, callback, filter) => {
    // Generate a unique channel ID
    const channelId = `${table}_${nanoid(6)}`;
    
    try {
      console.log(`Creating subscription for ${table}`, filter || 'no filter');
      // Create channel with optimized config
      const channel = supabase.channel(channelId, {
        config: {
          presence: { key: CLIENT_ID },
          broadcast: { self: false, ack: true },
          transport: { method: 'websocket' },
          // Reduce event frequency to prevent overwhelming clients
          params: { eventsPerSecond: 8 }
        }
      });
      
      // Configure channel
      channel.on(
        // Use postgres_changes for database events
        'postgres_changes',
        filter || { event: '*', schema: 'public', table },
        (payload) => {
          try {
            // More detailed logging in production to help debug issues
            if (IS_PRODUCTION) {
              console.log(`🔔 ${table} table changed:`, {
                eventType: payload.eventType,
                table: payload.table,
                schema: payload.schema,
                hasNew: !!payload.new,
                hasOld: !!payload.old,
                timestamp: new Date().toISOString()
              });
            } else {
              console.log(`🔔 ${table} table changed:`, payload.eventType);
            }
            
            // Debounce rapid updates to reduce processing overhead
            clearTimeout(updateTimeouts.get(channelId));
            updateTimeouts.set(channelId, setTimeout(() => {
              callback(payload);
            }, 50)); // 50ms debounce
          } catch (error) {
            console.error(`Error in subscription callback (${channelId}):`, error);
          }
        }
      )
      // Add error handling for channel
      .on('error', (error) => {
        console.error(`Channel ${channelId} error:`, error);
      })
      .subscribe((status) => {
        console.log(`Channel ${channelId} status:`, status);
      });
      
      // Store channel
      activeChannels.set(channelId, { channel, table });
      
      return channelId;
    } catch (error) {
      console.error(`Error creating subscription to ${table}:`, error);
      throw error;
    }
  },

  /**
   * Remove a subscription
   */
  removeSubscription: async (channelId) => {
    const channelInfo = activeChannels.get(channelId);
    if (!channelInfo) return;
    
    try {
      console.log(`Removing subscription ${channelId}`);
      await channelInfo.channel.unsubscribe();
      supabase.removeChannel(channelInfo.channel);
      activeChannels.delete(channelId);
      
      // Clear any pending timeouts for this channel
      clearTimeout(updateTimeouts.get(channelId));
      updateTimeouts.delete(channelId);
      
      // Decrement active connection count
      activeConnectionCount = Math.max(0, activeConnectionCount - 1);
    } catch (error) {
      console.warn(`Error removing subscription ${channelId}:`, error);
    }
  },

  /**
   * Add a connection listener
   */
  addConnectionListener: (listener) => {
    connectionListeners.add(listener);
    
    // Return current state immediately
    listener(connectionState);
  },

  /**
   * Remove a connection listener
   */
  removeConnectionListener: (listener) => {
    connectionListeners.delete(listener);
  },

  /**
   * Force reconnection
   */
  reconnect: async () => {
    console.log('🔄 Manual reconnection requested');
    // Log reconnection attempt
    try {
      await supabase
        .from('realtime_connection_logs')
        .insert({
          status: 'disconnected',
          client_id: CLIENT_ID,
          error_message: 'Manual reconnection requested',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to log reconnection attempt:', error);
    }
    
    // Close all existing channels
    console.log(`Closing ${activeChannels.size} active channels before reconnection`);
    for (const [id, info] of activeChannels.entries()) {
      try {
        await info.channel.unsubscribe();
        supabase.removeChannel(info.channel);
        
        // Clear any pending timeouts
        clearTimeout(updateTimeouts.get(id));
        updateTimeouts.delete(id);
      } catch (error) {
        console.warn(`Error closing channel ${id}:`, error);
      }
    }
    
    activeChannels.clear();
    // Reset active connection count
    activeConnectionCount = 0;
    updateTimeouts.clear();
    
    // Reconnect
    return RealtimeManager.init();
  },

  /**
   * Clean up all subscriptions
   */
  cleanup: async () => {
    console.log(`Cleaning up ${activeChannels.size} active channels`);
    // Close all channels
    for (const [id, info] of activeChannels.entries()) {
      try {
        await info.channel.unsubscribe();
        supabase.removeChannel(info.channel);
        
        // Clear any pending timeouts
        clearTimeout(updateTimeouts.get(id));
        updateTimeouts.delete(id);
      } catch (error) {
        console.warn(`Error closing channel ${id}:`, error);
      }
    }
    
    activeChannels.clear();
    connectionListeners.clear();
    activeConnectionCount = 0;
    
    // Log disconnection
    try {
      await supabase
        .from('realtime_connection_logs')
        .insert({
          status: 'disconnected',
          client_id: CLIENT_ID,
          error_message: 'Client disconnected',
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('Failed to log disconnection:', error);
    }
  },
  
  /**
   * Get active connection stats
   */
  getStats: () => {
    return {
      activeConnections: activeConnectionCount,
      activeChannels: activeChannels.size
    };
  }
};

// Update connection state and notify listeners
function updateConnectionState(state, error = null) {
  connectionState = state;
  
  // Notify all listeners
  for (const listener of connectionListeners) {
    try {
      listener(state, error);
    } catch (listenerError) {
      console.error('Error in connection listener:', listenerError);
    }
  }
}

// Setup automatic reconnection when tab becomes visible
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !RealtimeManager.isConnected()) {
      console.log('Document became visible, reconnecting...');
      RealtimeManager.init();
    }
  });
}

// Setup automatic reconnection when network comes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network came online, reconnecting...');
    RealtimeManager.init();
  });
}