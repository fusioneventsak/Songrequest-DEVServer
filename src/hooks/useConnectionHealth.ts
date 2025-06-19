import { useState, useEffect, useRef } from 'react';
import { RealtimeManager } from '../utils/realtimeManager';

// Connection health thresholds
const POOR_CONNECTION_THRESHOLD = 8000; // 8 seconds
const RECONNECT_THRESHOLD = 12000; // 12 seconds
const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds

/**
 * Custom hook to monitor connection health and auto-reconnect when needed
 */
export function useConnectionHealth() {
  const [status, setStatus] = useState<'good' | 'poor' | 'disconnected'>('good');
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const [spinCapUsage, setSpinCapUsage] = useState<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const healthCheckIntervalRef = useRef<number | null>(null);
  
  // Update the ref whenever the state changes
  useEffect(() => {
    lastUpdateTimeRef.current = lastUpdateTime;
  }, [lastUpdateTime]);
  
  // Register data update
  const registerUpdate = () => {
    const now = Date.now();
    setLastUpdateTime(now);
    lastUpdateTimeRef.current = now;
    setStatus('good');
  };
  
  // Monitor connection health
  useEffect(() => {
    const healthCheck = () => {
      const now = Date.now();
      const lastUpdate = lastUpdateTimeRef.current;
      
      if (now - lastUpdate > POOR_CONNECTION_THRESHOLD) {
        setStatus('poor');
        
        // Auto-reconnect if no updates for threshold duration
        if (now - lastUpdate > RECONNECT_THRESHOLD) {
          console.warn('🔄 No updates received for 15 seconds, attempting reconnection');
          RealtimeManager.reconnect();
          setReconnectAttempts(prev => prev + 1);
        }
      } else {
        setStatus('good');
      }
    };
    
    // Set up interval for health checks
    healthCheckIntervalRef.current = window.setInterval(healthCheck, HEALTH_CHECK_INTERVAL);
    
    // Listen for connection state changes
    const handleConnectionChange = (state: string) => {
      console.log(`Connection state changed to: ${state}`);
      if (state === 'connected') {
        setStatus('good');
      } else if (state === 'disconnected') {
        setStatus('disconnected');
      } else if (state === 'error') {
        setStatus('poor');
      }
    };
    
    RealtimeManager.addConnectionListener(handleConnectionChange);
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      RealtimeManager.removeConnectionListener(handleConnectionChange);
    };
  }, []);
  
  // Monitor Supabase Spin Cap usage
  useEffect(() => {
    // Function to check spin cap usage
    const checkSpinCapUsage = async () => {
      try {
        const { data, error } = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/get_spin_cap_usage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          }
        }).then(res => res.json());
        
        if (error) {
          console.error('Error fetching spin cap usage:', error);
          return;
        }
        
        if (data && typeof data.usage === 'number') {
          setSpinCapUsage(data.usage);
          
          // If we're approaching the limit, reduce polling frequency
          if (data.usage > 0.8) { // 80% of cap
            console.warn(`Spin cap usage high (${Math.round(data.usage * 100)}%). Reducing polling frequency.`);
            
            // Adjust health check interval
            if (healthCheckIntervalRef.current) {
              clearInterval(healthCheckIntervalRef.current);
              healthCheckIntervalRef.current = window.setInterval(() => {
                const now = Date.now();
                const lastUpdate = lastUpdateTimeRef.current;
                
                // Only check for severe disconnections
                if (now - lastUpdate > RECONNECT_THRESHOLD * 2) {
                  RealtimeManager.reconnect();
                }
              }, HEALTH_CHECK_INTERVAL * 3); // Triple the interval
            }
          }
        }
      } catch (err) {
        console.error('Error checking spin cap usage:', err);
      }
    };
    
    // Check spin cap usage every 5 minutes
    const spinCapInterval = setInterval(checkSpinCapUsage, 5 * 60 * 1000);
    
    // Initial check
    checkSpinCapUsage();
    
    return () => {
      clearInterval(spinCapInterval);
    };
  }, []);
  
  return {
    status,
    lastUpdateTime,
    reconnectAttempts,
    spinCapUsage,
    registerUpdate,
    reconnect: RealtimeManager.reconnect
  };
}