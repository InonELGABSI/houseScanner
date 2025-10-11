# 🗄️ S3 Storage Setup Guide - HouseScanner

## Overview

Your project is configured to use **MinIO** (S3-compatible storage) for local development and can easily switch to AWS S3 for production.

### Current Configuration (from .env)
```env
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=house-scanner
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=minio
STORAGE_SECRET_KEY=minio123
STORAGE_USE_SSL=false
STORAGE_PUBLIC_URL=http://localhost:9000/house-scanner
```

---

## 🎯 Quick Start - Local Development with MinIO

### Option 1: Using Docker (Recommended)

#### 1. Create docker-compose.yml for MinIO

Create or update `backend/docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: housescanner-postgres
    environment:
      POSTGRES_USER: house_scanner
      POSTGRES_PASSWORD: house_scanner
      POSTGRES_DB: house_scanner
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U house_scanner"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: housescanner-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: housescanner-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console UI
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

#### 2. Start Services

```bash
cd backend
docker-compose up -d
```

#### 3. Access MinIO Console

Open browser: **http://localhost:9001**

**Login:**
- Username: `minio`
- Password: `minio123`

#### 4. Create Bucket

In MinIO Console:
1. Click "Buckets" in left sidebar
2. Click "Create Bucket"
3. Name: `house-scanner`
4. Click "Create"
5. Click on the bucket
6. Go to "Access Policy" tab
7. Set policy to "Public" or use this custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::house-scanner/*"]
    }
  ]
}
```

#### 5. Verify Setup

```bash
# Test MinIO is running
curl http://localhost:9000/minio/health/live

# Should return: 200 OK
```

---

### Option 2: Install MinIO Locally (Without Docker)

#### 1. Install MinIO

```bash
# macOS
brew install minio/stable/minio

# Or download binary
wget https://dl.min.io/server/minio/release/darwin-amd64/minio
chmod +x minio
```

#### 2. Start MinIO Server

```bash
# Create data directory
mkdir -p ~/minio/data

# Start server
minio server ~/minio/data --console-address ":9001"
```

**You'll see output like:**
```
API: http://192.168.1.100:9000
Console: http://192.168.1.100:9001

RootUser: minioadmin
RootPass: minioadmin
```

#### 3. Access Console & Create Bucket

- Open: http://localhost:9001
- Login with credentials above
- Create bucket named `house-scanner`
- Set it to public (or use custom policy)

---

## 🔧 Backend Configuration

Your backend is already configured! The `StorageService` uses AWS SDK v3 which is compatible with MinIO.

### How It Works

**File Upload Flow:**
```typescript
// In scans.service.ts
const url = await this.storageService.uploadObject(
  key,        // 'scans/{scanId}/{timestamp}-{index}-{filename}'
  buffer,     // File buffer
  mimetype    // 'image/jpeg', 'image/png', etc.
);

// Returns: 'http://localhost:9000/house-scanner/scans/...'
```

**Storage Locations:**
```
http://localhost:9000/house-scanner/scans/{scanId}/{timestamp}-{index}-{filename}

Example:
http://localhost:9000/house-scanner/scans/abc-123/1696857600000-0-living-room.jpg
http://localhost:9000/house-scanner/scans/abc-123/1696857600000-1-kitchen.jpg
```

---

## 🧪 Test Storage Connection

### 1. Create Test Script

Create `backend/test-storage.ts`:

```typescript
import { S3Client, PutObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  credentials: {
    accessKeyId: 'minio',
    secretAccessKey: 'minio123',
  },
});

async function testStorage() {
  try {
    // List buckets
    console.log('📦 Listing buckets...');
    const buckets = await client.send(new ListBucketsCommand({}));
    console.log('Buckets:', buckets.Buckets?.map(b => b.Name));

    // Upload test file
    console.log('\n📤 Uploading test file...');
    const testContent = 'Hello from HouseScanner!';
    await client.send(
      new PutObjectCommand({
        Bucket: 'house-scanner',
        Key: 'test/hello.txt',
        Body: testContent,
        ContentType: 'text/plain',
      })
    );
    console.log('✅ Upload successful!');
    console.log('URL: http://localhost:9000/house-scanner/test/hello.txt');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testStorage();
```

### 2. Run Test

```bash
cd backend
npx ts-node test-storage.ts
```

**Expected Output:**
```
📦 Listing buckets...
Buckets: [ 'house-scanner' ]

📤 Uploading test file...
✅ Upload successful!
URL: http://localhost:9000/house-scanner/test/hello.txt
```

### 3. Verify in Browser

Open: http://localhost:9000/house-scanner/test/hello.txt

Should display: "Hello from HouseScanner!"

---

## 🌐 MinIO Console Guide

### Access Console
**URL:** http://localhost:9001
**Credentials:** minio / minio123

### Key Features

#### 1. **Buckets**
- View all buckets
- Create/delete buckets
- Set bucket policies
- Enable versioning

#### 2. **Object Browser**
- Upload files manually
- Download files
- Delete objects
- View object metadata

#### 3. **Access Keys**
- Create additional access keys
- Manage permissions
- Rotate credentials

#### 4. **Monitoring**
- Storage usage
- API requests
- Bandwidth usage

---

## 📁 Bucket Structure

Your app will create this structure:

```
house-scanner/
├── scans/
│   ├── {scanId-1}/
│   │   ├── 1696857600000-0-room1.jpg
│   │   ├── 1696857600000-1-room2.jpg
│   │   └── 1696857600000-2-room3.jpg
│   └── {scanId-2}/
│       ├── 1696857700000-0-living.jpg
│       └── 1696857700000-1-kitchen.jpg
└── test/
    └── hello.txt
```

