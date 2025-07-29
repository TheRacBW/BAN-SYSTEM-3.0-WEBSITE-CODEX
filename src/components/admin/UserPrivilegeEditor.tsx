import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { TrustLevel, TRUST_LEVEL_CONFIGS } from "../../types/trustLevels";

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  trust_level: number;
}

interface Props {
  userId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

const UserPrivilegeEditor: React.FC<Props> = ({ userId, onClose, onUpdated }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase.from("users").select("*").eq("id", userId).single().then(({ data }) => {
      setUser(data);
      setTrustLevel(data?.trust_level ?? 0);
      setIsAdmin(data?.is_admin ?? false);
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

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold mb-4">Edit User Privileges</h3>
        {loading ? (
          <div>Loading...</div>
        ) : user ? (
          <>
            <div className="mb-2">Username: <b>{user.username}</b></div>
            <div className="mb-2">Email: {user.email}</div>
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
                <span>Admin</span>
              </label>
            </div>
            <div className="mb-4">
              <label className="block mb-1">Trust Level:</label>
              <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" value={trustLevel} onChange={e => setTrustLevel(Number(e.target.value) as TrustLevel)}>
                {TRUST_LEVEL_CONFIGS.map(config => (
                  <option key={config.level} value={config.level}>
                    {config.icon} {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
              <button className="btn" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <div>User not found.</div>
        )}
      </div>
    </div>
  );
};

export default UserPrivilegeEditor; 