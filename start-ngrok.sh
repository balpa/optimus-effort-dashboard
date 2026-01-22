#!/bin/bash

echo "🚀 Starting dashboard and ngrok tunnel..."
echo ""

if pgrep -f "node src/dashboard.js" > /dev/null; then
    echo "✓ Dashboard is already running"
else
    echo "Starting dashboard on port 3001..."
    node src/dashboard.js &
    DASHBOARD_PID=$!
    sleep 3
    echo "✓ Dashboard started (PID: $DASHBOARD_PID)"
fi

echo ""
echo "Starting ngrok tunnel on port 3001..."
ngrok http 3001