---

## 🔄 Switching to AWS S3 (Production)

### 1. Update .env

```env
# Production S3
STORAGE_ENDPOINT=https://s3.amazonaws.com
STORAGE_BUCKET=housescanner-production
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=YOUR_AWS_ACCESS_KEY
STORAGE_SECRET_KEY=YOUR_AWS_SECRET_KEY
STORAGE_USE_SSL=true
STORAGE_PUBLIC_URL=https://housescanner-production.s3.amazonaws.com
```

### 2. Create S3 Bucket

```bash
# Using AWS CLI
aws s3 mb s3://housescanner-production --region us-east-1

# Set public read policy
aws s3api put-bucket-policy --bucket housescanner-production --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::housescanner-production/*"
    }
  ]
}'

# Enable CORS
aws s3api put-bucket-cors --bucket housescanner-production --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}'
```

### 3. Configure IAM User

Create IAM user with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::housescanner-production",
        "arn:aws:s3:::housescanner-production/*"
      ]
    }
  ]
}
```

---

## 🔐 Security Best Practices

### Local Development (MinIO)

✅ Keep default credentials for development
✅ Don't expose MinIO to the internet
✅ Use Docker network isolation

### Production (AWS S3)

✅ Use IAM roles for EC2/ECS instead of access keys
✅ Enable bucket versioning
✅ Enable server-side encryption
✅ Use CloudFront for CDN
✅ Implement lifecycle policies
✅ Enable access logging
✅ Use VPC endpoints for private access

---

## 🐛 Troubleshooting

### MinIO Not Starting

```bash
# Check if port is in use
lsof -i :9000
lsof -i :9001

# Kill existing process
kill -9 <PID>

# Or use different ports
docker-compose down
docker-compose up -d
```

### Bucket Not Found Error

```bash
# Access MinIO console
open http://localhost:9001

# Login and verify bucket exists
# Create bucket if missing: house-scanner
```

### Upload Fails - Connection Refused

```bash
# Check MinIO is running
curl http://localhost:9000/minio/health/live

# Check Docker containers
docker ps | grep minio

# Check backend .env has correct endpoint
cat backend/.env | grep STORAGE_ENDPOINT
```

### Images Not Accessible

```bash
# Check bucket policy is public
# In MinIO console: Buckets → house-scanner → Access Policy → Public

# Or set via mc client:
mc policy set public minio/house-scanner
```

### SSL/HTTPS Issues

```env
# For local MinIO, use:
STORAGE_USE_SSL=false
STORAGE_ENDPOINT=http://localhost:9000

# For AWS S3, use:
STORAGE_USE_SSL=true
STORAGE_ENDPOINT=https://s3.amazonaws.com
```

---

## 📊 Monitoring Storage Usage

### MinIO Console

1. Open http://localhost:9001
2. Dashboard shows:
   - Total storage used
   - Number of objects
   - API requests
   - Bandwidth

### CLI Commands

```bash
# Install mc (MinIO Client)
brew install minio/stable/mc

# Configure alias
mc alias set minio http://localhost:9000 minio minio123

# Check disk usage
mc du minio/house-scanner

# List objects
mc ls minio/house-scanner/scans/

# Get stats
mc admin info minio
```

---

## 🚀 Performance Tips

### 1. Use Multipart Upload for Large Files
```typescript
// Automatically handled by AWS SDK for files > 5MB
```

### 2. Enable Compression
```typescript
await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentEncoding: 'gzip', // If content is gzipped
  })
);
```

### 3. Set Cache Headers
```typescript
await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    CacheControl: 'max-age=31536000', // 1 year
  })
);
```

### 4. Use CloudFront (Production)
- Create CloudFront distribution
- Point to S3 bucket
- Update `STORAGE_PUBLIC_URL` to CloudFront URL

---

## 📋 Quick Reference

### Environment Variables
```env
STORAGE_ENDPOINT=http://localhost:9000        # MinIO API URL
STORAGE_BUCKET=house-scanner                  # Bucket name
STORAGE_REGION=us-east-1                      # AWS region (for S3)
STORAGE_ACCESS_KEY=minio                      # Access key
STORAGE_SECRET_KEY=minio123                   # Secret key
STORAGE_USE_SSL=false                         # Use HTTPS
STORAGE_PUBLIC_URL=http://localhost:9000/house-scanner  # Public URL
```

### MinIO URLs
- **API:** http://localhost:9000
- **Console:** http://localhost:9001
- **Health:** http://localhost:9000/minio/health/live

### Default Credentials
- **Username:** minio
- **Password:** minio123

### Docker Commands
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f minio

# Restart MinIO
docker-compose restart minio
```

---

## ✅ Verification Checklist

- [ ] MinIO running on port 9000
- [ ] MinIO Console accessible on port 9001
- [ ] Bucket `house-scanner` created
- [ ] Bucket policy set to public
- [ ] Test file uploaded successfully
- [ ] Test file accessible via URL
- [ ] Backend .env configured correctly
- [ ] Storage service test passes

---

## 🎉 You're Ready!

Your S3-compatible storage is now set up and ready to store images. When you upload images through the app:

1. Frontend calls `/api/scans/upload-images` with files
2. Backend receives files via multer
3. StorageService uploads to MinIO/S3
4. URLs saved to database
5. Images accessible via public URLs

**Test it:** Upload some images through your app and check MinIO console to see them appear!
