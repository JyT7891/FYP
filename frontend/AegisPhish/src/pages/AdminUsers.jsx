// src/pages/AdminUsers.jsx
import { useState, useEffect } from "react";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [updating, setUpdating] = useState(false);

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/admin/users", { headers });
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    
    setUpdating(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/admin/users/${editingUser._id}/role`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role: editingUser.role }),
      });
      
      if (res.ok) {
        // Update user in the list
        setUsers(users.map(u => 
          u._id === editingUser._id ? { ...u, role: editingUser.role } : u
        ));
        setShowEditModal(false);
        setEditingUser(null);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to update user role");
      }
    } catch (error) {
      console.error("Failed to update user role:", error);
      alert("Could not connect to server");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/admin/users/${userToDelete}`, {
        method: "DELETE",
        headers,
      });
      
      if (res.ok) {
        setUsers(users.filter(u => u._id !== userToDelete));
        setShowDeleteConfirm(false);
        setUserToDelete(null);
        setSelectedUser(null);
      } else {
        const data = await res.json();
        alert(data.detail || "Failed to delete user");
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Could not connect to server");
    }
  };

  const openEditModal = (user) => {
    setEditingUser({ ...user });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(search.toLowerCase()) ||
    user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <header className="border-b border-purple-500/20 px-6 py-4 bg-[#0f0f23]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-base font-semibold">Users</h1>
            <p className="text-xs text-gray-500">Manage system users</p>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-gray-800/60 border border-gray-600 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple-400 transition w-48"
            />
            <button
              onClick={fetchUsers}
              className="text-xs px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="p-8">
        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No users found</p>
        ) : (
          <div className="rounded-xl border border-purple-500/20 bg-gradient-to-b from-[#0f0f23] to-[#0a0a1a] overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-purple-500/20 bg-[#0f0f23]">
                <tr>
                  <th className="px-5 py-3 text-xs text-gray-500 uppercase">User</th>
                  <th className="px-5 py-3 text-xs text-gray-500 uppercase">Email</th>
                  <th className="px-5 py-3 text-xs text-gray-500 uppercase">Role</th>
                  <th className="px-5 py-3 text-xs text-gray-500 uppercase">Joined</th>
                  <th className="px-5 py-3 text-xs text-gray-500 uppercase">Verified</th>
                  <th className="px-5 py-3 text-xs text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/10">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">
                          {user.name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <span className="text-sm text-gray-300">{user.name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-400">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        user.role === "admin" 
                          ? "bg-purple-500/10 text-purple-400" 
                          : "bg-teal-500/10 text-teal-400"
                      }`}>
                        {user.role || "user"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs ${user.email_verified ? "text-teal-400" : "text-orange-400"}`}>
                        {user.email_verified ? "✓ Verified" : "⚠ Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-xs text-teal-400 hover:text-teal-300 transition"
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() => {
                            setUserToDelete(user._id);
                            setSelectedUser(user);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-xs text-red-400 hover:text-red-300 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-purple-500/10 text-right text-xs text-gray-500">
              Total: {filteredUsers.length} users
            </div>
          </div>
        )}
      </div>

      {/* Edit Role Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0f0f23] border border-purple-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold mb-2 text-purple-400">Edit User Role</h3>
            <p className="text-gray-400 text-sm mb-4">
              Change role for <span className="text-white font-medium">{editingUser.name}</span>
            </p>
            
            <div className="mb-4">
              <label className="text-sm text-gray-300 mb-2 block">Role</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="user"
                    checked={editingUser.role === "user"}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-4 h-4 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">User</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={editingUser.role === "admin"}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-4 h-4 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-300">Admin</span>
                </label>
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingUser(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={updating}
                className="flex-1 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50"
              >
                {updating ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-[#0f0f23] border border-red-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold mb-2 text-red-400">Delete User</h3>
            <p className="text-gray-400 text-sm mb-4">
              Are you sure you want to delete user <span className="text-white font-medium">{selectedUser.name}</span>?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              This will permanently delete their account and all associated scan history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedUser(null);
                  setUserToDelete(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}