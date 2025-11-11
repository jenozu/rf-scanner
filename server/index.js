import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || '/var/www/rf-scanner/data';
const JWT_SECRET = process.env.JWT_SECRET || 'rf-scanner-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // Token expires in 24 hours
const execAsync = promisify(exec);

// Get path to Python shipping API script
const PURO_DIR = path.join(__dirname, '..', 'puro');
const PYTHON_API_SCRIPT = path.join(PURO_DIR, 'shipping_api_server.py');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// JWT verification middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', expired: true });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`✅ Data directory ready: ${DATA_DIR}`);
  } catch (error) {
    console.error('❌ Error creating data directory:', error);
  }
}

// Helper function to read JSON file
async function readJSONFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw error;
  }
}

// Helper function to write JSON file
async function writeJSONFile(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper function to call Python shipping API
async function callPythonAPI(command) {
  try {
    const commandJson = JSON.stringify(command);
    const pythonCmd = process.platform === 'win32' 
      ? `python "${PYTHON_API_SCRIPT}"`
      : `python3 "${PYTHON_API_SCRIPT}"`;
    
    const { stdout, stderr } = await execAsync(pythonCmd, {
      input: commandJson,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      cwd: PURO_DIR
    });
    
    if (stderr && !stderr.includes('Warning') && !stderr.includes('Note')) {
      console.error('Python API stderr:', stderr);
    }
    
    const response = JSON.parse(stdout.trim());
    return response;
  } catch (error) {
    console.error('Error calling Python API:', error);
    throw new Error(`Python API call failed: ${error.message}`);
  }
}

// ============================================
// USER MANAGEMENT ENDPOINTS
// ============================================

const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Get all users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await readJSONFile(USERS_FILE) || [];
    // Don't send passwords
    const safeUsers = users.map(u => {
      const { password, ...user } = u;
      return user;
    });
    res.json(safeUsers);
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({ error: 'Failed to read users' });
  }
});

// Get single user by ID
app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const users = await readJSONFile(USERS_FILE) || [];
    const user = users.find(u => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Error reading user:', error);
    res.status(500).json({ error: 'Failed to read user' });
  }
});

