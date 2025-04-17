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
  const totalAssets = metals.reduce((sum, metal) => {
    return sum + metal.amount * metal.unitPrice;
  }, 0);

  const formatPrice = (price: number) => {
    if (price === 0) return '0円';
    return `${price.toFixed(1).toLocaleString()} 円`;
  };

  const formatAmount = (amount: number) => {
    if (amount === 0 && metals.every(m => m.amount === 0)) return '';
    return `${Math.floor(amount)} g`;
  };

  if (isLoading) {
    return (
      <div className="responsive-container dashboard-component">
        <h1 className="responsive-heading mb-4">資産状況</h1>
        <div className="responsive-card bg-white flex justify-center items-center" style={{ minHeight: "200px" }}>
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="responsive-container dashboard-component">
      <h1 className="responsive-heading mb-4">資産状況</h1>
      <div className="responsive-card bg-white">
        <div className="mb-4">
          <div className="flex justify-between">
            <span className="responsive-text">資産合計</span>
            <span className="responsive-text text-emerald-600">
              {totalAssets === 0 ? '' : `${(Math.round(totalAssets * 10) / 10).toLocaleString()}円`}
            </span>
          </div>
        </div>

        <div className="responsive-table">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left responsive-text">金属名</th>
                <th className="text-right responsive-text">保有量</th>
                <th className="text-right responsive-text">単価</th>
                <th className="text-right responsive-text">評価額</th>
              </tr>
            </thead>
            <tbody>
              {metals.map((metal) => (
                <tr key={metal.name} className="border-t">
                  <td className="py-2 responsive-text">{metal.name} {metal.nameJp}</td>
                  <td className="text-right py-2 responsive-text">{formatAmount(metal.amount)}</td>
                  <td className="text-right py-2 responsive-text">
                    {metal.unitPrice === 0 ? '' : `${metal.unitPrice.toFixed(1).toLocaleString()} 円/g`}
                  </td>
                  <td className="text-right py-2 responsive-text">
                    {formatPrice(metal.amount * metal.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AssetStatus;