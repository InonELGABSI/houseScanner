# Checklist Storage and Retrieval Flow

## Overview
The backend stores checklists in PostgreSQL using JSON columns and retrieves them as structured objects that match the format used by the agents-service.

## Database Schema

### Checklist Table Structure
```prisma
model Checklist {
  id        String         @id @default(uuid())
  scope     ChecklistScope  // 'house', 'room', or 'product'
  name      String
  version   Int            @default(1)
  isBase    Boolean        @default(true)  // true = system checklist, false = user custom
  userId    String?        // null for base, userId for custom
  itemsRaw  Json           // Full JSON structure (matches agents-service format)
  createdAt DateTime
}
```

### Key Fields:
- **`itemsRaw`**: Stores the complete checklist structure as JSON (exactly like the JSON files)
- **`scope`**: Determines which type of checklist (house/room/product)
- **`isBase`**: Distinguishes system checklists from user customizations

## Storage Flow

### 1. Saving Checklists (Write)

When saving a checklist to the database:

```typescript
// Example from ChecklistsService.createCustom()
await prisma.checklist.create({
  data: {
    scope: 'room',  // or 'house', 'product'
    name: 'Bedroom Checklist',
    version: 1,
    isBase: false,
    userId: 'user-123',
    itemsRaw: {
      // Complete JSON structure from rooms_type_checklist.json
      "default": {
        "description": "...",
        "items": [...]
      },
      "room_types": {
        "bedroom": {
          "description": "...",
          "items": [...]
        }
      }
    },
  }
});
```

**Key Points:**
- `itemsRaw` stores the **exact JSON structure** from the JSON files
- PostgreSQL's `Json` type stores this as JSONB internally (efficient binary format)
- `structuredClone()` is used to deep copy the object before storing

### 2. Reading Checklists (Read)

When retrieving checklists from the database:

```typescript
// Example from ChecklistsService.listBase()
const checklists = await prisma.checklist.findMany({
  where: {
    isBase: true,
    scope: 'room'
  }
});

// Access the JSON:
const checklistJson = checklists[0].itemsRaw;
// checklistJson is already a JavaScript object!
// TypeScript type: Prisma.JsonValue (can be cast to specific interface)
```

**PostgreSQL → JavaScript Conversion:**
```
Database (JSONB)  →  Prisma Client  →  JavaScript Object
{...}            →   Prisma.JsonValue  →   MergedChecklist interface
```

### 3. Type Casting

The service uses TypeScript interfaces to ensure type safety:

```typescript
interface MergedChecklist {
  default?: {
    description: string;
    items: ChecklistItem[];
  };
  house_types?: Record<string, { description: string; items: ChecklistItem[] }>;
  room_types?: Record<string, { description: string; items: ChecklistItem[] }>;
  description?: string;
  items?: ChecklistItem[];
}

// When reading:
const merged = latestBase.itemsRaw as MergedChecklist;
```

## Retrieval & Merging Flow

### Step 1: Fetch Base Checklists
```typescript
const baseChecklists = await prisma.checklist.findMany({
  where: {
    scope: 'room',
    isBase: true,
  },
  orderBy: { version: 'desc' }
});
```

### Step 2: Fetch User Custom Checklists
```typescript
const customChecklists = await prisma.checklist.findMany({
  where: {
    scope: 'room',
    userId: 'user-123',
    isBase: false,
  },
  orderBy: { version: 'desc' }
});
```

### Step 3: Merge (Base + Custom)
```typescript
// Start with latest base
let merged = baseChecklists[0].itemsRaw as MergedChecklist;

// Layer on custom checklists
for (const custom of customChecklists) {
  const customItems = custom.itemsRaw as MergedChecklist;
  merged = deepMergeChecklists(merged, customItems);
}
```

### Step 4: Return to Agents Service
```typescript
return {
  house_checklist: houseChecklist,   // itemsRaw from house scope
  rooms_checklist: roomsChecklist,   // itemsRaw from room scope
  products_checklist: productsChecklist // itemsRaw from product scope
};
```

## JSON Structure Preservation

### Example: Room Checklist

**Stored in DB (`itemsRaw` column):**
```json
{
  "default": {
    "description": "Checklist items relevant to all room types",
    "items": [
      {
        "id": "room_cleanliness",
        "title": "Room Cleanliness",
        "type": "categorical",
        "options": ["Poor", "Average", "Good", "Excellent"]
      }
    ]
  },
  "room_types": {
    "bedroom": {
      "description": "Room for sleeping",
      "items": [
        {
          "id": "bed",
          "title": "Bed",
          "type": "conditional",
          "subitems": [...]
        }
      ]
    }
  }
}
```

**Retrieved from DB:**
```typescript
const checklist = await prisma.checklist.findFirst({...});
const json = checklist.itemsRaw;
// json is the exact same structure as above!
```

**Sent to Agents Service:**
```typescript
{
  house_checklist: {...},      // from house scope
  rooms_checklist: json,       // from room scope (exactly as stored)
  products_checklist: {...}    // from product scope
}
```

## Data Flow Diagram

```
Initial Setup (Seed/Admin):
┌─────────────────────────┐
│ JSON Files              │
│ - house_type_*.json     │
│ - rooms_type_*.json     │
│ - products_type_*.json  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Database Seeding        │
│ INSERT INTO checklists  │
│ (itemsRaw = JSON)       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ PostgreSQL Database     │
│ checklists table        │
│ - itemsRaw (JSONB)      │
│ - scope, version, etc.  │
└───────────┬─────────────┘
            │
            ▼
Scan Processing:
┌─────────────────────────┐
│ ChecklistMergeService   │
│ - Fetch base checklists │
│ - Fetch user custom     │
│ - Merge JSON objects    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Agents Service          │
│ Receives merged JSON    │
│ (same structure as      │
│  original JSON files)   │
└─────────────────────────┘
```

## Key Advantages

1. **Exact Structure Preservation**: The JSON structure in the database matches the agents-service format exactly
2. **Flexible Schema**: Can store any JSON structure without schema migrations
3. **Efficient Querying**: PostgreSQL JSONB allows indexing and querying within JSON
4. **Type Safety**: TypeScript interfaces ensure type checking at compile time
5. **Versioning**: Multiple versions of checklists can coexist
6. **User Customization**: Users can override base checklists without affecting others

## Usage Examples

### Get User's Merged Checklists
```typescript
const merged = await checklistMergeService.getAllMergedChecklists(userId);
// Returns: { house_checklist, rooms_checklist, products_checklist }
```

### Create Custom Checklist
```typescript
await checklistsService.createCustom(userId, {
  scope: 'room',
  name: 'My Bedroom Checklist',
  version: 1,
  itemsRaw: { /* JSON structure */ }
});
```

### Update Checklist
```typescript
await checklistsService.updateChecklist(userId, checklistId, {
  itemsRaw: { /* updated JSON */ }
});
```

## Notes

- **No Transformation**: The JSON is stored and retrieved as-is, no conversion needed
- **Prisma Client**: Automatically handles JSON serialization/deserialization
- **Type Casting**: Use TypeScript interfaces to get type safety on the JSON objects
- **Performance**: JSONB in PostgreSQL is efficient for both storage and querying
