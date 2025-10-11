# Scan Data Persistence & WebSocket Implementation

## Summary
Implemented complete scan data persistence and WebSocket notification flow to save agents-service results to the database and notify the client when scanning is complete.

## Changes Made

### 1. Backend - Scan Processor Enhancement
**File:** `backend/src/infra/queue/processors/scan.processor.ts`

#### Added Dependencies
- Imported `PrismaService` for database access

#### Implemented `saveScanResults()` Method
This method handles saving all scan results from agents-service to the database:

```typescript
private async saveScanResults(scanId: string, houseId: string, agentsResponse: any)
```

**Database Updates Performed:**

1. **House Table** - Updates house type with detected classification
   - Field: `houseType` (primary detected type from agents-service)

2. **Room Table** - Updates each room with detected room types
   - Field: `detectedRoomTypes` (array of classified room types)

3. **Scan Table** - Updates scan status and metadata
   - `status`: Changed from 'running' to 'succeeded'
   - `finishedAt`: Timestamp of completion
   - `detectedHouseTypes`: Array of all detected house types

4. **AgentsRun Table** - Creates records for cost tracking
   - One record per agent execution
   - Stores token usage (prompt + completion tokens)
   - Tracks agent name and execution timestamps

5. **HouseScanSummary Table** - Stores the complete scan summary
   - `summaryJson`: Client-formatted summary from agents-service
   - `prosConsJson`: Pros and cons analysis
   - `costSummary`: Full cost breakdown including tokens, requests, and pricing
   - `schemaVersion`: Pipeline version (e.g., "2.0.0")

#### Transaction Safety
All database operations are wrapped in a Prisma transaction to ensure atomicity. If any part fails, all changes are rolled back.

#### Error Handling
- Catches and logs errors without throwing
- Ensures WebSocket completion event is sent even if database save fails
- Client still receives the full response data

### 2. WebSocket Flow (Already Implemented)

The WebSocket notification system was already in place:

#### Backend Events (ScansGateway)
- `scan:uploaded` - Images uploaded successfully
- `scan:processing` - Processing started
- `scan:progress` - Progress updates (0-100%)
- `scan:completed` - **Processing completed with results**
- `scan:failed` - Processing failed with error

#### Client Listeners (ProcessingPage.tsx)
The client already handles the `scan:completed` event:
```typescript
const handleCompleted = (data: { scanId: string; message: string; result?: any }) => {
  // 1. Update UI status
  setStatus('completed');
  setProgress(100);
  
  // 2. Navigate to summary page after delay
  setTimeout(() => {
    if (data.result) {
      dispatch({ type: 'SET_PHASE', payload: 'summary' });
    } else {
      navigate(`/scan/summary/${data.scanId}`);
    }
  }, 1500);
}
```

## Data Flow Diagram

```
┌─────────────┐
│   Client    │
│  (Upload)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│          Backend (NestJS)                       │
│                                                 │
│  1. Save images to MinIO                       │
│  2. Create Scan record (status: queued)        │
│  3. Queue scan job (BullMQ)                    │
│  4. Update status to 'running'                 │
└──────┬──────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│      Scan Processor (Queue Worker)              │
│                                                 │
│  1. Prepare request for agents-service         │
│  2. Call agents-service POST /v1/scan/run      │
│  3. Receive analysis results                   │
│  4. Save results to database: ┐                │
│     - Update House (houseType)│                │
│     - Update Rooms (roomTypes)│                │
│     - Update Scan (succeeded) │                │
│     - Create AgentsRun records│                │
│     - Create HouseScanSummary └────────┐       │
└──────┬──────────────────────────────────┘       │
       │                                          │
       ▼                                          ▼
┌──────────────────────┐              ┌──────────────────┐
│  WebSocket Gateway   │              │   PostgreSQL     │
│                      │              │                  │
│  Emit: scan:completed│              │  Tables Updated: │
│  {                   │              │  - houses        │
│    scanId,          │              │  - rooms         │
│    message,         │              │  - scans         │
│    result           │              │  - agents_runs   │
│  }                  │              │  - house_scan_   │
│                      │              │    summary       │
└──────┬───────────────┘              └──────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│           Client (React)                        │
│                                                 │
│  1. Receive scan:completed event               │
│  2. Update UI (progress 100%, status)          │
│  3. Navigate to /scan/summary/:scanId          │
│  4. Fetch complete scan details via API        │
└─────────────────────────────────────────────────┘
```

