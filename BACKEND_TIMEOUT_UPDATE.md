# Backend Timeout Configuration Update

## Changes Made

### Issue
The backend was timing out after 30 seconds when making requests to the Python agents service, but AI processing (especially with vision models) takes longer.

**Error:**
```
AxiosError: timeout of 30000ms exceeded
```

### Solution
Increased the timeout from **30 seconds to 5 minutes (300,000ms)** to accommodate AI processing time.

## Files Modified

### 1. `/backend/src/config/python.config.ts`
**Before:**
```typescript
timeout: Number(process.env.PYTHON_AGENTS_TIMEOUT ?? 30000),
```

**After:**
```typescript
timeout: Number(process.env.PYTHON_AGENTS_TIMEOUT ?? 300000), // 5 minutes for AI processing
```

### 2. `/backend/src/app.module.ts`
**Before:**
```typescript
PYTHON_AGENTS_TIMEOUT: Joi.number().default(30000),
```

**After:**
```typescript
PYTHON_AGENTS_TIMEOUT: Joi.number().default(300000), // 5 minutes for AI processing
```

### 3. `/backend/.env`
**Before:**
```properties
PYTHON_AGENTS_TIMEOUT=30000
```

**After:**
```properties
PYTHON_AGENTS_TIMEOUT=300000
```

### 4. `/backend/.env.example`
**Before:**
```properties
PYTHON_AGENTS_TIMEOUT=30000
```

**After:**
```properties
PYTHON_AGENTS_TIMEOUT=300000  # 5 minutes (300000ms) for AI agent processing
```

## Why 5 Minutes?

The scan processing involves:
- **Agent 1:** House type classification (~2-3s)
- **Agent 2:** House checklist evaluation in batches (~10-30s)
- **Agent 3:** Room type classification per room (~2-3s each)
- **Agent 4:** Room checklist evaluation per room (~10-30s each)
- **Agent 5:** Products checklist evaluation per room (~10-30s each)
- **Agent 6:** Pros/cons analysis (~2-5s)

With multiple rooms, batching, and potential API rate limits, total processing time can be **2-4 minutes** for a typical scan. The 5-minute timeout provides a comfortable buffer.

## Configuration Override

You can adjust the timeout via environment variable:
```bash
# For longer processing (10 minutes)
PYTHON_AGENTS_TIMEOUT=600000

# For shorter processing (2 minutes)
PYTHON_AGENTS_TIMEOUT=120000
```

## Next Steps

1. ✅ Restart the backend to apply the new timeout
2. ✅ Test scan processing with actual images
3. Monitor processing times in production to optimize if needed

## Related Configuration

- **Retry Count:** 1 retry = 2 total attempts (configurable via `PYTHON_AGENTS_RETRY_COUNT`)
- **Retry Delay:** 500ms between retries (configurable via `PYTHON_AGENTS_RETRY_DELAY`)

### Retry Behavior
With `PYTHON_AGENTS_RETRY_COUNT=1`:
- **1st attempt:** Wait up to 5 minutes
- **2nd attempt (if timeout):** Wait up to 5 minutes again
- **After 2nd timeout:** Return error to user

This means a maximum of **10 minutes** total before giving up (2 attempts × 5 minutes each).
