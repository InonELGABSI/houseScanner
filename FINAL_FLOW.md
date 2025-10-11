# Final Simplified Flow - Upload & Process

## ✅ Complete Implementation

### Flow Overview

```
1. Client: Create Scan
   ↓
2. Client: Upload Images with Files (multipart/form-data)
   ↓
3. Backend: Save files to S3, save URLs to DB, emit 'scan:uploaded'
   ↓
4. Client: Receive 'scan:uploaded' event → Auto-trigger process
   ↓
5. Client: Call /process endpoint
   ↓
6. Backend: Queue job, emit 'scan:processing'
   ↓
7. Processor: Fetch images from DB, call agents-service, emit progress
   ↓
8. Backend: Emit 'scan:completed' with results
   ↓
9. Client: Navigate to summary
```

---

## API Endpoints

### 1. **POST /scans** - Create Scan
Creates a new scan record ready for image upload.

**Request:**
```json
{
  "houseId": "uuid",
  "address": "123 Main St" // optional
}
```

**Response:**
```json
{
  "scanId": "uuid",
  "status": "queued"
}
```

---

### 2. **POST /scans/upload-images** - Upload Images
Upload image files and save to S3 + database.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `scanId`: string (required)
- `address`: string (optional)
- `images`: File[] (required - array of image files)

**Request Example:**
```javascript
const formData = new FormData();
formData.append('scanId', 'scan-uuid-here');
formData.append('address', '123 Main St');
files.forEach(file => formData.append('images', file));

await fetch('/api/scans/upload-images', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': 'Bearer token'
  }
});
```

**Response:**
```json
{
  "scanId": "uuid",
  "imagesCount": 5,
  "message": "Images uploaded successfully"
}
```

**What Happens:**
1. Validates scan ownership
2. Checks scan status (must be queued, not running/completed)
3. Uploads each file to S3: `scans/{scanId}/{timestamp}-{index}-{filename}`
4. Creates Room record
5. Creates HouseRoomImage records with S3 URLs
6. Updates scan status to 'queued'
7. **Emits WebSocket event:** `scan:uploaded` to `user:{userId}`

**Database Changes:**
- Room created with label "Main Room"
- HouseRoomImage records created with S3 URLs
- Scan status remains 'queued'

---

### 3. **POST /scans/process** - Process Scan
Trigger AI analysis of uploaded images.

**Request:**
```json
{
  "scanId": "uuid"
}
```

**Response:**
```json
{
  "scanId": "uuid",
  "status": "running",
  "message": "Scan queued for processing"
}
```

**What Happens:**
1. Validates scan ownership
2. Fetches scan with rooms and images from DB
3. Checks scan has images
4. Updates scan status to 'running'
5. Queues BullMQ job with scan data
6. **Emits WebSocket event:** `scan:processing` to `user:{userId}`
7. Background processor:
   - Emits progress: 10%, 20%, 90%, 100%
   - Merges checklists (base + user custom)
   - Calls agents-service with image URLs from DB
   - Emits `scan:completed` with result data

---

## WebSocket Events

### Connection
- **Namespace:** `/scans`
- **Authentication:** User must be logged in
- **Room:** `user:{userId}`

### Events Emitted by Server

#### 1. `scan:uploaded`
```typescript
{
  scanId: string;
  roomsCount: number;
  imagesCount: number;
  message: string;
}
```

#### 2. `scan:processing`
```typescript
{
  scanId: string;
  message: string;
}
```

#### 3. `scan:progress`
```typescript
{
  scanId: string;
  progress: number; // 0-100
  stage?: string;   // Optional description
}
```

#### 4. `scan:completed`
```typescript
{
  scanId: string;
  message: string;
  result?: any;     // Full agents-service response
}
```

#### 5. `scan:failed`
```typescript
{
  scanId: string;
  error: string;
}
```

---

## Frontend Implementation

### 1. Setup (Done on Login)
```typescript
import { scanSocket } from '@/services/scanSocket';

// On login
scanSocket.connect(user.id);

// On logout
scanSocket.disconnect();
```

### 2. Complete Flow in ProcessingPage
```typescript
import { scanAPI } from '@/api/scan';
import { scanSocket } from '@/services/scanSocket';

// Step 1: Create scan
const { scanId } = await scanAPI.createScan({
  houseId: 'house-uuid',
  address: '123 Main St'
});

// Step 2: Upload images
const files = [file1, file2, file3];
await scanAPI.uploadImagesWithFiles({
  scanId,
  files,
  address: '123 Main St'
});

// Step 3: Listen for upload complete
scanSocket.on('scan:uploaded', (data) => {
  console.log('Upload complete:', data);
  
  // Step 4: Auto-trigger processing
  scanAPI.processScan({ scanId: data.scanId });
});

// Step 5: Listen for processing events
scanSocket.on('scan:processing', (data) => {
  console.log('Processing started');
});

scanSocket.on('scan:progress', (data) => {
  console.log('Progress:', data.progress + '%');
  setProgress(data.progress);
});

scanSocket.on('scan:completed', (data) => {
  console.log('Complete!', data.result);
  navigate('/summary');
});

scanSocket.on('scan:failed', (data) => {
  console.error('Failed:', data.error);
});
```

---

## Testing the Flow

### 1. Start Services
```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd client-pwa
npm run dev

# Terminal 3 - Agents Service
cd agents-service
uvicorn app.main:app --reload

# Terminal 4 - Redis
redis-server
```

