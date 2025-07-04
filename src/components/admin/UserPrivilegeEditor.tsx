import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  trust_level: number;
}

type TrustLevel = 0 | 1 | 2;

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
    }
  };

  if (!userId) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Edit User Privileges</h3>
        {loading ? (
          <div>Loading...</div>
        ) : user ? (
          <>
            <div className="mb-2">Username: <b>{user.username}</b></div>
            <div className="mb-2">Email: {user.email}</div>
            <div className="mb-2">
              <label>
                <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
                <span className="ml-2">Admin</span>
              </label>
            </div>
            <div className="mb-2">
              <label>Trust Level:</label>
              <select className="select select-bordered ml-2" value={trustLevel} onChange={e => setTrustLevel(Number(e.target.value) as TrustLevel)}>
                <option value={0}>New</option>
                <option value={1}>Trusted</option>
                <option value={2}>Moderator</option>
              </select>
            </div>
            <div className="modal-action">
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