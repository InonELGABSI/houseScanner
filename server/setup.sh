#!/bin/bash

# House Scanner Setup Script
echo "🏠 Setting up House Scanner..."

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your OpenAI API key!"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "../.venv" ]; then
    echo "🐍 Creating virtual environment..."
    cd ..
    python -m venv .venv
    cd server
fi

# Activate virtual environment and install dependencies
echo "📦 Installing dependencies..."
source ../.venv/bin/activate
pip install -r requirements.txt

echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  1. Make sure your .env file has a valid OPENAI_API_KEY"
echo "  2. Run: python app.py"
echo ""
echo "To test the health endpoint:"
echo "  curl http://localhost:8000/health"
