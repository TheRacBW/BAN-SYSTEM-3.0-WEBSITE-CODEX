import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TrustLevel, TRUST_LEVEL_CONFIGS } from "../../types/trustLevels";
import { FaDiscord, FaCheck, FaTimes } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  trust_level: number;
  discord_verified: boolean;
  discord_username: string | null;
  discord_id: string | null;
  discord_verified_at: string | null;
}

interface Props {
  userId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

const UserPrivilegeEditor: React.FC<Props> = ({ userId, onClose, onUpdated }) => {
  const { user } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ username: string } | null>(null);
  
  // Check if current user is therac (only admin who can see Discord data)
  const canViewDiscordData = currentUserProfile?.username === "therac";

  // Fetch current user's profile to get username
  useEffect(() => {
    if (user?.id) {
      supabase
        .from("users")
        .select("username")
        .eq("id", user.id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) {
            setCurrentUserProfile(data);
          }
        });
    }
  }, [user?.id]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from("users")
      .select(`
        *,
        discord_verifications(
          discord_id,
          discord_username,
          is_verified,
          created_at
        )
      `)
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("Error fetching user:", error);
          setLoading(false);
          return;
        }
        
        // Transform the data to match our User interface
        const transformedUser = {
          id: data.id,
          username: data.username,
          email: data.email,
          is_admin: data.is_admin,
          trust_level: data.trust_level,
          discord_verified: data.discord_verifications?.is_verified || false,
          discord_username: data.discord_verifications?.discord_username || null,
          discord_id: data.discord_verifications?.discord_id || null,
          discord_verified_at: data.discord_verifications?.created_at || null,
        };
        
        setUserData(transformedUser);
        setTrustLevel(transformedUser.trust_level);
        setIsAdmin(transformedUser.is_admin);
        setLoading(false);
      });
  }, [userId]);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ trust_level: trustLevel, is_admin: isAdmin })
      .eq("id", userId);
    setLoading(false);
    if (!error) {
      onUpdated();
      onClose();
    } else {
      console.error('Error updating user privileges:', error);
      alert('Failed to update user privileges. Please try again.');
    }
  };

  const formatDiscordDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#232b36] dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border border-[#3a4250] max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-gray-200">Edit User Privileges</h3>
        {loading ? (
          <div className="text-gray-200">Loading...</div>
        ) : userData ? (
          <>
            <div className="mb-4">
              <div className="mb-2 text-gray-200">Username: <b className="text-white">{userData.username}</b></div>
              <div className="mb-2 text-gray-200">Email: <span className="text-white">{userData.email}</span></div>
            </div>

            {/* Discord Verification Section */}
            <div className="mb-6 p-4 bg-[#2a323c] rounded-lg border border-[#3a4250]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                  <FaDiscord color="#5865f2" />
                  Discord Verification Status
                </h4>
                {canViewDiscordData && (
                  <div className="flex items-center gap-1 text-green-400 text-sm">
                    <FaDiscord />
                    Discord Data Access
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Status:</span>
                  <div className="flex items-center gap-2">
                    {userData.discord_verified ? (
                      <>
                        <FaDiscord color="#5865f2" />
                        <FaCheck color="#22c55e" />
                        <span className="text-green-400">Verified</span>
                      </>
                    ) : (
                      <>
                        <FaTimes color="#ef4444" />
                        <span className="text-red-400">Not Verified</span>
                      </>
                    )}
                  </div>
                </div>
                {canViewDiscordData ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Discord Username:</span>
                      <span className="text-white">{userData.discord_username || "Not linked"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Discord ID:</span>
                      <span className="text-white">{userData.discord_id || "Not linked"}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Discord Data:</span>
                    <span className="text-gray-500 italic">Restricted - Admin access only</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Linked Date:</span>
                  <span className="text-white">{formatDiscordDate(userData.discord_verified_at)}</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 text-gray-200">
                <input 
                  type="checkbox" 
                  checked={isAdmin} 
                  onChange={e => setIsAdmin(e.target.checked)}
                  className="checkbox checkbox-sm"
                />
                <span>Admin</span>
              </label>
            </div>
            <div className="mb-4">
              <label className="block mb-1 text-gray-200">Trust Level:</label>
              <select 
                className="w-full p-2 border rounded bg-[#323a45] text-gray-200 border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={trustLevel} 
                onChange={e => setTrustLevel(Number(e.target.value) as TrustLevel)}
              >
                {TRUST_LEVEL_CONFIGS.map(config => (
                  <option key={config.level} value={config.level}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
              <button className="btn btn-ghost text-gray-200" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <div className="text-gray-200">User not found.</div>
        )}
      </div>
    </div>
  );
};

export default UserPrivilegeEditor; 