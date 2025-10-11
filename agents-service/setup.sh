#!/bin/bash

# HouseCheck Server Setup Script
echo "🏠 Setting up HouseCheck Server..."

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
required_version="3.11"

echo "🐍 Python version: $python_version"
if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" = "$required_version" ]; then
    echo "✅ Python version is compatible"
else
    echo "❌ Python 3.11+ required. Please upgrade Python."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🔧 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment and install dependencies
echo "📦 Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. ✅ .env file already configured with your OpenAI API key"
echo "2. Start Redis: brew install redis && redis-server"
echo "3. Activate environment: source venv/bin/activate"  
echo "4. Run server: python -m app.main"
echo "5. Visit: http://localhost:8000/docs"
echo ""
echo "Optional: Run simulation test:"
echo "python -m run_simulation"