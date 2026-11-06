// Server-side import of purchase orders / sales orders read from a SAP file.
//
// The browser parses the file (src/data/sap-import.ts) and sends the result here. The server
// does not trust it: it re-checks every field and computes ids, line keys, remaining quantities
// and status itself. The merge runs under the per-file lock (see ops.js), so
//   - the same file imported twice, or on two devices at the same moment, gives one copy of
//     each order (the id is po-<DocNum> / so-<DocNum>, never time-based);
//   - a re-import updates quantities, dates and vendor/customer from SAP but keeps what the
//     app recorded: received/picked quantities, lots, serials, and bins chosen by staff.
//
// Pure functions, no Node imports (the browser demo backend reuses them).
import { QTY_EPSILON, makeLineKey, normalizeDocNum, orderId, roundQty, sameCode } from './order-identity.js';
import { classifyBin, normalizeWarehouse } from './ops-logic.js';

const KINDS = {
  po: { collection: 'rf_purchase_orders', number: 'poNumber', done: 'ReceivedQty', party: 'vendor', date: 'expectedDate', unknownParty: 'Unknown Vendor' },
  so: { collection: 'rf_sales_orders', number: 'soNumber', done: 'DeliveredQty', party: 'customer', date: 'dueDate', unknownParty: 'Unknown Customer' },
};
const SHIP_TO = ['shipToStreet', 'shipToCity', 'shipToProvince', 'shipToPostal', 'shipToCountry', 'shipToPhone'];
const MAX_ORDERS = 5000;
const MAX_LINES_PER_ORDER = 5000;

export const importCollection = (kind) => KINDS[kind]?.collection;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const bad = (error) => ({ error, status: 400 });

export function validateOrderImport(body) {
  const cfg = KINDS[body?.kind];
  if (!cfg) return bad('kind must be "po" or "so"');
  const orders = body.orders;
  if (!Array.isArray(orders) || orders.length === 0) return bad('orders must be a non-empty list');
  if (orders.length > MAX_ORDERS) return bad(`At most ${MAX_ORDERS} orders per import`);
  const seenDocs = new Set();
  for (const order of orders) {
    if (!isObject(order)) return bad('each order must be an object');
    const docNum = normalizeDocNum(order[cfg.number]);
    if (!docNum) return bad(`each order needs a ${cfg.number}`);
    if (seenDocs.has(docNum)) return bad(`Order ${docNum} appears twice in the file`);
    seenDocs.add(docNum);
    if (!Array.isArray(order.items) || order.items.length === 0) return bad(`Order ${docNum} has no lines`);
    if (order.items.length > MAX_LINES_PER_ORDER) return bad(`Order ${docNum} has too many lines`);
    const seenLines = new Set();
    for (const item of order.items) {
      if (!isObject(item)) return bad(`Order ${docNum}: each line must be an object`);
      if (!text(item.ItemCode)) return bad(`Order ${docNum}: a line has no ItemCode`);
      if (!Number.isInteger(item.LineNumber) || item.LineNumber < 0) return bad(`Order ${docNum}: LineNumber must be a whole number from 0 up`);
      if (!isNumber(item.OrderedQty) || item.OrderedQty <= 0) return bad(`Order ${docNum}, line ${item.LineNumber}: OrderedQty must be a number above zero`);
      if (item[cfg.done] !== undefined && (!isNumber(item[cfg.done]) || item[cfg.done] < 0)) {
        return bad(`Order ${docNum}, line ${item.LineNumber}: ${cfg.done} must be a number from zero up`);
      }
      if (seenLines.has(item.LineNumber)) return bad(`Order ${docNum}: line ${item.LineNumber} appears twice`);
      seenLines.add(item.LineNumber);
    }
  }
  return null;
}

/** Drop undefined and empty-string properties so stored lines stay compact and comparable. */
function clean(obj) {
  for (const key of Object.keys(obj)) if (obj[key] === undefined || obj[key] === '') delete obj[key];
  return obj;
}

const doneOf = (cfg, line) => Number(line[cfg.done]) || 0;

/** Anything the app recorded on a line that a file import must not throw away. */
function hasHistory(cfg, line) {
  return doneOf(cfg, line) > QTY_EPSILON || !!line.BinAssignedAt || !!line.ShortPick ||
    (Array.isArray(line.Lots) && line.Lots.length > 0) || (Array.isArray(line.Serials) && line.Serials.length > 0);
}

function lineFromFile(cfg, docNum, item) {
  const ordered = roundQty(item.OrderedQty);
  const done = roundQty(Math.max(0, Number(item[cfg.done]) || 0));
  return clean({
    LineNumber: item.LineNumber,
    LineKey: makeLineKey(docNum, item.LineNumber),
    ItemCode: text(item.ItemCode),
    Description: text(item.Description) || text(item.ItemCode),
    OrderedQty: ordered,
    [cfg.done]: done,
    RemainingQty: roundQty(Math.max(0, ordered - done)),
    BinCode: text(item.BinCode),
    Warehouse: normalizeWarehouse(item.Warehouse),
  });
}

