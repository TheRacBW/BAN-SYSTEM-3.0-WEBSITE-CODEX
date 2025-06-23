-- =====================================================
-- Simplified Leaderboard Script - Raw Data Only
-- =====================================================

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")

-- Configuration
local SUPABASE_URL = "YOUR_SUPABASE_URL"
local SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"
local UPDATE_INTERVAL = 600 -- 10 minutes
local MAX_PLAYERS = 200

-- Function to make HTTP request to Supabase
local function makeSupabaseRequest(endpoint, method, data)
    local success, result = pcall(function()
        local url = SUPABASE_URL .. endpoint
        local headers = {
            ["Content-Type"] = "application/json",
            ["apikey"] = SUPABASE_ANON_KEY,
            ["Authorization"] = "Bearer " .. SUPABASE_ANON_KEY
        }
        
        local requestData = {
            Url = url,
            Method = method or "GET",
            Headers = headers
        }
        
        if data then
            requestData.Body = HttpService:JSONEncode(data)
        end
        
        local response = HttpService:RequestAsync(requestData)
        
        if response.Success then
            return HttpService:JSONDecode(response.Body)
        else
            warn("Supabase request failed:", response.StatusCode, response.Body)
            return nil
        end
    end)
    
    if not success then
        warn("Error making Supabase request:", result)
        return nil
    end
    
    return result
end

-- Function to get current leaderboard data
local function getCurrentLeaderboard()
    local result = makeSupabaseRequest("/rest/v1/leaderboard?select=*&order=rp.desc&limit=" .. MAX_PLAYERS)
    return result or {}
end

-- Function to create snapshot in history table
local function createSnapshot()
    local currentData = getCurrentLeaderboard()
    local timestamp = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
    
    for _, entry in ipairs(currentData) do
        local snapshotData = {
            username = entry.username,
            rank_position = entry.rank_position,
            rp = entry.rp,
            rank_title = entry.rank_title,
            inserted_at = timestamp
        }
        
        makeSupabaseRequest("/rest/v1/leaderboard_history", "POST", snapshotData)
    end
    
    print("Snapshot created with", #currentData, "entries")
end

-- Function to update leaderboard with new data
local function updateLeaderboard(newData)
    -- First, create snapshot of current data
    createSnapshot()
    
    -- Clear current leaderboard
    makeSupabaseRequest("/rest/v1/leaderboard", "DELETE", {})
    
    -- Insert new data (raw data only, no calculations)
    for _, entry in ipairs(newData) do
        local leaderboardData = {
            username = entry.username,
            rank_position = entry.rank_position,
            rp = entry.rp, -- Raw RP value from game
            rank_title = entry.rank_title, -- Raw rank title from game
            inserted_at = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
        }
        
        makeSupabaseRequest("/rest/v1/leaderboard", "POST", leaderboardData)
    end
    
    print("Leaderboard updated with", #newData, "entries")
end

-- Function to track RP changes
local function trackRPChanges(previousData, newData)
    local changes = {}
    
    -- Create lookup table for previous data
    local previousLookup = {}
    for _, entry in ipairs(previousData) do
        previousLookup[entry.username] = entry
    end
    
    -- Check for changes
    for _, newEntry in ipairs(newData) do
        local previousEntry = previousLookup[newEntry.username]
        
        if previousEntry then
            local rpChange = newEntry.rp - previousEntry.rp
            local rankChange = previousEntry.rank_position - newEntry.rank_position
            
            if rpChange ~= 0 then
                local changeData = {
                    username = newEntry.username,
                    previous_rp = previousEntry.rp,
                    new_rp = newEntry.rp,
                    rp_change = rpChange,
                    previous_rank = previousEntry.rank_position,
                    new_rank = newEntry.rank_position,
                    rank_change = rankChange,
                    change_timestamp = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
                }
                
                table.insert(changes, changeData)
            end
        else
            -- New player
            local changeData = {
                username = newEntry.username,
                previous_rp = 0,
                new_rp = newEntry.rp,
                rp_change = newEntry.rp,
                previous_rank = 0,
                new_rank = newEntry.rank_position,
                rank_change = newEntry.rank_position,
                change_timestamp = os.date("!%Y-%m-%dT%H:%M:%S.000Z")
            }
            
            table.insert(changes, changeData)
        end
    end
    
    -- Insert changes into database
    for _, change in ipairs(changes) do
        makeSupabaseRequest("/rest/v1/rp_changes", "POST", change)
    end
    
    print("Tracked", #changes, "RP changes")
end

-- Function to fetch leaderboard data from game
local function fetchLeaderboardData()
    -- This is where you would implement the logic to get leaderboard data from your game
    -- The script now only needs to return raw data without any calculations
    
    local leaderboardData = {}
    
    -- Example implementation (replace with your actual logic):
    -- 1. Get all players in the game
    -- 2. Sort them by RP
    -- 3. Assign rank positions
    -- 4. Return the raw data
    
    -- Placeholder data structure (raw data only):
    -- {
    --     username = "PlayerName",
    --     rank_position = 1,
    --     rp = 1500, -- Raw RP value from game
    --     rank_title = "Platinum 3" -- Raw rank title from game
    -- }
    
    return leaderboardData
end

-- Main update function
local function performLeaderboardUpdate()
    print("Starting leaderboard update...")
    
    -- Get current data from database
    local currentData = getCurrentLeaderboard()
    
    -- Fetch new data from game
    local newData = fetchLeaderboardData()
    
    if #newData > 0 then
        -- Track changes before updating
        trackRPChanges(currentData, newData)
        
        -- Update leaderboard with raw data
        updateLeaderboard(newData)
        
        print("Leaderboard update completed successfully")
    else
        warn("No leaderboard data received from game")
    end
end

-- Initialize the script
local function initialize()
    print("Simplified Leaderboard Script initialized")
    print("Update interval:", UPDATE_INTERVAL, "seconds")
    print("Max players:", MAX_PLAYERS)
    print("Note: This script only sends raw data. Rank calculations are handled on the frontend.")
    
    -- Perform initial update
    performLeaderboardUpdate()
    
    -- Set up recurring updates
    while true do
        wait(UPDATE_INTERVAL)
        performLeaderboardUpdate()
    end
end

-- Error handling wrapper
local function safeInitialize()
    local success, error = pcall(initialize)
    if not success then
        warn("Leaderboard script error:", error)
        -- Wait a bit before retrying
        wait(60)
        safeInitialize()
    end
end

-- Start the script
safeInitialize() 