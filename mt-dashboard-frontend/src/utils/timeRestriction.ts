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
  
  // 日本時間を確実に取得
  const jstHour = parseInt(now.toLocaleString("en-US", { 
    timeZone: "Asia/Tokyo", 
    hour: "2-digit", 
    hour12: false 
  }));
  const jstMinute = parseInt(now.toLocaleString("en-US", { 
    timeZone: "Asia/Tokyo", 
    minute: "2-digit" 
  }));
  
  // 10:00-12:30の時間帯
  if (jstHour === 10 || jstHour === 11 || (jstHour === 12 && jstMinute <= 30)) {
    return true;
  }
  
  // 14:30-15:30の時間帯
  if ((jstHour === 14 && jstMinute >= 30) || (jstHour === 15 && jstMinute <= 30)) {
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