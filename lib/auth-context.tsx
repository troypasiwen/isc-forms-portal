'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface UserData {
  id: string;
  email: string;
  fullName: string;
  position: string;
  department: string;
  role: 'Employee' | 'Admin';
  isApprover: boolean;
  profilePicture?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        // Fetch user data from Firestore
        try {
          const userDocRef = doc(db, 'users', authUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          if (userDocSnap.exists()) {
            setUserData({
              id: authUser.uid,
              ...userDocSnap.data(),
            } as UserData);
          } else {
            // If user document doesn't exist in Firestore, create default data
            // Check if email is admin email to assign appropriate role
            const isAdmin = authUser.email === 'adminhr@interworld.com';
            
            const defaultUserData: UserData = {
              id: authUser.uid,
              email: authUser.email || '',
              fullName: authUser.email?.split('@')[0] || 'User',
              position: isAdmin ? 'HR Administrator' : 'Employee',
              department: isAdmin ? 'Human Resources' : 'General',
              role: isAdmin ? 'Admin' : 'Employee',
              isApprover: isAdmin,
            };
            
            setUserData(defaultUserData);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          
          // Fallback: determine role based on email
          const isAdmin = authUser.email === 'adminhr@interworld.com';
          
          setUserData({
            id: authUser.uid,
            email: authUser.email || '',
            fullName: authUser.email?.split('@')[0] || 'User',
            position: isAdmin ? 'HR Administrator' : 'Employee',
            department: isAdmin ? 'Human Resources' : 'General',
            role: isAdmin ? 'Admin' : 'Employee',
            isApprover: isAdmin,
          });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setUserData(null);
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}