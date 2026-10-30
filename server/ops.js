// Operations that change one thing at a time, under the per-file lock in store.js.
// Two devices doing these at once add up instead of overwriting each other.
import path from 'node:path';
import { store } from './store.js';

const APPEND_KEYS = {
  rf_receiving_txns: { cap: null },
  rf_cycle_count_txns: { cap: null },
  rf_activity_logs: { cap: 100 },
};
const RECORD_KEYS = ['rf_purchase_orders', 'rf_sales_orders', 'rf_waves', 'rf_orders'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bad = (res, message, status = 400, extra = {}) => res.status(status).json({ error: message, ...extra });

function mergeLots(existing = [], changes = []) {
  const byCode = new Map(existing.map(l => [l.lotCode, { ...l }]));
  for (const { lotCode, qty } of changes) {
    const cur = byCode.get(lotCode) || { lotCode, qty: 0 };
    cur.qty += qty;
    byCode.set(lotCode, cur);
  }
  return [...byCode.values()].filter(l => l.qty > 0);
}

export function registerOps(app, { authenticateToken, requireWriter, dataDir }) {
  const fileFor = (key) => path.join(dataDir, `${key}.json`);
  const guard = [authenticateToken, requireWriter];

  // Add log/transaction records to the front of a list. Records need an id; a
  // record whose id is already present is skipped, so a retry never duplicates.
  app.post('/api/ops/append', ...guard, async (req, res) => {
    try {
      const { key } = req.body || {};
      const config = APPEND_KEYS[key];
      if (!config) return bad(res, 'Invalid key for append');
      const records = req.body.records ?? (req.body.record !== undefined ? [req.body.record] : null);
      if (!Array.isArray(records) || records.length === 0 ||
          !records.every(r => isObject(r) && typeof r.id === 'string' && r.id)) {
        return bad(res, 'record(s) with a string id are required');
      }
      const out = await store.update(fileFor(key), (current) => {
        const list = current || [];
        const seen = new Set(list.map(r => r?.id));
        const fresh = records.filter(r => !seen.has(r.id));
        let next = [...fresh, ...list];
        if (config.cap) next = next.slice(0, config.cap);
        return { data: next, result: { added: fresh.length, total: next.length } };
      });
      res.json(out);
    } catch (error) {
      console.error('append failed:', error);
      bad(res, 'Failed to append', 500);
    }
  });

  // Change one item's quantity in one bin: delta (+/-) or setQuantity (absolute).
  app.post('/api/ops/bin-adjust', ...guard, async (req, res) => {
    try {
      const { binCode, itemCode, description, delta, setQuantity, clampAtZero, createBin,
              lots, serialsAdd, serialsRemove } = req.body || {};
      if (typeof binCode !== 'string' || !binCode || typeof itemCode !== 'string' || !itemCode) {
        return bad(res, 'binCode and itemCode are required');
      }
      const hasDelta = delta !== undefined, hasSet = setQuantity !== undefined;
      if (hasDelta === hasSet) return bad(res, 'Send exactly one of delta or setQuantity');
      if (num(hasDelta ? delta : setQuantity) === null) return bad(res, 'Quantity must be a number');
      if (hasSet && setQuantity < 0) return bad(res, 'setQuantity cannot be negative');
      if (lots !== undefined && !(Array.isArray(lots) && lots.every(l => l && typeof l.lotCode === 'string' && num(l.qty) !== null))) {
        return bad(res, 'lots must be [{ lotCode, qty }]');
      }
      for (const list of [serialsAdd, serialsRemove]) {
        if (list !== undefined && !(Array.isArray(list) && list.every(s => typeof s === 'string'))) {
          return bad(res, 'serials must be arrays of strings');
        }
      }

      const out = await store.update(fileFor('rf_bins'), (current) => {
        const bins = current || [];
        let bin = bins.find(b => b.BinCode === binCode);
        if (!bin) {
          if (!isObject(createBin)) return { result: { error: 'Bin not found', status: 404 } };
          bin = { BinCode: binCode, Zone: createBin.Zone || 'Main', Capacity: num(createBin.Capacity) ?? 1000,
                  Status: createBin.Status || 'active', Items: [] };
          bins.push(bin);
        }
        bin.Items = bin.Items || [];
        let item = bin.Items.find(i => i.ItemCode === itemCode);
        const before = item ? Number(item.Quantity) || 0 : 0;
        let after = hasSet ? setQuantity : before + delta;
        if (after < 0) {
          if (!clampAtZero) {
            return { result: { error: 'Insufficient quantity in bin', status: 409, available: before } };
          }
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
      });
      if (out.error) return bad(res, out.error, out.status, out.available !== undefined ? { available: out.available } : {});
      res.json(out);
    } catch (error) {
      console.error('bin-adjust failed:', error);
      bad(res, 'Failed to adjust bin', 500);
    }
  });

  // Receive quantity against exactly one PO line (identified by its position).
  app.post('/api/ops/po-receive', ...guard, async (req, res) => {
    try {
      const { poId, lineIndex, qty, binCode, lots, serials } = req.body || {};
      if (typeof poId !== 'string' || !Number.isInteger(lineIndex) || lineIndex < 0) {
        return bad(res, 'poId and lineIndex are required');
      }
      if (num(qty) === null || qty <= 0) return bad(res, 'qty must be a positive number');
      const out = await store.update(fileFor('rf_purchase_orders'), (current) => {
        const pos = current || [];
        const po = pos.find(p => p.id === poId);
        if (!po) return { result: { error: 'PO not found', status: 404 } };
        const line = po.items?.[lineIndex];
        if (!line) return { result: { error: 'PO line not found', status: 404 } };
        line.ReceivedQty = (Number(line.ReceivedQty) || 0) + qty;
        line.RemainingQty = Math.max(0, (Number(line.OrderedQty) || 0) - line.ReceivedQty);
        if (binCode) line.BinCode = binCode;
        if (lots !== undefined) line.Lots = lots;
        if (serials !== undefined) line.Serials = serials;
        const allReceived = po.items.every(i => (Number(i.ReceivedQty) || 0) >= (Number(i.OrderedQty) || 0));
        po.status = allReceived ? 'completed' : 'receiving';
        if (allReceived) po.receivedDate = new Date().toISOString();
        return { data: pos, result: { ok: true, po } };
      });
      if (out.error) return bad(res, out.error, out.status);
      res.json(out);
    } catch (error) {
      console.error('po-receive failed:', error);
      bad(res, 'Failed to receive', 500);
    }
  });

  // Pick quantity against exactly one sales-order line (identified by position).
  app.post('/api/ops/so-pick', ...guard, async (req, res) => {
    try {
      const { soId, lineIndex, qty } = req.body || {};
      if (typeof soId !== 'string' || !Number.isInteger(lineIndex) || lineIndex < 0) {
        return bad(res, 'soId and lineIndex are required');
      }
      if (num(qty) === null || qty <= 0) return bad(res, 'qty must be a positive number');
      const out = await store.update(fileFor('rf_sales_orders'), (current) => {
        const sos = current || [];
        const so = sos.find(s => s.id === soId);
        if (!so) return { result: { error: 'Sales order not found', status: 404 } };
        const line = so.items?.[lineIndex];
        if (!line) return { result: { error: 'Sales order line not found', status: 404 } };
        line.DeliveredQty = (Number(line.DeliveredQty) || 0) + qty;
        line.RemainingQty = (Number(line.OrderedQty) || 0) - line.DeliveredQty;
        const allPicked = so.items.every(i => (i.RemainingQty || 0) === 0);
        so.status = allPicked ? 'picked' : 'picking';
        so.shippedDate = allPicked ? new Date().toISOString().split('T')[0] : undefined;
        return { data: sos, result: { ok: true, so } };
      });
      if (out.error) return bad(res, out.error, out.status);
      res.json(out);
    } catch (error) {
      console.error('so-pick failed:', error);
      bad(res, 'Failed to pick', 500);
    }
  });

  // Whole-record upsert/delete for collections of records that have an id.
  const recordKey = (req, res) => {
    if (!RECORD_KEYS.includes(req.params.key)) { bad(res, 'Invalid key for records'); return null; }
    return req.params.key;
  };

  app.put('/api/records/:key/:id', ...guard, async (req, res) => {
    try {
      const key = recordKey(req, res); if (!key) return;
      const record = req.body?.record;
      if (!isObject(record) || record.id !== req.params.id) return bad(res, 'record.id must match the URL id');
      const out = await store.update(fileFor(key), (current) => {
        const list = current || [];
        const i = list.findIndex(r => r.id === record.id);
        if (i >= 0) list[i] = record; else list.push(record);
        return { data: list, result: { ok: true, created: i < 0 } };
      });
      res.json(out);
    } catch (error) {
      console.error('record upsert failed:', error);
      bad(res, 'Failed to save record', 500);
    }
  });

  app.delete('/api/records/:key/:id', ...guard, async (req, res) => {
    try {
      const key = recordKey(req, res); if (!key) return;
      const out = await store.update(fileFor(key), (current) => {
        const list = current || [];
        const next = list.filter(r => r.id !== req.params.id);
        return next.length === list.length ? { result: false } : { data: next, result: true };
      });
      if (!out) return bad(res, 'Record not found', 404);
      res.json({ message: 'Record deleted' });
    } catch (error) {
      console.error('record delete failed:', error);
      bad(res, 'Failed to delete record', 500);
    }
  });

  // Add or update many records at once (imports). skipExisting leaves records
  // that are already stored untouched.
  app.post('/api/records/:key/upsert-many', ...guard, async (req, res) => {
    try {
      const key = recordKey(req, res); if (!key) return;
      const { records, skipExisting } = req.body || {};
      if (!Array.isArray(records) || !records.every(r => isObject(r) && typeof r.id === 'string' && r.id)) {
        return bad(res, 'records with a string id are required');
      }
      const out = await store.update(fileFor(key), (current) => {
        const list = current || [];
        let added = 0, updated = 0, skipped = 0;
        for (const record of records) {
          const i = list.findIndex(r => r.id === record.id);
          if (i < 0) { list.push(record); added++; }
          else if (skipExisting) skipped++;
          else { list[i] = record; updated++; }
        }
        return { data: list, result: { added, updated, skipped, total: list.length } };
      });
      res.json(out);
    } catch (error) {
      console.error('upsert-many failed:', error);
      bad(res, 'Failed to save records', 500);
    }
  });
}
