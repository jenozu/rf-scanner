// Startup configuration checks.

export const MIN_JWT_SECRET_LENGTH = 32;

// Values that have appeared in this repo's source or example files. They are
// public, so a server running with one of them accepts forged login tokens.
const PUBLIC_PLACEHOLDERS = new Set([
  'rf-scanner-secret-key-change-in-production',
  'change-me',
  'changeme',
  'your-secret-here',
  'secret',
]);

const HOW_TO_FIX =
  'Generate one with `openssl rand -hex 48` and set it as JWT_SECRET in server/.env ' +
  '(docker-compose reads that file). Changing it signs everyone out once.';

/**
 * Returns the JWT signing secret from the environment, or throws an Error
 * explaining what is wrong. The server must not start with a missing,
 * public, or short secret.
 */
export function resolveJwtSecret(env = process.env) {
  const secret = (env.JWT_SECRET ?? '').trim();

  if (!secret) {
    throw new Error(`JWT_SECRET is not set. ${HOW_TO_FIX}`);
  }
  if (PUBLIC_PLACEHOLDERS.has(secret.toLowerCase())) {
    throw new Error(
      `JWT_SECRET is set to a placeholder value that is public in this repository. ${HOW_TO_FIX}`
    );
  }
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is too short (${secret.length} characters, need at least ${MIN_JWT_SECRET_LENGTH}). ${HOW_TO_FIX}`
    );
  }
  return secret;
}
