// Shapes used only by the counting screens.

/** One bin/item pair in a sequential (bin range or aisle) count. */
export interface SequentialCountItem {
  binCode: string;
  zone: string;
  itemCode: string;
  description: string;
  expectedQty: number;
}

/** One count recorded in a session (kept in rf_session_count_logs). */
export interface SessionCountLog {
  id?: string;
  sessionId: string;
  sessionName: string;
  username: string;
  timestamp: string;
  binCode: string;
  itemCode: string;
  description: string;
  expectedQty: number;
  countedQty: number;
  variance: number;
}

export type ToastState = { message: string; type: "success" | "error" | "info" } | null;
