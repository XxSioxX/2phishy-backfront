# Frontend Overview — 2Phishy image-display-app

This document lists the important frontend files, their purpose, and key code snippets from the `image-display-app` React application.

---

## Entry

- File: [image-display-app/src/main.tsx](image-display-app/src/main.tsx)
- Purpose: App bootstrap — imports global styles and mounts the React tree.
- Code:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.scss';
import App from './App';
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## App & Routing

- File: [image-display-app/src/App.tsx](image-display-app/src/App.tsx)
- Purpose: Wraps providers (`ThemeProvider`, `AuthProvider`, `TimezoneProvider`, `MobileMenuProvider`), defines layout and routes using `createBrowserRouter`. Uses `RouteGuard` to restrict routes by role.
- Key router snippet:
```ts
const router = createBrowserRouter([
  { path: "/", element: <LayoutContent/>, children: [
    { path: "/", element: <RouteGuard allowedRoles={[ 'admin','super-admin' ]}><Home/></RouteGuard> },
    { path: "/bulletin", element: <RouteGuard allowedRoles={[ 'student','admin','super-admin' ]}><BulletinPage/></RouteGuard> },
    { path: "/play-game", element: <RouteGuard allowedRoles={[ 'student','admin','super-admin' ]}><GamePage/></RouteGuard> },
    // ...other routes
  ]},
  { path: "/login", element: <Login/> },
  { path: "/register", element: <Register/> }
]);
```

---

## Auth context

- File: [image-display-app/src/contexts/AuthContext.tsx](image-display-app/src/contexts/AuthContext.tsx)
- Purpose: Central user state: loads/stores `user` and `token` into `localStorage`, exposes `login`/`logout`, `isAuthenticated`, and auto-logout on inactivity.
- Key code:
```ts
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
const login = (userData, token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(userData));
  setUser(userData);
  resetInactivityTimer();
};
const logout = () => { apiLogout(); setUser(null); clearInactivityTimer(); };
```

---

## API service

- File: [image-display-app/src/services/api.ts](image-display-app/src/services/api.ts)
- Purpose: Single place for HTTP calls, handles `API_BASE_URL`, attaches auth headers, and implements domain methods (login, users, posts, game endpoints).
- Key code:
```ts
let API_BASE_URL = process.env.REACT_APP_API_BASE_URL!;
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token && { 'Authorization': `Bearer ${token}` }) };
};
async login(username, password) {
  const response = await fetch(`${API_BASE_URL}/users/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password}) });
  if (!response.ok) throw new Error(...);
  return response.json();
}
// posts
async getPosts() { const response = await fetch(`${API_BASE_URL}/posts`, { headers: getAuthHeaders() }); return response.json(); }
async createPost(postData) { await fetch(`${API_BASE_URL}/posts`, { method:'POST', headers: getAuthHeaders(), body: JSON.stringify(postData) }); }
```

---

## RouteGuard (authorization)

- File: [image-display-app/src/components/RouteGuard.tsx](image-display-app/src/components/RouteGuard.tsx)
- Purpose: Prevents unauthenticated or unauthorized access; redirects based on role.
- Key logic:
```ts
if (loading) return <Loading... />;
if (!isAuthenticated) return <Navigate to="/login" />;
if (allowedRoles.length === 0) return <>{children}</>;
if (user?.role && allowedRoles.includes(user.role)) return <>{children}</>;
// redirects for students/admins otherwise
```

---

## Navbar (top navigation + notifications)

- File: [image-display-app/src/components/navbar/Navbar.tsx](image-display-app/src/components/navbar/Navbar.tsx)
- Purpose: Renders menu toggle, logo, user info, notification badge; reads reports/announcements from `localStorage` and updates badge; toggles fullscreen.
- Notification snippet:
```ts
useEffect(() => {
  const calculateNotifications = () => {
    const allReports = getReportsFromStorage();
    const viewedNotifications = JSON.parse(localStorage.getItem('viewedNotifications') || '{}');
    const newNotificationsCount = studentReports.filter(r => !viewedNotifications[`report_${r.id}`]).length;
    setNotificationCount(newNotificationsCount + newAnnouncementsCount);
  };
  if (isAuthenticated && user) calculateNotifications();
  window.addEventListener('storage', handleStorageChange);
}, [isAuthenticated, user]);
```

---

## Posts / Bulletin (CRUD UI)

- File: [image-display-app/src/pages/posts/PostsPage.tsx](image-display-app/src/pages/posts/PostsPage.tsx)
- Purpose: Lists published posts with filtering, pagination; allows adding and deleting posts (uses `api.createPost` and `api.deletePost`).
- Key snippets:
```ts
const fetchPosts = async () => {
  setLoading(true);
  const data = await api.getPosts();
  setPosts(data.map(p => ({ ...p, created_by_role: p.created_by_role?.toLowerCase() || 'student' })));
};
const handleSaveAdd = async () => {
  if (!validateForm()) return;
  await api.createPost({ ...formData, status:'published', created_by: username, created_by_role: userRole });
  fetchPosts();
};
```

---

## Game page (Phaser integration)

- File: [image-display-app/src/pages/game/GamePage.tsx](image-display-app/src/pages/game/GamePage.tsx)
- Purpose: Dynamically imports and mounts Phaser game, performs robust cleanup to avoid duplicate canvas/game instances (handles React StrictMode double-mount), shows friendly errors for WebGL failures.
- Key pattern:
```ts
// NUCLEAR CLEANUP: destroy previous games and canvases
if (gameInstanceRef.current) { gameInstanceRef.current.destroy(true); gameInstanceRef.current = null; }
const { createPhaserGame } = await import('../../game/integrated-game');
gameInstanceRef.current = createPhaserGame(gameContainerRef.current, userData);
(window as any).gameInstance = gameInstanceRef.current;
```

---

## Types & Utilities

- Files: `src/types/*` and `src/utils/*`
- Purpose: Central TypeScript type definitions (`User`, `Report`, etc.) and helper utilities used across pages (date helpers, weekly stats).

---

If you want a different output format I can generate:
- `FRONTEND_OVERVIEW.md` in a different folder
- A compact CSV mapping file → purpose
- A full per-file dump with complete source excerpts


---

*Exported from the project workspace.*
