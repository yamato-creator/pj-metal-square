import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface LocationState {
  totalAmount: number;
  message: string;
}

const DepositCompletionScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  if (!state) {
    navigate('/deposit-transaction');  // 預入画面に遷移
    return null;
  }

  const formatPrice = (price: number) => {
    return Math.floor(price).toLocaleString();
  };

  const handleBackToDeposit = () => {
    navigate('/deposit-transaction');  // 預入画面に戻る
  };

  return (
    <div className="p-4">
      <div className="bg-white p-6 rounded shadow">
        <h1 className="text-xl font-bold mb-4">預入完了</h1>
        <p className="mb-4">{state.message}</p>
        <p className="font-bold mb-6">
          預入合計金額: {formatPrice(state.totalAmount)}円
        </p>
        <button
          onClick={handleBackToDeposit}
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          預入画面に戻る
        </button>
      </div>
    </div>
  );
};

export default DepositCompletionScreen; 