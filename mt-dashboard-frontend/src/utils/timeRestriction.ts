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
      allowed_hours: "11:05:00-24:00:00 (JST)",
      message: "時刻確認中にエラーが発生しました"
    };
  }
}; 