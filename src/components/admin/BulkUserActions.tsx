import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

type TrustLevel = 0 | 1 | 2;

interface Props {
  selectedUserIds: string[];
  onActionComplete: () => void;
}

const BulkUserActions: React.FC<Props> = ({ selectedUserIds, onActionComplete }) => {
  const [loading, setLoading] = useState(false);
  const [trustLevel, setTrustLevel] = useState<TrustLevel>(1);

  const handleBulkTrust = async () => {
    if (!window.confirm("Change trust level for selected users?")) return;
    setLoading(true);
    const { error } = await supabase.from("users").update({ trust_level: trustLevel }).in("id", selectedUserIds);
    setLoading(false);
    if (error) {
      console.error('Error updating trust levels:', error);
      alert('Failed to update trust levels. Please try again.');
    } else {
      onActionComplete();
    }
  };

  const handleBulkAdmin = async (makeAdmin: boolean) => {
    if (!window.confirm(`${makeAdmin ? "Grant" : "Revoke"} admin for selected users?`)) return;
    setLoading(true);
    const { error } = await supabase.from("users").update({ is_admin: makeAdmin }).in("id", selectedUserIds);
    setLoading(false);
    if (error) {
      console.error('Error updating admin status:', error);
      alert('Failed to update admin status. Please try again.');
    } else {
      onActionComplete();
    }
  };

  if (selectedUserIds.length === 0) return null;

  return (
    <div className="mb-4">
      <span>Bulk actions for {selectedUserIds.length} users:</span>
      <button className="btn btn-xs btn-info ml-2" onClick={() => handleBulkAdmin(true)}>Make Admin</button>
      <button className="btn btn-xs btn-warning ml-2" onClick={() => handleBulkAdmin(false)}>Remove Admin</button>
      <select className="select select-xs ml-2" value={trustLevel} onChange={e => setTrustLevel(Number(e.target.value) as TrustLevel)}>
        <option value={0}>New</option>
        <option value={1}>Trusted</option>
        <option value={2}>Moderator</option>
      </select>
      <button className="btn btn-xs btn-success ml-2" onClick={handleBulkTrust}>Set Trust Level</button>
    </div>
  );
};

export default BulkUserActions; 