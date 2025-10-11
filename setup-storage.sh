#!/bin/bash

# HouseScanner - S3 Storage Quick Setup Script

set -e

echo "🚀 Setting up S3 Storage (MinIO) for HouseScanner..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Navigate to backend directory
cd "$(dirname "$0")/backend"

echo "📦 Starting MinIO container..."
docker-compose up -d minio

echo ""
echo "⏳ Waiting for MinIO to be ready..."
sleep 5

# Wait for MinIO health check
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        echo "✅ MinIO is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Waiting... ($attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ MinIO failed to start. Check logs with: docker-compose logs minio"
    exit 1
fi

echo ""
echo "🎉 MinIO is running!"
echo ""
echo "📊 Access MinIO Console:"
echo "   URL: http://localhost:9001"
echo "   Username: minio"
echo "   Password: minio123"
echo ""
echo "📝 Next steps:"
echo "   1. Open http://localhost:9001 in your browser"
echo "   2. Login with credentials above"
echo "   3. Click 'Buckets' → 'Create Bucket'"
echo "   4. Name it: house-scanner"
echo "   5. Click the bucket → 'Access Policy' → Set to 'Public'"
echo ""
echo "🔗 MinIO API: http://localhost:9000"
echo ""
echo "✨ Done! Your S3 storage is ready."
