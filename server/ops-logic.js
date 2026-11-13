// Pure operation logic shared by the API (server/ops.js) and the browser demo
// backend (src/demo/demo-mode.ts). Each apply* function takes the current stored
// value and the request, and returns { data?, result }:
//   data   - the new value to save (omit to save nothing)
//   result - what to send back; { error, status, ... } means "refuse".
// Keep this file free of Node-only imports so it also runs in the browser.

import { QTY_EPSILON, roundQty } from './order-identity.js';
import { ordersInOpenWaves, waveMembers, hasPickedLines, hasOpenLines } from './waves.js';

export const APPEND_KEYS = {
  rf_receiving_txns: { cap: null },
  rf_pick_txns: { cap: null },
  rf_cycle_count_txns: { cap: null },
  rf_activity_logs: { cap: 100 },
  rf_session_count_logs: { cap: null },
};
export const RECORD_KEYS = [
  'rf_purchase_orders', 'rf_sales_orders', 'rf_waves', 'rf_orders',
  'rf_cycle_counts', 'rf_inventory_sessions', 'rf_temporary_locations',
];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const fail = (error, status = 400, extra = {}) => ({ error, status, ...extra });

function mergeLots(existing = [], changes = []) {
  const byCode = new Map(existing.map(l => [l.lotCode, { ...l }]));
  for (const { lotCode, qty } of changes) {
    const cur = byCode.get(lotCode) || { lotCode, qty: 0 };
    cur.qty += qty;
    byCode.set(lotCode, cur);
  }
  return [...byCode.values()].filter(l => l.qty > 0);
}

export function validateAppend(body) {
  const { key } = body || {};
  if (!APPEND_KEYS[key]) return fail('Invalid key for append');
  const records = body.records ?? (body.record !== undefined ? [body.record] : null);
  if (!Array.isArray(records) || records.length === 0 ||
      !records.every(r => isObject(r) && typeof r.id === 'string' && r.id)) {
    return fail('record(s) with a string id are required');
  }
  return null;
}

// Add records to the front of a list; ids already present are skipped (safe to retry).
export function applyAppend(current, body) {
  const config = APPEND_KEYS[body.key];
  const records = body.records ?? [body.record];
  const list = current || [];
  const seen = new Set(list.map(r => r?.id));
  const fresh = records.filter(r => !seen.has(r.id));
  let next = [...fresh, ...list];
  if (config.cap) next = next.slice(0, config.cap);
  return { data: next, result: { added: fresh.length, total: next.length } };
}

export function validateBinAdjust(body) {
  const { binCode, itemCode, delta, setQuantity, lots, serialsAdd, serialsRemove } = body || {};
  if (typeof binCode !== 'string' || !binCode || typeof itemCode !== 'string' || !itemCode) {
    return fail('binCode and itemCode are required');
  }
  const hasDelta = delta !== undefined, hasSet = setQuantity !== undefined;
  if (hasDelta === hasSet) return fail('Send exactly one of delta or setQuantity');
  if (num(hasDelta ? delta : setQuantity) === null) return fail('Quantity must be a number');
  if (hasSet && setQuantity < 0) return fail('setQuantity cannot be negative');
  if (lots !== undefined && !(Array.isArray(lots) && lots.every(l => l && typeof l.lotCode === 'string' && num(l.qty) !== null))) {
    return fail('lots must be [{ lotCode, qty }]');
  }
  for (const list of [serialsAdd, serialsRemove]) {
    if (list !== undefined && !(Array.isArray(list) && list.every(s => typeof s === 'string'))) {
      return fail('serials must be arrays of strings');
    }
  }
  return null;
}

// Change one item's quantity in one bin: delta (+/-) or setQuantity (absolute).
export function applyBinAdjust(current, body) {
  const { binCode, itemCode, description, delta, setQuantity, clampAtZero, createBin,
          lots, serialsAdd, serialsRemove } = body;
  const hasSet = setQuantity !== undefined;
  const bins = current || [];
  let bin = bins.find(b => b.BinCode === binCode);
  if (!bin) {
    if (!isObject(createBin)) return { result: fail('Bin not found', 404) };
    bin = { BinCode: binCode, Zone: createBin.Zone || 'Main', Capacity: num(createBin.Capacity) ?? 1000,
            Status: createBin.Status || 'active', Items: [] };
    bins.push(bin);
  }
  bin.Items = bin.Items || [];
  let item = bin.Items.find(i => i.ItemCode === itemCode);
  const before = item ? Number(item.Quantity) || 0 : 0;
  let after = hasSet ? setQuantity : before + delta;
  if (after < 0) {
    if (!clampAtZero) return { result: fail('Insufficient quantity in bin', 409, { available: before }) };
    after = 0;
  }
  if (!item) {
    item = { ItemCode: itemCode, Description: description || '', Quantity: 0 };
    bin.Items.push(item);
  } else if (description && !item.Description) {
    item.Description = description;
  }
  item.Quantity = after;
  if (lots) {
    const merged = mergeLots(item.Lots, lots);
    if (merged.length) item.Lots = merged; else delete item.Lots;
  }
  if (serialsAdd || serialsRemove) {
    const remove = new Set(serialsRemove || []);
    const serials = [...new Set([...(item.Serials || []), ...(serialsAdd || [])])].filter(s => !remove.has(s));
    if (serials.length) item.Serials = serials; else delete item.Serials;
  }
  return { data: bins, result: { ok: true, bin, quantity: after, previous: before } };
}

