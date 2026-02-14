import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const AUTH_KEY = 'agent402_authenticated';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const authStatus = localStorage.getItem(AUTH_KEY);
    const sessionAuth = sessionStorage.getItem(AUTH_KEY);
    
    if (authStatus === 'true' || sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const setAuthenticated = (value: boolean) => {
  if (value) {
    localStorage.setItem(AUTH_KEY, 'true');
    sessionStorage.setItem(AUTH_KEY, 'true');
  } else {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  }
};

export const isUserAuthenticated = (): boolean => {
  const authStatus = localStorage.getItem(AUTH_KEY);
  const sessionAuth = sessionStorage.getItem(AUTH_KEY);
  return authStatus === 'true' || sessionAuth === 'true';
};

export const logout = () => {
  setAuthenticated(false);
  window.location.href = '/';
};