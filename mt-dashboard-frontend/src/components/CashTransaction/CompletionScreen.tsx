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

  // 取引タイプ判定（売却がデフォルト。旧「見積依頼」も売却完了として表示）
  const isSale = !state.transactionType || state.transactionType === '売却' || state.transactionType === '見積依頼';
  const isDeposit = state.transactionType === '預入';

  const heading = isSale ? '売却完了' : '決済完了';
  const amountLabel = isSale ? '売却金額(税抜)' : isDeposit ? '預入合計金額' : '返却合計金額';

  const handleBackToTop = () => {
    navigate('/cash-transaction');
  };

  return (
    <div className="responsive-container p-4">
      <div className="responsive-card bg-white p-6 rounded shadow">
        <h1 className="responsive-heading font-bold mb-4">{heading}</h1>
        <p className="mb-4">{state.message}</p>
        <p className="font-bold mb-6">
          {amountLabel}: {formatPrice(state.totalAmount)}円
        </p>
        <button
          onClick={handleBackToTop}
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          {isSale ? '売却画面に戻る' : '現金決済画面に戻る'}
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;