// ---- Addressing one order line ----
// A line is named by its LineKey ("<DocNum>:<LineNumber>"), which survives a re-import that adds,
// removes or re-orders lines. A bare position (lineIndex) is only accepted for orders imported
// before line keys existed; on a keyed line it is refused, because the position may have moved.
function validateLineRef(body, idField) {
  if (typeof body?.[idField] !== 'string' || !body[idField]) return fail(`${idField} and lineKey are required`);
  const { lineKey, lineIndex } = body;
  const hasKey = typeof lineKey === 'string' && lineKey !== '';
  const hasIndex = Number.isInteger(lineIndex) && lineIndex >= 0;
  if (!hasKey && !hasIndex) return fail(`${idField} and lineKey are required`);
  return null;
}

function findLine(items, body, label) {
  const list = items || [];
  if (typeof body.lineKey === 'string' && body.lineKey !== '') {
    const index = list.findIndex((l) => l?.LineKey === body.lineKey);
    if (index < 0) return { error: fail(`${label} line ${body.lineKey} not found`, 404, { code: 'LINE_NOT_FOUND' }) };
    return { line: list[index], index };
  }
  const line = list[body.lineIndex];
  if (!line) return { error: fail(`${label} line not found`, 404, { code: 'LINE_NOT_FOUND' }) };
  if (line.LineKey) {
    return { error: fail(`${label} line ${body.lineIndex} has a line key (${line.LineKey}); send the line key, not a position`, 409, { code: 'LINE_KEY_REQUIRED' }) };
  }
  return { line, index: body.lineIndex };
}

const openQty = (line) => Math.max(0, roundQty((Number(line.OrderedQty) || 0) - (Number(line.ReceivedQty ?? line.DeliveredQty) || 0)));
const isClosed = (line) => line?.SapClosed === true;
const closedError = (line) => fail(`Line ${line.LineKey || line.LineNumber} is no longer in SAP's export and is closed`, 409, { code: 'LINE_CLOSED' });

function validateLineOp(body, idField) {
  const problem = validateLineRef(body, idField);
  if (problem) return problem;
  if (num(body.qty) === null || body.qty <= 0) return fail('qty must be a positive number');
  return null;
}
export const validatePoReceive = (body) => validateLineOp(body, 'poId');
export const validateSoPick = (body) => validateLineOp(body, 'soId');

// Receive quantity against exactly one PO line. Refused (nothing changed) when it would take the
// line past its ordered quantity or the line is closed.
export function applyPoReceive(current, body) {
  const { poId, qty, binCode, lots, serials } = body;
  const pos = current || [];
  const po = pos.find(p => p.id === poId);
  if (!po) return { result: fail('PO not found', 404) };
  const found = findLine(po.items, body, 'PO');
  if (found.error) return { result: found.error };
  const { line } = found;
  if (isClosed(line)) return { result: closedError(line) };
  if (binCode !== undefined && binCode !== '' && !classifyBin(binCode, line.Warehouse).real) {
    return { result: fail(`${classifyBin(binCode, line.Warehouse).reason}. Receive into a real bin.`, 409, { code: 'NO_REAL_BIN' }) };
  }
  const remaining = openQty({ OrderedQty: line.OrderedQty, ReceivedQty: line.ReceivedQty });
  if (qty > remaining + QTY_EPSILON) {
    return { result: fail(`Only ${remaining} left to receive on this line (asked for ${qty})`, 409, { code: 'OVER_RECEIPT', remaining, requested: qty }) };
  }
  line.ReceivedQty = roundQty((Number(line.ReceivedQty) || 0) + qty);
  line.RemainingQty = openQty({ OrderedQty: line.OrderedQty, ReceivedQty: line.ReceivedQty });
  if (binCode) line.BinCode = binCode;
  if (lots !== undefined) line.Lots = lots;
  if (serials !== undefined) line.Serials = serials;
  const allReceived = po.items.filter((i) => !isClosed(i)).every(i => openQty({ OrderedQty: i.OrderedQty, ReceivedQty: i.ReceivedQty }) <= QTY_EPSILON);
  po.status = allReceived ? 'completed' : 'receiving';
  if (allReceived) po.receivedDate = new Date().toISOString();
  return { data: pos, result: { ok: true, po, line } };
}

