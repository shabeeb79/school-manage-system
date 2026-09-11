import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import api from '../api/client';

export type UserRole = 'ADMIN' | 'STAFF' | 'STUDENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  studentProfile?: {
    studentId: string;
    schoolClassId?: string;
    schoolClass?: { id: string; name: string };
    parentName?: string;
    parentPhone?: string;
  } | null;
  staffProfile?: {
    employeeId: string;
    assignedClassId?: string;
    assignedClass?: { id: string; name: string };
    department?: string;
    subject?: string;
  } | null;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token'),
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      setToken(stored);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    setToken(data.accessToken);
    setUser(data.user);
    return data.user as User;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, logout, refresh }),
    [user, token, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
