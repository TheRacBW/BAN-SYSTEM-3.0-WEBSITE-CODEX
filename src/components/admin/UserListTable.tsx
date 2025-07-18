import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { FaCheck, FaTimes, FaChevronLeft, FaChevronRight, FaInfoCircle } from "react-icons/fa";
import './UserListTable.css'; // For custom transitions and modern styles

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  trust_level: number;
  created_at: string;
  last_login?: string;
}

interface Props {
  onEditUser: (userId: string) => void;
  bulkSelection: string[];
  setBulkSelection: (ids: string[]) => void;
  refresh: number;
}

const TRUST_LEVELS = [
  { value: 0, label: "New" },
  { value: 1, label: "Trusted" },
  { value: 2, label: "Moderator" }
];

const UserListTable: React.FC<Props> = ({ onEditUser, bulkSelection, setBulkSelection, refresh }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"created_at" | "last_login" | "trust_level">("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [trustFilter, setTrustFilter] = useState<number | "">("");

  useEffect(() => {
    setLoading(true);
    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order(sort, { ascending: order === "asc" });

    if (search) {
      query = query.ilike("username", `%${search}%`).or(`email.ilike.%${search}%`);
    }
    if (trustFilter !== "") {
      query = query.eq("trust_level", trustFilter);
    }

    query.then(({ data, error }) => {
      setLoading(false);
      if (error) return;
      setUsers(data || []);
    });
  }, [search, sort, order, trustFilter, refresh]);

  const toggleSelect = (id: string) => {
    setBulkSelection(
      bulkSelection.includes(id)
        ? bulkSelection.filter(uid => uid !== id)
        : [...bulkSelection, id]
    );
  };

  return (
    <div className="rounded-xl shadow-lg p-8 mb-8" style={{ background: '#232b36' }}>
      <div className="flex items-center mb-4 gap-2">
        <input
          className="input input-bordered flex-1 rounded-md px-4 py-2 bg-[#323a45] text-gray-200 placeholder:text-gray-400 border border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search username/email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="select select-bordered modern-select rounded-md px-4 py-2 bg-[#323a45] text-gray-200 border border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="created_at">Registration Date</option>
          <option value="last_login">Last Login</option>
          <option value="trust_level">Trust Level</option>
        </select>
        <select value={order} onChange={e => setOrder(e.target.value as any)} className="select select-bordered modern-select rounded-md px-4 py-2 bg-[#323a45] text-gray-200 border border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <select
          value={trustFilter}
          onChange={e => setTrustFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className="select select-bordered modern-select rounded-md px-4 py-2 bg-[#323a45] text-gray-200 border border-[#3a4250] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Trust Levels</option>
          {TRUST_LEVELS.map(tl => (
            <option key={tl.value} value={tl.value}>{tl.label}</option>
          ))}
        </select>
        <span className="tooltip ml-2" data-tip="Trust Level: 0=New (lowest), 2=Moderator (highest)"><FaInfoCircle color="#3b82f6" /></span>
      </div>
      <div className="overflow-x-auto user-list-scrollbar" style={{ maxHeight: '500px', overflowY: 'scroll', width: '100%' }}>
        <table className="table w-full modern-table">
          <thead>
            <tr>
              <th></th>
              <th>Username</th>
              <th>Email</th>
              <th>Admin</th>
              <th>Trust</th>
              <th>Registered</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7}>Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7}>No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-base-300 transition-colors">
                  <td>
                    <input
                      type="checkbox"
                      checked={bulkSelection.includes(u.id)}
                      onChange={() => toggleSelect(u.id)}
                    />
                  </td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.is_admin ? <FaCheck color="#22c55e" /> : <FaTimes color="#ef4444" />}</td>
                  <td>
                    <span className={`badge badge-${["neutral", "info", "success"][u.trust_level]}`}>
                      {["New", "Trusted", "Moderator"][u.trust_level]}
                    </span>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-xs btn-primary rounded-lg shadow" onClick={() => onEditUser(u.id)}>
                      Edit
                    </button>
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

export default UserListTable; 