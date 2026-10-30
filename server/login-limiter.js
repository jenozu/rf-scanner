// Small in-memory limiter for FAILED logins (no extra dependency).
// Two buckets: per username (stops guessing one account) and per client IP
// (stops spraying many accounts). A successful login clears the username bucket.
// State lives in this process only; a restart resets it, which is acceptable here.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_USER = 10;
const MAX_FAILS_PER_IP = 50;

const buckets = new Map(); // key -> { count, resetAt }

function current(key, now) {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.delete(key);
    return null;
  }
  return b;
}

function retryAfterSeconds(key, max, now) {
  const b = current(key, now);
  return b && b.count >= max ? Math.max(1, Math.ceil((b.resetAt - now) / 1000)) : 0;
}

function bump(key, now) {
  const b = current(key, now) || { count: 0, resetAt: now + WINDOW_MS };
  b.count += 1;
  buckets.set(key, b);
}

export function createLoginLimiter() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, WINDOW_MS);
  timer.unref();

  const userKey = (u) => `u:${String(u || '').trim().toLowerCase()}`;
  const ipKey = (ip) => `ip:${ip}`;

  return {
    // Seconds the caller must wait, or 0 if the attempt may proceed.
    blockedFor(username, ip, now = Date.now()) {
      return Math.max(
        retryAfterSeconds(userKey(username), MAX_FAILS_PER_USER, now),
        retryAfterSeconds(ipKey(ip), MAX_FAILS_PER_IP, now),
      );
    },
    recordFailure(username, ip, now = Date.now()) {
      bump(userKey(username), now);
      bump(ipKey(ip), now);
    },
    recordSuccess(username) {
      buckets.delete(userKey(username));
    },
  };
}
