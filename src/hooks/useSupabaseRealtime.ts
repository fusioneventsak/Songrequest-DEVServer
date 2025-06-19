import { useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

type TableName = 'songs' | 'set_lists' | 'set_list_songs' | 'requests' | 'requesters';

interface UseSupabaseRealtimeProps {
  table: TableName;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  filter?: {
    column: string;
    value: any;
  };
}

export function useSupabaseRealtime({
  table,
  onInsert,
  onUpdate,
  onDelete,
  filter,
}: UseSupabaseRealtimeProps) {
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupRealtime = async () => {
      // Create a unique channel name that includes any filters
      const channelName = filter 
        ? `public:${table}:${filter.column}:${filter.value}`
        : `public:${table}`;

      // Configure the filter for the subscription
      const filterConfig = filter
        ? { event: '*', schema: 'public', table, filter: `${filter.column}=eq.${filter.value}` }
        : { event: '*', schema: 'public', table };

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { ...filterConfig, event: 'INSERT' },
          (payload) => {
            console.log(`${table} INSERT:`, payload.new);
            onInsert?.(payload.new);
          }
        )
        .on(
          'postgres_changes',
          { ...filterConfig, event: 'UPDATE' },
          (payload) => {
            console.log(`${table} UPDATE:`, payload.new);
            onUpdate?.(payload.new);
          }
        )
        .on(
          'postgres_changes',
          { ...filterConfig, event: 'DELETE' },
          (payload) => {
            console.log(`${table} DELETE:`, payload.old);
            onDelete?.(payload.old);
          }
        );

      const { error } = await channel.subscribe((status) => {
        console.log(`Subscription status for ${table}:`, status);
      });

      if (error) {
        console.error(`Error subscribing to ${table}:`, error);
      } else {
        console.log(`Subscribed to ${table} changes`);
      }
    };

    setupRealtime();

    return () => {
      if (channel) {
        console.log(`Cleaning up ${table} subscription`);
        supabase.removeChannel(channel);
      }
    };
  }, [table, onInsert, onUpdate, onDelete, filter]);
}