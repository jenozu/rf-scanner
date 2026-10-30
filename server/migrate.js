// One-time, admin-only copy of a device's old browser-stored data to the server.
// By default a collection is filled only if the server's copy is empty. An admin can
// opt in to replacing a non-empty server copy; the old server file is then saved
// next to it as <key>.pre-migration-<timestamp>.json first. Nothing is ever deleted.
import fs from 'node:fs/promises';
import path from 'node:path';
import { store } from './store.js';
import { applyAppend } from './ops-logic.js';

export const MIGRATABLE = {
  rf_master: 'list', rf_active: 'list', rf_master_meta: 'object', rf_bins: 'list',
  rf_purchase_orders: 'list', rf_sales_orders: 'list', rf_orders: 'list', rf_waves: 'list',
  rf_cycle_counts: 'list', rf_cycle_count_txns: 'list', rf_receiving_txns: 'list',
  rf_inventory_sessions: 'list', rf_session_count_logs: 'list', rf_temporary_locations: 'list',
};

const kindOf = (v) => (Array.isArray(v) ? 'list' : v !== null && typeof v === 'object' ? 'object' : 'other');
const sizeOf = (v) => (Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0);

export function registerMigration(app, { authenticateToken, requireAdmin, dataDir }) {
  const fileFor = (key) => path.join(dataDir, `${key}.json`);
  const guard = [authenticateToken, requireAdmin];

  app.get('/api/migrate/status', ...guard, async (req, res) => {
    try {
      const counts = {};
      for (const key of Object.keys(MIGRATABLE)) counts[key] = sizeOf(await store.readJSON(fileFor(key)));
      res.json({ counts });
    } catch (error) {
      console.error('migrate status failed:', error);
      res.status(500).json({ error: 'Failed to read server data' });
    }
  });

  app.post('/api/migrate/browser-data', ...guard, async (req, res) => {
    try {
      const { collections, replace = [] } = req.body || {};
      if (collections === null || typeof collections !== 'object' || Array.isArray(collections)) {
        return res.status(400).json({ error: 'collections must be an object of key -> data' });
      }
      if (!Array.isArray(replace) || !replace.every(k => typeof k === 'string')) {
        return res.status(400).json({ error: 'replace must be a list of keys' });
      }
      for (const [key, data] of Object.entries(collections)) {
        if (!MIGRATABLE[key]) return res.status(400).json({ error: `Not a migratable key: ${key}` });
        if (kindOf(data) !== MIGRATABLE[key]) return res.status(400).json({ error: `${key} must be a ${MIGRATABLE[key]}` });
      }
      for (const key of replace) {
        if (!(key in collections)) return res.status(400).json({ error: `replace names ${key}, which was not sent` });
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const results = [];
      for (const key of Object.keys(collections).sort()) {
        const incoming = collections[key];
        const file = fileFor(key);
        const outcome = await store.locked(file, async (tx) => {
          if (sizeOf(incoming) === 0) return { status: 'skipped-empty-browser', count: 0 };
          const { data: current } = await tx.read();
          const serverHasData = sizeOf(current) > 0;
          if (serverHasData && !replace.includes(key)) {
            return { status: 'skipped-not-empty', count: sizeOf(current) };
          }
          let backup;
          if (serverHasData) {
            backup = `${key}.pre-migration-${stamp}.json`;
            await fs.copyFile(file, path.join(dataDir, backup));
          }
          await tx.write(incoming);
          return { status: serverHasData ? 'replaced' : 'uploaded', count: sizeOf(incoming), ...(backup ? { backup } : {}) };
        });
        results.push({ key, ...outcome });
      }

      const changed = results.filter(r => r.status === 'uploaded' || r.status === 'replaced');
      if (changed.length > 0) {
        const entry = {
          id: `migration-${Date.now()}`,
          userId: req.currentUser.id,
          username: req.currentUser.username,
          action: 'Browser data moved to server',
          timestamp: new Date().toISOString(),
          details: changed.map(r => `${r.key}: ${r.count} (${r.status})`).join(', '),
        };
        await store.update(fileFor('rf_activity_logs'), (cur) =>
          applyAppend(cur, { key: 'rf_activity_logs', record: entry }));
      }
      res.json({ results });
    } catch (error) {
      console.error('migration failed:', error);
      res.status(500).json({ error: 'Migration failed' });
    }
  });
}
