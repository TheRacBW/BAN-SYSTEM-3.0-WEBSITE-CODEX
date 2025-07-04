import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { FaCheck, FaTimes } from "react-icons/fa";

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

const PAGE_SIZE = 5;

const UserListTable: React.FC<Props> = ({ onEditUser, bulkSelection, setBulkSelection, refresh }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"created_at" | "last_login" | "trust_level">("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    let query = supabase
      .from("users")
      .select("*", { count: "exact" })
      .order(sort, { ascending: order === "asc" })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (search) {
      query = query.ilike("username", `%${search}%`).or(`email.ilike.%${search}%`);
    }

    query.then(({ data, count, error }) => {
      setLoading(false);
      if (error) return;
      setUsers(data || []);
      setTotal(count || 0);
    });
  }, [page, search, sort, order, refresh]);

  const toggleSelect = (id: string) => {
    setBulkSelection(
      bulkSelection.includes(id)
        ? bulkSelection.filter(uid => uid !== id)
        : [...bulkSelection, id]
    );
  };

  return (
    <div>
      <div className="flex mb-2">
        <input
          className="input input-bordered mr-2"
          placeholder="Search username/email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="select select-bordered mr-2">
          <option value="created_at">Registration Date</option>
          <option value="last_login">Last Login</option>
          <option value="trust_level">Trust Level</option>
        </select>
        <select value={order} onChange={e => setOrder(e.target.value as any)} className="select select-bordered">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </div>
      <table className="table w-full">
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
              <tr key={u.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={bulkSelection.includes(u.id)}
                    onChange={() => toggleSelect(u.id)}
                  />
                </td>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>{u.is_admin ? <FaCheck className="text-green-500" /> : <FaTimes className="text-red-500" />}</td>
                <td>
                  <span className={`badge badge-${["neutral", "info", "success"][u.trust_level]}`}>
                    {["New", "Trusted", "Moderator"][u.trust_level]}
                  </span>
                </td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-xs btn-primary" onClick={() => onEditUser(u.id)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="flex justify-between mt-2">
        <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page} / {Math.ceil(total / PAGE_SIZE)}</span>
        <button className="btn btn-sm" disabled={page * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
};

export default UserListTable; 