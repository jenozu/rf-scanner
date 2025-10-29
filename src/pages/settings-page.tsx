import React, { useState, useEffect } from "react";
import { PageType, User, AppSettings } from "../types";
import { useAuth } from "../hooks/useAuth";
import { 
  LogIn, LogOut, User as UserIcon, Settings as SettingsIcon, 
  Plus, Edit, Trash2, Shield, Eye, Users, Activity,
  Bell, Volume2, Clock, Moon, Sun
} from "lucide-react";

interface SettingsPageProps {
  setPage: (page: PageType) => void;
  onLogin?: () => void;
}

export default function SettingsPage({ setPage, onLogin }: SettingsPageProps) {
  const auth = useAuth();
  const [showLogin, setShowLogin] = useState(!auth.isLoggedIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "users" | "settings" | "activity">("profile");

  // User Management State
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "operator" as "admin" | "operator" | "viewer",
    isActive: true,
  });

  // App Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem("rf_app_settings");
      return saved ? JSON.parse(saved) : {
        soundEnabled: true,
        vibrationEnabled: true,
        autoLogout: false,
        autoLogoutMinutes: 15,
        showActivityLog: true,
        theme: "light",
      };
    } catch {
      return {
        soundEnabled: true,
        vibrationEnabled: true,
        autoLogout: false,
        autoLogoutMinutes: 15,
        showActivityLog: true,
        theme: "light",
      };
    }
  });

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem("rf_app_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  // Show login if not logged in
  useEffect(() => {
    setShowLogin(!auth.isLoggedIn);
  }, [auth.isLoggedIn]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const success = auth.login(username, password);
    if (success) {
      setLoginError("");
      setUsername("");
      setPassword("");
      setShowLogin(false);
      // Call the onLogin callback to update app state
      if (onLogin) {
        onLogin();
      }
    } else {
      setLoginError("Invalid username or password");
    }
  };

  const handleLogout = () => {
    auth.logout();
    setActiveTab("profile");
  };

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password || !newUser.fullName) {
      alert("Please fill in all required fields");
      return;
    }

    const success = auth.addUser(newUser);
    if (success) {
      setNewUser({
        username: "",
        password: "",
        fullName: "",
        role: "operator",
        isActive: true,
      });
      setShowAddUser(false);
      alert("User added successfully!");
    } else {
      alert("Failed to add user. Username may already exist.");
    }
  };

  const handleUpdateUser = (userId: string, updates: Partial<User>) => {
    const success = auth.updateUser(userId, updates);
    if (success) {
      setEditingUser(null);
      alert("User updated successfully!");
    } else {
      alert("Failed to update user.");
    }
  };

  const handleDeleteUser = (userId: string, username: string) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      const success = auth.deleteUser(userId);
      if (success) {
        alert("User deleted successfully!");
      } else {
        alert("Failed to delete user. Cannot delete yourself.");
      }
    }
  };

  // Login Screen
  if (showLogin) {
    return (
      <div className="max-w-md mx-auto mt-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-center mb-6">
            <LogIn className="mr-2" size={32} />
            <h2 className="text-2xl font-bold">Login</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-md text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Login
            </button>
          </form>

          <div className="mt-4 p-3 bg-gray-50 rounded-md text-xs text-gray-600">
            <strong>Default credentials:</strong><br />
            Username: admin<br />
            Password: admin123
          </div>
        </div>
      </div>
    );
  }

  // Main Settings Screen (when logged in)
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Settings</h2>
              <p className="text-sm text-blue-100">
                Logged in as: {auth.currentUser?.fullName} ({auth.currentUser?.role})
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === "profile"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UserIcon size={18} />
            Profile
          </button>

          {auth.currentUser?.role === "admin" && (
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "users"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users size={18} />
              Users
            </button>
          )}

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === "settings"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <SettingsIcon size={18} />
            App Settings
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === "activity"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Activity size={18} />
            Activity
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">User Profile</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Username</label>
                  <p className="text-lg">{auth.currentUser?.username}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <p className="text-lg">{auth.currentUser?.fullName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Role</label>
                  <div className="flex items-center gap-2">
                    {auth.currentUser?.role === "admin" && <Shield size={18} className="text-red-600" />}
                    {auth.currentUser?.role === "operator" && <UserIcon size={18} className="text-blue-600" />}
                    {auth.currentUser?.role === "viewer" && <Eye size={18} className="text-gray-600" />}
                    <p className="text-lg capitalize">{auth.currentUser?.role}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Last Login</label>
                  <p className="text-lg">
                    {auth.currentUser?.lastLogin 
                      ? new Date(auth.currentUser.lastLogin).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-md">
                <h4 className="font-medium mb-2">Role Permissions</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  {auth.currentUser?.role === "admin" && (
                    <>
                      <li>✓ Full access to all features</li>
                      <li>✓ Manage users and settings</li>
                      <li>✓ View activity logs</li>
                      <li>✓ Export data</li>
                    </>
                  )}
                  {auth.currentUser?.role === "operator" && (
                    <>
                      <li>✓ Receive, scan, pick items</li>
                      <li>✓ View inventory</li>
                      <li>✓ Export data</li>
                      <li>✗ Cannot manage users</li>
                    </>
                  )}
                  {auth.currentUser?.role === "viewer" && (
                    <>
                      <li>✓ View inventory</li>
                      <li>✓ View reports</li>
                      <li>✗ Cannot scan or modify items</li>
                      <li>✗ Cannot manage users</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Users Management Tab (Admin Only) */}
          {activeTab === "users" && auth.currentUser?.role === "admin" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">User Management</h3>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  <Plus size={18} />
                  Add User
                </button>
              </div>

              {/* Add User Form */}
              {showAddUser && (
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <h4 className="font-medium mb-3">Add New User</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="px-3 py-2 border rounded-md"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="px-3 py-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newUser.fullName}
                      onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                      className="px-3 py-2 border rounded-md"
                    />
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="operator">Operator</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAddUser}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                    >
                      Create User
                    </button>
                    <button
                      onClick={() => setShowAddUser(false)}
                      className="bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Users List */}
              <div className="space-y-2">
                {auth.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      {user.role === "admin" && <Shield size={18} className="text-red-600" />}
                      {user.role === "operator" && <UserIcon size={18} className="text-blue-600" />}
                      {user.role === "viewer" && <Eye size={18} className="text-gray-600" />}
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-gray-600">
                          @{user.username} • {user.role}
                          {!user.isActive && <span className="text-red-600"> (Inactive)</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateUser(user.id, { isActive: !user.isActive })}
                        className={`px-3 py-1 rounded-md text-sm ${
                          user.isActive
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      {user.id !== auth.currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* App Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">Application Settings</h3>

              {/* Sound & Notifications */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell size={18} />
                  Notifications & Feedback
                </h4>
                
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span className="flex items-center gap-2">
                    <Volume2 size={18} />
                    Sound Effects
                  </span>
                  <input
                    type="checkbox"
                    checked={appSettings.soundEnabled}
                    onChange={(e) => setAppSettings({ ...appSettings, soundEnabled: e.target.checked })}
                    className="w-5 h-5"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Vibration Feedback</span>
                  <input
                    type="checkbox"
                    checked={appSettings.vibrationEnabled}
                    onChange={(e) => setAppSettings({ ...appSettings, vibrationEnabled: e.target.checked })}
                    className="w-5 h-5"
                  />
                </label>
              </div>

              {/* Auto Logout */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock size={18} />
                  Security
                </h4>
                
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Auto Logout</span>
                  <input
                    type="checkbox"
                    checked={appSettings.autoLogout}
                    onChange={(e) => setAppSettings({ ...appSettings, autoLogout: e.target.checked })}
                    className="w-5 h-5"
                  />
                </label>

                {appSettings.autoLogout && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                    <span>Auto Logout After (minutes)</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={appSettings.autoLogoutMinutes}
                      onChange={(e) => setAppSettings({ ...appSettings, autoLogoutMinutes: parseInt(e.target.value) || 15 })}
                      className="w-20 px-2 py-1 border rounded-md"
                    />
                  </div>
                )}
              </div>

              {/* Theme */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  {appSettings.theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
                  Appearance
                </h4>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Theme</span>
                  <select
                    value={appSettings.theme}
                    onChange={(e) => setAppSettings({ ...appSettings, theme: e.target.value as "light" | "dark" })}
                    className="px-3 py-1 border rounded-md"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark (Coming Soon)</option>
                  </select>
                </div>
              </div>

              {/* Activity Log */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity size={18} />
                  Privacy
                </h4>
                
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Show Activity Log</span>
                  <input
                    type="checkbox"
                    checked={appSettings.showActivityLog}
                    onChange={(e) => setAppSettings({ ...appSettings, showActivityLog: e.target.checked })}
                    className="w-5 h-5"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Activity Log Tab */}
          {activeTab === "activity" && appSettings.showActivityLog && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Activity Log</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auth.getActivityLogs().map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{log.action}</p>
                        <p className="text-sm text-gray-600">by {log.username}</p>
                        {log.details && (
                          <p className="text-sm text-gray-500 mt-1">{log.details}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
                {auth.getActivityLogs().length === 0 && (
                  <p className="text-center text-gray-500 py-8">No activity logged yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

