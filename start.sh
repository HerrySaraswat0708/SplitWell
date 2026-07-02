#!/bin/bash

# Works from any directory — always resolves relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🚀 Starting Splitwell..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install Node.js 18+"
  exit 1
fi

# Kill anything already on our ports
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 1

# Install deps if needed
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  (cd "$BACKEND_DIR" && npm install --silent)
fi
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install --silent)
fi

# Start backend
echo "🔧 Backend  → http://localhost:3001"
(cd "$BACKEND_DIR" && node src/index.js) &
BACKEND_PID=$!
sleep 2

# Start frontend
echo "⚡ Frontend → http://localhost:5173"
(cd "$FRONTEND_DIR" && npx vite --port 5173) &
FRONTEND_PID=$!
sleep 2

echo ""
echo "✅  Open http://localhost:5173 in your browser"
echo "    Press Ctrl+C to stop both servers"
echo ""

cleanup() {
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}
trap cleanup INT TERM
wait
