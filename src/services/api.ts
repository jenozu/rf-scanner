/**
 * API client for RF Scanner backend
 * Handles all communication with the server API
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface AuthResponse {
  user: any;
  token: string;
  expiresIn: string;
}

class ApiClient {
  private getToken(): string | null {
    return sessionStorage.getItem('rf_auth_token');
  }

  private setToken(token: string): void {
    sessionStorage.setItem('rf_auth_token', token);
  }

  private clearToken(): void {
    sessionStorage.removeItem('rf_auth_token');
    sessionStorage.removeItem('rf_current_user_id');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Handle token expiration
        if (response.status === 401 && error.expired) {
          this.clearToken();
          throw new Error('Session expired. Please login again.');
        }
        
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // User endpoints
  async getUsers() {
    return this.request<any[]>('/users');
  }

  async getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }

  async login(username: string, password: string) {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    // Store the token
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  logout() {
    this.clearToken();
  }

  async createUser(user: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    isActive?: boolean;
  }) {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, updates: any) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async initAdmin() {
    return this.request<{ message: string; user: any }>('/users/init-admin', {
      method: 'POST',
    });
  }

  // Data endpoints
  async getData(key: string) {
    return this.request<any>(`/data/${key}`);
  }

  async saveData(key: string, data: any) {
    return this.request<{ message: string }>(`/data/${key}`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

export const api = new ApiClient();

