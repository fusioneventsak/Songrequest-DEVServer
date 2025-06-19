import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

// Create a Supabase client with the service role key
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Get the current spin cap usage from Supabase
    // This is a simplified example - in a real implementation, you would
    // query Supabase's internal metrics or use a custom tracking mechanism
    
    // For this example, we'll simulate usage based on connection logs
    const { data: connectionLogs, error: logsError } = await supabase
      .from('realtime_connection_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (logsError) {
      throw logsError
    }
    
    // Calculate a simulated usage metric (0-1 range)
    // In a real implementation, you would use actual metrics from Supabase
    const totalConnections = connectionLogs.length
    const recentConnections = connectionLogs.filter(
      log => new Date(log.created_at) > new Date(Date.now() - 5 * 60 * 1000)
    ).length
    
    // Calculate a usage value between 0-1 based on recent connections
    // This is just a simulation - real implementation would use actual metrics
    const usage = Math.min(recentConnections / 50, 1)
    
    return new Response(
      JSON.stringify({
        usage,
        totalConnections,
        recentConnections,
        timestamp: new Date().toISOString()
      }),
      { headers }
    )
  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers }
    )
  }
})