import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RobloxUserResponse {
  success: boolean;
  user?: {
    userId: number;
    username: string;
    avatarUrl: string;
    displayName: string;
  };
  cached?: boolean;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, includeDetails = false } = await req.json()

    if (!username) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Username is required'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Fetch user data from Roblox API
    const userResponse = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(username)}&limit=1`)
    
    if (!userResponse.ok) {
      throw new Error(`Roblox API error: ${userResponse.status}`)
    }

    const userData = await userResponse.json()
    
    if (!userData.data || userData.data.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User not found'
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const user = userData.data[0]
    
    // Get avatar URL
    const avatarResponse = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${user.id}&size=150x150&format=Png&isCircular=false`)
    
    if (!avatarResponse.ok) {
      throw new Error(`Avatar API error: ${avatarResponse.status}`)
    }

    const avatarData = await avatarResponse.json()
    const avatarUrl = avatarData.data?.[0]?.imageUrl || 'https://www.roblox.com/headshot-thumbnail/image?userId=' + user.id + '&width=150&height=150'

    const response: RobloxUserResponse = {
      success: true,
      user: {
        userId: user.id,
        username: user.name,
        avatarUrl: avatarUrl,
        displayName: user.displayName || user.name
      },
      cached: false
    }

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in fetch-roblox-user:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch user data',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}) 