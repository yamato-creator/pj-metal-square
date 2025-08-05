import React, { createContext, useContext, useState, useEffect } from 'react';
import { clearAllStorage } from '../utils/storageUtils';

interface AuthState {
  isAuthenticated: boolean;
  user: any;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  updateEmail: (newEmail: string) => Promise<boolean>;
  getAuthHeaders: () => { [key: string]: string };
  logout: () => void;
}

const safeLocalStorage = {
  set: (key: string, value: any) => {
    try {
      const stringValue = JSON.stringify(value);
      
      localStorage.setItem(key, stringValue);
      
      const savedValue = localStorage.getItem(key);
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: key,
        newValue: stringValue,
        oldValue: null,
        storageArea: localStorage
      }));
      
      return true;
    } catch (error) {
      console.error('Local Storage Set Error:', error);
      return false;
    }
  },

  get: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      
      if (value) {
        const parsed = JSON.parse(value);
        return parsed;
      }
      
      return null;
    } catch (error) {
      console.error('Local Storage Get Error:', error);
      return null;
    }
  }
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  useEffect(() => {
    const debugStorage = () => {
      const authData = localStorage.getItem('auth');
      
      if (authData) {
        try {
          JSON.parse(authData);
        } catch (e) {
          console.error('Auth Data Parse Error:', e);
        }
      }
    };

    const storageEventHandler = (event: StorageEvent) => {
      if (event.key === 'auth') {
      }
    };

    debugStorage();
    const interval = setInterval(debugStorage, 2000);
    window.addEventListener('storage', storageEventHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', storageEventHandler);
    };
  }, []);

  const [authState, setAuthState] = useState<AuthState>(() => {
    const savedAuth = safeLocalStorage.get('auth');
    
    return savedAuth || {
      isAuthenticated: false,
      user: null
    };
  });

  const login = async (userId: string, password: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        switch (response.status) {
          case 401:
            throw new Error(errorData.detail || 'ユーザーIDまたはパスワードが間違っています');
          case 403:
            throw new Error('このアカウントは退会済みです');
          default:
            throw new Error(errorData.detail || 'ログインに失敗しました');
        }
      }

      const data = await response.json();

      const newAuthState = {
        isAuthenticated: true,
        user: {
          ...data.data.user,
          api_key: data.data.user.api_key
        }
      };

      const saveSuccess = safeLocalStorage.set('auth', newAuthState);

      if (saveSuccess) {
        setAuthState(newAuthState);
      } else {
        throw new Error('認証状態の保存に失敗しました');
      }

      return true;
    } catch (error) {
      console.error('Login Error:', error);
      console.error('Stack Trace:', (error as Error).stack);
      throw error;
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('登録に失敗しました');
      }

      const data = await response.json();
      return true;
    } catch (error) {
      console.error('登録エラー:', error);
      return false;
    }
  };

  const updatePassword = async (oldPassword: string, newPassword: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: authState.user?.user_id,
          old_password: oldPassword,
          new_password: newPassword
        })
      });

      if (!response.ok) {
        throw new Error('パスワード更新に失敗しました');
      }

      const data = await response.json();
      return true;

    } catch (error) {
      console.error('パスワード更新エラー:', error);
      return false;
    }
  };

  const updateEmail = async (newEmail: string) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/change-email`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: authState.user?.user_id,
          new_email: newEmail
        })
      });

      if (!response.ok) {
        throw new Error('メールアドレス更新に失敗しました');
      }

      const data = await response.json();
      const newUserName = newEmail.split('@')[0];
      
      const newAuthState = {
        ...authState,
        user: {
          ...authState.user,
          email: newEmail,
          user_name: newUserName
        }
      };
      safeLocalStorage.set('auth', newAuthState);
      setAuthState(newAuthState);
      return true;

    } catch (error) {
      console.error('メールアドレス更新エラー:', error);
      return false;
    }
  };

  const getAuthHeaders = () => {
    const auth = safeLocalStorage.get('auth');
    return {
      'Content-Type': 'application/json',
      'X-API-Key': auth?.user?.api_key || ''
    };
  };

  const logout = () => {
    try {
      clearAllStorage().catch(error => {
        console.error('ストレージクリア中にエラーが発生しました:', error);
      });
      
      setAuthState({
        isAuthenticated: false,
        user: null
      });
    } catch (error) {
      console.error('ログアウト中にエラーが発生しました:', error);
    }
  };

  useEffect(() => {
  }, [authState]);

  return (
    <AuthContext.Provider value={{ ...authState, login, register, updatePassword, updateEmail, getAuthHeaders, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;