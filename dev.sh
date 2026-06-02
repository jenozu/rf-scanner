#!/usr/bin/env bash
# Start frontend (port 5173) and backend (port 3001) for local development.
# Access the app at http://localhost:5173 or http://<your-ip>:5173 from any LAN device.

set -e

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

if [ ! -d server/node_modules ]; then
  echo "Installing backend dependencies..."
  npm install --prefix server
fi

# Create data dir for the backend if it doesn't exist
mkdir -p server/data

echo ""
echo "Starting RF Scanner..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:3001"
echo ""

# Run both processes; kill both when either exits or Ctrl+C is pressed
trap 'kill 0' INT TERM EXIT

npm run dev &
npm run dev --prefix server &

wait
