#!/bin/bash

# Test script to demonstrate the enhanced logging
echo "🧪 Testing House Scanner with Enhanced Logging"
echo "=============================================="

# Start server in background
echo "🚀 Starting server..."
cd "$(dirname "$0")"
source ../.venv/bin/activate
python app.py &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "📊 Testing endpoints..."

# Test health check
echo "1. Testing health endpoint..."
curl -s http://localhost:8000/health | jq . || echo "Health check response received"

echo ""
echo "2. Testing simulation endpoint..."
curl -s http://localhost:8000/simulate | jq '.sim_root' || echo "Simulation response received"

echo ""
echo "🔍 Checking log files..."
echo "Main application logs:"
ls -la logs/app_*.log 2>/dev/null | tail -1 || echo "No app logs found yet"

echo ""
echo "Agent-specific logs:"
ls -la logs/agents_*.log 2>/dev/null | tail -1 || echo "No agent logs found yet"

echo ""
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ Test complete! Check the logs/ directory for detailed execution logs."
echo "   - app_*.log: Main application flow"
echo "   - agents_*.log: Detailed agent execution"
