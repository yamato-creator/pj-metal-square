import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const WithdrawCompletionScreen: React.FC = () => {
  const location = useLocation();
  const { message } = location.state as { message: string };

  return (
    <div className="p-4">
      <div className="bg-white p-6 rounded shadow-md max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-4">現物返却完了</h1>
        <div className="mb-6">
          <p className="text-green-600 text-lg mb-2">{message}</p>
        </div>
        <div className="flex justify-center space-x-4">
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
          >
            トップページへ
          </Link>
          <Link
            to="/transaction-history"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            決済履歴へ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WithdrawCompletionScreen; 