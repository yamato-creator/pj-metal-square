import React, { useState, useEffect } from 'react';

// 一時的に型定義をここで定義
interface TimeCheckResponse {
  is_allowed: boolean;
  current_time: string;
  current_hour: number;
  current_minute?: number;
  current_second?: number;
  allowed_hours: string;
  restricted_hours?: string;
  message: string;
}

// 一時的にcheckServerTime関数をここで定義
const checkServerTime = async (): Promise<TimeCheckResponse> => {
  try {
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    const response = await fetch(`${API_BASE_URL}/api/check-access-time`);
    if (!response.ok) {
      throw new Error('時刻チェックAPIの呼び出しに失敗しました');
    }
    return await response.json();
  } catch (error) {
    console.error('時刻チェックエラー:', error);
    // APIエラー時はアクセス拒否
    return {
      is_allowed: false,
      current_time: new Date().toISOString(),
      current_hour: new Date().getHours(),
      allowed_hours: "11:05:00-24:00:00 (JST)",
      message: "時刻確認中にエラーが発生しました"
    };
  }
};

const RestrictedPage: React.FC<{ timeInfo: TimeCheckResponse }> = ({ timeInfo }) => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">
        メンテナンス中
      </h1>
      <p className="text-gray-600 mb-4">
        このサイトは10:00-24:00の間のみご利用いただけます。
      </p>
    </div>
  </div>
);

const LoadingPage: React.FC = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">アクセス許可を確認中...</p>
    </div>
  </div>
);

export const TimeRestrictedApp: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDev = process.env.NODE_ENV === 'development';
  const [timeInfo, setTimeInfo] = useState<TimeCheckResponse | null>(isDev ? { is_allowed: true, current_time: '', current_hour: 12, allowed_hours: '', message: '' } : null);
  const [isLoading, setIsLoading] = useState(!isDev);

  useEffect(() => {
    if (isDev) return;

    const checkTime = async () => {
      const result = await checkServerTime();
      setTimeInfo(result);
      setIsLoading(false);
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [isDev]);

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!timeInfo?.is_allowed) {
    return <RestrictedPage timeInfo={timeInfo!} />;
  }

  return <>{children}</>;
}; 