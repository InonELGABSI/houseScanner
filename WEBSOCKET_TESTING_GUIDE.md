# WebSocket Flow Testing Guide

## Overview
This document outlines the complete end-to-end flow for testing the WebSocket-integrated scan processing system.

## Architecture Summary

### Frontend (client-pwa)
- **WebSocket Service**: `src/services/scanSocket.ts` - Manages Socket.IO connection
- **Auth Integration**: `src/context/AuthContext.tsx` - Connects/disconnects WebSocket with auth lifecycle
- **Image Upload API**: `src/api/images.ts` - Uploads files to backend storage
- **Scan API**: `src/api/scan.ts` - `uploadImages()` and `processScan()` endpoints
- **Processing Page**: `src/pages/scan/ProcessingPage.tsx` - Real-time progress UI with WebSocket events
- **Verify Page**: `src/pages/scan/VerifyImagesPage.tsx` - Address input and image review

### Backend (backend)
- **WebSocket Gateway**: `src/scans/scans.gateway.ts` - Emits scan events to user-specific rooms
- **Scans Service**: `src/scans/scans.service.ts` - Business logic for upload/process
- **Scan Processor**: `src/infra/queue/processors/scan.processor.ts` - Background job processing
- **Endpoints**: 
  - `POST /scans/upload-images` - Create scan with images
  - `POST /scans/process` - Queue scan for processing

## Complete Flow

### 1. User Authentication
```
Client Login/Signup → AuthContext.login() → scanSocket.connect(user.id)
```

**What happens:**
- User authenticates via `/auth/login` or `/auth/signup`
- `AuthContext` stores user data
- `scanSocket.connect(user.id)` establishes WebSocket connection
- Client joins room: `user:{userId}`

**Test:**
```bash
# Check browser console for:
"WebSocket connected"
```

---

### 2. Image Capture/Upload
```
User captures images → VerifyImagesPage → Reviews images + enters address
```

**What happens:**
- User navigates through capture flow
- Images stored in `ScanContext` as `ImageRef[]` with `file` and `url`
- User can add optional house address
- Click "Approve & process" → `SET_PHASE('processing')`

**Test:**
- Verify images appear in grid
- Verify address input works
- Check `ScanContext.state.images` has File objects

---

### 3. Processing Page - Upload Phase
```
ProcessingPage mounts → uploadAndProcess() → imageAPI.uploadFiles() → scanAPI.uploadImages()
```

**What happens:**
1. `ProcessingPage` loads, shows "Preparing upload..."
2. Filters images with `file !== null`, uploads via `POST /images/uploads`
3. Backend returns image URLs
4. Calls `POST /scans/upload-images` with URLs + metadata
5. Backend creates Scan, Rooms, HouseRoomImages in DB
6. Backend emits WebSocket event: `scan:uploaded`

**Backend Logs:**
```
[ScansService] Creating scan for house: {houseId}
[ScansService] Created {roomsCount} rooms with {imagesCount} images
[ScansGateway] Emitting 'scan:uploaded' to user:{userId}
```

**Client Console:**
```
Images uploaded: { scanId: '...', roomsCount: 2, imagesCount: 5, message: '...' }
Status: 'uploaded'
Stage: 'Images uploaded successfully'
```

**Test:**
- Check network tab: `POST /images/uploads` returns `{ urls: [...] }`
- Check network tab: `POST /scans/upload-images` returns scan object
- Check database: Scan, Room, HouseRoomImage records created
- Verify WebSocket event received in browser console

---

### 4. Auto-Trigger Processing
```
Client receives 'scan:uploaded' → setTimeout → scanAPI.processScan(scanId)
```

**What happens:**
1. Client receives `scan:uploaded` event
2. After 500ms delay, calls `POST /scans/process` with `scanId`
3. Backend queues BullMQ job
4. Backend emits `scan:processing` event
5. Processor starts executing

