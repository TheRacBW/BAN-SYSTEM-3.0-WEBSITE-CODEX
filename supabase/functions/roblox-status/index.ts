/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserPresence {
  userPresenceType: number;
  lastLocation?: string;
  placeId?: number;
  rootPlaceId?: number;
  universeId?: number;
  userId: number;
  lastOnline?: string;
}

interface RobloxPresenceResponse {
  userPresences: UserPresence[];
}

interface UserStatus {
  userId: number;
  username: string;
  isOnline: boolean;
  isInGame: boolean;
  inBedwars: boolean;
  userPresenceType: number | null;
  placeId: number | null;
  rootPlaceId: number | null;
  universeId: number | null;
  lastUpdated: number;
  presenceMethod: 'direct';
}

// Constants
const BEDWARS_UNIVERSE_ID = 6872265039; // Updated to correct BedWars universe ID

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting roblox-status function')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify we're using the right key
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    console.log('🔑 Using service role key:', serviceKey ? 'YES' : 'NO')
    console.log('🔑 Service key length:', serviceKey?.length || 0)
    console.log('🔑 Anon key length:', anonKey?.length || 0)

    // Get the cookie from environment
    const robloxCookie = Deno.env.get('ROBLOX_COOKIE')
    if (!robloxCookie) {
      console.error('❌ ROBLOX_COOKIE environment variable not set')
      throw new Error('ROBLOX_COOKIE environment variable not set')
    }

    // First, let's try a simple count to see if we can access the table at all
    console.log('🔍 Querying player_accounts table...')
    const { count, error: countError } = await supabaseClient
      .from('player_accounts')
      .select('*', { count: 'exact', head: true })

    console.log('📊 Table access check:', { count, countError })

    // Now get the actual data with explicit casting
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('player_accounts')
      .select('user_id')
      .not('user_id', 'is', null)

    console.log('🔍 Accounts query result:', { accounts, accountsError })
    console.log('📊 Number of accounts found:', accounts?.length || 0)

    if (accounts && accounts.length > 0) {
      console.log('👥 First few account user_ids:', accounts.slice(0, 3).map(a => a.user_id))
      console.log('🔢 Data types:', accounts.slice(0, 3).map(a => ({ 
        user_id: a.user_id, 
        type: typeof a.user_id 
      })))
    }

    if (accountsError) {
      console.error('❌ Database error:', accountsError)
      throw new Error(`Database query failed: ${accountsError.message}`)
    }

    if (!accounts || accounts.length === 0) {
      console.log('⚠️ No accounts found in database')
      return new Response(
        JSON.stringify({ message: 'No accounts found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Also let's make sure we handle the numeric type properly
    const userIds = accounts.map(account => {
      // Convert to number if it's a string, or keep as number
      const userId = typeof account.user_id === 'string' 
        ? parseInt(account.user_id, 10) 
        : account.user_id
      
      console.log(`🔄 Processing user_id: ${account.user_id} -> ${userId} (${typeof userId})`)
      return userId
    }).filter(id => !isNaN(id) && id > 0)

    console.log('🎯 User IDs to check:', userIds)
    console.log('📝 User IDs array length:', userIds.length)

    if (userIds.length === 0) {
      console.log('⚠️ No valid user IDs found - exiting early')
      return new Response(
        JSON.stringify({ message: 'No user IDs to check' }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Make request to Roblox API using POST with JSON body
    console.log('🌐 Making request to Roblox presence API...')
    const robloxResponse = await fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `.ROBLOSECURITY=${robloxCookie}`,
        'User-Agent': 'RobloxPresenceChecker/1.0',
      },
      body: JSON.stringify({ userIds: userIds }),
    })

    console.log('🌐 Roblox API response status:', robloxResponse.status)

    if (!robloxResponse.ok) {
      const errorText = await robloxResponse.text()
      console.error('❌ Roblox API error:', robloxResponse.status, errorText)
      throw new Error(`Roblox API error: ${robloxResponse.status} - ${errorText}`)
    }

    const presenceData: RobloxPresenceResponse = await robloxResponse.json()
    console.log('📄 Roblox API response data:', JSON.stringify(presenceData, null, 2))

    // Process the results
    const userStatuses: UserStatus[] = []
    console.log('🔄 Processing', accounts.length, 'accounts')

    for (const account of accounts) {
      console.log('👤 Processing account:', account.user_id)
      const presence = presenceData.userPresences.find(p => p.userId === account.user_id)
      
      if (!presence) {
        console.log(`⚠️ No presence data for user ${account.user_id}`)
        // User not found in response - treat as offline
        userStatuses.push({
          userId: account.user_id,
          username: account.user_id.toString(),
          isOnline: false,
          isInGame: false,
          inBedwars: false,
          userPresenceType: null,
          placeId: null,
          rootPlaceId: null,
          universeId: null,
          lastUpdated: Date.now(),
          presenceMethod: 'direct'
        })
        continue
      }

      // Determine status based on presence type
      const isOnline = presence.userPresenceType !== 0
      const isInGame = presence.userPresenceType === 2
      const inBedwars = isInGame && presence.universeId === BEDWARS_UNIVERSE_ID

      console.log(`✅ User ${account.user_id}: presenceType=${presence.userPresenceType}, universeId=${presence.universeId}, inBedwars=${inBedwars}`)

      userStatuses.push({
        userId: account.user_id,
        username: account.user_id.toString(),
        isOnline,
        isInGame,
        inBedwars,
        userPresenceType: presence.userPresenceType,
        placeId: presence.placeId || null,
        rootPlaceId: presence.rootPlaceId || null,
        universeId: presence.universeId || null,
        lastUpdated: Date.now(),
        presenceMethod: 'direct'
      })
    }

    // Update database with results
    console.log('💾 About to upsert', userStatuses.length, 'status records')
    for (const status of userStatuses) {
      console.log(`📝 Upserting status for user ${status.userId}`)
      const { error: updateError } = await supabaseClient
        .from('roblox_user_status')
        .upsert({
          user_id: status.userId,
          username: status.username,
          is_online: status.isOnline,
          is_in_game: status.isInGame,
          in_bedwars: status.inBedwars,
          user_presence_type: status.userPresenceType,
          place_id: status.placeId,
          root_place_id: status.rootPlaceId,
          universe_id: status.universeId,
          last_updated: new Date(status.lastUpdated).toISOString(),
          presence_method: status.presenceMethod
        })

      if (updateError) {
        console.error(`❌ Failed to update status for user ${status.userId}:`, updateError)
      } else {
        console.log(`✅ Successfully updated status for user ${status.userId}`)
      }
    }

    console.log(`🎉 Successfully processed ${userStatuses.length} users`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: userStatuses.length,
        statuses: userStatuses 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in roblox-status function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
