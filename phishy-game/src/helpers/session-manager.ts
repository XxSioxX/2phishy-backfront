// src/helpers/session-manager.ts
export interface UserSession {
  userid: string;
  username: string;
  email: string;
  token: string;
  tokenType: string;
}

const SESSION_KEY = 'phishy-session';

export class SessionManager {
  private static instance: SessionManager;
  private userSession: UserSession | null = null;

  private constructor() {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) this.userSession = JSON.parse(saved);
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async login(username: string, password: string): Promise<UserSession> {
    const response = await fetch('http://localhost:8000/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) throw new Error('Login failed');

    const data = await response.json();

    const session: UserSession = {
      userid: data.user.userid,
      username: data.user.username,
      email: data.user.email,
      token: data.access_token,
      tokenType: data.token_type,
    };

    this.userSession = session;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  getSession(): UserSession | null {
    if (!this.userSession) {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) this.userSession = JSON.parse(saved);
    }
    return this.userSession;
  }

  getUserId(): string | null {
    return this.userSession?.userid || null;
  }

  getToken(): string | null {
    return this.userSession?.token || null;
  }

  logout(): void {
    this.userSession = null;
    localStorage.removeItem(SESSION_KEY);
  }

  async authorizedFetch(url: string, options: RequestInit = {}) {
    const token = this.getToken();
    if (!token) throw new Error('No active session');

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, { ...options, headers });
    return response;
  }
}
