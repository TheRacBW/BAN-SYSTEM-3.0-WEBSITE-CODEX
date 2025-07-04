import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface RestrictedUser {
  id: number;
  roblox_user_id: string;
  reason: string;
  created_at: string;
  added_by: string;
  users?: { username: string };
}

const RestrictedUsersManager: React.FC = () => {
  const [restricted, setRestricted] = useState<RestrictedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [robloxId, setRobloxId] = useState("");
  const [reason, setReason] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchRestricted();
  }, []);

  const fetchRestricted = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("restricted_user_ids")
      .select("*, users:added_by(username)")
      .order("created_at", { ascending: false });
    setRestricted(data || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!robloxId) return;
    const user = await supabase.auth.getUser();
    const addedBy = user.data?.user?.id || '';
    const { data, error } = await supabase.from("restricted_user_ids").insert({
      roblox_user_id: robloxId,
      reason,
      added_by: addedBy,
    }).select().single();
    if (!error && data) {
      setRestricted([data, ...restricted]);
      setRobloxId("");
      setReason("");
    }
  };

  const handleRemove = async (id: number) => {
    if (!window.confirm("Remove this restriction?")) return;
    await supabase.from("restricted_user_ids").delete().eq("id", id);
    fetchRestricted();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImporting(true);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split("\n").map(line => line.trim()).filter(Boolean);
    for (const row of rows) {
      const [roblox_user_id, reason] = row.split(",");
      await supabase.from("restricted_user_ids").insert({
        roblox_user_id,
        reason: reason || "",
        added_by: supabase.auth.user()?.id,
      });
    }
    setImporting(false);
    fetchRestricted();
  };

  const handleExport = () => {
    const csv = restricted.map(r => `${r.roblox_user_id},${r.reason}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "restricted_user_ids.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modern-card shadow-lg rounded-2xl p-6 bg-base-200 dark:bg-base-300 text-base-content border border-base-400 mt-10 mb-8">
      <h3 className="text-lg font-bold mb-1">Restricted Roblox User IDs</h3>
      <div className="text-sm text-gray-400 mb-4">Prevent certain Roblox accounts from being tracked. Add, remove, or import/export restricted IDs. These users will be blocked from all tracking features.</div>
      <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
        <input
          className="input input-bordered flex-1 bg-base-100 dark:bg-base-300 text-base-content placeholder:text-base-content"
          placeholder="Roblox User ID"
          value={robloxId}
          onChange={e => setRobloxId(e.target.value)}
        />
        <input
          className="input input-bordered flex-1 bg-base-100 dark:bg-base-300 text-base-content placeholder:text-base-content"
          placeholder="Reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleAdd}>Add</button>
        <button className="btn btn-secondary ml-2" onClick={handleExport}>Export CSV</button>
      </div>
      <div className="overflow-x-auto" style={{ maxHeight: 300, overflowY: 'auto' }}>
        <table className="table w-full modern-table">
          <thead>
            <tr>
              <th>Roblox User ID</th>
              <th>Reason</th>
              <th>Added By</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}>Loading...</td></tr>
            ) : restricted.length === 0 ? (
              <tr><td colSpan={5}>No restricted users.</td></tr>
            ) : (
              restricted.map(r => (
                <tr key={r.id}>
                  <td>{r.roblox_user_id}</td>
                  <td>{r.reason}</td>
                  <td>{r.users?.username || r.added_by}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-xs btn-error" onClick={() => handleRemove(r.id)}>Remove</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RestrictedUsersManager; 