// Record a pick on a sales-order line and recompute the order's status. Callers have already
// checked the cap. An order that has shipped stays shipped (a late pick must not undo that).
function recordPick(so, line, qty, user, short) {
  line.DeliveredQty = roundQty((Number(line.DeliveredQty) || 0) + qty);
  line.RemainingQty = openQty({ OrderedQty: line.OrderedQty, ReceivedQty: line.DeliveredQty });
  if (short) {
    line.ShortPick = { reason: short.reason.trim(), qtyPicked: line.DeliveredQty, stillOpen: line.RemainingQty,
                       by: user?.username || 'unknown', at: new Date().toISOString() };
  } else if (line.RemainingQty <= QTY_EPSILON) {
    delete line.ShortPick;
  } else if (line.ShortPick) {
    line.ShortPick = { ...line.ShortPick, qtyPicked: line.DeliveredQty, stillOpen: line.RemainingQty };
  }
  if (so.status === 'shipped') return;
  const allPicked = so.items.filter((i) => !isClosed(i)).every(i => (Number(i.RemainingQty) || 0) <= QTY_EPSILON);
  so.status = allPicked ? 'picked' : 'picking';
  so.shippedDate = allPicked ? new Date().toISOString().split('T')[0] : undefined;
}

// Pick quantity against exactly one sales-order line (no stock, no scan: see applyPickSo).
export function applySoPick(current, body, user) {
  const { soId, qty } = body;
  const sos = current || [];
  const so = sos.find(s => s.id === soId);
  if (!so) return { result: fail('Sales order not found', 404) };
  const found = findLine(so.items, body, 'Sales order');
  if (found.error) return { result: found.error };
  const { line } = found;
  if (isClosed(line)) return { result: closedError(line) };
  const remaining = openQty({ OrderedQty: line.OrderedQty, ReceivedQty: line.DeliveredQty });
  if (qty > remaining + QTY_EPSILON) {
    return { result: fail(`Only ${remaining} left to pick on this line (asked for ${qty})`, 409, { code: 'OVER_PICK', remaining, requested: qty }) };
  }
  recordPick(so, line, qty, user, null);
  return { data: sos, result: { ok: true, so, line } };
}

// --- Shipping ---
export function validateShip(body) {
  const { shipments } = body || {};
  if (!Array.isArray(shipments) || shipments.length === 0 ||
      !shipments.every(x => isObject(x) && typeof x.soId === 'string' && x.soId && typeof x.shipmentPin === 'string' && x.shipmentPin.trim())) {
    return fail('shipments must be [{ soId, shipmentPin }]');
  }
  return null;
}

// Mark orders shipped. Only status, shipmentPin and shippedDate are touched, under the file's
// lock, so it can never overwrite a pick that landed a moment earlier. Repeating the same PIN is
// fine; a different PIN on a shipped order is refused. If any order is unknown nothing changes.
export function applyShip(current, body) {
  const sos = current || [];
  for (const { soId, shipmentPin } of body.shipments) {
    const so = sos.find(s => s.id === soId);
    if (!so) return { result: fail(`Sales order ${soId} not found`, 404) };
    if (so.status === 'shipped' && so.shipmentPin && so.shipmentPin !== shipmentPin.trim()) {
      return { result: fail(`Sales order ${so.soNumber} is already shipped with PIN ${so.shipmentPin}`, 409, { code: 'ALREADY_SHIPPED' }) };
    }
  }
  const shipped = [];
  for (const { soId, shipmentPin } of body.shipments) {
    const so = sos.find(s => s.id === soId);
    if (!(so.status === 'shipped' && so.shipmentPin === shipmentPin.trim())) {
      so.status = 'shipped';
      so.shipmentPin = shipmentPin.trim();
      so.shippedDate = new Date().toISOString();
    }
    shipped.push(so);
  }
  return { data: sos, result: { ok: true, orders: shipped } };
}

// Purchase and sales orders are changed only through the order operations (import, receive, pick,
// assign bin, ship), never by saving a whole record from a screen that may be out of date: that
// could silently undo a pick or receipt made on another device.
const ORDER_KEYS = ['rf_purchase_orders', 'rf_sales_orders'];
export function blockOrderWrites(key, writesRecords = true) {
  return writesRecords && ORDER_KEYS.includes(key)
    ? fail('Orders are changed through the order operations (import, receive, pick, ship), not by saving the whole record', 409, { code: 'USE_ORDER_OPERATIONS' })
    : null;
}

export function validateRecordKey(key) {
  return RECORD_KEYS.includes(key) ? null : fail('Invalid key for records');
}

export function validateRecordUpsert(id, body) {
  const record = body?.record;
  return isObject(record) && record.id === id ? null : fail('record.id must match the URL id');
}

export function applyRecordUpsert(current, record) {
  const list = current || [];
  const i = list.findIndex(r => r.id === record.id);
  if (i >= 0) list[i] = record; else list.push(record);
  return { data: list, result: { ok: true, created: i < 0 } };
}

export function applyRecordDelete(current, id) {
  const list = current || [];
  const next = list.filter(r => r.id !== id);
  return next.length === list.length
    ? { result: fail('Record not found', 404) }
    : { data: next, result: { message: 'Record deleted' } };
}

export function validateUpsertMany(body) {
  const { records } = body || {};
  return Array.isArray(records) && records.every(r => isObject(r) && typeof r.id === 'string' && r.id)
    ? null : fail('records with a string id are required');
}

