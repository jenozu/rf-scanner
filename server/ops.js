// HTTP routes for the operations in ops-logic.js. Each runs under the per-file
// lock in store.js, so two devices doing these at once add up instead of
// overwriting each other.
import path from 'node:path';
import { store } from './store.js';
import * as logic from './ops-logic.js';

export function registerOps(app, { authenticateToken, requireWriter, dataDir }) {
  const fileFor = (key) => path.join(dataDir, `${key}.json`);
  const guard = [authenticateToken, requireWriter];

  // Wrap a route: validate -> run apply under the lock -> send result or error.
  function operation(name, { validate, file, apply }) {
    return async (req, res) => {
      try {
        const problem = validate?.(req);
        if (problem) return res.status(problem.status).json({ error: problem.error });
        const key = typeof file === 'function' ? file(req) : file;
        const result = await store.update(fileFor(key), (current) => apply(current, req));
        if (result?.error) {
          const { error, status, ...extra } = result;
          return res.status(status).json({ error, ...extra });
        }
        res.json(result);
      } catch (error) {
        console.error(`${name} failed:`, error);
        res.status(500).json({ error: `Failed: ${name}` });
      }
    };
  }

  app.post('/api/ops/append', ...guard, operation('append', {
    validate: (req) => logic.validateAppend(req.body),
    file: (req) => req.body.key,
    apply: (cur, req) => logic.applyAppend(cur, req.body),
  }));

  app.post('/api/ops/bin-adjust', ...guard, operation('bin-adjust', {
    validate: (req) => logic.validateBinAdjust(req.body),
    file: 'rf_bins',
    apply: (cur, req) => logic.applyBinAdjust(cur, req.body),
  }));

  app.post('/api/ops/po-receive', ...guard, operation('po-receive', {
    validate: (req) => logic.validatePoReceive(req.body),
    file: 'rf_purchase_orders',
    apply: (cur, req) => logic.applyPoReceive(cur, req.body),
  }));

  app.post('/api/ops/so-pick', ...guard, operation('so-pick', {
    validate: (req) => logic.validateSoPick(req.body),
    file: 'rf_sales_orders',
    apply: (cur, req) => logic.applySoPick(cur, req.body),
  }));

  app.put('/api/records/:key/:id', ...guard, operation('record upsert', {
    validate: (req) => logic.validateRecordKey(req.params.key) || logic.validateRecordUpsert(req.params.id, req.body),
    file: (req) => req.params.key,
    apply: (cur, req) => logic.applyRecordUpsert(cur, req.body.record),
  }));

  app.delete('/api/records/:key/:id', ...guard, operation('record delete', {
    validate: (req) => logic.validateRecordKey(req.params.key),
    file: (req) => req.params.key,
    apply: (cur, req) => logic.applyRecordDelete(cur, req.params.id),
  }));

  app.post('/api/records/:key/upsert-many', ...guard, operation('upsert-many', {
    validate: (req) => logic.validateRecordKey(req.params.key) || logic.validateUpsertMany(req.body),
    file: (req) => req.params.key,
    apply: (cur, req) => logic.applyUpsertMany(cur, req.body),
  }));
}
