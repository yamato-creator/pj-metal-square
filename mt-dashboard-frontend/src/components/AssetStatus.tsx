import React from 'react';
import { CircularProgress } from '@mui/material';

interface Metal {
  name: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
}

interface Props {
  metals: Metal[];
  onUpdateAssets?: (assets: any[]) => void;
  isLoading?: boolean;
}

const AssetStatus: React.FC<Props> = ({ metals, onUpdateAssets, isLoading }) => {
  // 現在の日付を取得して表示形式をフォーマット (例: 2025年4月20日現在)
  const formatCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return `${year}年${month}月${day}日現在`;
  };

  const totalAssets = metals.reduce((sum, metal) => {
    return sum + Math.floor(Number(metal.amount.toFixed(2)) * Math.floor(metal.unitPrice));
  }, 0);

  const formatPrice = (price: number) => {
    if (price === 0) return '0円';
    return `${Math.floor(price).toLocaleString()} 円`;
  };

  const formatAmount = (amount: number) => {
    if (amount === 0 && metals.every(m => m.amount === 0)) return '';
    return `${amount.toFixed(2)} g`;
  };

  if (isLoading) {
    return (
      <div className="responsive-container dashboard-component">
        <div className="flex flex-col mb-4">
          <h1 className="responsive-heading">資産状況</h1>
          <span className="text-gray-600 text-2xl">{formatCurrentDate()}</span>
        </div>
        <div className="responsive-card bg-white flex justify-center items-center" style={{ minHeight: "200px" }}>
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-container dashboard-component">
      <div className="flex flex-col mb-4">
        <h1 className="responsive-heading">資産状況</h1>
        <span className="text-gray-600 text-2xl">{formatCurrentDate()}</span>
      </div>
      <div className="responsive-card bg-white">
        <div className="responsive-table">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left responsive-text">金属名</th>
                <th className="text-right responsive-text">保有量</th>
                <th className="text-right responsive-text">買取価格</th>
                <th className="text-right responsive-text">評価額</th>
              </tr>
            </thead>
            <tbody>
              {metals.map((metal) => (
                <tr key={metal.name} className="border-t">
                  <td className="py-2 responsive-text">{metal.name} {metal.nameJp}</td>
                  <td className="text-right py-2 responsive-text">{formatAmount(metal.amount)}</td>
                  <td className="text-right py-2 responsive-text">
                    {metal.unitPrice === 0 ? '' : `${Math.floor(metal.unitPrice).toLocaleString()} 円/g`}
                  </td>
                  <td className="text-right py-2 responsive-text">
                    {formatPrice(Number(metal.amount.toFixed(2)) * Math.floor(metal.unitPrice))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-between">
          <span className="responsive-text font-bold text-xl">資産合計:</span>
          <span className="responsive-text font-bold text-xl">
            {totalAssets === 0 ? <span className="text-red-600">0円(税抜)</span> : <span className="text-red-600">{Math.floor(totalAssets).toLocaleString()}円(税抜)</span>}
          </span>
        </div>
      </div>
      <div className="mt-2 text-left text-gray-500 text-xl font-bold">※上記価格は消費税は含まれておりません</div>
    </div>
  );
};

export default AssetStatus;