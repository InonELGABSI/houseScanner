# Complete Scan Processing Flow

## Overview
The scan process follows a 3-step architecture with proper separation of concerns:
1. **Client PWA** - Handles uploads and UI
2. **Backend (NestJS)** - Orchestrates data, merges checklists, manages jobs
3. **Agents-Service (Python)** - Processes images with AI agents

---

## Step-by-Step Flow

### **Phase 1: Image Upload** 
**Endpoint**: `POST /scans/upload`

```
Client PWA
   │
   ├─► Upload image files (multipart/form-data)
   │   {
   │     houseId: "uuid",
   │     address: "123 Main St",
   │     rooms: [{ name: "Living Room", files: [File, File] }]
   │   }
   │
   ▼
Backend (scans.service.ts)
   │
   ├─► 1. Create Scan record in DB
   │      status: "pending"
   │
   ├─► 2. For each room:
   │      - Create Room record
   │      - Upload images to S3/MinIO
   │      - Save Image records with URLs
   │
   ├─► 3. Link images to Scan and Rooms
   │
   ▼
Return to Client
   {
     scanId: "scan-uuid",
     houseId: "house-uuid",
     status: "pending"
   }
```

**Database State After Upload:**
```
Scan { id, houseId, status: "pending", images: [] }
  └─► Room[] { id, scanId, name, images: [] }
       └─► Image[] { id, roomId, scanId, url: "s3://..." }
```

---

### **Phase 2: Trigger Processing**
**Endpoint**: `POST /scans/:scanId/process`

```
Client PWA
   │
   ├─► Request scan processing
   │   POST /scans/{scanId}/process
   │
   ▼
Backend (scans.service.ts::processScan)
   │
   ├─► 1. Load Scan with relations
   │      - Include house, rooms, images
   │      - Verify status (not already running/completed)
   │
   ├─► 2. Get Merged Checklists
   │      ▼
   │   ChecklistMergeService::getAllMergedChecklists(userId)
   │      │
   │      ├─► Load BASE checklists (isBase=true, latest version)
   │      │   - house: base_house_checklist
   │      │   - room: base_room_checklist
   │      │   - product: base_product_checklist
   │      │
   │      ├─► Load CUSTOM checklists (userId=X, isBase=false)
   │      │   - house: custom_house_checklist
   │      │   - room: custom_room_checklist
   │      │   - product: custom_product_checklist
   │      │
   │      ├─► Merge each scope using deepMergeChecklists()
   │      │
   │      │   For HOUSE scope:
   │      │   ┌───────────────────────────────────────┐
   │      │   │ BASE:                                 │
   │      │   │   default.items: [water_damage, ...]  │
   │      │   │   house_types.apartment.items: [...]  │
   │      │   └───────────────────────────────────────┘
   │      │                    +
   │      │   ┌───────────────────────────────────────┐
   │      │   │ CUSTOM:                               │
   │      │   │   default.items: [roof_damage]        │
   │      │   │   house_types.apartment.items:        │
   │      │   │     [balcony_safety]                  │
   │      │   └───────────────────────────────────────┘
   │      │                    ║
   │      │                    ▼
   │      │   ┌───────────────────────────────────────┐
   │      │   │ MERGED RESULT:                        │
   │      │   │   default.items: [                    │
   │      │   │     water_damage,                     │
   │      │   │     overall_cleanliness,              │
   │      │   │     ...(base items),                  │
   │      │   │     roof_damage  ← custom added       │
   │      │   │   ]                                   │
   │      │   │   house_types.apartment.items: [      │
   │      │   │     balcony (base),                   │
   │      │   │     elevator_access (base),           │
   │      │   │     parking (base),                   │
   │      │   │     balcony_safety ← custom added     │
   │      │   │   ]                                   │
   │      │   └───────────────────────────────────────┘
   │      │
   │      └─► Return: { house_checklist, rooms_checklist, products_checklist }
   │
   ├─► 3. Prepare Rooms Data
   │      rooms_data = [
   │        { room_id: "room-1", image_urls: ["s3://...", "s3://..."] },
   │        { room_id: "room-2", image_urls: ["s3://..."] }
   │      ]
   │
   ├─► 4. Update Scan Status
   │      status: "pending" → "running"
   │      startedAt: now()
   │
   ├─► 5. Queue Job
   │      ▼
   │   BullMQ Queue: 'process-scan'
   │      {
   │        scanId: "scan-uuid",
   │        houseId: "house-uuid", 
   │        userId: "user-uuid",
   │        rooms: rooms_data,
   │        house_checklist: <MERGED>,
   │        rooms_checklist: <MERGED>,
   │        products_checklist: <MERGED>
   │      }
   │
   ▼
Return to Client
   { message: "Scan processing started" }
```

