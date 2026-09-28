import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// 取引履歴のインターフェース
interface Transaction {
  id: string;
  date: string;
  company: string;
  items: {
    metalName: string;
    nameJp: string;
    amount: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status?: string;
  transaction_type?: string;
}

// ストレージキー
const STORAGE_KEY = 'transactions_history';
// キャッシュの有効期限（30分 = 1800000ミリ秒）
const CACHE_EXPIRY = 30 * 60 * 1000;

export const useTransactions = () => {
  const { getAuthHeaders } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const saveToCache = useCallback((data: Transaction[]) => {
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

  // キャッシュをクリアする関数
  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('キャッシュクリアエラー:', error);
    }
  }, []);

  // データを取得する関数
  const fetchTransactions = useCallback(async (forceRefresh = false) => {
    // 初期化時にキャッシュをチェック
    const cachedData = getFromCache();
    if (!forceRefresh && cachedData) {
      setTransactions(cachedData);
      return; // キャッシュがある場合はAPIリクエストをスキップ
    }

    try {
      setLoading(true);
      setError(null);

      // APIからデータを取得
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('取引履歴の取得に失敗しました');
      }
      
      const data = await response.json();
      
      // APIレスポンスの形式を確認し、適切に処理
      let transactionsData: Transaction[] = [];
      if (Array.isArray(data)) {
        transactionsData = data;
      } else if (data.transactions && Array.isArray(data.transactions)) {
        transactionsData = data.transactions;
      } else {
        throw new Error('取引履歴のデータ形式が不正です');
      }
      
      // データをステートとキャッシュに保存
      setTransactions(transactionsData);
      saveToCache(transactionsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '取引履歴の取得中にエラーが発生しました';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, getFromCache, saveToCache]);

  // コンポーネントマウント時とリロード時の処理
  useEffect(() => {
    // キャッシュからデータを取得
    const cachedData = getFromCache();

    // 2026/09/28 受け入れ検証で判明: 画面遷移時はキャッシュ（最大30分）を返すだけで再取得しないため、
    // シート側の売却・管理者キャンセル・中断された売却など"アプリ外の変化"が最大30分見えなかった。
    // → キャッシュがあれば即表示（UX維持）しつつ、常にバックグラウンドで最新を取り直す。
    if (cachedData) {
      // 静かにバックグラウンドでデータを更新
      (async () => {
        try {
          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions`, {
            headers: getAuthHeaders()
          });
          
          if (!response.ok) {
            console.error('取引履歴の更新に失敗しました');
            return;
          }
          
          const data = await response.json();
          
          // APIレスポンスの形式を確認し、適切に処理
          let transactionsData: Transaction[] = [];
          if (Array.isArray(data)) {
            transactionsData = data;
          } else if (data.transactions && Array.isArray(data.transactions)) {
            transactionsData = data.transactions;
          } else {
            console.error('取引履歴のデータ形式が不正です');
            return;
          }
          
          // キャッシュを更新
          saveToCache(transactionsData);
          
          // キャッシュから最新データを取得して表示
          const updatedCache = getFromCache();
          if (updatedCache) {
            setTransactions(updatedCache);
          }
        } catch (err) {
          console.error('バックグラウンド更新エラー:', err);
        }
      })();
      
      // キャッシュを一旦表示（UX向上）。上のバックグラウンド更新が完了したら最新に差し替わる
      setTransactions(cachedData);
      return;
    }

    // キャッシュがない場合は通常のフェッチ処理
    fetchTransactions(false);
  }, [fetchTransactions, getFromCache, saveToCache, getAuthHeaders]);

  return { 
    transactions, 
    loading, 
    error, 
    refetch: () => fetchTransactions(true), // 強制的に再取得する関数
    clearCache // キャッシュクリア関数を公開
  };
}; 