// src/components/CashTransaction/TransactionHistory.tsx
import React, { useState } from 'react';
import TransactionPDFGenerator from './TransactionPDFGenerator.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { CircularProgress } from '@mui/material';

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

interface Props {
  transactions: Transaction[];
  onTransactionUpdated?: () => void; // 取引更新時に親コンポーネントに通知するための関数
  onAssetUpdated?: (updatedAssets: any) => void; // 資産更新時に親コンポーネントに通知するための関数
}

const TransactionHistory: React.FC<Props> = ({ transactions, onTransactionUpdated, onAssetUpdated }) => {
  const { getAuthHeaders, user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState<boolean>(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string>('');
  const [resultMessage, setResultMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // キャンセルボタンの表示制御設定（将来的に有効化する可能性があるため設定として分離）
  const ENABLE_CANCEL_BUTTON = false;

  // 48時間以内かどうかを判定する関数
  const isWithin48Hours = (dateString: string): boolean => {
    const transactionDate = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60);
    return diffInHours <= 48;
  };

  // 取引日が今日かどうかを判定する関数（24時を過ぎたらPDF表示可能）
  const isTransactionToday = (dateString: string): boolean => {
    const transactionDate = new Date(dateString);
    const today = new Date();
    
    // 取引日と今日の日付部分のみを比較（時間は無視）
    const transactionDateOnly = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return transactionDateOnly.getTime() === todayDateOnly.getTime();
  };

  // 取引キャンセル確認ダイアログを表示
  const showCancelConfirmation = (transactionId: string) => {
    setCurrentTransactionId(transactionId);
    setShowConfirmDialog(true);
  };

  // 取引キャンセル処理
  const handleCancelTransaction = async () => {
    try {
      setIsLoading(true);
      setShowConfirmDialog(false);
      
      // 取引IDの検証
      if (!currentTransactionId) {
        throw new Error('取引IDが設定されていません');
      }
      
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/cancel/${currentTransactionId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        // 取引IDをリクエストボディにも含める（サーバー側の実装によっては必要）
        body: JSON.stringify({
          transaction_id: currentTransactionId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '取引のキャンセルに失敗しました');
      }
      
      const responseData = await response.json();
      
      // 成功メッセージを表示
      setResultMessage({
        type: 'success',
        text: '取引をキャンセルしました。売却した金属が返却されました。'
      });
      
      // 更新された資産情報を親コンポーネントに通知
      if (responseData.status === 'success' && responseData.updated_assets && onAssetUpdated) {
        onAssetUpdated(responseData.updated_assets);
      }
      
      // 取引履歴を再読み込み
      if (onTransactionUpdated) {
        onTransactionUpdated();
      }
    } catch (error) {
      console.error('取引キャンセルエラー:', error);
      setResultMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '取引のキャンセルに失敗しました'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 結果メッセージを閉じる
  const closeResultMessage = () => {
    setResultMessage(null);
  };

  return (
    <div className="responsive-container p-4 relative">
      {/* ローディングオーバーレイ */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      )}

      {/* 確認ダイアログ */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">取引キャンセルの確認</h3>
            <p className="mb-6">この取引をキャンセルしますか？キャンセルした場合、売却した金属が返却されます。</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowConfirmDialog(false)} 
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                閉じる
              </button>
              <button 
                onClick={handleCancelTransaction} 
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                キャンセルする
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 結果メッセージ */}
      {resultMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className={`text-lg font-bold mb-4 ${resultMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {resultMessage.type === 'success' ? '完了' : 'エラー'}
            </h3>
            <p className="mb-6">{resultMessage.text}</p>
            <div className="flex justify-end">
              <button 
                onClick={closeResultMessage} 
                className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="responsive-heading mb-4">取引履歴</h1>
      <div className="space-y-4">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="responsive-card bg-white p-4 rounded shadow">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div>{transaction.date}</div>
                <div>{transaction.company}</div>
                {/* 取引種別を表示 */}
                {transaction.transaction_type && (
                  <div className={`font-bold ${
                    transaction.transaction_type === '売却' ? 'text-red-600' : 
                    transaction.transaction_type === '預入' ? 'text-blue-600' : 
                    'text-green-600'
                  }`}>
                    {transaction.transaction_type}
                  </div>
                )}
                {/* キャンセル済みの場合に表示 */}
                {transaction.status === "取消" && (
                  <div className="text-red-600 font-bold">キャンセル済み</div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* 預入や現物返却の場合は合計金額を表示しない */}
                {transaction.transaction_type !== '預入' && transaction.transaction_type !== '現物返却' && (
                  <span className="font-bold">
                    合計: {transaction.total.toLocaleString()}円
                  </span>
                )}
                {/* PDF出力ボタン: 預入とキャンセル済み以外、かつ取引日の24時を過ぎた場合に表示 */}
                {transaction.transaction_type !== '預入' && transaction.status !== "取消" && !isTransactionToday(transaction.date) && (
                  <TransactionPDFGenerator
                    transaction={transaction}
                    className="bg-red-600 text-white px-3 py-1 text-sm rounded hover:bg-red-700"
                    userId={user?.user_id}
                    userName={user?.user_name}
                  />
                )}
                {/* 当日24時まで且つステータスが「取消」でない場合、且つ預入でない場合のみキャンセルボタンを表示 */}
                {/* キャンセルボタン表示条件: ENABLE_CANCEL_BUTTON && isTransactionToday(transaction.date) && transaction.status !== "取消" && transaction.transaction_type !== '預入' */}
                {ENABLE_CANCEL_BUTTON && isTransactionToday(transaction.date) && transaction.status !== "取消" && transaction.transaction_type !== '預入' && (
                  <button 
                    onClick={() => showCancelConfirmation(transaction.id)}
                    className="bg-gray-600 text-white px-3 py-1 text-sm rounded hover:bg-gray-700"
                    disabled={isLoading}
                  >
                    注文キャンセル
                  </button>
                )}
              </div>
            </div>
            
            <div className="mt-4">
              {/* 取引種別が預入の場合とそれ以外で表示を分ける */}
              {transaction.transaction_type === '預入' ? (
                <div>
                  <table className="w-full max-w-lg mx-auto">
                    <thead>
                      <tr>
                        <th className="text-left w-2/3">金属名</th>
                        <th className="text-right w-1/3">預入量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaction.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2">{item.metalName} {item.nameJp}</td>
                          <td className="text-right py-2">{item.amount.toFixed(2)}g</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : transaction.transaction_type === '現物返却' ? (
                <div>
                  <table className="w-full max-w-lg mx-auto">
                    <thead>
                      <tr>
                        <th className="text-left w-2/3">金属名</th>
                        <th className="text-right w-1/3">返却量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaction.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2">{item.metalName} {item.nameJp}</td>
                          <td className="text-right py-2">{item.amount.toFixed(2)}g</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <div className="mb-2 text-left max-w-2xl">
                    <div>小計 {transaction.subtotal.toLocaleString()}円</div>
                    <div>適用税率 10% 消費税 {Math.floor(transaction.tax).toLocaleString()}円</div>
                  </div>
                  
                  <table className="w-full max-w-2xl mx-auto">
                    <thead>
                      <tr>
                        <th className="text-left">金属名</th>
                        <th className="text-right">売却量</th>
                        <th className="text-right">買取価格</th>
                        <th className="text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transaction.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2">{item.metalName} {item.nameJp}</td>
                          <td className="text-right py-2">{item.amount.toFixed(2)}g</td>
                          <td className="text-right py-2">{Math.floor(item.unitPrice).toLocaleString()}円/g</td>
                          <td className="text-right py-2">{Math.floor(item.total).toLocaleString()}円</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionHistory;