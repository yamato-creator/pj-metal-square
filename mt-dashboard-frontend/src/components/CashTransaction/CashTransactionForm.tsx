// src/components/CashTransaction/CashTransactionForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import ConfirmationModal from './ConfirmationModal';

interface Metal {
  name: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
}

interface SaleResult {
  subtotal: number;
  tax: number;
  total: number;
}

interface CalculateResult {
  subtotal: number;
  tax: number;
  total: number;
}

interface CashTransactionFormProps {
  metals: Metal[];
  onSale: (saleAmounts: { [key: string]: number }) => Promise<SaleResult | null>;
  onCalculate: (amounts: { [key: string]: number }) => CalculateResult;
  onSaleComplete: (result: any) => void;
}

const CashTransactionForm: React.FC<CashTransactionFormProps> = ({ metals, onSale, onCalculate, onSaleComplete }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [saleAmounts, setSaleAmounts] = useState<{ [key: string]: number }>(() => {
    return metals.reduce((acc, metal) => ({
      ...acc,
      [metal.name]: 0
    }), {});
  });
  // 入力中の値を一時的に保持するための状態
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
    if (amount === 0 && metals.every(m => m.amount === 0)) return '';
    return Math.floor(amount);
  };

  const handleAmountChange = (metalName: string, value: string) => {
    // 入力値をそのまま保存（バリデーションなし）
    setInputValues(prev => ({
      ...prev,
      [metalName]: value
    }));
    
    if (value === '') {
      setSaleAmounts(prev => ({
        ...prev,
        [metalName]: 0
      }));
      return;
    }

    const numAmount = Number(value);
    
    if (numAmount < 0 || isNaN(numAmount)) {
      return;
    }
    
    // 整数値のみ許可（小数点以下は切り捨て）
    const intAmount = Math.floor(numAmount);
    
    // 保有量を超える場合はリアルタイムで制限
    const metal = metals.find(m => m.name === metalName);
    if (metal && intAmount > metal.amount) {
      setInputValues(prev => ({ ...prev, [metalName]: String(metal.amount) }));
      setSaleAmounts(prev => ({
        ...prev,
        [metalName]: metal.amount
      }));
      return;
    }
    
    setSaleAmounts(prev => ({
      ...prev,
      [metalName]: intAmount
    }));
  };

  // 入力フォーカスが外れた時の処理
  const handleBlur = (metalName: string) => {
    const value = inputValues[metalName];
    
    // 空の入力は0として処理
    if (value === '' || value === '0') {
      setInputValues(prev => ({ ...prev, [metalName]: '0' }));
      setSaleAmounts(prev => ({ ...prev, [metalName]: 0 }));
      return;
    }
    
    // 数値に変換
    let numAmount = Number(value);
    
    // 不正な値は0にリセット
    if (isNaN(numAmount) || numAmount < 0) {
      setInputValues(prev => ({ ...prev, [metalName]: '0' }));
      setSaleAmounts(prev => ({ ...prev, [metalName]: 0 }));
      return;
    }
    
    // 整数値に変換
    numAmount = Math.floor(numAmount);
    
    // 保有量の確認
    const metal = metals.find(m => m.name === metalName);
    if (metal && numAmount > metal.amount) {
      numAmount = metal.amount;
      alert(`${metal.name} ${metal.nameJp}の売却量は保有量(${metal.amount}g)を超えることはできません。`);
    }
    
    setInputValues(prev => ({ ...prev, [metalName]: String(numAmount) }));
    setSaleAmounts(prev => ({
      ...prev,
      [metalName]: numAmount
    }));
  };

  const calculateTotal = () => {
    // 計算前に保有量を超える値を調整
    let needsAdjustment = false;
    const adjustedAmounts = { ...saleAmounts };
    
    metals.forEach(metal => {
      const amount = saleAmounts[metal.name] || 0;
      if (amount > metal.amount) {
        adjustedAmounts[metal.name] = metal.amount;
        setInputValues(prev => ({ 
          ...prev, 
          [metal.name]: String(metal.amount) 
        }));
        needsAdjustment = true;
      }
    });
    
    if (needsAdjustment) {
      setSaleAmounts(adjustedAmounts);
      alert('売却量が保有量を超えている金属があります。最大値に調整しました。');
    }
    
    const total = Math.floor(metals.reduce((sum, metal) => {
      return sum + (adjustedAmounts[metal.name] || 0) * metal.unitPrice;
    }, 0));
    setTotalAmount(total);
    onCalculate(adjustedAmounts);
  };

  const handleProceed = () => {
    // 保有量を超える値を調整
    let needsAdjustment = false;
    const adjustedAmounts = { ...saleAmounts };
    
    metals.forEach(metal => {
      const amount = saleAmounts[metal.name] || 0;
      if (amount > metal.amount) {
        adjustedAmounts[metal.name] = metal.amount;
        setInputValues(prev => ({ 
          ...prev, 
          [metal.name]: String(metal.amount) 
        }));
        needsAdjustment = true;
      }
    });
    
    if (needsAdjustment) {
      setSaleAmounts(adjustedAmounts);
      alert('売却量が保有量を超えている金属があります。最大値に調整しました。');
      return;
    }
    
    const hasSaleItems = Object.values(saleAmounts).some(amount => amount > 0);
    
    if (!hasSaleItems) {
      alert('売却する金属を選択してください。');
      return;
    }

    calculateTotal();
    setIsConfirmationOpen(true);
  };

  const handleConfirm = async () => {
    // 最終確認時にも保有量チェック
    let hasInvalidAmount = false;
    
    for (const metal of metals) {
      if (saleAmounts[metal.name] > metal.amount) {
        hasInvalidAmount = true;
        break;
      }
    }
    
    if (hasInvalidAmount) {
      alert('売却量が保有量を超えています。売却量を調整してください。');
      setIsConfirmationOpen(false);
      return;
    }
    
    setIsProcessing(true);
    const result = await onSale(saleAmounts);
    setIsConfirmationOpen(false);
    
    if (result) {
      // 成功した場合は完了画面へ遷移
      fetch(`${process.env.REACT_APP_API_URL}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': (() => {
            // localStorage から認証情報を取得
            const auth = localStorage.getItem('auth');
            return auth ? JSON.parse(auth).user.api_key : '';
          })()
        },
        body: JSON.stringify({
          user_id: (() => {
            // localStorage から認証情報を取得
            const auth = localStorage.getItem('auth');
            return auth ? JSON.parse(auth).user.user_id : '';
          })(),
          metals: metals
            .filter(metal => saleAmounts[metal.name] > 0)
            .map(metal => ({
              metal_type: (() => {
                switch (metal.name) {
                  case 'Au': return '金';
                  case 'Pt': return 'プラチナ';
                  case 'Pd': return 'パラジウム';
                  case 'Ag': return '銀';
                  default: return '';
                }
              })(),
              amount: saleAmounts[metal.name],
              unit_price: metal.unitPrice,
            }))
        })
      }).then(response => response.json())
      .then(data => {
        // 売却完了後の処理（資産情報の更新など）
        onSaleComplete(data);
        
        // 完了画面へ遷移
        navigate('/completion', { 
          state: { 
            totalAmount: result.total,
            message: '売却が正常に処理されました。',
          } 
        });
      })
      .catch(error => {
        console.error('売却処理エラー:', error);
        alert('売却処理に失敗しました。');
      })
      .finally(() => {
        setIsProcessing(false);
      });
    } else {
      alert('売却処理に失敗しました。');
      setIsProcessing(false);
    }
  };

  const saleItems = metals
    .filter(metal => saleAmounts[metal.name] > 0)
    .map(metal => ({
      metalName: metal.name,
      nameJp: metal.nameJp,
      amount: saleAmounts[metal.name] || 0,
      unitPrice: metal.unitPrice,
      total: Math.floor((saleAmounts[metal.name] || 0) * metal.unitPrice)
    }));

  return (
    <div className="responsive-container">
      <h1 className="responsive-heading mb-4">現金決済</h1>
      <div className="responsive-card bg-white">
        <h2 className="responsive-subheading mb-4">資産状況と売却数量入力</h2>
        <p className="responsive-text text-gray-600 mb-2">※ 保有量を超える売却はできません</p>
        <div className="responsive-table">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left responsive-text">金属名</th>
                <th className="text-right responsive-text">保有量 (g)</th>
                <th className="text-right responsive-text">単価 (円/g)</th>
                <th className="text-right responsive-text">評価額 (円)</th>
                <th className="text-right responsive-text">売却量 (g)</th>
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
                      max={metal.amount}
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
            <span className="font-bold">売却合計金額: </span>
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              売却手続きへ
            </button>
          </div>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirm}
        saleItems={saleItems}
        totalAmount={totalAmount}
        isDeposit={false}
      />

      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <CircularProgress />
        </div>
      )}
    </div>
  );
};

export default CashTransactionForm;