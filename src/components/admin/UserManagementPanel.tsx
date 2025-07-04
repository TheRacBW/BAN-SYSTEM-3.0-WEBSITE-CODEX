import React, { useState } from "react";
import UserListTable from "./UserListTable";
import UserPrivilegeEditor from "./UserPrivilegeEditor";
import TrustLevelManager from "./TrustLevelManager";
import BulkUserActions from "./BulkUserActions";
import { useAuth } from "../../context/AuthContext";

const UserManagementPanel: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);

  if (!isAdmin) return <div>Access denied.</div>;

  return (
    <div className="admin-section">
      <h2 className="text-2xl font-bold mb-4">User Management</h2>
      <UserListTable
        onEditUser={setSelectedUser}
        bulkSelection={bulkSelection}
        setBulkSelection={setBulkSelection}
        refresh={refresh}
      />
      <BulkUserActions
        selectedUserIds={bulkSelection}
        onActionComplete={() => setRefresh(r => r + 1)}
      />
      <UserPrivilegeEditor
        userId={selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdated={() => setRefresh(r => r + 1)}
      />
      <TrustLevelManager />
    </div>
  );
};

export default UserManagementPanel; 