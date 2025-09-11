#!/bin/bash

# House Scanner Server Start Script
echo "🏠 Starting House Scanner Server..."

# Navigate to project root
cd "$(dirname "$0")"

# Activate virtual environment
echo "🐍 Activating virtual environment..."
source .venv/bin/activate

# Navigate to server directory
cd server

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found! Please create one with your OPENAI_API_KEY"
    exit 1
fi

# Start the server
echo "🚀 Starting server on http://localhost:8000"
python app.py