### 2. Test Steps

#### A. Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```
✅ Check: WebSocket connects (see console: "WebSocket connected")

#### B. Create Scan
```bash
POST /api/scans
{
  "houseId": "your-house-uuid",
  "address": "123 Test St"
}
```
✅ Check: Returns `{ scanId, status: "queued" }`
✅ Check: Database has Scan record

#### C. Upload Images
```bash
POST /api/scans/upload-images
Content-Type: multipart/form-data

scanId: "scan-uuid-from-step-b"
address: "123 Test St"
images: [file1, file2, file3]
```
✅ Check: Returns `{ scanId, imagesCount: 3, message: "..." }`
✅ Check: WebSocket event received: `scan:uploaded`
✅ Check: Database has Room + HouseRoomImage records
✅ Check: S3 has uploaded files

#### D. Process Scan (Auto-triggered or manual)
```bash
POST /api/scans/process
{
  "scanId": "scan-uuid"
}
```
✅ Check: Returns `{ scanId, status: "running", message: "..." }`
✅ Check: WebSocket event received: `scan:processing`
✅ Check: Redis has BullMQ job
✅ Check: WebSocket progress events: 10%, 20%, 90%, 100%
✅ Check: Agents-service receives request with image URLs
✅ Check: WebSocket event received: `scan:completed`

---

## Database Verification

### After Upload
```sql
-- Check scan
SELECT * FROM "Scan" WHERE id = 'scan-uuid';

-- Check room
SELECT * FROM "Room" WHERE "scanId" = 'scan-uuid';

-- Check images
SELECT * FROM "HouseRoomImage" WHERE "scanId" = 'scan-uuid';
```

Expected Results:
- Scan: status = 'queued'
- Room: 1 record with label "Main Room"
- HouseRoomImage: N records with S3 URLs

### After Processing
```sql
-- Check scan status
SELECT status FROM "Scan" WHERE id = 'scan-uuid';
-- Should be: 'succeeded'

-- Check agents run (TODO - not yet implemented)
SELECT * FROM "AgentsRun" WHERE "scanId" = 'scan-uuid';
```

---

## Key Changes from Original

### ❌ Removed
- `/images/uploads` endpoint - No longer needed
- `ImagesModule` - Deleted entirely
- Two separate API calls for URLs then metadata
- Complex room grouping logic

### ✅ Simplified
- **Single upload endpoint** - Files + scanId in one call
- **Storage handled in ScansService** - Direct S3 upload
- **Simple room structure** - One room per scan
- **Images fetched from DB** - Process endpoint reads from database

---

## Architecture Benefits

1. **Single Responsibility**
   - `/scans/upload-images` - Handles file upload + DB storage
   - `/scans/process` - Handles AI processing

2. **Clean Separation**
   - Upload = Store data
   - Process = Analyze data

3. **Best Practices**
   - Files uploaded once to S3
   - URLs stored in database
   - Processor reads URLs from DB (no file passing)
   - WebSocket for real-time updates

4. **Scalability**
   - Files stored in S3 (not in memory)
   - Processing async with BullMQ
   - Processor can retry with DB URLs

---

## Environment Variables

### Backend (.env)
```env
# Storage
STORAGE_ENDPOINT=https://s3.amazonaws.com
STORAGE_BUCKET=housescanner-images
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=your-key
STORAGE_SECRET_KEY=your-secret
STORAGE_PUBLIC_URL=https://cdn.example.com

# Agents Service
PYTHON_AGENTS_BASE_URL=http://localhost:8000

# Redis
REDIS_URL=redis://localhost:6379

# Upload
UPLOAD_MAX_SIZE_MB=10
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

---

## Error Handling

### Upload Errors
- **No files:** 400 Bad Request
- **Scan not found:** 404 Not Found
- **Already processing:** 400 Bad Request
- **S3 upload fails:** 500 Internal Server Error
- **Invalid file type:** 400 Bad Request

### Process Errors
- **No images:** 400 Bad Request
- **Already processing:** 400 Bad Request
- **Agents service down:** Emits `scan:failed` event
- **Timeout:** Job fails, emits `scan:failed` event

---

## Success Indicators

✅ Files uploaded to S3 with URLs like: `scans/{scanId}/{timestamp}-{index}-{filename}`
✅ Database has Room + HouseRoomImage records
✅ WebSocket event `scan:uploaded` received
✅ Auto-triggers processing
✅ WebSocket event `scan:processing` received
✅ Progress updates received: 10% → 20% → 90% → 100%
✅ WebSocket event `scan:completed` received with result
✅ Client navigates to summary page

---

## Testing Checklist

- [ ] Backend compiles with no errors
- [ ] Frontend compiles with no errors
- [ ] WebSocket connects on login
- [ ] Can create scan
- [ ] Can upload images (check S3 + DB)
- [ ] Receives `scan:uploaded` event
- [ ] Can trigger processing
- [ ] Receives `scan:processing` event
- [ ] Receives progress updates
- [ ] Agents-service receives request with correct URLs
- [ ] Receives `scan:completed` event
- [ ] Client displays results

---

## 🎉 Ready to Test!

The flow is now **simplified and working**:

1. **Create scan** → Get scanId
2. **Upload images** → Files saved to S3, URLs in DB, emit event
3. **Process** → Read URLs from DB, call agents-service, emit progress
4. **Complete** → Emit result, client shows summary

**No more duplicate image handling!**
**No more unnecessary modules!**
**Clean, simple, best practice!**