// Add or update many records at once (imports). skipExisting leaves stored records alone.
export function applyUpsertMany(current, body) {
  const list = current || [];
  let added = 0, updated = 0, skipped = 0;
  for (const record of body.records) {
    const i = list.findIndex(r => r.id === record.id);
    if (i < 0) { list.push(record); added++; }
    else if (body.skipExisting) skipped++;
    else { list[i] = record; updated++; }
  }
  return { data: list, result: { added, updated, skipped, total: list.length } };
}

// --- Real-bin rule ---
// A bin is "real" when a picker can walk to it. These are not: blank values, placeholders
// like NO-BIN, SAP's system bin (e.g. 01-SYSTEM-BIN-LOCATION, which stock lands in when an
// item has no default bin), and a bare warehouse code such as "01".
const PLACEHOLDER_BIN = /^(NO[\s_-]*BIN|N\/?A|NONE|NULL|UNASSIGNED|TBD|\?+|-+)$/i;
const SYSTEM_BIN = /SYSTEM[\s_-]*BIN/i;
const WAREHOUSE_ONLY = /^\d{1,2}$/;

// --- Warehouses ---
// 01 is the main warehouse. 05 holds one customer's parts (special discount) and uses the SAME
// bin codes as 01, so a bin never tells you the warehouse: the line's own warehouse does.
export const WAREHOUSE_NAMES = { '01': 'Main', '05': 'Customer stock' };
export const CUSTOMER_WAREHOUSE = '05';

// SAP exports and Excel cells write the same warehouse as 5, "5", "05" or " 05 ". Make them one value.
export function normalizeWarehouse(value) {
  const text = String(value ?? '').trim().toUpperCase();
  return /^\d{1,2}$/.test(text) ? text.padStart(2, '0') : text;
}

export const isCustomerWarehouse = (warehouse) => normalizeWarehouse(warehouse) === CUSTOMER_WAREHOUSE;

export function classifyBin(code, warehouse) {
  const value = String(code ?? '').trim();
  if (!value) return { kind: 'blank', real: false, reason: 'No bin on this line' };
  if (SYSTEM_BIN.test(value)) return { kind: 'system', real: false, reason: `${value} is SAP's system bin, not a shelf` };
  if (PLACEHOLDER_BIN.test(value)) return { kind: 'placeholder', real: false, reason: `"${value}" is a placeholder, not a bin` };
  const wh = normalizeWarehouse(warehouse);
  if (WAREHOUSE_ONLY.test(value) || (wh && value.toUpperCase() === wh)) {
    return { kind: 'warehouse-only', real: false, reason: `"${value}" is a warehouse code, not a bin` };
  }
  return { kind: 'real', real: true, reason: '' };
}

export const isRealBin = (code, warehouse) => classifyBin(code, warehouse).real;

export function validateAssignBin(body) {
  const { binCode } = body || {};
  const problem = validateLineRef(body, 'soId');
  if (problem) return problem;
  if (typeof binCode !== 'string' || !binCode.trim()) return fail('binCode is required');
  return null;
}

// Give one sales-order line a real, existing bin. The first time, SAP's original value is
// kept in OriginalBinCode so the owner can fix the item's default bin in SAP afterwards.
// state is { sos, bins }; user is the signed-in user (for the record of who changed it).
export function applyAssignBin(state, body, user) {
  const { soId } = body;
  const code = String(body.binCode).trim().toUpperCase();
  const so = (state.sos || []).find(s => s.id === soId);
  if (!so) return { result: fail('Sales order not found', 404) };
  const found = findLine(so.items, body, 'Sales order');
  if (found.error) return { result: found.error };
  const { line } = found;

  const check = classifyBin(code, line.Warehouse);
  if (!check.real) return { result: fail(`${check.reason}. Choose a real bin.`, 400, { code: 'NOT_A_REAL_BIN' }) };
  const exists = (state.bins || []).some(b => String(b.BinCode ?? '').trim().toUpperCase() === code);
  if (!exists) return { result: fail(`Bin ${code} is not in the system. Choose an existing bin.`, 404, { code: 'BIN_NOT_FOUND' }) };

  const before = String(line.BinCode ?? '').trim();
  if (line.OriginalBinCode === undefined && before !== '' && before.toUpperCase() !== code) {
    line.OriginalBinCode = line.BinCode;
  }
  line.BinCode = code;
  line.BinAssignedBy = user?.username || 'unknown';
  line.BinAssignedAt = new Date().toISOString();
  return { data: { sos: state.sos, bins: state.bins }, result: { ok: true, so, line } };
}

export function validateAssignItemBin(body) {
  const { itemCode, binCode } = body || {};
  if (typeof itemCode !== 'string' || !itemCode.trim()) return fail('itemCode is required');
  if (typeof binCode !== 'string' || !binCode.trim()) return fail('binCode is required');
  return null;
}

