# Quick Start Guide - WebSocket Scan Flow

## 🚀 Start Services

```bash
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend  
cd client-pwa
npm run dev

# Terminal 3 - Agents Service (optional for full flow)
cd agents-service
python -m uvicorn app.main:app --reload

# Terminal 4 - Redis (if not running as service)
redis-server
```

## 📱 User Flow

### 1. Login
- Navigate to http://localhost:5173
- Login with credentials
- ✅ Check console: "WebSocket connected"

### 2. Start Scan
- Click "New Scan" or similar
- Navigate through capture flow

### 3. Capture Images
- Upload or capture at least 2 images
- Click "Next" or "Continue"

### 4. Verify & Submit
- Review images in grid
- Enter house address (optional): "123 Main St, City"
- Click **"Approve & process"**

### 5. Watch Processing (Auto)
The page will automatically show:

```
⏳ Uploading images to storage...
   ↓ (2-5 seconds)
✅ Images uploaded successfully
   ↓ (auto-triggers after 500ms)
⏳ Processing images...
   ↓ (shows progress bar)
▓▓░░░░░░░░ 10% - Preparing data...
   ↓
▓▓▓░░░░░░░ 20% - Analyzing rooms...
   ↓
▓▓▓▓▓▓▓▓▓░ 90% - Finalizing results...
   ↓
▓▓▓▓▓▓▓▓▓▓ 100% - Complete!
   ↓ (auto-navigates after 1.5s)
✅ Scan Complete! → Summary Page
```

## 🔍 What to Watch

### Browser Console
```javascript
// Success flow:
"Images uploaded: { scanId: '...', roomsCount: 2, imagesCount: 5 }"
"Processing started: { scanId: '...' }"
"Progress update: { scanId: '...', progress: 10 }"
"Progress update: { scanId: '...', progress: 20 }"
"Progress update: { scanId: '...', progress: 90 }"
"Progress update: { scanId: '...', progress: 100 }"
"Scan completed: { scanId: '...', result: {...} }"
```

### Backend Logs
```
[ScansService] Creating scan for house: ...
[ScansService] Created 2 rooms with 5 images
[ScansGateway] Emitting 'scan:uploaded' to user:...
[ScansService] Queuing scan ... for processing
[ScansGateway] Emitting 'scan:processing' to user:...
[ScanProcessor] Processing scan ...
[ScanProcessor] Emitting progress: 10%
[ScanProcessor] Merged checklists for scan ...
[ScanProcessor] Calling agents-service...
[ScanProcessor] Emitting progress: 20%
[ScanProcessor] Emitting progress: 90%
[ScanProcessor] Emitting progress: 100%
[ScansGateway] Emitting 'scan:completed' to user:...
```

### Network Tab
```
POST /api/images/uploads          → 200 OK { urls: [...] }
POST /api/scans/upload-images     → 201 Created { scan: {...} }
WebSocket Frame → scan:uploaded
POST /api/scans/process           → 201 Created { message: "..." }
WebSocket Frame → scan:processing
WebSocket Frame → scan:progress (multiple)
WebSocket Frame → scan:completed
```

## ⚠️ Common Issues

### WebSocket Not Connecting
```bash
# Check if Socket.IO is running
curl http://localhost:3000/socket.io/
# Should return Socket.IO protocol info

# Check backend logs for:
[ScansGateway] Client connected: ...
```

### Events Not Received
1. Verify login successful
2. Check `scanSocket.isConnected()` in console
3. Verify user ID in room: `user:{userId}`

### Images Not Uploading
1. Check file size limits (default: 10MB)
2. Verify storage service configured
3. Check backend logs for multer errors

### Processing Stuck
1. Verify Redis running: `redis-cli ping` → PONG
2. Check BullMQ queue: `redis-cli KEYS "*bull*"`
3. Verify agents-service accessible

## 🧪 Quick Test

```bash
# In browser console after login:
scanSocket.isConnected()  // Should return true

# To manually test events:
scanSocket.on('scan:uploaded', (data) => console.log('TEST:', data))
```

## ✅ Success Indicators

- [ ] WebSocket connects on login
- [ ] Images upload successfully
- [ ] `scan:uploaded` event received
- [ ] Processing auto-triggers
- [ ] `scan:processing` event received
- [ ] Progress bar animates smoothly
- [ ] `scan:completed` event received
- [ ] Auto-navigates to summary
- [ ] Results display correctly

## 🎯 End-to-End Time

- Login: instant
- Upload: ~2-5 seconds
- Processing: ~30-60 seconds
- **Total: ~1-2 minutes**

## 📞 Debug Commands

```bash
# Check WebSocket connections
netstat -an | grep 3000

# Monitor Redis
redis-cli MONITOR

# Check database
psql housescanner
SELECT * FROM "Scan" ORDER BY "createdAt" DESC LIMIT 5;

# Backend logs
tail -f backend.log
```

That's it! The flow should work seamlessly with real-time updates. 🎉
