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

const PAGE_SIZE = 5;

const TRUST_LEVELS = [
  { value: 0, label: "New", desc: "Lowest. Limited access, manual approval required." },
  { value: 1, label: "Trusted", desc: "Can submit and edit content, auto-approval enabled." },
  { value: 2, label: "Moderator", desc: "Highest. Can moderate users and submissions." },
];

const UserListTable: React.FC<Props> = ({ onEditUser, bulkSelection, setBulkSelection, refresh }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"created_at" | "last_login" | "trust_level">("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [trustFilter, setTrustFilter] = useState<number | "">("");
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);
  const [isFading, setIsFading] = useState(false);

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
    if (trustFilter !== "") {
      query = query.eq("trust_level", trustFilter);
    }

    query.then(({ data, count, error }) => {
      setLoading(false);
      if (error) return;
      setUsers(data || []);
      setTotal(count || 0);
    });
  }, [page, search, sort, order, trustFilter, refresh]);

  const toggleSelect = (id: string) => {
    setBulkSelection(
      bulkSelection.includes(id)
        ? bulkSelection.filter(uid => uid !== id)
        : [...bulkSelection, id]
    );
  };

  // Slide transition logic
  const handlePageChange = (dir: "left" | "right") => {
    setSlideDirection(dir);
    setIsFading(true);
    setTimeout(() => {
      setPage(p => dir === "left" ? p - 1 : p + 1);
      setSlideDirection(null);
      setTimeout(() => setIsFading(false), 350); // match CSS duration
    }, 350); // match CSS duration
  };

  return (
    <div className="modern-card-table bg-base-200 dark:bg-base-300 rounded-2xl shadow-lg p-6 mb-8">
      <div className="flex items-center mb-4 gap-2">
        <input
          className="input input-bordered flex-1 bg-base-100 dark:bg-base-300 text-base-content placeholder:text-base-content"
          placeholder="Search username/email"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="select select-bordered modern-select bg-base-100 dark:bg-base-300 text-base-content">
          <option value="created_at">Registration Date</option>
          <option value="last_login">Last Login</option>
          <option value="trust_level">Trust Level</option>
        </select>
        <select value={order} onChange={e => setOrder(e.target.value as any)} className="select select-bordered modern-select bg-base-100 dark:bg-base-300 text-base-content">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
        <select
          value={trustFilter}
          onChange={e => setTrustFilter(e.target.value === "" ? "" : Number(e.target.value))}
          className="select select-bordered modern-select bg-base-100 dark:bg-base-300 text-base-content"
        >
          <option value="">All Trust Levels</option>
          {TRUST_LEVELS.map(tl => (
            <option key={tl.value} value={tl.value}>{tl.label}</option>
          ))}
        </select>
        <span className="tooltip ml-2" data-tip="Trust Level: 0=New (lowest), 2=Moderator (highest)"><FaInfoCircle color="#3b82f6" /></span>
      </div>
      <div className="mb-2 flex items-center gap-4">
        <FaInfoCircle color="#3b82f6" />
        <span>
          <b>Trust Level Guide:</b> 0 = New (lowest), 1 = Trusted, 2 = Moderator (highest). Moderator has the most permissions.
        </span>
      </div>
      <div className={`overflow-x-auto transition-slide ${slideDirection ? `slide-${slideDirection}` : 'slide-in'}${isFading ? '' : ' slide-in'}`}>
        <div className="overflow-x-auto" style={{ maxHeight: 500, overflowY: 'auto' }}>
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
    </div>
  );
};

export default UserListTable; 