## Testing the Flow

### 1. Start All Services
```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Agents Service
cd agents-service
python -m uvicorn app.main:app --reload

# Terminal 3: Client
cd client-pwa
npm run dev
```

### 2. Perform a Scan
1. Navigate to the upload page
2. Upload images for rooms
3. Watch the processing page for WebSocket events

### 3. Verify Database Updates

Check the database after scan completion:

```sql
-- Check house was updated
SELECT id, "houseType", "updatedAt" 
FROM houses 
WHERE id = '<houseId>';

-- Check rooms were updated
SELECT id, "detectedRoomTypes" 
FROM rooms 
WHERE "scanId" = '<scanId>';

-- Check scan status
SELECT id, status, "finishedAt", "detectedHouseTypes"
FROM scans 
WHERE id = '<scanId>';

-- Check agent runs were created
SELECT "agentName", "tokensIn", "tokensOut", "createdAt"
FROM agents_runs 
WHERE "scanId" = '<scanId>';

-- Check summary was created
SELECT id, "prosConsJson", "schemaVersion"
FROM house_scan_summary 
WHERE "scanId" = '<scanId>';
```

### 4. Monitor Logs

**Backend logs should show:**
```
[ScanProcessor] Agents-service completed scan <scanId>
[ScanProcessor] Saving results for scan <scanId>
[ScanProcessor] Updated house <houseId> with type: apartment
[ScanProcessor] Updated room <roomId> with types: kitchen, living_room
[ScanProcessor] Updated scan <scanId> status to succeeded
[ScanProcessor] Created X agent run records for scan <scanId>
[ScanProcessor] Created/updated summary for scan <scanId>
[ScanProcessor] Successfully saved all results for scan <scanId> to database
[ScanProcessor] Successfully processed scan <scanId>
[ScansGateway] Emitted 'scan:completed' to user <userId>
```

**Client console should show:**
```
Progress update: {scanId: "...", progress: 90, stage: "Saving results"}
Progress update: {scanId: "...", progress: 100, stage: "Complete"}
Scan completed: {scanId: "...", message: "...", result: {...}}
```

## API Endpoints to Verify Data

### Get Scan Details
```bash
GET /api/scans/:scanId
Authorization: Bearer <token>
```

Returns complete scan with:
- House information
- Rooms with detected types
- Images
- Summary (if exists)

### Get Scan Summary
```bash
GET /api/summaries/scan/:scanId
Authorization: Bearer <token>
```

Returns:
- Client summary (from agents-service)
- Pros/cons analysis
- Cost breakdown
- Room and product details

## Next Steps

### Potential Enhancements
1. **Retry Logic**: Add retry mechanism if database save fails
2. **Partial Success**: Handle cases where some data saves but others fail
3. **Caching**: Cache scan results in Redis for faster retrieval
4. **Notifications**: Add email/push notifications when scan completes
5. **Analytics**: Track scan success rates and processing times

### Client Improvements
1. **Rich Summary Display**: Use the `result` data in completion event to show preview
2. **Offline Support**: Cache scan results for offline viewing
3. **Progress Details**: Show which agent is currently running
4. **Cost Display**: Show token usage and estimated cost to user

## Troubleshooting

### Scan Status Not Updating
- Check BullMQ queue is running: `GET /api/admin/queue/health`
- Verify PrismaService is injected in ScanProcessor
- Check database connection

### WebSocket Not Received
- Verify client is connected to WebSocket
- Check userId is correctly extracted from JWT token
- Monitor ScansGateway logs for emit events

### Database Save Fails
- Check Prisma migrations are up to date
- Verify foreign key relationships (houseId, scanId exist)
- Check JSON fields accept the data structure

### Data Mismatch
- Verify agents-service response structure matches expected format
- Check room_id in response matches database room IDs
- Validate JSON schema versions are compatible