// Make a real bin the item's default bin (the BinCode on every master and active row for
// that ItemCode). state is { master, active }; a list that is not stored yet is left alone.
// An item that is in neither list changes nothing and reports updated: 0.
export function applyAssignItemBin(state, body, user) {
  const itemCode = String(body.itemCode).trim().toUpperCase();
  const code = String(body.binCode).trim().toUpperCase();
  const check = classifyBin(code, body.warehouse);
  if (!check.real) return { result: fail(`${check.reason}. Choose a real bin.`, 400, { code: 'NOT_A_REAL_BIN' }) };

  const who = user?.username || 'unknown';
  const at = new Date().toISOString();
  let updated = 0;
  const stamp = (list) => (list || []).map((row) => {
    if (String(row.ItemCode ?? '').trim().toUpperCase() !== itemCode) return row;
    updated++;
    return { ...row, BinCode: code, BinAssignedBy: who, BinAssignedAt: at };
  });
  const master = state.master ? stamp(state.master) : undefined;
  const active = state.active ? stamp(state.active) : undefined;
  return {
    data: { master, active },
    result: { ok: true, itemCode, binCode: code, updated },
  };
}

// --- Composite operations (several collections changed together) ---

export function validateReceive(body) {
  const problem = validatePoReceive(body);
  if (problem) return problem;
  if (typeof body.binCode !== 'string' || !body.binCode) return fail('binCode is required');
  if (typeof body.txnId !== 'string' || !body.txnId) return fail('txnId is required');
  return validateBinAdjust({
    binCode: body.binCode, itemCode: 'x', delta: body.qty, lots: body.lots,
    serialsAdd: body.serials,
  });
}

// One receipt = PO line + bin quantity + receiving log, applied together.
// state is { pos, bins, txns } (current stored arrays). Retrying the same txnId
// is a no-op, so a lost response can be retried safely.
export function applyReceive(state, body, user) {
  const { poId, qty, binCode, txnId, lots, serials, createBin } = body;
  if ((state.txns || []).some(t => t?.id === txnId)) {
    return { result: { ok: true, duplicate: true } };
  }
  // Find the line first so every refusal (unknown line, key required) is reported before
  // anything changes. Stock may only be received into a real bin: not blank, not SAP's system
  // bin, not a warehouse code.
  const poBefore = (state.pos || []).find(p => p.id === poId);
  let target;
  if (poBefore) {
    const found = findLine(poBefore.items, body, 'PO');
    if (found.error) return { result: found.error };
    target = found.line;
    const chosen = classifyBin(binCode, target.Warehouse);
    if (!chosen.real) {
      return { result: fail(`${chosen.reason}. Choose a real bin to receive into.`, 409, { code: 'NO_REAL_BIN' }) };
    }
  }
  const priorBin = target?.BinCode;
  const hadRealBin = classifyBin(priorBin, target?.Warehouse).real;
  const po = applyPoReceive(state.pos, { poId, lineKey: body.lineKey, lineIndex: body.lineIndex, qty, binCode, lots, serials });
  if (po.result.error) return { result: po.result };
  const line = po.result.line;
  if (!hadRealBin) {
    // The line had no real bin (e.g. SAP's system bin); someone chose one now. Keep what SAP had.
    const original = String(priorBin ?? '').trim();
    if (original && line.OriginalBinCode === undefined && original.toUpperCase() !== String(binCode).trim().toUpperCase()) {
      line.OriginalBinCode = priorBin;
    }
    line.BinAssignedBy = user?.username || 'unknown';
    line.BinAssignedAt = new Date().toISOString();
  }

  const bin = applyBinAdjust(state.bins, {
    binCode, itemCode: line.ItemCode, description: line.Description, delta: qty,
    createBin: createBin || {}, lots, serialsAdd: serials,
  });
  if (bin.result.error) return { result: bin.result };

  const txn = {
    id: txnId,
    poNumber: po.result.po.poNumber,
    lineKey: line.LineKey,
    itemCode: line.ItemCode,
    description: line.Description,
    qty,
    binCode,
    warehouse: normalizeWarehouse(line.Warehouse),
    lots,
    serials,
    user: user?.username || 'unknown',
    timestamp: new Date().toISOString(),
  };
  const txns = applyAppend(state.txns, { key: 'rf_receiving_txns', record: txn });
  return {
    data: { pos: po.data, bins: bin.data, txns: txns.data },
    result: { ok: true, po: po.result.po, bin: bin.result.bin, quantity: bin.result.quantity, txn },
  };
}

export function validatePickSo(body) {
  const problem = validateLineRef(body, 'soId');
  if (problem) return problem;
  const { qty, short, scannedCode } = body;
  if (num(qty) === null || qty < 0) return fail('qty must be a number, zero or more');
  if (short !== undefined) {
    if (!isObject(short) || typeof short.reason !== 'string' || !short.reason.trim()) {
      return fail('A short pick needs a reason', 400, { code: 'SHORT_REASON_REQUIRED' });
    }
  } else if (qty <= 0) {
    return fail('qty must be a positive number');
  }
  if (typeof body.txnId !== 'string' || !body.txnId) return fail('txnId is required');
  if (qty > 0 && (typeof scannedCode !== 'string' || !scannedCode.trim())) {
    return fail('Scan the item to confirm the pick', 400, { code: 'SCAN_REQUIRED' });
  }
  if (body.acceptShortfall !== undefined && typeof body.acceptShortfall !== 'boolean') {
    return fail('acceptShortfall must be true or false');
  }
  if (body.binCode !== undefined && (typeof body.binCode !== 'string' || !body.binCode)) {
    return fail('binCode must be a non-empty string');
  }
  return null;
}

