import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../redux/store';
import { 
  login,
  logout,
  clearError,
  UserLoginResponse 
} from '../redux/slices/AuthSlice';
import { userStorage, tokenStorage } from '../lib/storage';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserLoginResponse | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, userLogin, loading, error } = useSelector(
    (state: RootState) => state.auth
  );
  
  // Extract user from userLogin
  const user = userLogin?.user || null;
  const isLoading = loading;

  // Load user from storage on app start
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        const storedUser = await userStorage.getUser();
        const storedToken = await tokenStorage.getToken();
        
        if (storedUser && storedToken) {
          // Dispatch setCredentials action to restore auth state
          dispatch({ 
            type: 'auth/setCredentials', 
            payload: { user: storedUser, token: storedToken } 
          });
        }
      } catch (error) {
        console.error('Error loading user from storage:', error);
      }
    };

    loadUserFromStorage();
  }, [dispatch]);

  const handleLogin = async (username: string, password: string) => {
    try {
      // Dispatch login action
      const result = await dispatch(login({ username, password }));
      if (login.rejected.match(result)) {
        throw new Error(result.payload as string || 'Login failed');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    dispatch(logout());
  };

  const forgotPassword = async (email: string) => {
    // TODO: Implement forgot password functionality
    console.log('Forgot password for:', email);
  };

  const handleClearError = () => {
    dispatch(clearError());
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
    forgotPassword,
    clearError: handleClearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};