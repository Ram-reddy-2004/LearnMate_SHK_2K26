import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// Fix: Remove v9 imports. Auth state and doc fetching will use v8 syntax.
import { auth } from '../services/firebaseConfig';
import { type FirebaseUser } from '../types';

interface AuthContextType {
  user: FirebaseUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true });

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fix: Use v8 namespaced method for auth state changes.
    const unsubscribeFromAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });

    return () => unsubscribeFromAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);