**Backend Logs:**
```
[ScansService] Queuing scan {scanId} for processing
[ScansGateway] Emitting 'scan:processing' to user:{userId}
[ScanProcessor] Processing scan {scanId}
```

**Client Console:**
```
Processing started: { scanId: '...', message: 'Scan queued for processing' }
Status: 'processing'
Stage: 'Processing images...'
Progress: 20%
```

**Test:**
- Check Redis: Job queued in BullMQ
- Verify `scan:processing` event received
- UI shows spinner + "Processing images..."

---

### 5. Background Processing with Progress
```
ScanProcessor → emitProgress(10%) → Calls agents-service → emitProgress(20%, 90%, 100%)
```

**What happens:**
1. Processor emits progress at 10% (preparing data)
2. Calls `ChecklistMergeService` to merge checklists
3. Calls agents-service `/v1/scan/run` with merged data
4. Emits progress at 20%, 90% (processing)
5. Receives response from agents-service
6. Emits progress at 100%
7. Emits `scan:completed` with full result data

**Backend Logs:**
```
[ScanProcessor] Emitting progress: 10%
[ScanProcessor] Merged checklists for scan {scanId}
[ScanProcessor] Calling agents-service...
[ScanProcessor] Emitting progress: 20%
[ScanProcessor] Emitting progress: 90%
[ScanProcessor] Agents service response received
[ScanProcessor] Emitting progress: 100%
[ScansGateway] Emitting 'scan:completed' to user:{userId}
```

**Client Console:**
```
Progress update: { scanId: '...', progress: 10 }
Progress update: { scanId: '...', progress: 20, stage: 'Analyzing rooms...' }
Progress update: { scanId: '...', progress: 90, stage: 'Finalizing results...' }
Progress update: { scanId: '...', progress: 100 }
Scan completed: { scanId: '...', message: 'Scan processing completed', result: {...} }
Status: 'completed'
Stage: 'Scan completed!'
```

**Test:**
- Progress bar animates from 0% → 100%
- Check agents-service logs for incoming request
- Verify WebSocket progress events in console
- Check `scan:completed` event has result data

---

### 6. Navigation to Summary
```
Client receives 'scan:completed' → setTimeout(1500ms) → Navigate to summary
```

**What happens:**
1. Client receives `scan:completed` with result data
2. Shows "Scan completed!" for 1.5 seconds
3. Dispatches `SET_PHASE('summary')`
4. Navigates to summary page

**Client Console:**
```
Navigating to summary...
```

**Test:**
- Summary page displays results
- Check that result data is available

---

## Error Handling

### Upload Failure
```
imageAPI.uploadFiles() throws → Status: 'failed' → Shows error UI
```

**What happens:**
- Error caught in `uploadAndProcess()`
- `setStatus('failed')` + `setError(message)`
- Shows "❌ Processing Failed" screen
- "Try Again" button returns to verify page

### Processing Failure
```
Agents-service fails → Processor emits 'scan:failed'
```

**What happens:**
- Processor catches error
- Emits `scan:failed` event with error message
- Client shows failure UI

**Backend Logs:**
```
[ScanProcessor] Error processing scan: {error}
[ScansGateway] Emitting 'scan:failed' to user:{userId}
```

**Client Console:**
```
Scan failed: { scanId: '...', error: 'Agent processing failed' }
Status: 'failed'
```

---

## Testing Checklist

### Prerequisites
- [ ] Backend running: `npm run start:dev`
- [ ] Agents-service running on configured port
- [ ] Redis running for BullMQ
- [ ] PostgreSQL database accessible
- [ ] Frontend running: `npm run dev`

### Manual Test Steps

1. **Authentication**
   - [ ] Login with valid credentials
   - [ ] Check console: "WebSocket connected"
   - [ ] Verify network tab: WebSocket connection established

2. **Image Upload**
   - [ ] Navigate to scan flow
   - [ ] Upload/capture at least 2 images
   - [ ] Verify images in VerifyImagesPage
   - [ ] Enter address (optional)
   - [ ] Click "Approve & process"

