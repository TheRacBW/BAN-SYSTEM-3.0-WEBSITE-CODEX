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
const BEDWARS_UNIVERSE_ID = 2619619496; // Correct universe ID
const BEDWARS_PLACE_ID = 6872265039; // Place ID

// CRITICAL: Use the exact same headers that work in your localhost tool
const getWorkingHeaders = (cookie: string) => ({
  'Content-Type': 'application/json',
  'Cookie': `.ROBLOSECURITY=${cookie}`,
  'User-Agent': 'Roblox/WinInet', // Changed from 'RobloxPresenceChecker/1.0'
  'Referer': 'https://www.roblox.com/', // CRITICAL: This was missing!
  'Accept': 'application/json'
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Starting FIXED roblox-status function')
    
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

    // Get cookie from environment variable OR database
    let robloxCookie = Deno.env.get('ROBLOX_COOKIE')
    
    if (!robloxCookie) {
      console.log('🔍 No env cookie, checking database...')
      const { data: settings } = await supabaseClient
        .from('roblox_settings')
        .select('cookie')
        .eq('id', 'global')
        .single()
      
      robloxCookie = settings?.cookie
    }

    if (!robloxCookie) {
      console.error('❌ No Roblox cookie available (checked env and database)')
      return new Response(
        JSON.stringify({ error: 'No Roblox cookie configured. Please set ROBLOX_COOKIE environment variable or use the admin panel.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log('🍪 Cookie source:', Deno.env.get('ROBLOX_COOKIE') ? 'environment' : 'database')
    console.log('🍪 Cookie length:', robloxCookie.length)
    console.log('🍪 Cookie format valid:', robloxCookie.startsWith('_|WARNING:'))

    // Get accounts from database  
    const { data: accounts, error: accountsError } = await supabaseClient
      .from('player_accounts')  // Correct table name from your schema
      .select('user_id')

    if (accountsError) {
      console.error('❌ Database error:', accountsError)
      throw new Error(`Database error: ${accountsError.message}`)
    }

    if (!accounts || accounts.length === 0) {
      console.log('📭 No accounts found in database')
      return new Response(
        JSON.stringify({ message: 'No accounts to check' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Convert user IDs to numbers
    const userIds = accounts.map(account => {
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
        JSON.stringify({ message: 'No valid user IDs to check' }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log('🌐 Making request to Roblox presence API with WORKING headers...')
    console.log('📊 Request details:', {
      url: 'https://presence.roblox.com/v1/presence/users',
      method: 'POST',
      userIdsCount: userIds.length,
      firstFewIds: userIds.slice(0, 5),
      headers: 'Using exact same headers as localhost tool'
    })

    // Use the EXACT same request that works in your localhost tool
    const robloxResponse = await fetch('https://presence.roblox.com/v1/presence/users', {
      method: 'POST',
      headers: getWorkingHeaders(robloxCookie),
      body: JSON.stringify({ userIds: userIds }),
    })

    console.log('📨 Roblox API Response:', {
      ok: robloxResponse.ok,
      status: robloxResponse.status,
      statusText: robloxResponse.statusText,
      headers: Object.fromEntries(robloxResponse.headers.entries())
    })

    if (!robloxResponse.ok) {
      const errorText = await robloxResponse.text()
      console.error('❌ Roblox API Error Response:', errorText)
      throw new Error(`Roblox API error: ${robloxResponse.status} ${robloxResponse.statusText} - ${errorText}`)
    }

    const presenceData: RobloxPresenceResponse = await robloxResponse.json()
    console.log('📊 Raw presence data sample:', JSON.stringify(presenceData.userPresences?.slice(0, 2), null, 2))

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
      
      // Enhanced BedWars detection with fallback
      let inBedwars = false
      let universeId = presence.universeId

      if (isInGame) {
        // Primary check: universe ID
        if (presence.universeId === BEDWARS_UNIVERSE_ID) {
          inBedwars = true
        }
        // Fallback check: place ID (in case universe ID is null)
        else if (presence.placeId === BEDWARS_PLACE_ID || presence.rootPlaceId === BEDWARS_PLACE_ID) {
          inBedwars = true
          // If we know it's BedWars from place ID but universe ID is null, set it
          if (!universeId) {
            universeId = BEDWARS_UNIVERSE_ID
            console.log(`🔧 Fixed null universeId for user ${account.user_id} using place ID`)
          }
        }
        // Additional fallback: check last location
        else if (presence.lastLocation && presence.lastLocation.toLowerCase().includes('bedwars')) {
          inBedwars = true
          if (!universeId) {
            universeId = BEDWARS_UNIVERSE_ID
            console.log(`🔧 Fixed null universeId for user ${account.user_id} using lastLocation`)
          }
        }
      }

      console.log(`✅ User ${account.user_id}:`, {
        presenceType: presence.userPresenceType,
        universeId: universeId,
        originalUniverseId: presence.universeId,
        placeId: presence.placeId,
        inBedwars,
        lastLocation: presence.lastLocation
      })

      userStatuses.push({
        userId: account.user_id,
        username: account.user_id.toString(),
        isOnline,
        isInGame,
        inBedwars,
        userPresenceType: presence.userPresenceType,
        placeId: presence.placeId || null,
        rootPlaceId: presence.rootPlaceId || null,
        universeId: universeId || null,
        lastUpdated: Date.now(),
        presenceMethod: 'direct'
      })
    }

    // Update database with results using proper UPSERT
    console.log('💾 About to upsert', userStatuses.length, 'status records')
    for (const status of userStatuses) {
      console.log(`📝 Upserting status for user ${status.userId}`)
      
      const { error } = await supabaseClient
        .from('user_status')
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
        }, {
          onConflict: 'user_id'
        })

      if (error) {
        console.error(`❌ Failed to update user ${status.userId}:`, error)
      } else {
        console.log(`✅ Successfully updated user ${status.userId}`)
      }
    }

    console.log('🎉 Function completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        processed: userStatuses.length,
        timestamp: new Date().toISOString(),
        summary: {
          online: userStatuses.filter(s => s.isOnline).length,
          inGame: userStatuses.filter(s => s.isInGame).length,
          inBedwars: userStatuses.filter(s => s.inBedwars).length
        },
        cookieSource: Deno.env.get('ROBLOX_COOKIE') ? 'environment' : 'database'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('💥 Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
