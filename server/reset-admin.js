import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || '/var/www/rf-scanner/data';
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function resetAdmin() {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    console.log('🔄 Resetting admin user...');
    console.log(`📁 Data directory: ${DATA_DIR}`);
    
    // Hash the default password
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const adminUser = {
      id: 'user-1',
      username: 'admin',
      passwordHash,
      fullName: 'Administrator',
      role: 'admin',
      isActive: true,
      createdDate: new Date().toISOString(),
    };
    
    // Write the admin user to users.json (replacing any existing users)
    await fs.writeFile(USERS_FILE, JSON.stringify([adminUser], null, 2), 'utf8');
    
    console.log('✅ Admin user reset successfully!');
    console.log('');
    console.log('📋 Default credentials:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  Please change the password after logging in!');
  } catch (error) {
    console.error('❌ Error resetting admin user:', error);
    process.exit(1);
  }
}

resetAdmin();

