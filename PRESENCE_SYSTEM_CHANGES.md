# Online Presence System Implementation

## Overview
Replaced the static `last_login` timestamp with a real-time `last_seen` heartbeat system for accurate online/offline user status tracking.

## Why This Change Matters
- **Real-time Accuracy**: Users are shown as online only when actively using the app, not just when they logged in
- **Better User Experience**: More accurate presence indicators in user lists and dashboards
- **Scalability**: No dependency on login events for presence tracking
- **Thesis-Level Simplicity**: HTTP-based heartbeat without complex WebSocket infrastructure

## Database Changes
```sql
ALTER TABLE users ADD COLUMN last_seen TIMESTAMP;
```

## Backend Changes

### 1. User Model (`backend/app/modules/user/models/user.py`)
Added `last_seen` column to track real-time presence.

### 2. API Schema (`backend/app/modules/user/schemas/schemas.py`)
Added `last_seen` field to `UserResponse` for API responses.

### 3. Service Function (`backend/app/modules/user/services/services.py`)
```python
def update_last_seen(db: Session, user: User):
    """Update user's last_seen timestamp"""
    user.last_seen = datetime.utcnow()
    db.commit()
    db.refresh(user)
```

### 4. API Endpoint (`backend/app/modules/user/routes/routes.py`)
```python
@router.post("/presence")
def update_presence(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Update user's last_seen timestamp (heartbeat endpoint)"""
    update_last_seen(db, current_user)
    return {"message": "Presence updated"}
```

## Frontend Changes

### 1. User Type (`2Phishy/image-display-app/src/types/index.ts`)
Added `last_seen` field to TypeScript interface.

### 2. API Service (`2Phishy/image-display-app/src/services/api.ts`)
Added `updatePresence()` method to call the heartbeat endpoint.

### 3. AuthContext (`2Phishy/image-display-app/src/contexts/AuthContext.tsx`)
- Added heartbeat interval (30 seconds)
- Starts on login, stops on logout
- Automatic cleanup on component unmount

### 4. TopBox Component (`2Phishy/image-display-app/src/components/topBox/TopBox.tsx`)
Updated online status logic to use `last_seen` instead of `last_login`.

### 5. Additional Frontend Edits (Feb 16, 2026)
- Wired the posts/announcements/reports UI to backend HTTP endpoints instead of localStorage where applicable.
- Added announcements & reports endpoints to the frontend API: `getAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `getReports`, `createReport`, `updateReport`, `deleteReport` (`src/services/api.ts`).
- Replaced several localStorage-only flows with API calls (kept localStorage fallbacks for offline/dev):
    - `PostsPage` now uses `api.getPosts` / `api.createPost` / `api.deletePost`.
    - `AnnouncementPage` and `StudentAnnouncement` now use announcement API endpoints.
    - `ReportPage` and `StudentReport` now use report API endpoints; `ReportPage` marks reports resolved via API when available.
    - `Navbar` notifications now prefer backend `api.getReports()` / `api.getAnnouncements()` with localStorage fallback.
- Removed an unused local helper (`getReportsFromStorage`) from `src/data.ts` and removed a duplicate placeholder `getReports` in `src/services/api.ts`.
- Cleaned up unused type imports to silence TypeScript warnings.

## How It Works
1. **Login**: User logs in → Heartbeat starts (every 30 seconds)
2. **Active**: Frontend sends `POST /users/presence` → Backend updates `last_seen`
3. **Display**: Other users see someone as online if `last_seen` < 10 minutes ago
4. **Logout**: Heartbeat stops → User appears offline after 10 minutes

## Key Benefits
- ✅ Accurate real-time presence
- ✅ No WebSocket complexity
- ✅ Automatic cleanup
- ✅ Error-resilient (failed heartbeats don't break app)
- ✅ Simple HTTP-based implementation

## Files Modified
- `backend/app/modules/user/models/user.py`
- `backend/app/modules/user/schemas/schemas.py`
- `backend/app/modules/user/services/services.py`
- `backend/app/modules/user/routes/routes.py`
- `2Phishy/image-display-app/src/types/index.ts`
- `2Phishy/image-display-app/src/services/api.ts`
- `2Phishy/image-display-app/src/contexts/AuthContext.tsx`
- `2Phishy/image-display-app/src/components/topBox/TopBox.tsx`
 - `2Phishy/image-display-app/src/pages/posts/PostsPage.tsx`
 - `2Phishy/image-display-app/src/pages/announcement/AnnouncementPage.tsx`
 - `2Phishy/image-display-app/src/pages/student-announcement/StudentAnnouncement.tsx`
 - `2Phishy/image-display-app/src/pages/report/ReportPage.tsx`
 - `2Phishy/image-display-app/src/pages/student-report/StudentReport.tsx`
 - `2Phishy/image-display-app/src/components/navbar/Navbar.tsx`
 - `2Phishy/image-display-app/src/data.ts`
