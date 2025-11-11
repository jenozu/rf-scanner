import { useState, useEffect } from "react";
import { User, ActivityLog } from "../types";
import { api } from "../services/api";

interface AuthState {
  currentUser: User | null;
  users: User[];
  isLoggedIn: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    currentUser: null,
    users: [],
    isLoggedIn: false,
    isLoading: true,
  });

  // Load current user from session storage on mount
  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const currentUserId = sessionStorage.getItem("rf_current_user_id");
        if (currentUserId) {
          // Try to get user from API
          try {
            const user = await api.getUser(currentUserId);
            setAuthState({
              currentUser: user as User,
              users: [],
              isLoggedIn: true,
              isLoading: false,
            });
          } catch (error) {
            // User not found or API error, clear session
            sessionStorage.removeItem("rf_current_user_id");
            setAuthState(prev => ({ ...prev, isLoading: false }));
          }
        } else {
          setAuthState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error("Error loading initial auth state:", error);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };

    loadInitialState();
  }, []);

  // Load users list (for admin user management)
  const loadUsers = async () => {
    try {
      const users = await api.getUsers();
      setAuthState(prev => ({ ...prev, users: users as User[] }));
      return users;
    } catch (error) {
      console.error("Error loading users:", error);
      return [];
    }
  };

  // Initialize default admin user if no users exist
  useEffect(() => {
    const initAdmin = async () => {
      try {
        const users = await api.getUsers();
        if (users.length === 0) {
          // Initialize admin user
          await api.initAdmin();
          await loadUsers();
        }
      } catch (error) {
        console.error("Error initializing admin:", error);
      }
    };

    if (!authState.isLoading && authState.currentUser?.role === "admin") {
      initAdmin();
    }
  }, [authState.isLoading, authState.currentUser?.role]);

  // Load users when admin logs in
  useEffect(() => {
    if (authState.isLoggedIn && authState.currentUser?.role === "admin") {
      loadUsers();
    }
  }, [authState.isLoggedIn, authState.currentUser?.role]);

  // Log activity
  const logActivity = async (action: string, details?: string) => {
    if (!authState.currentUser) return;

    const log: ActivityLog = {
      id: `log-${Date.now()}`,
      userId: authState.currentUser.id,
      username: authState.currentUser.username,
      action,
      timestamp: new Date().toISOString(),
      details,
    };

    try {
      const logs = await api.getData("rf_activity_logs") || [];
      logs.unshift(log); // Add to beginning
      // Keep only last 100 logs
      const trimmedLogs = logs.slice(0, 100);
      await api.saveData("rf_activity_logs", trimmedLogs);
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await api.login(username, password);
      const user = response.user;

      setAuthState({
        currentUser: user as User,
        users: [],
        isLoggedIn: true,
        isLoading: false,
      });

      sessionStorage.setItem("rf_current_user_id", user.id);
      
      // Load users if admin
      if (user.role === "admin") {
        await loadUsers();
      }

      await logActivity("Logged in", `User ${username} logged in`);
      return true;
    } catch (error: any) {
      console.error("Login error:", error);
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    if (authState.currentUser) {
      await logActivity("Logged out", `User ${authState.currentUser.username} logged out`);
    }

    // Clear token and user data
    api.logout();

    setAuthState({
      currentUser: null,
      users: [],
      isLoggedIn: false,
      isLoading: false,
    });
  };

  // Add new user (admin only)
  const addUser = async (user: Omit<User, "id" | "createdDate">): Promise<boolean> => {
    if (!authState.currentUser || authState.currentUser.role !== "admin") {
      return false;
    }

    try {
      const newUser = await api.createUser({
        username: user.username,
        password: user.password || "",
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
      });

      await loadUsers(); // Refresh users list
      await logActivity("User created", `Created user: ${user.username}`);
      return true;
    } catch (error: any) {
      console.error("Error creating user:", error);
      return false;
    }
  };

  // Update user (admin only)
  const updateUser = async (userId: string, updates: Partial<User>): Promise<boolean> => {
    if (!authState.currentUser || authState.currentUser.role !== "admin") {
      return false;
    }

    try {
      await api.updateUser(userId, updates);
      await loadUsers(); // Refresh users list
      
      // Update current user if it's the same user
      if (authState.currentUser.id === userId) {
        setAuthState(prev => ({
          ...prev,
          currentUser: { ...prev.currentUser!, ...updates } as User,
        }));
      }

      await logActivity("User updated", `Updated user ID: ${userId}`);
      return true;
    } catch (error: any) {
      console.error("Error updating user:", error);
      return false;
    }
  };

  // Delete user (admin only)
  const deleteUser = async (userId: string): Promise<boolean> => {
    if (!authState.currentUser || authState.currentUser.role !== "admin") {
      return false;
    }

    // Can't delete yourself
    if (userId === authState.currentUser.id) {
      return false;
    }

    try {
      await api.deleteUser(userId);
      await loadUsers(); // Refresh users list
      await logActivity("User deleted", `Deleted user ID: ${userId}`);
      return true;
    } catch (error: any) {
      console.error("Error deleting user:", error);
      return false;
    }
  };

  // Get activity logs
  const getActivityLogs = async (): Promise<ActivityLog[]> => {
    try {
      return (await api.getData("rf_activity_logs")) || [];
    } catch (error) {
      console.error("Error loading activity logs:", error);
      return [];
    }
  };

  return {
    currentUser: authState.currentUser,
    users: authState.users,
    isLoggedIn: authState.isLoggedIn,
    isLoading: authState.isLoading,
    login,
    logout,
    addUser,
    updateUser,
    deleteUser,
    logActivity,
    getActivityLogs,
    loadUsers,
  };
}
