# API Endpoints Migration Summary

## Overview
Successfully refactored the backend API endpoints to follow REST best practices and updated the PWA client to use the new API structure.

## Backend Changes

### 1. API Versioning
- **Updated**: Global API prefix now includes version: `/api/v1`
- **File**: `backend/src/main.ts`

### 2. Health Endpoint
- **Changed**: `/api/health` → `/api/v1/healthz`
- **File**: `backend/src/infra/health/health.controller.ts`

### 3. Auth Endpoints (No changes)
- ✅ `POST /api/v1/auth/signup`
- ✅ `POST /api/v1/auth/login`
- ✅ `POST /api/v1/auth/refresh`

### 4. Users Endpoints (Simplified)
**Removed**:
- ❌ `GET /api/v1/users` (admin only)
- ❌ `POST /api/v1/users` (admin only)
- ❌ `GET /api/v1/users/:id` (admin only)
- ❌ `PATCH /api/v1/users/:id` (admin only)
- ❌ `DELETE /api/v1/users/:id` (admin only)

**Kept** (Current user only):
- ✅ `GET /api/v1/users/me` - Get current user profile
- ✅ `PATCH /api/v1/users/me` - Update current user
- ✅ `GET /api/v1/users/me/scans` - Get user's scan history
- ✅ `GET /api/v1/users/me/checklists` - Get user's checklists

**Files Modified**:
- `backend/src/users/users.controller.ts` - Removed admin endpoints
- `backend/src/users/users.service.ts` - Added `getMyChecklists()` method

### 5. Scans Endpoints (Refactored)
**Changed**:
- `POST /api/v1/scans` - Create scan (returns `scanId`)
- `POST /api/v1/scans/:scanId/images` - Upload images (was `/scans/upload-images`)
- `POST /api/v1/scans/:scanId/process` - Process scan (was `/scans/process`)
- `GET /api/v1/scans/:scanId` - Get scan details (comprehensive, includes house, rooms, images, summary)
- `GET /api/v1/scans/:scanId/summary` - Get scan summary

**Removed**:
- ❌ `GET /api/v1/scans` - Moved to `/api/v1/users/me/scans`
- ❌ `GET /api/v1/scans/:id/rooms`
- ❌ `POST /api/v1/scans/:id/checklist`

**Files Modified**:
- `backend/src/scans/scans.controller.ts` - Updated endpoints and signatures
- `backend/src/scans/scans.service.ts` - Updated method signatures
- `backend/src/scans/dto/create-scan.dto.ts` - Created new DTO
- `backend/src/summaries/summaries.controller.ts` - Updated Swagger tags

### 6. Checklists Endpoints (Simplified)
**Removed**:
- ❌ `GET /api/v1/checklists/base`
- ❌ `PATCH /api/v1/checklists/base/admin/enable`
- ❌ `GET /api/v1/checklists/custom`
- ❌ `POST /api/v1/checklists/custom`
- ❌ `PATCH /api/v1/checklists/custom/:id`
- ❌ `DELETE /api/v1/checklists/custom/:id`

**Kept**:
- ✅ `PATCH /api/v1/checklists/:checklistId` - Update user checklist

**Files Modified**:
- `backend/src/checklists/checklists.controller.ts` - Simplified to single endpoint
- `backend/src/checklists/checklists.module.ts` - Removed unused controllers
- `backend/src/checklists/dto/update-checklist.dto.ts` - Created new DTO
- **Deleted**:
  - `backend/src/checklists/base/base-checklists.controller.ts`
  - `backend/src/checklists/base/base-checklists.service.ts`
  - `backend/src/checklists/custom/custom-checklists.controller.ts`
  - `backend/src/checklists/custom/custom-checklists.service.ts`

### 7. Houses Endpoints (Removed)
**Removed all public endpoints**:
- ❌ `POST /api/v1/houses`
- ❌ `GET /api/v1/houses`
- ❌ `GET /api/v1/houses/:id`
- ❌ `PATCH /api/v1/houses/:id`
- ❌ `DELETE /api/v1/houses/:id`