// One pick = sales-order line + stock taken out of the line's bin + a pick log entry, together.
//  - the line is named by its LineKey; a closed line, a line without a real bin, an unscanned or
//    wrongly scanned item, and a pick past the open quantity are all refused with nothing changed;
//  - taking more than the bin holds is refused unless the picker confirms it (acceptShortfall),
//    in which case the bin goes to zero and the difference is written to the log;
//  - a short pick (body.short = { reason }) takes what the picker found, records why, and leaves
//    the rest open;
//  - retrying the same txnId changes nothing.
// state is { sos, bins, txns }.
export function applyPickSo(state, body, user) {
  if ((state.txns || []).some(t => t?.id === body.txnId)) {
    return { result: { ok: true, duplicate: true } };
  }
  const { qty } = body;
  const so = (state.sos || []).find(s => s.id === body.soId);
  if (!so) return { result: fail('Sales order not found', 404) };
  const found = findLine(so.items, body, 'Sales order');
  if (found.error) return { result: found.error };
  const { line } = found;
  if (isClosed(line)) return { result: closedError(line) };

  if (qty > 0) {
    const check = classifyBin(line.BinCode, line.Warehouse);
    if (!check.real) {
      return { result: fail(`${check.reason}. Assign a real bin before picking this line.`, 409, { code: 'NO_REAL_BIN' }) };
    }
    const scanned = String(body.scannedCode).trim();
    if (scanned.toUpperCase() !== String(line.ItemCode ?? '').trim().toUpperCase()) {
      return { result: fail(`Scanned ${scanned}, but this line is ${line.ItemCode}`, 409, { code: 'SCAN_MISMATCH', expected: line.ItemCode, scanned }) };
    }
  }
  const remaining = openQty({ OrderedQty: line.OrderedQty, ReceivedQty: line.DeliveredQty });
  if (qty > remaining + QTY_EPSILON) {
    return { result: fail(`Only ${remaining} left to pick on this line (asked for ${qty})`, 409, { code: 'OVER_PICK', remaining, requested: qty }) };
  }
  if (body.short && qty >= remaining - QTY_EPSILON) {
    return { result: fail('A short pick must leave something open; pick the full quantity normally instead', 400, { code: 'NOT_SHORT' }) };
  }

  // Stock: the line's own bin decides where it comes from (never a bin sent by the browser).
  const binCode = line.BinCode;
  const bins = state.bins || [];
  const bin = qty > 0 ? bins.find(b => String(b.BinCode ?? '').trim().toUpperCase() === String(binCode).trim().toUpperCase()) : undefined;
  let binQuantity = null;
  let stockBefore;
  let shortfall = 0;
  let nextBins = state.bins;
  if (bin) {
    stockBefore = Number(bin.Items?.find(i => i.ItemCode === line.ItemCode)?.Quantity) || 0;
    if (qty > stockBefore + QTY_EPSILON) {
      if (body.acceptShortfall !== true) {
        return { result: fail(`Bin ${bin.BinCode} holds ${stockBefore} of ${line.ItemCode}, not ${qty}`, 409,
          { code: 'INSUFFICIENT_BIN_STOCK', available: stockBefore, requested: qty }) };
      }
      shortfall = roundQty(qty - stockBefore);
    }
    const take = roundQty(qty - shortfall);
    if (take > 0) {
      const adjusted = applyBinAdjust(state.bins, { binCode: bin.BinCode, itemCode: line.ItemCode, delta: -take });
      if (adjusted.result.error) return { result: adjusted.result };
      nextBins = adjusted.data;
      binQuantity = adjusted.result.quantity;
    } else {
      binQuantity = stockBefore;
    }
  }
  // (A bin that is not in the system cannot be checked: the pick goes through and the log says
  // stockTracked: false.)

  const sos = state.sos;
  recordPick(so, line, qty, user, body.short || null);

  const txn = {
    id: body.txnId,
    soNumber: so.soNumber,
    lineKey: line.LineKey,
    itemCode: line.ItemCode,
    qty,
    binCode: bin ? bin.BinCode : binCode,
    warehouse: normalizeWarehouse(line.Warehouse),
    scannedCode: qty > 0 ? String(body.scannedCode).trim() : undefined,
    stockTracked: Boolean(bin),
    stockBefore,
    shortfall: shortfall > 0 ? shortfall : undefined,
    short: body.short ? { reason: body.short.reason.trim(), stillOpen: line.RemainingQty } : undefined,
    user: user?.username || 'unknown',
    timestamp: new Date().toISOString(),
  };
  const txns = applyAppend(state.txns, { key: 'rf_pick_txns', record: txn });
  return {
    data: { sos, bins: nextBins, txns: txns.data },
    result: { ok: true, so, line, binQuantity, shortfall: shortfall > 0 ? shortfall : undefined, txn },
  };
}

// --- Counting / inventory operations ---

