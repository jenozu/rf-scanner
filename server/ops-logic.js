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
export function applyReceive(state, body) {
  const { poId, lineIndex, qty, binCode, txnId, lots, serials, createBin } = body;
  if ((state.txns || []).some(t => t?.id === txnId)) {
    return { result: { ok: true, duplicate: true } };
  }
  const po = applyPoReceive(state.pos, { poId, lineIndex, qty, binCode, lots, serials });
  if (po.result.error) return { result: po.result };
  const line = po.result.po.items[lineIndex];

  const bin = applyBinAdjust(state.bins, {
    binCode, itemCode: line.ItemCode, description: line.Description, delta: qty,
    createBin: createBin || {}, lots, serialsAdd: serials,
  });
  if (bin.result.error) return { result: bin.result };

  const txn = {
    id: txnId,
    poNumber: po.result.po.poNumber,
    itemCode: line.ItemCode,
    description: line.Description,
    qty,
    binCode,
    lots,
    serials,
    timestamp: new Date().toISOString(),
  };
  const txns = applyAppend(state.txns, { key: 'rf_receiving_txns', record: txn });
  return {
    data: { pos: po.data, bins: bin.data, txns: txns.data },
    result: { ok: true, po: po.result.po, bin: bin.result.bin, quantity: bin.result.quantity, txn },
  };
}

export function validatePickSo(body) {
  const problem = validateSoPick(body);
  if (problem) return problem;
  if (body.binCode !== undefined && (typeof body.binCode !== 'string' || !body.binCode)) {
    return fail('binCode must be a non-empty string');
  }
  return null;
}

// One pick = sales-order line + stock taken out of the bin (never below zero; a
// bin that does not exist is skipped, as the page always did).
// state is { sos, bins }.
export function applyPickSo(state, body) {
  const so = applySoPick(state.sos, body);
  if (so.result.error) return { result: so.result };
  const line = so.result.so.items[body.lineIndex];
  const binCode = body.binCode || line.BinCode;
  let bins = state.bins;
  let quantity = null;
  if (binCode && (state.bins || []).some(b => b.BinCode === binCode)) {
    const bin = applyBinAdjust(state.bins, {
      binCode, itemCode: line.ItemCode, delta: -body.qty, clampAtZero: true,
    });
    if (bin.result.error) return { result: bin.result };
    bins = bin.data;
    quantity = bin.result.quantity;
  }
  return { data: { sos: so.data, bins }, result: { ok: true, so: so.result.so, binQuantity: quantity } };
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
