// src/components/CashTransaction/ConfirmationModal.tsx
import React from 'react';

interface SaleItem {
  metalName: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
  total: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  saleItems: SaleItem[];
  totalAmount: number;
  isDeposit?: boolean;
  isWithdraw?: boolean;
  hideAmount?: boolean;
}

const ConfirmationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onConfirm,
  saleItems,
  totalAmount,
  isDeposit = false,
  isWithdraw = false,
  hideAmount = false,
}) => {
  if (!isOpen) return null;
  const formatPrice = (price: number) => {
    return Math.floor(price).toLocaleString();
  };

  // 消費税込みの合計金額を計算
  const calculateTaxIncludedTotal = (amount: number) => {
    return Math.floor(amount * 1.1); // 10%消費税を追加し、小数点以下を切り捨て
  };

  const taxIncludedTotal = calculateTaxIncludedTotal(totalAmount);

  // 取引タイプに応じたテキストを取得
  const getTransactionTypeText = () => {
    if (isDeposit) return '預入';
    if (isWithdraw) return '現物返却';
    return '売却';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-bold mb-4">確認画面</h2>
        <table className="w-full mb-4 tabular-nums">
          <thead>
            <tr>
              <th className="text-left">金属名</th>
              <th className="text-right">
                {isDeposit ? '預入量' : isWithdraw ? '返却量' : '売却量'} (g)
              </th>
              {!hideAmount && (
                <>
                  <th className="text-right">買取価格 (円/g)</th>
                  <th className="text-right">金額 (円)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {saleItems.map((item) => (
              <tr key={item.metalName} className="border-t">
                <td className="py-2">{item.metalName} {item.nameJp}</td>
                <td className="text-right py-2">
                  {item.amount.toFixed(2)}
                </td>
                {!hideAmount && (
                  <>
                    <td className="text-right py-2">{Math.floor(item.unitPrice).toLocaleString()}</td>
                    <td className="text-right py-2">{formatPrice(item.total)}円</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        
        {!hideAmount && (
          <div className="text-right mb-4">
            <span className="font-bold">
              {isDeposit ? '預入合計金額: ' : isWithdraw ? '返却合計金額: ' : '売却合計金額(税込): '}
            </span>
            <span>{formatPrice(isDeposit || isWithdraw ? totalAmount : taxIncludedTotal)}円</span>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            戻る
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            {`${getTransactionTypeText()}を完了する`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
