import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * 認証チェック用フック。
 * - 未認証時にログインページへリダイレクト
 * - React Context の認証状態が変化したら即座に判定（5秒 polling は廃止）
 */
const PUBLIC_PATHS = ['/login', '/register', '/'];

export const useAuthCheck = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated && !PUBLIC_PATHS.includes(location.pathname)) {
      navigate('/login');
    }
    setLoading(false);
  }, [isAuthenticated, navigate, location.pathname]);

  return { isAuthenticated, loading, user };
};
