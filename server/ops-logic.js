// Pure operation logic shared by the API (server/ops.js) and the browser demo
// backend (src/demo/demo-mode.ts). Each apply* function takes the current stored
// value and the request, and returns { data?, result }:
//   data   - the new value to save (omit to save nothing)
//   result - what to send back; { error, status, ... } means "refuse".
// Keep this file free of Node-only imports so it also runs in the browser.

export const APPEND_KEYS = {
  rf_receiving_txns: { cap: null },
  rf_cycle_count_txns: { cap: null },
  rf_activity_logs: { cap: 100 },
};
export const RECORD_KEYS = ['rf_purchase_orders', 'rf_sales_orders', 'rf_waves', 'rf_orders'];

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

function validateLineOp(body, idField) {
  const { lineIndex, qty } = body || {};
  if (typeof body?.[idField] !== 'string' || !Number.isInteger(lineIndex) || lineIndex < 0) {
    return fail(`${idField} and lineIndex are required`);
  }
  if (num(qty) === null || qty <= 0) return fail('qty must be a positive number');
  return null;
}
export const validatePoReceive = (body) => validateLineOp(body, 'poId');
export const validateSoPick = (body) => validateLineOp(body, 'soId');

// Receive quantity against exactly one PO line (identified by its position).
export function applyPoReceive(current, body) {
  const { poId, lineIndex, qty, binCode, lots, serials } = body;
  const pos = current || [];
  const po = pos.find(p => p.id === poId);
  if (!po) return { result: fail('PO not found', 404) };
  const line = po.items?.[lineIndex];
  if (!line) return { result: fail('PO line not found', 404) };
  line.ReceivedQty = (Number(line.ReceivedQty) || 0) + qty;
  line.RemainingQty = Math.max(0, (Number(line.OrderedQty) || 0) - line.ReceivedQty);
  if (binCode) line.BinCode = binCode;
  if (lots !== undefined) line.Lots = lots;
  if (serials !== undefined) line.Serials = serials;
  const allReceived = po.items.every(i => (Number(i.ReceivedQty) || 0) >= (Number(i.OrderedQty) || 0));
  po.status = allReceived ? 'completed' : 'receiving';
  if (allReceived) po.receivedDate = new Date().toISOString();
  return { data: pos, result: { ok: true, po } };
}

// Pick quantity against exactly one sales-order line (identified by position).
export function applySoPick(current, body) {
  const { soId, lineIndex, qty } = body;
  const sos = current || [];
  const so = sos.find(s => s.id === soId);
  if (!so) return { result: fail('Sales order not found', 404) };
  const line = so.items?.[lineIndex];
  if (!line) return { result: fail('Sales order line not found', 404) };
  line.DeliveredQty = (Number(line.DeliveredQty) || 0) + qty;
  line.RemainingQty = (Number(line.OrderedQty) || 0) - line.DeliveredQty;
  const allPicked = so.items.every(i => (i.RemainingQty || 0) === 0);
  so.status = allPicked ? 'picked' : 'picking';
  so.shippedDate = allPicked ? new Date().toISOString().split('T')[0] : undefined;
  return { data: sos, result: { ok: true, so } };
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
