#!/bin/bash

# Script to initialize MinIO bucket for house-scanner
# This should be run after docker-compose starts MinIO

set -e

echo "🚀 Initializing MinIO for house-scanner..."

# Wait for MinIO to be ready
echo "⏳ Waiting for MinIO to be ready..."
until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  echo "   Waiting for MinIO..."
  sleep 2
done

echo "✅ MinIO is ready!"

# Install mc (MinIO Client) if not present
if ! command -v mc &> /dev/null; then
  echo "📦 Installing MinIO Client (mc)..."
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    brew install minio/stable/mc
  else
    # Linux
    wget https://dl.min.io/client/mc/release/linux-amd64/mc
    chmod +x mc
    sudo mv mc /usr/local/bin/
  fi
fi

# Configure mc alias for local MinIO
echo "🔧 Configuring MinIO client..."
mc alias set local http://localhost:9000 minio minio123

# Create bucket if it doesn't exist
echo "📦 Creating bucket 'house-scanner'..."
mc mb local/house-scanner --ignore-existing

# Set bucket to public read (for development)
echo "🔓 Setting bucket policy to public read..."
mc anonymous set download local/house-scanner

echo ""
echo "✅ MinIO initialization complete!"
echo ""
echo "📊 MinIO Access:"
echo "   - API Endpoint: http://localhost:9000"
echo "   - Console: http://localhost:9001"
echo "   - Username: minio"
echo "   - Password: minio123"
echo "   - Bucket: house-scanner"
echo ""
echo "🧪 Test upload:"
echo "   echo 'test' > test.txt"
echo "   mc cp test.txt local/house-scanner/"
echo "   curl http://localhost:9000/house-scanner/test.txt"
echo ""
