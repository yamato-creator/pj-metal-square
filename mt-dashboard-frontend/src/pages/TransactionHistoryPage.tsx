import React from 'react';
import TransactionHistory from '../components/CashTransaction/TransactionHistory';
import { useTransactions } from '../hooks/useTransactions';

// TransactionHistoryコンポーネントで定義されているインターフェースを再利用
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

interface Metal {
  name: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
}

const TransactionHistoryPage: React.FC = () => {
  const { transactions, loading, error, refetch } = useTransactions();

  // 資産情報を更新する関数
  const handleAssetUpdate = (updatedAssets: any) => {
    // グローバルな資産状態を更新するためのイベントを発行
    const event = new CustomEvent('assetUpdated', { detail: updatedAssets });
    window.dispatchEvent(event);
    
    // 取引履歴を再取得
    refetch();
  };

  if (loading) {
    return <div className="p-4">読み込み中...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return <TransactionHistory 
    transactions={transactions} 
    onTransactionUpdated={refetch} 
    onAssetUpdated={handleAssetUpdate}
  />;
};

export default TransactionHistoryPage;