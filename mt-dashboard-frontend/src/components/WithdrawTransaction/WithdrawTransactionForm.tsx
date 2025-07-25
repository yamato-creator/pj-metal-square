import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import ConfirmationModal from '../CashTransaction/ConfirmationModal';
import { isTransactionButtonVisible } from '../../utils/timeRestriction';

interface Metal {
  name: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
}

interface WithdrawResult {
  status: string;
  updated_assets?: any[];
}

interface WithdrawTransactionFormProps {
  metals: Metal[];
  onWithdraw: (withdrawAmounts: { [key: string]: number }) => Promise<WithdrawResult | null>;
}

type WithdrawMode = 'specific' | 'full';

const WithdrawTransactionForm: React.FC<WithdrawTransactionFormProps> = ({ metals, onWithdraw }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [withdrawMode, setWithdrawMode] = useState<WithdrawMode>('specific');
  const [withdrawAmounts, setWithdrawAmounts] = useState<{ [key: string]: number }>(() => {
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
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTransactionButton, setShowTransactionButton] = useState(false);

  // 時間制限チェックを定期的に実行
  useEffect(() => {
    const checkButtonVisibility = () => {
      const isVisible = isTransactionButtonVisible();
      setShowTransactionButton(isVisible);
    };

    checkButtonVisibility(); // 初回チェック
    const interval = setInterval(checkButtonVisibility, 60000); // 1分ごとにチェック

    return () => clearInterval(interval);
  }, []);

  // 金のみをフィルタリングし、保有量が0より大きい金属のみを表示
  const filteredMetals = metals.filter(m => m.name === 'Au' && m.amount > 0);

  const formatAmount = (amount: number) => {
    if (amount === 0 && metals.every(m => m.amount === 0)) return '';
    return amount.toFixed(2);
  };

  // 入力値の変更を処理する関数
  const handleAmountChange = (metalName: string, value: string) => {
    // 小数点を含む場合は整数部分のみ使用
    const intValue = value.includes('.') ? value.split('.')[0] : value;
    
    // 入力値をそのまま保存（バリデーションなし）
    setInputValues(prev => ({
      ...prev,
      [metalName]: intValue
    }));
    
    // 空の入力は0として処理
    if (intValue === '') {
      setWithdrawAmounts(prev => ({
        ...prev,
        [metalName]: 0
      }));
      return;
    }

    // 数値変換
    const numAmount = Number(intValue);
    
    // 不正な値の検出（負数やNaN）
    if (numAmount < 0 || isNaN(numAmount)) {
      return;
    }
    
    // 保有量の確認
    const metal = filteredMetals.find(m => m.name === metalName);
    if (metal) {
      let validAmount = numAmount;
      
      // 50の倍数に調整
      if (validAmount % 50 !== 0) {
        validAmount = Math.floor(validAmount / 50) * 50;
      }
      
      // 保有量を超える場合は保有量以下の最大の50の倍数に設定
      if (validAmount > metal.amount) {
        validAmount = Math.floor(metal.amount / 50) * 50;
        setInputValues(prev => ({
          ...prev,
          [metalName]: validAmount.toString()
        }));
      }
      
      // 有効な入力として設定
      setWithdrawAmounts(prev => ({
        ...prev,
        [metalName]: validAmount
      }));
    }
  };

  // 入力フォーカスが外れた時の処理
  const handleBlur = (metalName: string) => {
    const value = inputValues[metalName];
    
    // 空の入力は0として処理
    if (value === '' || value === '0') {
      setInputValues(prev => ({ ...prev, [metalName]: '0' }));
      setWithdrawAmounts(prev => ({ ...prev, [metalName]: 0 }));
      return;
    }
    
    // 数値に変換
    let numAmount = Number(value);
    
    // 不正な値は0にリセット
    if (isNaN(numAmount) || numAmount < 0) {
      setInputValues(prev => ({ ...prev, [metalName]: '0' }));
      setWithdrawAmounts(prev => ({ ...prev, [metalName]: 0 }));
      return;
    }
    
    // 保有量の確認
    const metal = filteredMetals.find(m => m.name === metalName);
    if (metal) {
      // 50g単位に調整
      if (numAmount % 50 !== 0) {
        numAmount = Math.floor(numAmount / 50) * 50;
      }
      
      // 保有量を超える場合は保有量以下の最大の50の倍数に設定
      if (numAmount > metal.amount) {
        numAmount = Math.floor(metal.amount / 50) * 50;
      }
      
      setInputValues(prev => ({ ...prev, [metalName]: numAmount.toString() }));
      setWithdrawAmounts(prev => ({
        ...prev,
        [metalName]: numAmount
      }));
    }
  };

  // 全量返却モードでの金額設定
  const handleFullAmountSelection = (metalName: string, selected: boolean) => {
    const metal = metals.find(m => m.name === metalName);
    if (!metal) return;

    if (selected) {
      // 全量返却チェック時に保有量を設定（小数点第2位までの精度を保持）
      const amountValue = parseFloat(metal.amount.toFixed(2));
      setWithdrawAmounts(prev => ({
        ...prev,
        [metalName]: amountValue
      }));
      setInputValues(prev => ({
        ...prev,
        [metalName]: amountValue.toFixed(2)
      }));
    } else {
      // チェック解除時に0に設定
      setWithdrawAmounts(prev => ({
        ...prev,
        [metalName]: 0
      }));
      setInputValues(prev => ({
        ...prev,
        [metalName]: '0.00'
      }));
    }
  };

  // 返却モードの切り替え
  const handleModeChange = (mode: WithdrawMode) => {
    setWithdrawMode(mode);
    
    if (mode === 'full') {
      // 全量返却モードに切り替えた場合、すべてを0にリセット
      setWithdrawAmounts(prev => {
        const resetAmounts = { ...prev };
        Object.keys(resetAmounts).forEach(key => {
          resetAmounts[key] = 0;
        });
        return resetAmounts;
      });
      setInputValues(prev => {
        const resetValues = { ...prev };
        Object.keys(resetValues).forEach(key => {
          resetValues[key] = '0.00';
        });
        return resetValues;
      });
    }
  };

  const handleProceed = () => {
    // 現在の入力値をすべて50g単位にバリデーション
    if (withdrawMode === 'specific') {
      let isValid = true;
      const validatedAmounts = { ...withdrawAmounts };
      
      Object.entries(withdrawAmounts).forEach(([key, amount]) => {
        if (amount !== 0 && amount % 50 !== 0) {
          isValid = false;
          validatedAmounts[key] = Math.floor(amount / 50) * 50;
        }
      });
      
      if (!isValid) {
        setWithdrawAmounts(validatedAmounts);
        alert('返却量は50g単位で指定してください。入力値を調整しました。');
        return;
      }
    }

    const hasWithdrawItems = Object.values(withdrawAmounts).some(amount => amount > 0);
    
    if (!hasWithdrawItems) {
      alert('返却する金属を選択してください。');
      return;
    }

    setIsConfirmationOpen(true);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    const result = await onWithdraw(withdrawAmounts);
    setIsConfirmationOpen(false);
    
    if (result && result.status === 'success') {
      navigate('/withdraw-completion', { 
        state: { 
          message: '返却手続きが完了しました。',
        } 
      });
    } else {
      alert('返却処理に失敗しました。');
    }
    setIsProcessing(false);
  };

  const withdrawItems = filteredMetals
    .filter(metal => withdrawAmounts[metal.name] > 0)
    .map(metal => ({
      metalName: metal.name,
      nameJp: metal.nameJp,
      amount: withdrawAmounts[metal.name] || 0,
      unitPrice: 0,  // 返却では単価は使わない
      total: 0       // 返却では合計額は使わない
    }));

  useEffect(() => {
    // 金属データが空の場合はローディングを表示
    setIsLoading(metals.length === 0);
  }, [metals]);

  if (isLoading) {
    return (
      <div className="responsive-container">
        <h1 className="responsive-heading mb-4">現物返却</h1>
        <div className="responsive-card bg-white flex justify-center items-center" style={{ minHeight: "200px" }}>
          <div className="flex justify-center items-center h-64">
            <CircularProgress style={{ color: '#10b981' }} />
          </div>
        </div>
      </div>
    );
  }

  if (filteredMetals.length === 0) {
    return (
      <div className="responsive-container">
        <h1 className="responsive-heading mb-4">現物返却</h1>
        <div className="responsive-card bg-white">
          <p className="text-center responsive-text py-8">返却可能な資産がありません。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-container">
      <h1 className="responsive-heading mb-4">現物返却</h1>
      <div className="responsive-card bg-white">
        <h2 className="responsive-subheading mb-4">返却数量入力</h2>
        
        <div className="mb-4">
          <p className="responsive-text text-gray-600 mb-2">※ 金のみ返却可能です</p>
          <p className="responsive-text text-gray-600 mb-2">※ 指定返却は50g単位になります（入力完了時に自動調整されます）</p>
          <label className="responsive-text">返却方式：</label>
          <div className="mt-2 space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-5 w-5 text-emerald-600"
                name="withdrawMode"
                value="specific"
                checked={withdrawMode === 'specific'}
                onChange={() => handleModeChange('specific')}
              />
              <span className="ml-2 responsive-text">指定返却（50g単位）</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                className="form-radio h-5 w-5 text-emerald-600"
                name="withdrawMode"
                value="full"
                checked={withdrawMode === 'full'}
                onChange={() => handleModeChange('full')}
              />
              <span className="ml-2 responsive-text">全量返却</span>
            </label>
          </div>
        </div>
        
        <div className="responsive-table">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left responsive-text">金属名</th>
                <th className="text-right responsive-text">保有量 (g)</th>
                {withdrawMode === 'full' ? (
                  <th className="text-center responsive-text">全量返却</th>
                ) : (
                  <th className="text-right responsive-text">返却量 (g)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredMetals.map((metal) => (
                <tr key={metal.name} className="border-t">
                  <td className="py-2 responsive-text">{metal.name} {metal.nameJp}</td>
                  <td className="text-right py-2 responsive-text">{isLoading ? "" : formatAmount(metal.amount) + " g"}</td>
                  {withdrawMode === 'full' ? (
                    <td className="text-center py-2">
                      <input
                        type="checkbox"
                        checked={withdrawAmounts[metal.name] > 0}
                        onChange={(e) => handleFullAmountSelection(metal.name, e.target.checked)}
                      />
                    </td>
                  ) : (
                    <td className="text-right py-2">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        max={metal.amount}
                        className="w-20 text-right border rounded p-1 responsive-text"
                        value={inputValues[metal.name]}
                        onChange={(e) => handleAmountChange(metal.name, e.target.value)}
                        onBlur={() => handleBlur(metal.name)}
                        onClick={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === '.' || e.key === ',') {
                            e.preventDefault();
                          }
                        }}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-4">
          {showTransactionButton && (
            <button
              onClick={handleProceed}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
            >
              返却手続きへ
            </button>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-left text-gray-500 text-xl font-bold">※現物返却は10:00〜12:30、14:30〜15:30の時間帯のみ利用可能です</div>
      
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirm}
        saleItems={withdrawItems}
        totalAmount={0}
        isDeposit={false}
        isWithdraw={true}
        hideAmount={true}
      />

      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      )}
    </div>
  );
};

export default WithdrawTransactionForm; 