**Note**: House data is now accessed through `GET /api/v1/scans/:scanId` which includes comprehensive house information.

**Files Modified**:
- `backend/src/houses/houses.module.ts` - Removed controller
- **Deleted**:
  - `backend/src/houses/houses.controller.ts`

## Frontend (PWA) Changes

### 1. API Client Configuration
- **Updated**: Base URL now includes `/v1` version
- **File**: `client-pwa/src/api/client.ts`
```typescript
baseURL: 'http://localhost:3000/api/v1'
```

### 2. Auth API
- **Updated**: `getProfile()` now uses `/users/me` instead of `/auth/profile`
- **Updated**: `logout()` is now client-side only (no server call)
- **File**: `client-pwa/src/api/auth.ts`

### 3. Scan API
- **Updated**: All endpoints to match new structure
  - `uploadImagesWithFiles()` now uses `/scans/:scanId/images`
  - `processScan()` now takes `scanId` as parameter instead of object
  - Added `getScanDetails()` for comprehensive scan data
  - `getScanHistory()` now uses `/users/me/scans`
- **File**: `client-pwa/src/api/scan.ts`

### 4. New API Modules
**Created**:
- `client-pwa/src/api/users.ts` - Users API methods
  - `getMe()` - Get current user
  - `updateMe()` - Update current user
  - `getMyScanHistory()` - Get scan history
  - `getMyChecklists()` - Get checklists

- `client-pwa/src/api/checklists.ts` - Checklists API methods
  - `updateChecklist()` - Update checklist

- `client-pwa/src/api/index.ts` - Centralized exports

### 5. Processing Page
- **Updated**: `processScan()` call to use new signature
- **File**: `client-pwa/src/pages/scan/ProcessingPage.tsx`

## API Endpoint Summary

### Final User-Facing API Structure

```
Health
  GET /api/v1/healthz

Auth
  POST /api/v1/auth/signup
  POST /api/v1/auth/login
  POST /api/v1/auth/refresh

Users (current user only)
  GET /api/v1/users/me
  PATCH /api/v1/users/me
  GET /api/v1/users/me/scans
  GET /api/v1/users/me/checklists

Scans
  POST /api/v1/scans
  POST /api/v1/scans/:scanId/images
  POST /api/v1/scans/:scanId/process
  GET /api/v1/scans/:scanId
  GET /api/v1/scans/:scanId/summary

Checklists
  PATCH /api/v1/checklists/:checklistId
```

## Breaking Changes

1. **API Versioning**: All endpoints now require `/v1` prefix
2. **Scan Upload**: Changed from `/scans/upload-images` to `/scans/:scanId/images`
3. **Scan Process**: Now takes scanId in URL instead of body
4. **Scan History**: Moved from `/scans` to `/users/me/scans`
5. **Houses**: All house endpoints removed, data accessed via scan details
6. **Checklists**: Simplified to single update endpoint

## Migration Notes

### For Existing Clients
1. Update base URL to include `/v1`
2. Update scan upload endpoint usage
3. Update scan processing call signature
4. Update scan history endpoint
5. Remove any direct house API calls

### Internal Services
- HousesService maintained for internal use
- ChecklistsService and ChecklistMergeService maintained for internal use
- All services continue to work, only public endpoints changed

## Testing Checklist

- [ ] Health endpoint accessible
- [ ] Auth flow (signup, login, refresh)
- [ ] User profile operations
- [ ] Scan creation
- [ ] Image upload to scan
- [ ] Scan processing
- [ ] Scan details retrieval
- [ ] Scan summary retrieval
- [ ] Checklist updates
- [ ] Scan history retrieval
- [ ] User checklists retrieval

## Environment Variables

No changes required. Existing environment variables continue to work:
- `VITE_API_BASE_URL` - PWA should point to `http://localhost:3000/api/v1`
- Backend configuration unchanged

## Next Steps

1. Test all endpoints in Swagger UI
2. Update any documentation or API contracts
3. Test full scan flow in PWA
4. Verify WebSocket events still work correctly
5. Update any external integrations or clients
