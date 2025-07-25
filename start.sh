#!/bin/sh

# AI Property Research Agent Startup Script
# Runs both backend (Express) and frontend (Next.js) services

echo "🚀 Starting AI Property Research Agent..."

# Start the backend server in the background
echo "📡 Starting backend server on port 3004..."
node server/listener.js &
BACKEND_PID=$!

# Wait a moment for backend to initialize
sleep 3

# Start the Next.js frontend
echo "🌐 Starting frontend on port 3000..."
node server.js &
FRONTEND_PID=$!

# Function to handle shutdown
cleanup() {
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap signals to cleanup properly
trap cleanup SIGTERM SIGINT

# Wait for either process to exit
wait $BACKEND_PID $FRONTEND_PID

# If we get here, one of the processes exited
echo "❌ One of the services stopped unexpectedly"
cleanup 