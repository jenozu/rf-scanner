import { useState, useEffect } from "react";
import { User, ActivityLog } from "../types";

interface AuthState {
  currentUser: User | null;
  users: User[];
  isLoggedIn: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    try {
      const users = JSON.parse(localStorage.getItem("rf_users") || "[]");
      const currentUserId = localStorage.getItem("rf_current_user_id");
      const currentUser = currentUserId 
        ? users.find((u: User) => u.id === currentUserId) || null
        : null;
      
      return {
        currentUser,
        users,
        isLoggedIn: !!currentUser,
      };
    } catch (error) {
      console.error("Error loading auth state:", error);
      return {
        currentUser: null,
        users: [],
        isLoggedIn: false,
      };
    }
  });

  // Initialize default admin user if no users exist
  useEffect(() => {
    if (authState.users.length === 0) {
      const defaultAdmin: User = {
        id: "user-1",
        username: "admin",
        password: "admin123", // In production, use proper password hashing
        fullName: "Administrator",
        role: "admin",
        isActive: true,
        createdDate: new Date().toISOString(),
      };
      
      const updatedUsers = [defaultAdmin];
      localStorage.setItem("rf_users", JSON.stringify(updatedUsers));
      setAuthState(prev => ({ ...prev, users: updatedUsers }));
    }
  }, [authState.users.length]);

  // Save users to localStorage whenever they change
  useEffect(() => {
    if (authState.users.length > 0) {
      localStorage.setItem("rf_users", JSON.stringify(authState.users));
    }
  }, [authState.users]);

  // Log activity
  const logActivity = (action: string, details?: string) => {
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
      const logs = JSON.parse(localStorage.getItem("rf_activity_logs") || "[]");
      logs.unshift(log); // Add to beginning
      // Keep only last 100 logs
      const trimmedLogs = logs.slice(0, 100);
      localStorage.setItem("rf_activity_logs", JSON.stringify(trimmedLogs));
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  // Login function
  const login = (username: string, password: string): boolean => {
    const user = authState.users.find(
      u => u.username === username && u.password === password && u.isActive
    );

    if (user) {
      const updatedUser = { ...user, lastLogin: new Date().toISOString() };
      const updatedUsers = authState.users.map(u => 
        u.id === user.id ? updatedUser : u
      );

      setAuthState({
        currentUser: updatedUser,
        users: updatedUsers,
        isLoggedIn: true,
      });

      localStorage.setItem("rf_current_user_id", user.id);
      localStorage.setItem("rf_users", JSON.stringify(updatedUsers));

      logActivity("Logged in", `User ${username} logged in`);
      return true;
    }

    return false;
  };

  // Logout function
  const logout = () => {
    if (authState.currentUser) {
      logActivity("Logged out", `User ${authState.currentUser.username} logged out`);
    }

    setAuthState({
      ...authState,
      currentUser: null,
      isLoggedIn: false,
    });

    localStorage.removeItem("rf_current_user_id");
  };

  // Add new user (admin only)
  const addUser = (user: Omit<User, "id" | "createdDate">): boolean => {
    if (!authState.currentUser || authState.currentUser.role !== "admin") {
      return false;
    }

    // Check if username already exists
    if (authState.users.some(u => u.username === user.username)) {
      return false;
    }

    const newUser: User = {
      ...user,
      id: `user-${Date.now()}`,
      createdDate: new Date().toISOString(),
    };

    const updatedUsers = [...authState.users, newUser];
    setAuthState(prev => ({ ...prev, users: updatedUsers }));

    logActivity("User created", `Created user: ${user.username}`);
    return true;
  };

  // Update user (admin only)
  const updateUser = (userId: string, updates: Partial<User>): boolean => {
    if (!authState.currentUser || authState.currentUser.role !== "admin") {
      return false;
    }

    const updatedUsers = authState.users.map(u =>
      u.id === userId ? { ...u, ...updates } : u
    );

    setAuthState(prev => ({
      ...prev,
      users: updatedUsers,
      currentUser: prev.currentUser?.id === userId 
        ? { ...prev.currentUser, ...updates } 
        : prev.currentUser,
    }));

    logActivity("User updated", `Updated user ID: ${userId}`);
    return true;
  };

  // Delete user (admin only)
  const deleteUser = (userId: string): boolean => {
    if (!authState.currentUser || authState.currentUser.role !== "admin") {
      return false;
    }

    // Can't delete yourself
    if (userId === authState.currentUser.id) {
      return false;
    }

    const updatedUsers = authState.users.filter(u => u.id !== userId);
    setAuthState(prev => ({ ...prev, users: updatedUsers }));

    logActivity("User deleted", `Deleted user ID: ${userId}`);
    return true;
  };

  // Get activity logs
  const getActivityLogs = (): ActivityLog[] => {
    try {
      return JSON.parse(localStorage.getItem("rf_activity_logs") || "[]");
    } catch (error) {
      console.error("Error loading activity logs:", error);
      return [];
    }
  };

  return {
    currentUser: authState.currentUser,
    users: authState.users,
    isLoggedIn: authState.isLoggedIn,
    login,
    logout,
    addUser,
    updateUser,
    deleteUser,
    logActivity,
    getActivityLogs,
  };
}

