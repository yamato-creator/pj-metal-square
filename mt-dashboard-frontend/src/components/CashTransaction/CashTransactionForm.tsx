// src/components/CashTransaction/CashTransactionForm.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import ConfirmationModal from './ConfirmationModal';
import { useAuth } from '../../contexts/AuthContext';
import { isSaleAllowedNow } from '../../utils/timeRestriction';

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
  priceUpdateTime?: string;
}

const CashTransactionForm: React.FC<CashTransactionFormProps> = ({ metals, onSale, onCalculate, onSaleComplete, priceUpdateTime }) => {
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();
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
  const [showTransactionButton, setShowTransactionButton] = useState(false);

  // 売却可能時間チェック（相場更新後〜午前12:30／午後15:30）を定期的に実行
  useEffect(() => {
    const checkButtonVisibility = () => {
      setShowTransactionButton(isSaleAllowedNow(priceUpdateTime));
    };

    checkButtonVisibility(); // 初回チェック
    const interval = setInterval(checkButtonVisibility, 30000); // 30秒ごとにチェック

    return () => clearInterval(interval);
  }, [priceUpdateTime]);

  const formatPrice = (price: number) => {
    if (price === 0) return '0円';
    return `${Math.floor(price).toLocaleString()}円`;
  };

  const formatAmount = (amount: number) => {
    if (amount === 0) return '0 g';
    return `${amount.toFixed(2)} g`;
  };

  // 買取価格の更新日時をフォーマット
  const formatPriceUpdateTime = () => {
    if (!priceUpdateTime) return '';
    try {
      // priceUpdateTimeの形式に応じて適切にパース
      const date = new Date(priceUpdateTime);
      if (isNaN(date.getTime())) {
        // 日付形式でない場合は、そのまま表示
        return `買取価格は${priceUpdateTime}更新(日本時間)`;
      }
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `買取価格は${year}年${month}月${day}日 ${hours}:${minutes}更新(日本時間)`;
    } catch {
      return `買取価格は${priceUpdateTime}更新(日本時間)`;
    }
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
    
    // 小数点第2位まで許可
    const roundedAmount = Math.round(numAmount * 100) / 100;
    
    // 保有量を超える場合はリアルタイムで制限
    const metal = metals.find(m => m.name === metalName);
    if (metal && roundedAmount > metal.amount) {
      setInputValues(prev => ({ ...prev, [metalName]: String(metal.amount) }));
      setSaleAmounts(prev => ({
        ...prev,
        [metalName]: metal.amount
      }));
      return;
    }
    
    setSaleAmounts(prev => ({
      ...prev,
      [metalName]: roundedAmount
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
    
    // 小数点第2位まで許可
    numAmount = Math.round(numAmount * 100) / 100;
    
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
    
    const total = metals.reduce((sum, metal) => {
      // 各金属の評価額を計算し、整数に切り捨てた後で合計する
      return sum + Math.floor((adjustedAmounts[metal.name] || 0) * Math.floor(metal.unitPrice));
    }, 0);
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
      try {
        // 成功した場合は売却データをAPIに送信
        const metalTypeMap: { [key: string]: string } = {
          'Au': '金',
          'Pt': 'プラチナ',
          'Pd': 'パラジウム',
          'Ag': '銀'
        };

        // 売却アイテムを準備
        const saleMetals = metals
          .filter(metal => saleAmounts[metal.name] > 0)
          .map(metal => ({
            metal_type: metalTypeMap[metal.name],
            amount: saleAmounts[metal.name],
            unit_price: Math.floor(metal.unitPrice),
            total: Math.floor(saleAmounts[metal.name] * Math.floor(metal.unitPrice))
          }));

        // APIエンドポイントと必要なパラメータの修正
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/sale`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metals: saleMetals,
            total_amount: result.subtotal,
            tax: result.tax,
            total: result.total
          })
        });

        if (!response.ok) {
          throw new Error(`APIエラー: ${response.status}`);
        }

        const data = await response.json();
        console.log('売却API成功:', data);

        // 売却完了後の処理
        onSaleComplete(data);

        // 完了画面へ遷移
        navigate('/completion', {
          state: {
            totalAmount: totalAmount,
            message: '売却が完了しました。',
            isTaxIncluded: false,
            transactionType: '売却'
          }
        });
      } catch (error) {
        console.error('売却エラー:', error);
        alert('売却処理に失敗しました。' + (error instanceof Error ? error.message : ''));
      } finally {
        setIsProcessing(false);
      }
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
      unitPrice: Math.floor(metal.unitPrice),
      total: Math.floor((saleAmounts[metal.name] || 0) * Math.floor(metal.unitPrice))
    }));

  return (
    <div className="responsive-container">
      <h1 className="responsive-heading mb-4">売却</h1>
      <div className="responsive-card bg-white">
        <h2 className="responsive-subheading mb-4">資産状況と売却希望数量入力</h2>
        <p className="responsive-text text-gray-600 mb-2">※ 保有量を超える売却はできません</p>
        <div className="responsive-table">
          <table className="w-full tabular-nums">
            <thead>
              <tr>
                <th className="text-left responsive-text">金属名</th>
                <th className="text-right responsive-text">保有量 (g)</th>
                <th className="text-right responsive-text">買取価格 (円/g)</th>
                <th className="text-right responsive-text">評価額 (円)</th>
                <th className="text-right responsive-text">売却希望量 (g)</th>
              </tr>
            </thead>
            <tbody>
              {metals.map((metal) => (
                <tr key={metal.name} className="border-t">
                  <td className="py-2 responsive-text">{metal.name} {metal.nameJp}</td>
                  <td className="text-right py-2 responsive-text">{formatAmount(metal.amount)}</td>
                  <td className="text-right py-2 responsive-text">
                    {metal.unitPrice === 0 ? '' : `${Math.floor(metal.unitPrice).toLocaleString()}円`}
                  </td>
                  <td className="text-right py-2 responsive-text">
                    {formatPrice(Number(metal.amount.toFixed(2)) * Math.floor(metal.unitPrice))}
                  </td>
                  <td className="text-right py-2">
                    {/* 2026/08/21 星さん要望: 入力欄の数字がプロポーショナル幅(Inter)で小数点位置がずれるため、
                        tabular-nums（等幅数字）を入力欄自身に付与して行ごとの桁を揃える */}
                    <input
                      type="number"
                      min="0"
                      max={metal.amount}
                      step="0.01"
                      className="w-20 text-right border rounded p-1 responsive-text tabular-nums"
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
            <span className="font-bold">売却金額: </span>
            <span>{totalAmount === 0 ? '0' : Math.floor(totalAmount).toLocaleString()}円</span>
          </div>
          <div className="space-x-2">
            <button
              onClick={calculateTotal}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              計算
            </button>
            {/* 営業時間外はボタンを消さず、表示したまま押せない状態にする（2026/09/16 星さん要望） */}
            <button
              onClick={handleProceed}
              disabled={!showTransactionButton || isProcessing}
              className={`px-4 py-2 rounded text-white ${
                showTransactionButton && !isProcessing
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              {/* 2026/09/28 受け入れ検証: ログイン直後にバックエンドが遅い日は価格が届くまで
                  「売却できない時間です」に見えて誤解を招くため、価格ロード中は別表示にする */}
              {!priceUpdateTime
                ? '価格を読み込み中…'
                : showTransactionButton ? '売却する' : '売却できない時間です'}
            </button>
          </div>
        </div>
      </div>

      {priceUpdateTime && (
        <div className="mt-2 text-left text-gray-500 text-xl font-bold">※{formatPriceUpdateTime()}</div>
      )}
      <div className="mt-1 text-left text-gray-500 text-xl font-bold">※上記価格は消費税を含まない価格です</div>
      <div className="mt-1 text-left text-gray-500 text-xl font-bold">※買取価格の予定更新時刻：午前10時前後／午後14:30前後</div>
      <div className="mt-1 text-left text-gray-500 text-xl font-bold">※売却は相場更新後〜午前12:30／午後は相場更新後〜15:30の間のみ可能です</div>
      {/* 2026/09/16 星さん要望: 売却は相場更新後のみ可能（更新前の古い価格での確定を防ぐ）。判定は isSaleAllowedNow */}
      
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
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      )}
    </div>
  );
};

export default CashTransactionForm;