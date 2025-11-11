#!/bin/bash

# RF Scanner Backend Setup Script
# Run this on your VPS after uploading the server folder

set -e  # Exit on error

echo "🚀 RF Scanner Backend Setup"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
echo -e "${YELLOW}📦 Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Installing...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js found: $(node --version)${NC}"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
else
    echo -e "${GREEN}✅ npm found: $(npm --version)${NC}"
fi

# Install dependencies
echo ""
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Create .env file if it doesn't exist
echo ""
echo -e "${YELLOW}📝 Checking .env file...${NC}"
if [ ! -f .env ]; then
    echo "PORT=3001" > .env
    echo "DATA_DIR=/var/www/rf-scanner/data" >> .env
    echo "NODE_ENV=production" >> .env
    echo -e "${GREEN}✅ Created .env file${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Create data directory
echo ""
echo -e "${YELLOW}📁 Setting up data directory...${NC}"
sudo mkdir -p /var/www/rf-scanner/data
sudo chown -R www-data:www-data /var/www/rf-scanner/data
sudo chmod -R 755 /var/www/rf-scanner/data
echo -e "${GREEN}✅ Data directory ready${NC}"

# Install PM2
echo ""
echo -e "${YELLOW}📦 Checking PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✅ PM2 installed${NC}"
else
    echo -e "${GREEN}✅ PM2 found: $(pm2 --version)${NC}"
fi

# Check if already running
echo ""
echo -e "${YELLOW}🔄 Checking if API is already running...${NC}"
if pm2 list | grep -q "rf-api"; then
    echo -e "${YELLOW}⚠️  API already running. Restarting...${NC}"
    pm2 restart rf-api
else
    echo -e "${YELLOW}▶️  Starting API with PM2...${NC}"
    pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "📋 Next steps:"
echo "1. Configure PM2 startup: pm2 startup (then run the output command)"
echo "2. Configure Nginx proxy (see DEPLOYMENT_WALKTHROUGH.md)"
echo "3. Initialize admin user: curl -X POST http://localhost:3001/api/users/init-admin"
echo ""
echo "📝 View logs: pm2 logs rf-api"
echo "🔄 Restart: pm2 restart rf-api"
echo "⏹️  Stop: pm2 stop rf-api"