// Login - authenticate user
app.post('/api/auth/login', async (req, res) => {
  try {
    let { username, password } = req.body;
    
    // Trim whitespace from inputs
    username = username?.trim();
    password = password?.trim();
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const users = await readJSONFile(USERS_FILE) || [];
    // Case-insensitive username matching
    const user = users.find(u => 
      u.username?.toLowerCase() === username.toLowerCase() && 
      u.isActive !== false
    );

    if (!user) {
      console.log(`Login failed: User not found or inactive - username: "${username}"`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password (handle both hashed and plain text for migration)
    let passwordMatch = false;
    if (user.passwordHash) {
      passwordMatch = await bcrypt.compare(password, user.passwordHash);
    } else if (user.password) {
      // Legacy plain text password (for migration)
      passwordMatch = user.password === password;
      // Auto-upgrade to hashed password
      if (passwordMatch) {
        user.passwordHash = await bcrypt.hash(password, 10);
        delete user.password;
        await writeJSONFile(USERS_FILE, users);
      }
    }

    if (!passwordMatch) {
      console.log(`Login failed: Invalid password for user "${username}"`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    await writeJSONFile(USERS_FILE, users);

    // Generate JWT token with 24-hour expiration
    const token = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const { password: _, passwordHash, ...safeUser } = user;
    console.log(`Login successful: ${username}`);
    res.json({ 
      user: safeUser,
      token: token,
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Create user (admin only - check is done in frontend)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    let { username, password, fullName, role, isActive } = req.body;
    
    // Trim whitespace from inputs
    username = username?.trim();
    password = password?.trim();
    fullName = fullName?.trim();
    
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password, and full name required' });
    }

    if (username.length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }

    if (password.length < 3) {
      return res.status(400).json({ error: 'Password must be at least 3 characters' });
    }

    const users = await readJSONFile(USERS_FILE) || [];
    
    // Check if username already exists (case-insensitive)
    if (users.some(u => u.username?.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: `user-${Date.now()}`,
      username,
      passwordHash,
      fullName,
      role: role || 'operator',
      isActive: isActive !== undefined ? isActive : true,
      createdDate: new Date().toISOString(),
    };

    users.push(newUser);
    await writeJSONFile(USERS_FILE, users);

    console.log(`User created successfully: ${username}`);
    const { passwordHash: _, ...safeUser } = newUser;
    res.status(201).json(safeUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const users = await readJSONFile(USERS_FILE) || [];
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If password is being updated, hash it
    if (updates.password) {
      updates.passwordHash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    // Don't allow changing ID
    delete updates.id;

    users[userIndex] = { ...users[userIndex], ...updates };
    await writeJSONFile(USERS_FILE, users);

    const { password, passwordHash, ...safeUser } = users[userIndex];
    res.json(safeUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const users = await readJSONFile(USERS_FILE) || [];
    const filteredUsers = users.filter(u => u.id !== id);

    if (filteredUsers.length === users.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    await writeJSONFile(USERS_FILE, filteredUsers);
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Initialize default admin user if none exists
app.post('/api/users/init-admin', async (req, res) => {
  try {
    const users = await readJSONFile(USERS_FILE) || [];
    
    if (users.length > 0) {
      return res.json({ message: 'Users already exist' });
    }

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

    await writeJSONFile(USERS_FILE, [adminUser]);
    
    const { passwordHash: _, ...safeUser } = adminUser;
    res.json({ message: 'Admin user created', user: safeUser });
  } catch (error) {
    console.error('Error initializing admin:', error);
    res.status(500).json({ error: 'Failed to initialize admin' });
  }
});

// ============================================
// DATA STORAGE ENDPOINTS
// ============================================

// Get data (rf_active, rf_master, etc.)
app.get('/api/data/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const validKeys = ['rf_active', 'rf_master', 'rf_purchase_orders', 'rf_sales_orders', 
                       'rf_orders', 'rf_waves', 'rf_bins', 'rf_cycle_counts', 'rf_activity_logs'];
    
    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid data key' });
    }

    const data = await readJSONFile(path.join(DATA_DIR, `${key}.json`));
    res.json(data || []);
  } catch (error) {
    console.error(`Error reading ${req.params.key}:`, error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Save data
app.post('/api/data/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { data } = req.body;
    
    const validKeys = ['rf_active', 'rf_master', 'rf_purchase_orders', 'rf_sales_orders', 
                       'rf_orders', 'rf_waves', 'rf_bins', 'rf_cycle_counts', 'rf_activity_logs'];
    
    if (!validKeys.includes(key)) {
      return res.status(400).json({ error: 'Invalid data key' });
    }

    if (data === undefined) {
      return res.status(400).json({ error: 'Data is required' });
    }

    await writeJSONFile(path.join(DATA_DIR, `${key}.json`), data);
    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error(`Error saving ${req.params.key}:`, error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// ============================================
// SHIPPING API ENDPOINTS
// ============================================

// Search customers in address book
app.get('/api/shipping/customers/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const result = await callPythonAPI({
      action: 'search_customers',
      search_term: q
    });
    
    if (result.status === 'success') {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// Search locations in address book
app.get('/api/shipping/locations/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const result = await callPythonAPI({
      action: 'search_locations',
      search_term: q
    });
    
    if (result.status === 'success') {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error searching locations:', error);
    res.status(500).json({ error: 'Failed to search locations' });
  }
});

// Get customer locations
app.get('/api/shipping/customers/:customerId/locations', authenticateToken, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }
    
    const result = await callPythonAPI({
      action: 'get_customer_locations',
      customer_id: customerId
    });
    
    if (result.status === 'success') {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error getting customer locations:', error);
    res.status(500).json({ error: 'Failed to get customer locations' });
  }
});

// Get shipping address for customer or location
app.get('/api/shipping/address', authenticateToken, async (req, res) => {
  try {
    const { customerId, locationId } = req.query;
    
    if (!customerId && !locationId) {
      return res.status(400).json({ error: 'customerId or locationId required' });
    }
    
    const result = await callPythonAPI({
      action: 'get_shipping_address',
      customer_id: customerId ? parseInt(customerId) : undefined,
      location_id: locationId ? parseInt(locationId) : undefined
    });
    
    if (result.status === 'success') {
      res.json(result.data);
    } else {
      res.status(404).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error getting shipping address:', error);
    res.status(500).json({ error: 'Failed to get shipping address' });
  }
});

// Get order details from Python database (if order exists there)
app.get('/api/shipping/orders/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const result = await callPythonAPI({
      action: 'get_order_with_details',
      order_id: orderId
    });
    
    if (result.status === 'success') {
      res.json(result.data);
    } else {
      res.status(404).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// Create shipment for a single order
app.post('/api/shipping/shipments/create', authenticateToken, async (req, res) => {
  try {
    const { orderId, packageData, customerName, customerId, locationId, shipmentData } = req.body;
    
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required' });
    }
    
    let shipmentResult;
    
    // Priority 1: If full shipment data is provided (direct shipping with address)
    if (shipmentData) {
      shipmentResult = await callPythonAPI({
        action: 'create_shipment_direct',
        shipment_data: shipmentData
      });
    }
    // Priority 2: If locationId is provided, ship directly to that location
    else if (locationId) {
      shipmentResult = await callPythonAPI({
        action: 'ship_to_location',
        location_id: parseInt(locationId),
        package_data: packageData || {}
      });
    }
    // Priority 3: If customerId is provided, ship to that customer's default location
    else if (customerId) {
      shipmentResult = await callPythonAPI({
        action: 'ship_to_customer',
        customer_id: parseInt(customerId),
        package_data: packageData || {}
      });
    }
    // Priority 4: Try to find customer by name
    else if (customerName) {
      try {
        const searchResult = await callPythonAPI({
          action: 'search_customers',
          search_term: customerName
        });
        
        if (searchResult.status === 'success' && searchResult.data.length > 0) {
          const customer = searchResult.data[0];
          shipmentResult = await callPythonAPI({
            action: 'ship_to_customer',
            customer_id: customer.customer_id,
            package_data: packageData || {}
          });
        } else {
          return res.status(404).json({
            success: false,
            error: `Customer "${customerName}" not found in address book. Please add them first.`
          });
        }
      } catch (e) {
        console.error('Error finding customer:', e);
        return res.status(500).json({
          success: false,
          error: `Failed to find customer: ${e.message}`
        });
      }
    }
    // Priority 5: Try to ship by order ID (if order exists in Python DB)
    else {
      shipmentResult = await callPythonAPI({
        action: 'ship_order',
        order_id: orderId,
        package_data: packageData || {}
      });
    }
    
    // Check result
    if (shipmentResult && (shipmentResult.status === 'Success' || shipmentResult.status === 'success')) {
      // Update order status in React storage
      try {
        const salesOrders = await readJSONFile(path.join(DATA_DIR, 'rf_sales_orders.json')) || [];
        const orderIndex = salesOrders.findIndex(so => so.id === orderId || so.soNumber === orderId);
        
        if (orderIndex !== -1) {
          salesOrders[orderIndex].status = 'shipped';
          salesOrders[orderIndex].shipmentPin = shipmentResult.shipment_pin;
          salesOrders[orderIndex].shippedDate = new Date().toISOString();
          await writeJSONFile(path.join(DATA_DIR, 'rf_sales_orders.json'), salesOrders);
        }
      } catch (e) {
        console.error('Error updating order status:', e);
        // Continue even if update fails
      }
      
      res.json({
        success: true,
        shipmentPin: shipmentResult.shipment_pin,
        message: shipmentResult.message || 'Shipment created successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: shipmentResult?.message || 'Failed to create shipment'
      });
    }
  } catch (error) {
    console.error('Error creating shipment:', error);
    res.status(500).json({ error: 'Failed to create shipment', details: error.message });
  }
});

// Create batch shipments for multiple orders
app.post('/api/shipping/shipments/batch', authenticateToken, async (req, res) => {
  try {
    const { orderIds, packageData, orders } = req.body;
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ error: 'orderIds array is required' });
    }
    
    // Get order details from storage
    const salesOrders = await readJSONFile(path.join(DATA_DIR, 'rf_sales_orders.json')) || [];
    
    // Process each order individually
    const results = [];
    for (const orderId of orderIds) {
      const order = salesOrders.find(so => so.id === orderId || so.soNumber === orderId);
      if (!order) {
        results.push({
          order_id: orderId,
          status: 'Error',
          message: 'Order not found'
        });
        continue;
      }
      
      try {
        // Try to find customer by name
        const searchResult = await callPythonAPI({
          action: 'search_customers',
          search_term: order.customer
        });
        
        if (searchResult.status === 'success' && searchResult.data.length > 0) {
          const customer = searchResult.data[0];
          const shipmentResult = await callPythonAPI({
            action: 'ship_to_customer',
            customer_id: customer.customer_id,
            package_data: {
              ...packageData,
              reference: order.soNumber
            }
          });
          
          results.push({
            order_id: orderId,
            ...shipmentResult
          });
        } else {
          results.push({
            order_id: orderId,
            status: 'Error',
            message: `Customer "${order.customer}" not found in address book`
          });
        }
      } catch (e) {
        results.push({
          order_id: orderId,
          status: 'Error',
          message: e.message || 'Failed to create shipment'
        });
      }
    }
    
    // Update order statuses in React storage
    try {
      const updatedSalesOrders = salesOrders.map(so => {
        const shipmentResult = results.find(r => r.order_id === so.id || r.order_id === so.soNumber);
        if (shipmentResult && (shipmentResult.status === 'Success' || shipmentResult.status === 'success')) {
          return {
            ...so,
            status: 'shipped',
            shipmentPin: shipmentResult.shipment_pin,
            shippedDate: new Date().toISOString()
          };
        }
        return so;
      });
      
      await writeJSONFile(path.join(DATA_DIR, 'rf_sales_orders.json'), updatedSalesOrders);
    } catch (e) {
      console.error('Error updating batch order statuses:', e);
      // Continue even if update fails
    }
    
    const successful = results.filter(r => r.status === 'Success' || r.status === 'success').length;
    const failed = results.filter(r => r.status === 'Error' || r.status === 'error').length;
    
    res.json({
      success: true,
      results: results,
      total: results.length,
      successful: successful,
      failed: failed
    });
  } catch (error) {
    console.error('Error creating batch shipments:', error);
    res.status(500).json({ error: 'Failed to create batch shipments', details: error.message });
  }
});

// Quick lookup - search for customers or locations
app.get('/api/shipping/lookup', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const result = await callPythonAPI({
      action: 'quick_lookup',
      search_term: q
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error performing lookup:', error);
    res.status(500).json({ error: 'Failed to perform lookup' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
ensureDataDir().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 RF Scanner API server running on port ${PORT}`);
    console.log(`📁 Data directory: ${DATA_DIR}`);
  });
});

export default app;