export function validateRecordChanges(body) {
  const { upsert = [], remove = [] } = body || {};
  if (!Array.isArray(upsert) || !upsert.every(r => isObject(r) && typeof r.id === 'string' && r.id)) {
    return fail('upsert must be records with a string id');
  }
  if (!Array.isArray(remove) || !remove.every(id => typeof id === 'string' && id)) {
    return fail('remove must be a list of ids');
  }
  if (upsert.length === 0 && remove.length === 0) return fail('Nothing to change');
  return null;
}

// Several record changes at once (one request, one lock): replace/add the upserted
// records, delete the removed ids.
export function applyRecordChanges(current, body) {
  const { upsert = [], remove = [] } = body;
  const removeSet = new Set(remove);
  let list = (current || []).filter(r => !removeSet.has(r.id));
  let added = 0, updated = 0;
  for (const record of upsert) {
    const i = list.findIndex(r => r.id === record.id);
    if (i < 0) { list.push(record); added++; } else { list[i] = record; updated++; }
  }
  return { data: list, result: { ok: true, added, updated, removed: remove.length } };
}

export function validateBinsSet(body) {
  const { newBins = [], changes = [] } = body || {};
  if (!Array.isArray(newBins) || !newBins.every(b => isObject(b) && typeof b.BinCode === 'string' && b.BinCode)) {
    return fail('newBins must be bins with a BinCode');
  }
  if (!Array.isArray(changes) || !changes.every(c => isObject(c) && typeof c.binCode === 'string' && c.binCode &&
      typeof c.itemCode === 'string' && c.itemCode && num(c.setQuantity) !== null && c.setQuantity >= 0)) {
    return fail('changes must be [{ binCode, itemCode, setQuantity >= 0 }]');
  }
  if (newBins.length === 0 && changes.length === 0) return fail('Nothing to change');
  return null;
}

// Create bins and set item quantities (absolute, as counting does) all together.
// If any single change is refused, nothing is applied.
export function applyBinsSet(current, body) {
  const { newBins = [], changes = [] } = body;
  const bins = current || [];
  for (const nb of newBins) {
    if (bins.some(b => b.BinCode === nb.BinCode)) return { result: fail(`Bin ${nb.BinCode} already exists`, 409) };
    bins.push({ BinCode: nb.BinCode, Zone: nb.Zone || 'Main', Capacity: num(nb.Capacity) ?? 1000,
                Status: nb.Status || 'active', Items: Array.isArray(nb.Items) ? nb.Items : [] });
  }
  for (const c of changes) {
    const step = applyBinAdjust(bins, {
      binCode: c.binCode, itemCode: c.itemCode, description: c.description, setQuantity: c.setQuantity,
    });
    if (step.result.error) return { result: step.result };
  }
  return { data: bins, result: { ok: true, bins: bins.length, changed: changes.length, created: newBins.length } };
}

// --- Count variance approval ---
// A count only changes stock after an admin approves it. A count that matches
// what the bin holds needs no change and is logged as matched. A count that
// differs is queued in rf_count_variances and leaves the bin untouched until
// an admin approves (the counted quantity is then applied) or rejects it.

export const VARIANCE_STATUSES = ['pending', 'approved', 'rejected'];

export function validateCountSubmit(body) {
  const { counts } = body || {};
  if (!Array.isArray(counts) || counts.length === 0 || counts.length > 500) {
    return fail('counts must be a list of 1 to 500 counts');
  }
  for (const c of counts) {
    if (!isObject(c) || typeof c.binCode !== 'string' || !c.binCode || typeof c.itemCode !== 'string' || !c.itemCode) {
      return fail('each count needs a binCode and an itemCode');
    }
    if (num(c.countedQty) === null || c.countedQty < 0) return fail('countedQty must be a number of 0 or more');
  }
  return null;
}

