/**
 * API client for RF Scanner backend.
 * In Vercel preview mode every request is routed to an isolated local demo adapter.
 */

import { demoRequest, isDemoMode } from "../demo/demo-mode";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/** Error from the API with the HTTP status and any extra fields the server sent. */
export class ApiError extends Error {
  status: number;
  details: Record<string, unknown>;
  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export interface AuthResponse {
  user: any;
  token: string;
  expiresIn: string;
}

class ApiClient {
  private getToken(): string | null {
    return sessionStorage.getItem("rf_auth_token");
  }

  private setToken(token: string): void {
    sessionStorage.setItem("rf_auth_token", token);
  }

  private clearToken(): void {
    sessionStorage.removeItem("rf_auth_token");
    sessionStorage.removeItem("rf_current_user_id");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return (await this.requestFull<T>(endpoint, options)).body;
  }

  /** Like request, but also returns the response headers (null in demo mode). */
  private async requestFull<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ body: T; headers: Headers | null }> {
    if (isDemoMode()) {
      return { body: await demoRequest<T>(endpoint, options), headers: null };
    }

    const url = `${API_BASE}${endpoint}`;
    const token = this.getToken();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Unknown error" }));

        if (response.status === 401 && error.expired) {
          this.clearToken();
          throw new ApiError("Session expired. Please login again.", 401, error);
        }

        throw new ApiError(error.error || `HTTP ${response.status}`, response.status, error);
      }

      return { body: (await response.json()) as T, headers: response.headers };
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  async getUsers() {
    return this.request<any[]>("/users");
  }

  async getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }

  async login(username: string, password: string) {
    const response = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

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
    return this.request<any>("/users", {
      method: "POST",
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, updates: any) {
    return this.request<any>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id: string) {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: "DELETE",
    });
  }


  async getData(key: string) {
    return this.request<any>(`/data/${key}`);
  }

  /** Data plus its revision (null when the server does not report one). */
  async getDataWithRevision(key: string): Promise<{ data: any; revision: string | null }> {
    const { body, headers } = await this.requestFull<any>(`/data/${key}`);
    return { data: body, revision: headers?.get("X-Revision") ?? null };
  }

  /**
   * Replace a whole collection. With baseRevision the server refuses (409) if the
   * data changed since it was read; without it the last save wins.
   */
  async saveData(key: string, data: any, baseRevision?: string | null) {
    return this.request<{ message: string; revision?: string }>(`/data/${key}`, {
      method: "POST",
      body: JSON.stringify({ data, ...(baseRevision ? { baseRevision } : {}) }),
    });
  }

  // --- Operations that change one thing atomically on the server (server/ops.js) ---

  private post<T>(endpoint: string, body: unknown, method = "POST") {
    return this.request<T>(endpoint, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  appendRecords(key: string, records: any[]) {
    return this.post<{ added: number; total: number }>("/ops/append", { key, records });
  }

  adjustBin(params: {
    binCode: string;
    itemCode: string;
    description?: string;
    delta?: number;
    setQuantity?: number;
    clampAtZero?: boolean;
    createBin?: { Zone?: string; Capacity?: number; Status?: string };
    lots?: Array<{ lotCode: string; qty: number }>;
    serialsAdd?: string[];
    serialsRemove?: string[];
  }) {
    return this.post<{ ok: true; bin: any; quantity: number; previous: number }>("/ops/bin-adjust", params);
  }

  receivePoLine(params: {
    poId: string;
    lineIndex: number;
    qty: number;
    binCode?: string;
    lots?: Array<{ lotCode: string; qty: number }>;
    serials?: string[];
  }) {
    return this.post<{ ok: true; po: any }>("/ops/po-receive", params);
  }

  pickSoLine(params: { soId: string; lineIndex: number; qty: number }) {
    return this.post<{ ok: true; so: any }>("/ops/so-pick", params);
  }

  /** One receipt: PO line + bin quantity + receiving log in a single request. Safe to retry with the same txnId. */
  receiveStock(params: {
    poId: string;
    lineIndex: number;
    qty: number;
    binCode: string;
    txnId: string;
    createBin?: { Zone?: string; Capacity?: number; Status?: string };
    lots?: Array<{ lotCode: string; qty: number }>;
    serials?: string[];
  }) {
    return this.post<{ ok: true; duplicate?: boolean; po?: any; bin?: any; quantity?: number; txn?: any }>(
      "/ops/receive", params);
  }

  /** One pick: sales-order line + stock taken from the bin in a single request. */
  pickSalesOrderLine(params: { soId: string; lineIndex: number; qty: number; binCode?: string }) {
    return this.post<{ ok: true; so: any; binQuantity: number | null }>("/ops/pick-so", params);
  }

  upsertRecord(key: string, record: { id: string }) {
    return this.post<{ ok: true; created: boolean }>(
      `/records/${key}/${encodeURIComponent(record.id)}`, { record }, "PUT");
  }

  deleteRecord(key: string, id: string) {
    return this.post<{ message: string }>(`/records/${key}/${encodeURIComponent(id)}`, undefined, "DELETE");
  }

  /** Several record changes in one request: add/replace the upserted records, delete the removed ids. */
  applyRecordChanges(key: string, changes: { upsert: Array<{ id: string }>; remove: string[] }) {
    return this.post<{ ok: true; added: number; updated: number; removed: number }>(
      `/records/${key}/apply`, changes);
  }

  /** Create bins and set item quantities (absolute, as counting does), all or nothing. */
  setBinQuantities(params: {
    newBins?: Array<{ BinCode: string; Zone?: string; Capacity?: number; Status?: string }>;
    changes?: Array<{ binCode: string; itemCode: string; description?: string; setQuantity: number }>;
  }) {
    return this.post<{ ok: true; bins: number; changed: number; created: number }>("/ops/bins-set", params);
  }

  upsertManyRecords(key: string, records: Array<{ id: string }>, skipExisting = false) {
    return this.post<{ added: number; updated: number; skipped: number; total: number }>(
      `/records/${key}/upsert-many`, { records, skipExisting });
  }

  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>("/health");
  }

  async checkBinAvailability(startBin: string, endBin: string, sessionId: string) {
    return this.request<{ available: boolean; conflicts: any[] }>("/bins/check-availability", {
      method: "POST",
      body: JSON.stringify({ startBin, endBin, sessionId }),
    });
  }

  async lockBins(
    startBin: string,
    endBin: string,
    sessionId: string,
    sessionName: string,
    username: string
  ) {
    return this.request<{ message: string }>("/bins/lock", {
      method: "POST",
      body: JSON.stringify({ startBin, endBin, sessionId, sessionName, username }),
    });
  }

  async unlockBins(sessionId: string) {
    return this.request<{ message: string }>("/bins/unlock", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });
  }
}

export const api = new ApiClient();
