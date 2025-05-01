// src/components/CashTransaction/CompletionScreen.tsx
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LocationState {
  totalAmount: number;
  message: string;
  isTaxIncluded?: boolean; // 税込み価格かどうかのフラグ（オプション）
  transactionType?: string; // 取引タイプ（売却、預入、返却）
}

const CompletionScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  if (!state) {
    navigate('/cash-transaction');  // 現金決済画面に遷移
    return null;
  }

  const formatPrice = (price: number) => {
    return Math.floor(price).toLocaleString();
  };

  // 消費税込みの合計金額を計算
  const calculateTaxIncludedTotal = (amount: number) => {
    return Math.floor(amount * 1.1); // 10%消費税を追加し、小数点以下を切り捨て
  };

  // すでに税込みの価格が渡されている場合はそのまま使用、そうでなければ計算する
  const taxIncludedTotal = state.isTaxIncluded ? state.totalAmount : calculateTaxIncludedTotal(state.totalAmount);
  
  // 取引タイプが売却かどうかを判定（デフォルトは売却として扱う）
  const isSale = !state.transactionType || state.transactionType === '売却';
  
  // 表示する金額
  const displayAmount = isSale ? taxIncludedTotal : state.totalAmount;
  
  // 表示するラベル
  const amountLabel = isSale ? '売却合計金額(税込)' : state.transactionType === '預入' ? '預入合計金額' : '返却合計金額';

  const handleBackToTop = () => {
    navigate('/cash-transaction');  // 現金決済画面に戻る
  };

  return (
    <div className="responsive-container p-4">
      <div className="responsive-card bg-white p-6 rounded shadow">
        <h1 className="responsive-heading font-bold mb-4">決済完了</h1>
        <p className="mb-4">{state.message}</p>
        <p className="font-bold mb-6">
          {amountLabel}: {formatPrice(displayAmount)}円
        </p>
        <button
          onClick={handleBackToTop}
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          現金決済画面に戻る
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;