import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { User } from '../types';
import { isAuthenticated, getCurrentUser, logout as apiLogout } from '../services/api';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const HEARTBEAT_FAILURE_BACKOFF_MS = 30 * 1000;
const MAX_HEARTBEAT_FAILURES_BEFORE_BACKOFF = 3;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatInFlightRef = useRef(false);
  const heartbeatFailuresRef = useRef(0);
  const heartbeatPausedUntilRef = useRef(0);
  const userRef = useRef<User | null>(null);

  userRef.current = user;

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearInactivityTimer();
    stopHeartbeat();
    apiLogout();
    userRef.current = null;
    setUser(null);
  }, [clearInactivityTimer, stopHeartbeat]);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimer();
  }, [clearInactivityTimer]);

  const sendHeartbeat = useCallback(async () => {
    if (!userRef.current || !isAuthenticated()) {
      return;
    }

    if (Date.now() < heartbeatPausedUntilRef.current || heartbeatInFlightRef.current) {
      return;
    }

    heartbeatInFlightRef.current = true;

    try {
      await api.updatePresence();
      heartbeatFailuresRef.current = 0;
      heartbeatPausedUntilRef.current = 0;
    } catch (error) {
      heartbeatFailuresRef.current += 1;

      if (heartbeatFailuresRef.current >= MAX_HEARTBEAT_FAILURES_BEFORE_BACKOFF) {
        heartbeatPausedUntilRef.current = Date.now() + HEARTBEAT_FAILURE_BACKOFF_MS;
        console.warn('Heartbeat temporarily paused after repeated failures:', error);
      } else {
        console.error('Heartbeat failed:', error);
      }
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  }, [sendHeartbeat]);

  useEffect(() => {
    if (isAuthenticated()) {
      const savedUser = getCurrentUser();
      if (savedUser) {
        userRef.current = savedUser;
        setUser(savedUser);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      resetInactivityTimer();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearInactivityTimer();
      stopHeartbeat();
    };
  }, [clearInactivityTimer, resetInactivityTimer, stopHeartbeat]);

  useEffect(() => {
    if (user) {
      resetInactivityTimer();
      startHeartbeat();
    } else {
      clearInactivityTimer();
      stopHeartbeat();
    }
  }, [clearInactivityTimer, resetInactivityTimer, startHeartbeat, stopHeartbeat, user]);

  const login = useCallback((userData: User, token: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    userRef.current = userData;
    setUser(userData);
    startHeartbeat();
  }, [startHeartbeat]);

  const value: AuthContextType = useMemo(() => ({
      user,
      isAuthenticated: !!user,
      login,
      logout,
      loading,
    }),
    [loading, login, logout, user]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
