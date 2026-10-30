// One-time setup: create the first admin account (or reset one admin's password).
//
//   ADMIN_PASSWORD='choose-a-long-password' node reset-admin.js
//   ADMIN_USERNAME=jane ADMIN_PASSWORD='...' node reset-admin.js
//   ADMIN_PASSWORD='...' node reset-admin.js --reset-password   (existing admin only)
//
// There is no default password. With no users yet it creates the first admin.
// If users already exist it refuses, unless --reset-password is given; that
// changes only the named admin's password and never deletes any other user.
// In Docker:  docker compose exec -e ADMIN_PASSWORD='...' api node reset-admin.js
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MIN_LENGTH = 10;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function readUsers() {
  try {
    const parsed = JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    fail(`could not read ${USERS_FILE}: ${error.message}`);
  }
}

async function main() {
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const password = process.env.ADMIN_PASSWORD;
  const resetPassword = process.argv.includes('--reset-password');

  if (!password) fail('set ADMIN_PASSWORD (there is no default password).');
  if (password.length < MIN_LENGTH) fail(`ADMIN_PASSWORD must be at least ${MIN_LENGTH} characters.`);
  if (username.length < 2) fail('ADMIN_USERNAME must be at least 2 characters.');

  const users = await readUsers();
  const passwordHash = await bcrypt.hash(password, 10);

  if (resetPassword) {
    const admin = users.find(u => u.username?.toLowerCase() === username.toLowerCase() && u.role === 'admin');
    if (!admin) fail(`no admin named "${username}" exists.`);
    admin.passwordHash = passwordHash;
    delete admin.password;
    admin.isActive = true;
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log(`Password updated for admin "${username}". No other users were changed.`);
    return;
  }

  if (users.length > 0) {
    fail(`${USERS_FILE} already has ${users.length} user(s). Use --reset-password to change an admin's password.`);
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const admin = {
    id: `user-${Date.now()}`,
    username,
    passwordHash,
    fullName: 'Administrator',
    role: 'admin',
    isActive: true,
    createdDate: new Date().toISOString(),
  };
  await fs.writeFile(USERS_FILE, JSON.stringify([admin], null, 2), 'utf8');
  console.log(`First admin "${username}" created in ${USERS_FILE}.`);
}

main();
