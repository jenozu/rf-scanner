import React, { useEffect, useState } from "react";
import { ActivityLog, AppSettings, Item, PageType, User } from "../types";
import { useAuth } from "../hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  Bell,
  Clock,
  Database,
  Eye,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
  Volume2,
} from "lucide-react";
import { clearAllData } from "../data/sample-data";
import { parseCSV } from "../data/csv-utils";
import { api } from "../services/api";
import { buildBinsFromItems } from "../utils/bin-utils";

interface SettingsPageProps {
  setPage: (page: PageType) => void;
  onLogin?: () => void;
}

type SettingsTab = "profile" | "users" | "settings" | "activity";

type MasterMeta = {
  updatedAt?: string;
  updatedBy?: string;
  sourceFile?: string;
  itemCount?: number;
};

const defaultSettings: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  autoLogout: false,
  autoLogoutMinutes: 15,
  showActivityLog: true,
  theme: "light",
};

export default function SettingsPage({ onLogin }: SettingsPageProps) {
  const auth = useAuth();
  const [showLogin, setShowLogin] = useState(!auth.isLoggedIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "operator" as "admin" | "operator" | "viewer",
    isActive: true,
  });

  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem("rf_app_settings");
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryStatus, setInventoryStatus] = useState("");
  const [masterItemCount, setMasterItemCount] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rf_master") || "[]");
      return Array.isArray(saved) ? saved.length : 0;
    } catch {
      return 0;
    }
  });
  const [masterMeta, setMasterMeta] = useState<MasterMeta>(() => {
    try {
      return JSON.parse(localStorage.getItem("rf_master_meta") || "{}");
    } catch {
      return {};
    }
  });
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    localStorage.setItem("rf_app_settings", JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    setShowLogin(!auth.isLoggedIn);
  }, [auth.isLoggedIn]);

  useEffect(() => {
    if (!auth.isLoggedIn) return;

    const loadMasterSummary = async () => {
      try {
        const [master, meta] = await Promise.all([
          api.getData("rf_master"),
          api.getData("rf_master_meta").catch(() => null),
        ]);

        if (Array.isArray(master)) {
          setMasterItemCount(master.length);
        }

        if (meta && typeof meta === "object") {
          setMasterMeta(meta as MasterMeta);
          localStorage.setItem("rf_master_meta", JSON.stringify(meta));
        }
      } catch (error) {
        console.log("Could not load master inventory summary:", error);
      }
    };

    loadMasterSummary();
  }, [auth.isLoggedIn]);

  useEffect(() => {
    if (activeTab !== "activity" || !appSettings.showActivityLog || !auth.isLoggedIn) {
      return;
    }

    auth.getActivityLogs().then(setActivityLogs).catch((error) => {
      console.error("Could not load activity logs:", error);
      setActivityLogs([]);
    });
  }, [activeTab, appSettings.showActivityLog, auth.isLoggedIn]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setLoginError("Please enter both username and password");
      return;
    }

    const success = await auth.login(trimmedUsername, trimmedPassword);
    if (!success) {
      setLoginError("Invalid username or password");
      return;
    }

    setLoginError("");
    setUsername("");
    setPassword("");
    setShowLogin(false);
    onLogin?.();
  };

  const handleLogout = () => {
    auth.logout();
    setActiveTab("profile");
  };

  const persistMasterInventory = async (items: Item[], sourceFile: string) => {
    const validItems = items.filter((item) => item.ItemCode?.trim());

    if (validItems.length === 0) {
      throw new Error("No valid inventory rows were found in the selected file.");
    }

    const bins = buildBinsFromItems(validItems);
    const meta: MasterMeta = {
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.username || "unknown",
      sourceFile,
      itemCount: validItems.length,
    };

    await Promise.all([
      api.saveData("rf_master", validItems),
      api.saveData("rf_active", validItems),
      api.saveData("rf_bins", bins),
      api.saveData("rf_master_meta", meta),
    ]);

    localStorage.setItem("rf_master", JSON.stringify(validItems));
    localStorage.setItem("rf_active", JSON.stringify(validItems));
    localStorage.setItem("rf_bins", JSON.stringify(bins));
    localStorage.setItem("rf_master_meta", JSON.stringify(meta));

    setMasterItemCount(validItems.length);
    setMasterMeta(meta);

    await auth.logActivity(
      "Master inventory replaced",
      `${validItems.length} rows loaded from ${sourceFile}`
    );

    return validItems.length;
  };

  const handleMasterInventoryUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      `Replace the current master inventory with "${file.name}"?\n\n` +
        "This replaces the app's active inventory quantities and rebuilds bin data from the uploaded file."
    );

    if (!confirmed) {
      e.target.value = "";
      return;
    }

    setInventoryLoading(true);
    setInventoryStatus(`Parsing ${file.name}...`);

    try {
      const parsedData = await parseCSV(file);
      const count = await persistMasterInventory(parsedData, file.name);
      setInventoryStatus(
        `Master inventory replaced successfully. ${count} inventory rows are now active.`
      );
    } catch (error: any) {
      console.error("Master inventory upload failed:", error);
      setInventoryStatus(
        `Upload failed: ${error?.message || "Could not process inventory file."}`
      );
    } finally {
      setInventoryLoading(false);
      e.target.value = "";
    }
  };

  const handleReloadMasterFromServer = async () => {
    setInventoryLoading(true);
    setInventoryStatus("Reloading saved master inventory from the server...");

    try {
      let masterData = await api.getData("rf_master");

      if (!Array.isArray(masterData) || masterData.length === 0) {
        masterData = await api.getData("rf_active");
      }

      if (!Array.isArray(masterData) || masterData.length === 0) {
        throw new Error("No saved master inventory was found on the server.");
      }

      const bins = buildBinsFromItems(masterData as Item[]);

      localStorage.setItem("rf_master", JSON.stringify(masterData));
      localStorage.setItem("rf_active", JSON.stringify(masterData));
      localStorage.setItem("rf_bins", JSON.stringify(bins));

      await Promise.all([
        api.saveData("rf_active", masterData),
        api.saveData("rf_bins", bins),
      ]);

      setMasterItemCount(masterData.length);
      setInventoryStatus(
        `Reloaded ${masterData.length} inventory rows from the server.`
      );

      await auth.logActivity(
        "Master inventory reloaded",
        `${masterData.length} rows loaded from server storage`
      );
    } catch (error: any) {
      console.error("Master inventory reload failed:", error);
      setInventoryStatus(
        `Reload failed: ${error?.message || "Could not load master inventory."}`
      );
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleClearAllData = () => {
    if (
      window.confirm(
        "Are you sure? This will delete ALL local data including inventory, users, and settings. This cannot be undone."
      )
    ) {
      clearAllData();
      auth.logout();
      window.location.reload();
    }
  };

  const handleAddUser = async () => {
    const trimmedUser = {
      ...newUser,
      username: newUser.username.trim(),
      password: newUser.password.trim(),
      fullName: newUser.fullName.trim(),
    };

    if (!trimmedUser.username || !trimmedUser.password || !trimmedUser.fullName) {
      alert("Please fill in all required fields");
      return;
    }

    if (trimmedUser.username.length < 2) {
      alert("Username must be at least 2 characters");
      return;
    }

    if (trimmedUser.password.length < 3) {
      alert("Password must be at least 3 characters");
      return;
    }

    const success = await auth.addUser(trimmedUser);
    if (!success) {
      alert("Failed to add user. Username may already exist.");
      return;
    }

    setNewUser({
      username: "",
      password: "",
      fullName: "",
      role: "operator",
      isActive: true,
    });
    setShowAddUser(false);
    alert("User added successfully!");
  };

  const handleUpdateUser = async (userId: string, updates: Partial<User>) => {
    const success = await auth.updateUser(userId, updates);
    alert(success ? "User updated successfully!" : "Failed to update user.");
  };

  const handleDeleteUser = async (userId: string, usernameToDelete: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${usernameToDelete}"?`)) {
      return;
    }

    const success = await auth.deleteUser(userId);
    alert(success ? "User deleted successfully!" : "Failed to delete user. Cannot delete yourself.");
  };

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
            <strong>Default credentials:</strong>
            <br />
            Username: admin
            <br />
            Password: admin123
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
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

        <div className="flex border-b overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-6 py-3 font-medium whitespace-nowrap flex-shrink-0 ${
              activeTab === "profile"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <UserIcon size={18} /> Profile
          </button>

          {auth.currentUser?.role === "admin" && (
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-6 py-3 font-medium whitespace-nowrap flex-shrink-0 ${
                activeTab === "users"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users size={18} /> Users
            </button>
          )}

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-6 py-3 font-medium whitespace-nowrap flex-shrink-0 ${
              activeTab === "settings"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <SettingsIcon size={18} /> App Settings
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 px-6 py-3 font-medium whitespace-nowrap flex-shrink-0 ${
              activeTab === "activity"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Activity size={18} /> Activity
          </button>
        </div>

        <div className="p-6">
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
                    {auth.currentUser?.role === "admin" && (
                      <Shield size={18} className="text-red-600" />
                    )}
                    {auth.currentUser?.role === "operator" && (
                      <UserIcon size={18} className="text-blue-600" />
                    )}
                    {auth.currentUser?.role === "viewer" && (
                      <Eye size={18} className="text-gray-600" />
                    )}
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
                      <li>✓ Manage users and inventory master data</li>
                      <li>✓ View activity logs</li>
                      <li>✓ Export data</li>
                    </>
                  )}
                  {auth.currentUser?.role === "operator" && (
                    <>
                      <li>✓ Receive, scan, pick items</li>
                      <li>✓ View inventory</li>
                      <li>✓ Export data</li>
                      <li>✗ Cannot replace master inventory</li>
                    </>
                  )}
                  {auth.currentUser?.role === "viewer" && (
                    <>
                      <li>✓ View inventory</li>
                      <li>✓ View reports</li>
                      <li>✗ Cannot scan or modify items</li>
                      <li>✗ Cannot replace master inventory</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "users" && auth.currentUser?.role === "admin" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">User Management</h3>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  <Plus size={18} /> Add User
                </button>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-gray-700">
                Users are stored on the server and can sign in from any device.
              </div>

              {showAddUser && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium mb-3">Add New User</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Username"
                      value={newUser.username}
                      onChange={(e) =>
                        setNewUser({ ...newUser, username: e.target.value })
                      }
                      className="px-3 py-2 border rounded-md"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser({ ...newUser, password: e.target.value })
                      }
                      className="px-3 py-2 border rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newUser.fullName}
                      onChange={(e) =>
                        setNewUser({ ...newUser, fullName: e.target.value })
                      }
                      className="px-3 py-2 border rounded-md"
                    />
                    <select
                      value={newUser.role}
                      onChange={(e) =>
                        setNewUser({
                          ...newUser,
                          role: e.target.value as "admin" | "operator" | "viewer",
                        })
                      }
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

              <div className="space-y-2">
                {auth.users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      {user.role === "admin" && (
                        <Shield size={18} className="text-red-600" />
                      )}
                      {user.role === "operator" && (
                        <UserIcon size={18} className="text-blue-600" />
                      )}
                      {user.role === "viewer" && (
                        <Eye size={18} className="text-gray-600" />
                      )}
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-gray-600">
                          @{user.username} • {user.role}
                          {!user.isActive && (
                            <span className="text-red-600"> (Inactive)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleUpdateUser(user.id, { isActive: !user.isActive })
                        }
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
                          className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200"
                          aria-label={`Delete ${user.username}`}
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

          {activeTab === "settings" && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4">Application Settings</h3>

              {auth.currentUser?.role === "admin" && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Database size={18} /> Inventory Data
                  </h4>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md space-y-4">
                    <div>
                      <p className="font-medium text-blue-900">Master Inventory</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Current master inventory contains{" "}
                        <strong>{masterItemCount}</strong> rows.
                      </p>
                      {masterMeta.updatedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Last replaced: {new Date(masterMeta.updatedAt).toLocaleString()}
                          {masterMeta.sourceFile
                            ? ` • ${masterMeta.sourceFile}`
                            : ""}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-md text-white font-medium transition ${
                          inventoryLoading
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                        }`}
                      >
                        <Upload size={18} />
                        Upload / Replace Master
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleMasterInventoryUpload}
                          disabled={inventoryLoading}
                          className="hidden"
                        />
                      </label>

                      <button
                        onClick={handleReloadMasterFromServer}
                        disabled={inventoryLoading}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-md hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                      >
                        <RefreshCw
                          size={18}
                          className={inventoryLoading ? "animate-spin" : ""}
                        />
                        Reload From Server
                      </button>
                    </div>

                    {inventoryStatus && (
                      <div className="text-sm bg-white border border-blue-100 rounded-md p-3">
                        {inventoryStatus}
                      </div>
                    )}

                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                      Replacing the master inventory rebuilds bin quantities and
                      replaces the app's active inventory with the uploaded file.
                      Use a fresh SAP export whenever possible so newer RF changes
                      are not overwritten by an older spreadsheet.
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell size={18} /> Notifications & Feedback
                </h4>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span className="flex items-center gap-2">
                    <Volume2 size={18} /> Sound Effects
                  </span>
                  <input
                    type="checkbox"
                    checked={appSettings.soundEnabled}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        soundEnabled: e.target.checked,
                      })
                    }
                    className="w-5 h-5"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Vibration Feedback</span>
                  <input
                    type="checkbox"
                    checked={appSettings.vibrationEnabled}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        vibrationEnabled: e.target.checked,
                      })
                    }
                    className="w-5 h-5"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock size={18} /> Security
                </h4>

                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Auto Logout</span>
                  <input
                    type="checkbox"
                    checked={appSettings.autoLogout}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        autoLogout: e.target.checked,
                      })
                    }
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
                      onChange={(e) =>
                        setAppSettings({
                          ...appSettings,
                          autoLogoutMinutes: parseInt(e.target.value) || 15,
                        })
                      }
                      className="w-20 px-2 py-1 border rounded-md"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  {appSettings.theme === "light" ? (
                    <Sun size={18} />
                  ) : (
                    <Moon size={18} />
                  )}
                  Appearance
                </h4>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Theme</span>
                  <select
                    value={appSettings.theme}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        theme: e.target.value as "light" | "dark",
                      })
                    }
                    className="px-3 py-1 border rounded-md"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark (Coming Soon)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity size={18} /> Privacy
                </h4>
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                  <span>Show Activity Log</span>
                  <input
                    type="checkbox"
                    checked={appSettings.showActivityLog}
                    onChange={(e) =>
                      setAppSettings({
                        ...appSettings,
                        showActivityLog: e.target.checked,
                      })
                    }
                    className="w-5 h-5"
                  />
                </label>
              </div>

              <div className="space-y-3 pt-6 border-t border-gray-200">
                <h4 className="font-medium flex items-center gap-2 text-red-600">
                  <AlertTriangle size={18} /> Danger Zone
                </h4>
                <div className="p-4 bg-red-50 border border-red-200 rounded-md space-y-3">
                  <div>
                    <p className="font-medium text-red-800">Clear Local Data</p>
                    <p className="text-sm text-red-600 mt-1">
                      This clears this browser's local RF data and logs you out.
                      Server-saved inventory can be loaded again after login.
                    </p>
                  </div>
                  <button
                    onClick={handleClearAllData}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} /> Clear Local Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Activity Log</h3>
              {!appSettings.showActivityLog ? (
                <p className="text-center text-gray-500 py-8">
                  Activity log display is disabled in App Settings.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-md">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-gray-600">by {log.username}</p>
                          {log.details && (
                            <p className="text-sm text-gray-500 mt-1">
                              {log.details}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  {activityLogs.length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      No activity logged yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
