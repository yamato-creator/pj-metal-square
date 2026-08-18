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
  priceUpdateTime?: string;
}

const AssetStatus: React.FC<Props> = ({ metals, onUpdateAssets, isLoading, priceUpdateTime }) => {
  // 現在の日付を取得して表示形式をフォーマット (例: 2025年4月20日現在)
  const formatCurrentDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return `${year}年${month}月${day}日現在`;
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

  const totalAssets = metals.reduce((sum, metal) => {
    return sum + Math.floor(Number(metal.amount.toFixed(2)) * Math.floor(metal.unitPrice));
  }, 0);

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
    <div className="responsive-container dashboard-component !px-2 sm:!px-6">
      <div className="flex flex-col mb-4">
        <h1 className="responsive-heading">資産状況</h1>
        <span className="text-gray-600 text-2xl">{formatCurrentDate()}</span>
      </div>
      <div className="responsive-card bg-white !p-2 sm:!p-6">
        <div className="responsive-table overflow-x-auto">
          <table className="w-full tabular-nums text-xs sm:text-base">
            <thead>
              <tr>
                <th className="text-left whitespace-nowrap">金属名</th>
                <th className="text-right whitespace-nowrap">保有量(g)</th>
                <th className="text-right whitespace-nowrap">買取価格(円/g)</th>
                <th className="text-right whitespace-nowrap">評価額(円)</th>
              </tr>
            </thead>
            <tbody>
              {metals.map((metal) => (
                <tr key={metal.name} className="border-t">
                  <td className="py-2 whitespace-nowrap">{metal.name} {metal.nameJp}</td>
                  {/* 保有量0は空白ではなく「0」を表示（2026/08/18 星さん依頼） */}
                  <td className="text-right py-2 whitespace-nowrap">{metal.amount === 0 ? '0' : metal.amount.toFixed(2)}</td>
                  <td className="text-right py-2 whitespace-nowrap">
                    {metal.unitPrice === 0 ? '' : Math.floor(metal.unitPrice).toLocaleString()}
                  </td>
                  <td className="text-right py-2 whitespace-nowrap">
                    {Number(metal.amount.toFixed(2)) * Math.floor(metal.unitPrice) === 0 ? '0' : Math.floor(Number(metal.amount.toFixed(2)) * Math.floor(metal.unitPrice)).toLocaleString()}
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
      {priceUpdateTime && (
        <div className="mt-2 text-left text-gray-500 text-xl font-bold">※{formatPriceUpdateTime()}</div>
      )}
      <div className="mt-2 text-left text-gray-500 text-xl font-bold">※上記価格は消費税は含まれておりません</div>
    </div>
  );
};

export default AssetStatus;