**Merge Logic Details** (`deepMergeChecklists`):
```typescript
// For each scope (house/room/product):

1. Start with BASE structure as foundation
2. Merge custom.default.items → result.default.items
   - Items with same ID: custom overrides base fields
   - New IDs: append to array
3. Merge custom.{type}_types.{subtype}.items
   - Same merge logic per subtype
4. Deduplicate by ID (last wins)

Result: Unified structure with all base + custom items
```

---

### **Phase 3: Process with Agents**
**Background Job → Agents-Service**

```
Backend Worker (BullMQ processor)
   │
   ├─► Receive job from queue
   │   { scanId, rooms, house_checklist, ... }
   │
   ├─► Call Agents-Service
   │   POST http://agents-service:8001/agents-runs/run
   │   {
   │     "rooms": [
   │       { "room_id": "...", "image_urls": ["s3://..."] }
   │     ],
   │     "house_checklist": { <FINAL MERGED> },
   │     "rooms_checklist": { <FINAL MERGED> },
   │     "products_checklist": { <FINAL MERGED> }
   │   }
   │
   ▼
Agents-Service (Python)
   │
   ├─► RunScanUseCase.execute()
   │   │
   │   ├─► Fetch images from URLs
   │   ├─► Preprocess images
   │   ├─► Run Agent Pipeline
   │   │   │
   │   │   ├─► Agent 1: House Type Classification
   │   │   ├─► Agent 2: House Checklist Evaluation (merged checklist)
   │   │   ├─► Agent 3: Room Classification
   │   │   ├─► Agent 4: Room Checklist Evaluation (merged checklist)
   │   │   ├─► Agent 5: Product Detection
   │   │   ├─► Agent 6: Product Checklist Evaluation (merged checklist)
   │   │   └─► Pros/Cons Analysis
   │   │
   │   └─► Aggregate Results
   │
   ├─► Return Results
   │   {
   │     scan_id: "...",
   │     house_result: { ... },
   │     rooms_results: [ ... ],
   │     aggregated_summary: { ... },
   │     cost: { ... }
   │   }
   │
   ▼
Backend Worker (job completion)
   │
   ├─► Update Scan in DB
   │   status: "running" → "succeeded"
   │   completedAt: now()
   │   resultsSummary: <agent results>
   │
   └─► Notify client (optional webhook/websocket)
```

---

## Key Points

### ✅ **What Works Correctly**

1. **Checklist Structure Compatibility**
   - Base checklists use: `default.items`, `{scope}_types.{type}.items`
   - Custom checklists now use: **same structure** (as of your recent update)
   - Merge logic handles this perfectly ✅

2. **Merge Strategy**
   - Base items come first
   - Custom items append or override by ID
   - Deduplication keeps last occurrence
   - Preserves nested structure (subitems, descriptions)

3. **Separation of Concerns**
   - Backend: Data orchestration + checklist merging
   - Agents-Service: Pure AI processing with final checklists
   - No awareness of "base vs custom" in agents-service ✅

### 📋 **Data Flow Summary**

```
User Custom Checklist (DB)          Base Checklist (DB)
        │                                  │
        └──────────┬───────────────────────┘
                   │
                   ▼
         ChecklistMergeService
         (deepMergeChecklists)
                   │
                   ▼
           Final Merged Checklist
       {
         default: { items: [...all...] },
         house_types: {
           apartment: { items: [...all...] },
           villa: { items: [...all...] }
         }
       }
                   │
                   ▼
         Sent to Agents-Service
         (no knowledge of merge source)
                   │
                   ▼
           AI Analysis Results
```

---

## Example Merged Output

**Given:**
- Base house checklist: 6 default items + 3 apartment items
- Custom house checklist: 1 default item + 1 apartment item

**Result sent to agents-service:**
```json
{
  "house_checklist": {
    "default": {
      "items": [
        { "id": "water_damage", ... },      // from base
        { "id": "overall_cleanliness", ... }, // from base
        { "id": "structural_issues", ... }, // from base
        { "id": "electrical_system", ... }, // from base
        { "id": "plumbing_system", ... },   // from base
        { "id": "pest_issues", ... },       // from base
        { "id": "item_1760128996871", "title": "Roof Visible Damage", ... }  // from custom
      ]
    },
    "house_types": {
      "apartment": {
        "items": [
          { "id": "balcony", ... },          // from base (conditional)
          { "id": "elevator_access", ... },  // from base
          { "id": "parking", ... },          // from base (conditional)
          { "id": "item_1760129057881", "title": "Balcony Safety", ... }  // from custom
        ]
      },
      "villa": { ... },  // all from base (no custom)
      "studio": { ... }, // all from base (no custom)
      ...
    }
  }
}
```

---

## Verification Checklist

- ✅ Backend merges base + custom correctly
- ✅ Structure matches what agents-service expects
- ✅ Custom items properly append to their scope/type
- ✅ No empty type buckets in custom (your recent fix)
- ✅ Agents-service has no awareness of merge source
- ✅ Image URLs properly passed through
- ✅ Job queue handles async processing

**Status**: Flow is **fully operational** ✅