3. **Upload Phase**
   - [ ] ProcessingPage shows "Uploading images..."
   - [ ] Check network: `POST /images/uploads` succeeds
   - [ ] Check network: `POST /scans/upload-images` succeeds
   - [ ] Console shows: "Images uploaded"
   - [ ] Status changes to "uploaded"

4. **Processing Phase**
   - [ ] After 500ms, auto-triggers processing
   - [ ] Console shows: "Processing started"
   - [ ] Progress bar appears
   - [ ] Progress updates: 10%, 20%, 90%, 100%
   - [ ] Status messages update

5. **Completion**
   - [ ] Console shows: "Scan completed"
   - [ ] Shows "Scan Complete!" message
   - [ ] After 1.5s, navigates to summary
   - [ ] Summary displays results

6. **Error Cases**
   - [ ] Test with no images → Shows error
   - [ ] Test with network failure → Shows retry UI
   - [ ] Test agents-service down → Shows processing failed

### WebSocket Events to Monitor

In browser console, watch for these events:
```javascript
// Success flow
"Images uploaded: { scanId, roomsCount, imagesCount }"
"Processing started: { scanId, message }"
"Progress update: { scanId, progress: 10 }"
"Progress update: { scanId, progress: 20 }"
"Progress update: { scanId, progress: 90 }"
"Progress update: { scanId, progress: 100 }"
"Scan completed: { scanId, message, result }"

// Failure flow
"Scan failed: { scanId, error }"
```

---

## Database Verification

### After Upload
```sql
-- Check scan created
SELECT * FROM "Scan" WHERE id = '{scanId}';

-- Check rooms created
SELECT * FROM "Room" WHERE "scanId" = '{scanId}';

-- Check images linked
SELECT * FROM "HouseRoomImage" WHERE "roomId" IN (
  SELECT id FROM "Room" WHERE "scanId" = '{scanId}'
);
```

### After Processing (TODO - not yet implemented)
```sql
-- Check AgentsRun created
SELECT * FROM "AgentsRun" WHERE "scanId" = '{scanId}';

-- Check summary created
SELECT * FROM "HouseScanSummary" WHERE "scanId" = '{scanId}';
```

---

## Known TODOs

1. **Store agents-service response**: Processor needs to save result to DB
   - Create `AgentsRun` record
   - Update Scan status to 'completed'
   - Create `HouseScanSummary` record

2. **House creation**: Currently uses placeholder UUID
   - Need house creation/selection flow
   - Link scans to actual houses

3. **Image URL handling**: Need to handle different image sources
   - Camera captures → upload files
   - Existing URLs → use directly
   - Currently assumes all have File objects

4. **Transform result to ScanSummary**: ProcessingPage needs to convert
   - Map agents-service response to `ScanSummary` interface
   - Store in `ScanContext`
   - Pass to summary page

---

## Environment Variables

### Backend (.env)
```env
PYTHON_AGENTS_SERVICE_URL=http://localhost:8000
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_URL=postgresql://user:pass@localhost:5432/housescanner
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

## Troubleshooting

### WebSocket not connecting
- Check backend CORS configuration
- Verify `@nestjs/platform-socket.io` installed
- Check browser console for connection errors

### Events not received
- Verify user authenticated (`scanSocket.connect()` called)
- Check backend logs for gateway emissions
- Verify room name matches: `user:{userId}`

### Progress stuck at 0%
- Check Redis connection
- Verify BullMQ processor running
- Check agents-service accessibility

### Image upload fails
- Check `multer` configuration in backend
- Verify storage service (S3/local) configured
- Check file size limits

---

## Performance Notes

- Image upload: ~2-5 seconds for 5 images
- Agents-service processing: ~30-60 seconds
- WebSocket latency: <100ms
- Total flow: ~1-2 minutes end-to-end
