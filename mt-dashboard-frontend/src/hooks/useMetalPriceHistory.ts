import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// 金属価格履歴のインターフェース
interface PriceHistory {
  date: string;
  'au_retail_price': string;
  'pt_retail_price': string;
  'pd_retail_price': string;
  'ag_retail_price': string;
}

// ストレージキー
const STORAGE_KEY = 'metal_price_history';
// キャッシュの有効期限（30分 = 1800000ミリ秒）
const CACHE_EXPIRY = 30 * 60 * 1000;

export const useMetalPriceHistory = () => {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // キャッシュからデータを取得する関数
  const getFromCache = useCallback(() => {
    try {
      const cachedData = localStorage.getItem(STORAGE_KEY);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        // キャッシュが有効期限内かチェック
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error('キャッシュからの読み込みエラー:', error);
      return null;
    }
  }, []);

  // キャッシュにデータを保存する関数
  const saveToCache = useCallback((data: PriceHistory[]) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.error('キャッシュへの保存エラー:', error);
    }
  }, []);

  // データを取得する関数
  const fetchData = useCallback(async (forceRefresh = false) => {
    // 初期化時にキャッシュをチェック
    const cachedData = getFromCache();
    if (!forceRefresh && cachedData) {
      setData(cachedData);
      return; // キャッシュがある場合はAPIリクエストをスキップ
    }

    try {
      setLoading(true);
      setError(null);

      // APIからデータを取得
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/metal-prices/history`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`データの取得に失敗しました。(ステータス: ${response.status})`);
      }

      const result = await response.json();
      
      if (result.status === 'success' && Array.isArray(result.data)) {
        // データをステートとキャッシュに保存
        setData(result.data);
        saveToCache(result.data);
      } else {
        throw new Error('不正なデータ形式です。');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'データの取得中にエラーが発生しました。';
      setError(errorMessage);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, getFromCache, saveToCache]);

  // コンポーネントマウント時とリロード時の処理
  useEffect(() => {
    // ページがリロードされたかどうかを確認
    const isPageReload = window.performance && 
      window.performance.getEntriesByType && 
      window.performance.getEntriesByType('navigation').length > 0 && 
      (window.performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type === 'reload';
    
    // キャッシュからデータを取得
    const cachedData = getFromCache();
    
    // キャッシュがあり、リロードでない場合はキャッシュを使用
    if (cachedData && !isPageReload) {
      setData(cachedData);
      return;
    }
    
    // リロード時またはキャッシュがない場合
    if (isPageReload) {
      // リロード時は静かにバックグラウンドでデータを更新
      (async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/metal-prices/history`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            console.error(`データの更新に失敗しました。(ステータス: ${response.status})`);
            return;
          }
          
          const result = await response.json();
          
          if (result.status === 'success' && Array.isArray(result.data)) {
            // キャッシュを更新
            saveToCache(result.data);
            
            // キャッシュから最新データを取得して表示
            const updatedCache = getFromCache();
            if (updatedCache) {
              setData(updatedCache);
            }
          }
        } catch (err) {
          console.error('バックグラウンド更新エラー:', err);
        }
      })();
      
      // リロード時でもキャッシュがあれば一旦それを表示（UX向上）
      if (cachedData) {
        setData(cachedData);
        return;
      }
    }
    
    // キャッシュがない場合は通常のフェッチ処理
    fetchData(false);
  }, [fetchData, getFromCache, saveToCache, getAuthHeaders]);

  return { 
    data, 
    loading, 
    error, 
    refetch: () => fetchData(true) // 強制的に再取得する関数
  };
}; 