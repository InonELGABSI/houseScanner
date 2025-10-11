# 🗄️ Connect to Database with pgAdmin

## Database Connection Info

From your `.env` file:
```
Host: localhost
Port: 5432
Database: house_scanner
Username: house_scanner
Password: house_scanner
```

## Option 1: Using pgAdmin (GUI)

### Install pgAdmin (if not installed):
```bash
brew install --cask pgadmin4
```

### Connect Steps:

1. **Open pgAdmin 4**

2. **Add New Server:**
   - Right-click "Servers" in left panel
   - Click "Create" → "Server..."

3. **General Tab:**
   - **Name:** `HouseScanner Local` (or any name you like)

4. **Connection Tab:**
   - **Host name/address:** `localhost`
   - **Port:** `5432`
   - **Maintenance database:** `house_scanner`
   - **Username:** `house_scanner`
   - **Password:** `house_scanner`
   - ☑️ Check "Save password" (optional)

5. **Click "Save"**

6. **Browse Your Database:**
   ```
   Servers
     └── HouseScanner Local
         └── Databases
             └── house_scanner
                 └── Schemas
                     └── public
                         └── Tables
                             ├── User
                             ├── House
                             ├── Scan
                             ├── Room
                             ├── HouseRoomImage
                             ├── AgentsRun
                             ├── HouseScanSummary
                             ├── BaseChecklist
                             ├── CustomChecklist
                             └── ModelInfo
   ```

---

## Option 2: Using psql (Command Line)

### Connect:
```bash
psql postgresql://house_scanner:house_scanner@localhost:5432/house_scanner
```

### Common Commands:
```sql
-- List all tables
\dt

-- Describe a table
\d "Scan"
\d "User"
\d "HouseRoomImage"

-- View data
SELECT * FROM "User";
SELECT * FROM "House";
SELECT * FROM "Scan";
SELECT * FROM "Room";
SELECT * FROM "HouseRoomImage";

-- Count records
SELECT COUNT(*) FROM "Scan";
SELECT COUNT(*) FROM "HouseRoomImage";

-- Join query to see scans with images
SELECT 
  s.id as scan_id,
  s.status,
  COUNT(hri.id) as image_count
FROM "Scan" s
LEFT JOIN "HouseRoomImage" hri ON hri."scanId" = s.id
GROUP BY s.id;

-- Exit
\q
```

---

## Option 3: Using DBeaver (Alternative GUI)

### Install:
```bash
brew install --cask dbeaver-community
```

### Connect:
- Click "New Database Connection"
- Select "PostgreSQL"
- Host: `localhost`
- Port: `5432`
- Database: `house_scanner`
- Username: `house_scanner`
- Password: `house_scanner`

---

## Quick Verification

### Check if PostgreSQL is running:
```bash
pg_isready -h localhost -p 5432
```

### Check database exists:
```bash
psql -h localhost -U house_scanner -c "\l" | grep house_scanner
```

### See all tables:
```bash
psql postgresql://house_scanner:house_scanner@localhost:5432/house_scanner -c "\dt"
```

---

## Useful Queries for Your App

### See latest scans:
```sql
SELECT 
  s.id,
  s.status,
  s."createdAt",
  h.address,
  u.email as user_email,
  COUNT(DISTINCT r.id) as room_count,
  COUNT(DISTINCT hri.id) as image_count
FROM "Scan" s
JOIN "House" h ON h.id = s."houseId"
JOIN "User" u ON u.id = h."userId"
LEFT JOIN "Room" r ON r."scanId" = s.id
LEFT JOIN "HouseRoomImage" hri ON hri."scanId" = s.id
GROUP BY s.id, h.address, u.email
ORDER BY s."createdAt" DESC
LIMIT 10;
```

### See images for a specific scan:
```sql
SELECT 
  hri.id,
  hri.url,
  hri.tag,
  r.label as room_label,
  hri."createdAt"
FROM "HouseRoomImage" hri
LEFT JOIN "Room" r ON r.id = hri."roomId"
WHERE hri."scanId" = 'YOUR_SCAN_ID_HERE'
ORDER BY hri."createdAt";
```

### See all scans with their processing status:
```sql
SELECT 
  s.id,
  s.status,
  s."createdAt",
  s."finishedAt",
  EXTRACT(EPOCH FROM (s."finishedAt" - s."createdAt")) as processing_seconds
FROM "Scan" s
ORDER BY s."createdAt" DESC;
```

---

## Database Schema Overview

Your current tables:

1. **User** - User accounts
2. **House** - Houses owned by users
3. **Scan** - Scan records (one per upload/process cycle)
4. **Room** - Rooms detected in scans
5. **HouseRoomImage** - Individual images with S3 URLs
6. **AgentsRun** - AI processing run metadata
7. **HouseScanSummary** - Scan results and summaries
8. **BaseChecklist** - System checklists
9. **CustomChecklist** - User custom checklists
10. **ModelInfo** - AI model information

---

## Troubleshooting

### Can't connect?
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL if not running
brew services start postgresql@14

# Or check with:
pg_ctl status
```

### Permission denied?
```bash
# Make sure user exists
psql postgres -c "SELECT usename FROM pg_user WHERE usename='house_scanner';"

# If not, create user:
psql postgres -c "CREATE USER house_scanner WITH PASSWORD 'house_scanner';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE house_scanner TO house_scanner;"
```

### Database doesn't exist?
```bash
# Create database
createdb -U house_scanner house_scanner

# Or run Prisma migrations
cd backend
npx prisma migrate dev
```

---

## 🎯 Quick Start

**Easiest way to view your database:**

```bash
# Open in psql
psql postgresql://house_scanner:house_scanner@localhost:5432/house_scanner

# Then run:
\dt                    # See all tables
SELECT * FROM "Scan";  # View scans
\q                     # Exit
```

**Or download and open pgAdmin 4 for a nice GUI!**
