import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useAuthCheck = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 認証状態をチェックする関数
    const checkAuth = () => {
      if (!isAuthenticated) {
        // ログインページとレジスターページにいない場合のみリダイレクト
        if (location.pathname !== '/login' && location.pathname !== '/register' && location.pathname !== '/') {
          navigate('/login');
        }
      }
      // 初回読み込み完了
      setLoading(false);
    };

    // 初回チェック
    checkAuth();

    // 5秒ごとに認証状態をチェック
    const interval = setInterval(checkAuth, 5000);

    // クリーンアップ
    return () => clearInterval(interval);
  }, [isAuthenticated, navigate, location.pathname]);
  
  return { isAuthenticated, loading, user };
}; 