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

  // 取引タイプ判定（「見積依頼」がデフォルト。旧「売却」も見積依頼として扱う）
  const isQuoteRequest = !state.transactionType || state.transactionType === '見積依頼' || state.transactionType === '売却';
  const isDeposit = state.transactionType === '預入';

  const heading = isQuoteRequest ? '見積もり依頼を受け付けました' : '決済完了';
  const amountLabel = isQuoteRequest ? '見積もり依頼金額(参考・税抜)' : isDeposit ? '預入合計金額' : '返却合計金額';

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
        {isQuoteRequest && (
          <p className="text-sm text-gray-600 mb-6">
            担当者が内容を確認のうえ、改めて正式な見積もりをご連絡いたします。
          </p>
        )}
        <button
          onClick={handleBackToTop}
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          {isQuoteRequest ? '見積もり依頼画面に戻る' : '現金決済画面に戻る'}
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;