const byLineNumber = (a, b) => (a.LineNumber ?? 0) - (b.LineNumber ?? 0);

/** Status from the lines SAP still lists. A shipped (or picked) sales order never goes backwards. */
function deriveStatus(kind, previous, items) {
  const cfg = KINDS[kind];
  const active = items.filter((i) => !i.SapClosed);
  if (active.length === 0) return previous || 'pending';
  const complete = active.every((i) => doneOf(cfg, i) + QTY_EPSILON >= i.OrderedQty);
  const started = active.some((i) => doneOf(cfg, i) > QTY_EPSILON);
  if (kind === 'po') return complete ? 'completed' : started ? 'receiving' : 'pending';
  if (previous === 'shipped') return 'shipped';
  if (complete) return previous === 'picked' ? 'picked' : 'shipped';
  if (previous === 'picked' && complete) return 'picked';
  return started ? 'picking' : 'pending';
}

function newOrder(kind, incoming, docNum, now) {
  const cfg = KINDS[kind];
  const items = incoming.items.map((i) => lineFromFile(cfg, docNum, i)).sort(byLineNumber);
  const order = {
    id: orderId(kind, docNum),
    [cfg.number]: docNum,
    [cfg.party]: text(incoming[cfg.party]) || text(incoming.cardCode) || cfg.unknownParty,
  };
  if (text(incoming.cardCode) || kind === 'so') order.cardCode = text(incoming.cardCode);
  order.items = items;
  order.status = deriveStatus(kind, undefined, items);
  if (kind === 'po') order.expectedDate = text(incoming.expectedDate);
  else {
    order.createdDate = now.toISOString().split('T')[0];
    if (text(incoming.dueDate)) order.dueDate = text(incoming.dueDate);
    for (const field of SHIP_TO) if (text(incoming[field])) order[field] = text(incoming[field]);
  }
  return order;
}

/** Bring one stored line up to date with its line in the file. Returns true when it was changed. */
function mergeLine(cfg, stored, fromFile) {
  stored.LineNumber = fromFile.LineNumber;
  stored.LineKey = fromFile.LineKey;
  stored.ItemCode = fromFile.ItemCode;
  stored.Description = fromFile.Description;
  stored.OrderedQty = fromFile.OrderedQty;
  if (fromFile.Warehouse) stored.Warehouse = fromFile.Warehouse;

  // Received/delivered: the larger of what the app recorded and what SAP shows. Adding them
  // would count a receipt twice once it is posted in SAP; replacing would lose app-only work.
  const done = roundQty(Math.max(doneOf(cfg, stored), fromFile[cfg.done] || 0));
  stored[cfg.done] = done;
  stored.RemainingQty = roundQty(Math.max(0, stored.OrderedQty - done));
  delete stored.SapClosed;

  // A real bin from SAP wins; otherwise a bin chosen in the app is kept; otherwise show what SAP had.
  const fileBin = fromFile.BinCode;
  if (fileBin && classifyBin(fileBin, stored.Warehouse).real) {
    if (stored.BinCode !== fileBin) {
      stored.BinCode = fileBin;
      delete stored.BinAssignedBy;
      delete stored.BinAssignedAt;
    }
  } else if (fileBin && !classifyBin(stored.BinCode, stored.Warehouse).real) {
    stored.BinCode = fileBin;
  }
}

const stamp = (order) => { const { ImportedAt, ImportedBy, ...rest } = order; return JSON.stringify(rest); };

/**
 * Merge a file's orders into the stored list.
 * Returns { data, result } like every other operation; result tells the page what happened.
 */
