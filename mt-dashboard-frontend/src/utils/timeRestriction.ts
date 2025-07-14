const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface TimeCheckResponse {
  is_allowed: boolean;
  current_time: string;
  current_hour: number;
  current_minute?: number;
  current_second?: number;
  allowed_hours: string;
  restricted_hours?: string;
  message: string;
}

// 取引ボタンの表示可否をチェックする関数
export const isTransactionButtonVisible = (): boolean => {
  const now = new Date();
  
  // 日本時間に変換（UTC+9）
  const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const hour = jstNow.getHours();
  const minute = jstNow.getMinutes();
  
  // 10:00-12:30の時間帯
  if (hour === 10 || hour === 11 || (hour === 12 && minute <= 30)) {
    return true;
  }
  
  // 14:30-15:30の時間帯
  if ((hour === 14 && minute >= 30) || (hour === 15 && minute <= 30)) {
    return true;
  }
  
  return false;
};

export const checkServerTime = async (): Promise<TimeCheckResponse> => {
  try {
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
      allowed_hours: "10:00:00-24:00:00 (JST)",
      message: "時刻確認中にエラーが発生しました"
    };
  }
}; 