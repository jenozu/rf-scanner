// Shared test setup: loads the app against a throwaway data folder and
// starts it on a random port. Environment must be set before the app is imported.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const TEST_JWT_SECRET = 'test-secret-test-secret-test-secret-1234';

export async function startTestServer() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rf-api-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATA_DIR = dataDir;
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const { default: app } = await import('../index.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  return {
    base,
    dataDir,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(dataDir, { recursive: true, force: true });
    },
  };
}