export function applyOrderImport(current, body, user, now = new Date()) {
  const kind = body.kind;
  const cfg = KINDS[kind];
  const list = current || [];
  const result = {
    ok: true, kind, added: 0, updated: 0, unchanged: 0,
    lines: { added: 0, updated: 0, unchanged: 0, closed: 0, reopened: 0 },
    conflicts: [], notes: [], orders: [],
  };
  const importedAt = now.toISOString();
  const importedBy = user?.username || 'unknown';

  for (const incoming of body.orders) {
    const docNum = normalizeDocNum(incoming[cfg.number]);
    const id = orderId(kind, docNum);
    const outcome = (name, extra = {}) => result.orders.push({ id, docNum, outcome: name, ...extra });
    const matches = list.filter((o) => o.id === id || normalizeDocNum(o[cfg.number]) === docNum);

    if (matches.length > 1) {
      result.conflicts.push({ code: 'DUPLICATE_ORDERS', docNum, message: `Order ${docNum} exists ${matches.length} times (${matches.map((m) => m.id).join(', ')}). Delete the extra copies, then import again.` });
      outcome('conflict');
      continue;
    }
    if (matches.length === 0) {
      const fresh = newOrder(kind, incoming, docNum, now);
      fresh.ImportedAt = importedAt;
      fresh.ImportedBy = importedBy;
      list.push(fresh);
      result.added++;
      result.lines.added += fresh.items.length;
      outcome('added');
      continue;
    }

    const stored = matches[0];
    const next = JSON.parse(JSON.stringify(stored));
    const fileLines = incoming.items.map((i) => lineFromFile(cfg, docNum, i));
    const lineCounts = { added: 0, updated: 0, unchanged: 0, closed: 0, reopened: 0 };
    const orderConflicts = [];

    // Orders imported before line keys existed: give their lines keys when that is unambiguous.
    const unkeyed = next.items.filter((l) => !l.LineKey);
    if (unkeyed.length > 0) {
      const numbers = unkeyed.map((l) => l.LineNumber);
      const distinct = new Set(numbers).size === numbers.length;
      const matchable = distinct && unkeyed.every((l) => fileLines.some((f) => f.LineNumber === l.LineNumber && sameCode(f.ItemCode, l.ItemCode)));
      if (matchable) {
        for (const l of unkeyed) l.LineKey = makeLineKey(docNum, l.LineNumber);
      } else if (next.items.some((l) => hasHistory(cfg, l))) {
        result.conflicts.push({
          code: 'LEGACY_ORDER_UNMATCHED', docNum,
          message: `Order ${docNum} was imported before line numbers were tracked and its lines cannot be matched to the file one by one. It already has received/picked work, so it was left unchanged.`,
        });
        outcome('conflict');
        continue;
      } else {
        next.items = []; // nothing recorded on it: rebuild the lines from the file
      }
    }

    const matchedKeys = new Set();
    for (const fromFile of fileLines) {
      matchedKeys.add(fromFile.LineKey);
      const line = next.items.find((l) => l.LineKey === fromFile.LineKey);
      if (!line) { next.items.push(fromFile); lineCounts.added++; continue; }
      if (!sameCode(line.ItemCode, fromFile.ItemCode) && hasHistory(cfg, line)) {
        orderConflicts.push({ code: 'ITEM_CHANGED', docNum, lineKey: line.LineKey, message: `Order ${docNum} line ${line.LineNumber}: SAP now says ${fromFile.ItemCode}, but this line (${line.ItemCode}) already has received/picked work. The line was left unchanged.` });
        continue;
      }
      const before = JSON.stringify(line);
      const wasClosed = !!line.SapClosed;
      mergeLine(cfg, line, fromFile);
      if (wasClosed) lineCounts.reopened++;
      else if (JSON.stringify(line) !== before) lineCounts.updated++;
      else lineCounts.unchanged++;
      if (doneOf(cfg, line) > line.OrderedQty + QTY_EPSILON) {
        result.notes.push({ code: kind === 'po' ? 'OVER_RECEIVED' : 'OVER_PICKED', docNum, lineKey: line.LineKey, message: `Order ${docNum} line ${line.LineNumber}: ${doneOf(cfg, line)} already ${kind === 'po' ? 'received' : 'picked'} but SAP now orders ${line.OrderedQty}.` });
      }
    }
    for (const line of next.items) {
      if (!matchedKeys.has(line.LineKey) && !line.SapClosed) { line.SapClosed = true; lineCounts.closed++; }
    }
    next.items.sort(byLineNumber);

    const party = text(incoming[cfg.party]);
    if (party && party !== cfg.unknownParty) next[cfg.party] = party;
    if (text(incoming.cardCode)) next.cardCode = text(incoming.cardCode);
    if (text(incoming[cfg.date])) next[cfg.date] = text(incoming[cfg.date]);
    if (kind === 'so') for (const field of SHIP_TO) if (text(incoming[field])) next[field] = text(incoming[field]);
    next.status = deriveStatus(kind, stored.status, next.items);

    for (const [k, v] of Object.entries(lineCounts)) result.lines[k] += v;
    result.conflicts.push(...orderConflicts);

    if (stamp(next) === stamp(stored)) {
      result.unchanged++;
      outcome(orderConflicts.length ? 'conflict' : 'unchanged', { lines: lineCounts });
    } else {
      next.ImportedAt = importedAt;
      next.ImportedBy = importedBy;
      list[list.indexOf(stored)] = next;
      result.updated++;
      outcome('updated', { lines: lineCounts });
    }
  }
  return { data: list, result };
}