// state: { bins, variances } as read under the locks. Returns the new variance list only:
// bins are never written by a count.
export function applyCountSubmit(state, body, user) {
  const bins = state.bins || [];
  let variances = [...(state.variances || [])];
  const now = new Date().toISOString();
  let matched = 0;
  const pendingIds = [];

  body.counts.forEach((c, i) => {
    const bin = bins.find(b => b.BinCode === c.binCode);
    const item = bin?.Items?.find(x => x.ItemCode === c.itemCode);
    const held = item ? Number(item.Quantity) || 0 : 0;
    const variance = c.countedQty - held;

    // A newer count for the same bin and item replaces the older pending one.
    variances = variances.filter(v => !(v.status === 'pending' && v.binCode === c.binCode && v.itemCode === c.itemCode));

    if (variance === 0) {
      matched++;
      return;
    }
    const id = `VAR-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    variances.push({
      id,
      status: 'pending',
      binCode: c.binCode,
      itemCode: c.itemCode,
      description: typeof c.description === 'string' ? c.description : (item?.Description || ''),
      heldQty: held,
      countedQty: c.countedQty,
      variance,
      expectedAtCountStart: num(c.expectedQty),
      sessionId: typeof c.sessionId === 'string' ? c.sessionId : null,
      sessionName: typeof c.sessionName === 'string' ? c.sessionName : null,
      submittedBy: user?.username || 'unknown',
      submittedAt: now,
    });
    pendingIds.push(id);
  });

  return { data: { variances }, result: { ok: true, matched, pending: pendingIds.length, pendingIds } };
}

export function validateVarianceDecision(body) {
  const { id, decision } = body || {};
  if (typeof id !== 'string' || !id) return fail('id is required');
  if (decision !== 'approve' && decision !== 'reject') return fail("decision must be 'approve' or 'reject'");
  return null;
}

// Admin only. Approve applies the counted quantity to the bin; reject changes nothing.
export function applyVarianceDecision(state, body, user) {
  if (user?.role !== 'admin') return { result: fail('Only an admin can approve or reject count variances', 403) };
  const variances = [...(state.variances || [])];
  const idx = variances.findIndex(v => v.id === body.id);
  if (idx < 0) return { result: fail('Variance not found', 404) };
  const v = variances[idx];
  if (v.status !== 'pending') return { result: fail(`Variance is already ${v.status}`, 409) };

  const decided = { decidedBy: user.username, decidedAt: new Date().toISOString() };

  if (body.decision === 'reject') {
    variances[idx] = { ...v, ...decided, status: 'rejected' };
    return { data: { variances }, result: { ok: true, status: 'rejected' } };
  }

  const bins = state.bins || [];
  const bin = bins.find(b => b.BinCode === v.binCode);
  const item = bin?.Items?.find(x => x.ItemCode === v.itemCode);
  const heldNow = item ? Number(item.Quantity) || 0 : 0;
  const step = applyBinAdjust(bins, {
    binCode: v.binCode,
    itemCode: v.itemCode,
    description: v.description,
    setQuantity: v.countedQty,
    createBin: { Zone: 'Main' },
  });
  if (step.result?.error) return { result: step.result };

  variances[idx] = { ...v, ...decided, status: 'approved', heldQtyAtApproval: heldNow };
  return {
    data: { bins, variances },
    result: { ok: true, status: 'approved', changedSinceCount: heldNow !== v.heldQty, previousQty: heldNow, newQty: v.countedQty },
  };
}

// --- Pick waves ---
// Create and delete are admin only. A wave is only a list of sales-order ids (see waves.js).

const sosById = (sos) => Object.fromEntries((sos || []).map((s) => [s.id, s]));

export function validateWaveCreate(body) {
  const { soIds } = body || {};
  if (!Array.isArray(soIds) || soIds.length === 0 || soIds.length > 200 ||
      !soIds.every((id) => typeof id === 'string' && id)) {
    return fail('soIds must be a list of 1 to 200 sales-order ids');
  }
  if (new Set(soIds).size !== soIds.length) return fail('A sales order can only be added to a wave once');
  return null;
}

function nextWaveNumber(waves) {
  const used = (waves || []).map((w) => Number(String(w.waveNumber || '').replace(/\D/g, ''))).filter(Number.isFinite);
  return `W-${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
}

export function applyWaveCreate(state, body, user) {
  if (user?.role !== 'admin') return { result: fail('Only an admin can create a wave', 403) };
  const sos = state.sos || [];
  const byId = sosById(sos);
  const waves = [...(state.waves || [])];
  const taken = ordersInOpenWaves(waves, byId);

  for (const id of body.soIds) {
    const so = byId[id];
    if (!so) return { result: fail(`Sales order ${id} not found`, 404) };
    if (so.status !== 'pending' && so.status !== 'picking') {
      return { result: fail(`${so.soNumber || id} is ${so.status} and cannot go in a wave`, 409, { code: 'SO_NOT_PICKABLE', soId: id }) };
    }
    if (!hasOpenLines(so)) {
      return { result: fail(`${so.soNumber || id} has nothing left to pick`, 409, { code: 'SO_NOTHING_OPEN', soId: id }) };
    }
    if (taken.has(id)) {
      return { result: fail(`${so.soNumber || id} is already in an open wave`, 409, { code: 'SO_IN_WAVE', soId: id }) };
    }
  }

  const wave = {
    id: `WAVE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    waveNumber: nextWaveNumber(waves),
    soIds: [...body.soIds],
    createdBy: user?.username || 'unknown',
    createdAt: new Date().toISOString(),
  };
  waves.push(wave);
  return { data: { waves }, result: { ok: true, wave } };
}

export function validateWaveDelete(body) {
  if (typeof body?.id !== 'string' || !body.id) return fail('id is required');
  return null;
}

// Only a wave with no picks can be deleted. Otherwise the picks would have no wave to belong to.
export function applyWaveDelete(state, body, user) {
  if (user?.role !== 'admin') return { result: fail('Only an admin can delete a wave', 403) };
  const waves = state.waves || [];
  const wave = waves.find((w) => w.id === body.id);
  if (!wave) return { result: fail('Wave not found', 404) };
  const byId = sosById(state.sos);
  if (waveMembers(wave, byId).some(hasPickedLines)) {
    return { result: fail('Some lines in this wave have been picked, so it cannot be deleted', 409, { code: 'WAVE_HAS_PICKS' }) };
  }
  return { data: { waves: waves.filter((w) => w.id !== body.id) }, result: { ok: true } };
}
