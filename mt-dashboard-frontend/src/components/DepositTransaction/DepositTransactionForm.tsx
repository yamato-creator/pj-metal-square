import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import ConfirmationModal from '../CashTransaction/ConfirmationModal';

interface Metal {
  name: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
}

interface DepositResult {
  status: string;
  updated_assets?: any[];
}

interface DepositTransactionFormProps {
  metals: Metal[];
  onDeposit: (depositAmounts: { [key: string]: number }) => Promise<DepositResult | null>;
}

const DepositTransactionForm: React.FC<DepositTransactionFormProps> = ({ metals, onDeposit }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [depositAmounts, setDepositAmounts] = useState<{ [key: string]: number }>(() => {
    return metals.reduce((acc, metal) => ({
      ...acc,
      [metal.name]: 0
    }), {});
  });
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>(() => {
    return metals.reduce((acc, metal) => ({
      ...acc,
      [metal.name]: '0'
    }), {});
  });
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const formatPrice = (price: number) => {
    if (price === 0) return '0円';
    return `${price.toFixed(1).toLocaleString()}円`;
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return '0';
    return Math.floor(amount);
  };

  const handleAmountChange = (metalName: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [metalName]: value
    }));
    
    if (value === '') {
      setDepositAmounts(prev => ({
        ...prev,
        [metalName]: 0
      }));
      return;
    }

    const numAmount = Number(value);
    
    if (numAmount < 0 || isNaN(numAmount)) {
      return;
    }
    
    const intAmount = Math.floor(numAmount);
    
    setDepositAmounts(prev => ({
      ...prev,
      [metalName]: intAmount
    }));
  };

  const handleBlur = (metalName: string) => {
    const value = inputValues[metalName];
    
    if (value === '' || value === '0') {
      setInputValues(prev => ({ ...prev, [metalName]: '0' }));
      setDepositAmounts(prev => ({ ...prev, [metalName]: 0 }));
      return;
    }
    
    let numAmount = Number(value);
    
    if (isNaN(numAmount) || numAmount < 0) {
      setInputValues(prev => ({ ...prev, [metalName]: '0' }));
      setDepositAmounts(prev => ({ ...prev, [metalName]: 0 }));
      return;
    }
    
    numAmount = Math.floor(numAmount);
    setInputValues(prev => ({ ...prev, [metalName]: String(numAmount) }));
    
    setDepositAmounts(prev => ({
      ...prev,
      [metalName]: numAmount
    }));
  };

  const calculateTotal = () => {
    const total = Math.floor(metals.reduce((sum, metal) => {
      return sum + (depositAmounts[metal.name] || 0) * metal.unitPrice;
    }, 0));
    setTotalAmount(total);
  };

  const handleProceed = () => {
    const hasDepositItems = Object.values(depositAmounts).some(amount => amount > 0);
    
    if (!hasDepositItems) {
      alert('預入する金属を選択してください。');
      return;
    }

    calculateTotal();
    setIsConfirmationOpen(true);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    const result = await onDeposit(depositAmounts);
    setIsConfirmationOpen(false);
    
    if (result && result.status === 'success') {
      navigate('/deposit-completion', { 
        state: { 
          message: '預入が正常に処理されました。',
          totalAmount: totalAmount
        } 
      });
    } else {
      alert('預入処理に失敗しました。');
    }
    setIsProcessing(false);
  };

  const depositItems = metals
    .filter(metal => depositAmounts[metal.name] > 0)
    .map(metal => ({
      metalName: metal.name,
      nameJp: metal.nameJp,
      amount: depositAmounts[metal.name] || 0,
      unitPrice: metal.unitPrice,
      total: Math.floor((depositAmounts[metal.name] || 0) * metal.unitPrice)
    }));

  return (
    <div className="responsive-container">
      <h1 className="responsive-heading mb-4">預入</h1>
      <div className="responsive-card bg-white">
        <h2 className="responsive-subheading mb-4">資産状況と預入数量入力</h2>
        <div className="responsive-table">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left responsive-text">金属名</th>
                <th className="text-right responsive-text">保有量 (g)</th>
                <th className="text-right responsive-text">単価 (円/g)</th>
                <th className="text-right responsive-text">評価額 (円)</th>
                <th className="text-right responsive-text">預入量 (g)</th>
              </tr>
            </thead>
            <tbody>
              {metals.map((metal) => (
                <tr key={metal.name} className="border-t">
                  <td className="py-2 responsive-text">{metal.name} {metal.nameJp}</td>
                  <td className="text-right py-2 responsive-text">{formatAmount(metal.amount)}</td>
                  <td className="text-right py-2 responsive-text">
                    {metal.unitPrice === 0 ? '' : `${metal.unitPrice.toFixed(1).toLocaleString()}`}
                  </td>
                  <td className="text-right py-2 responsive-text">
                    {formatPrice(metal.amount * metal.unitPrice)}
                  </td>
                  <td className="text-right py-2">
                    <input
                      type="number"
                      min="0"
                      className="w-20 text-right border rounded p-1 responsive-text"
                      value={inputValues[metal.name]}
                      onChange={(e) => handleAmountChange(metal.name, e.target.value)}
                      onBlur={() => handleBlur(metal.name)}
                      onClick={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === '-') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4">
          <div className="text-right responsive-text mb-2 sm:mb-0">
            <span className="font-bold">預入合計金額: </span>
            <span>{totalAmount === 0 ? '0' : totalAmount.toLocaleString()}円</span>
          </div>
          <div className="space-x-2">
            <button
              onClick={calculateTotal}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              計算
            </button>
            <button
              onClick={handleProceed}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              預入手続きへ
            </button>
          </div>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirm}
        saleItems={depositItems}
        totalAmount={totalAmount}
        isDeposit={true}
      />

      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      )}
    </div>
  );
};

export default DepositTransactionForm; 