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

// 売却可能ウィンドウ判定（2026/09/16 星さん要望）
// 午前＝相場更新後〜12:30 / 午後＝相場更新後〜15:30。
// priceUpdateTime は "2026-09-16 14:27:10" のようなJST壁時計文字列。
// 更新前・当日でない・締め超過は不可（サーバー側 require_sale_time と同一ロジック）。
export const isSaleAllowedNow = (priceUpdateTime?: string): boolean => {
  if (!priceUpdateTime) return false;
  const m = priceUpdateTime.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return false;
  const uY = +m[1], uMo = +m[2], uD = +m[3], uH = +m[4], uMi = +m[5];

  // 現在のJST壁時計を取得
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
  const nY = get('year'), nMo = get('month'), nD = get('day');
  let nH = get('hour'); const nMi = get('minute');
  if (nH === 24) nH = 0; // hour12:false で 24 が返る環境対策

  // 当日更新でなければ不可（前日の価格のまま売らせない）
  if (uY !== nY || uMo !== nMo || uD !== nD) return false;

  const updateMin = uH * 60 + uMi;
  const nowMin = nH * 60 + nMi;
  if (nowMin < updateMin) return false; // 更新前

  const AM_CLOSE = 12 * 60 + 30; // 12:30
  const PM_CLOSE = 15 * 60 + 30; // 15:30
  // 13時以降の更新を「午後」扱い
  return uH < 13 ? nowMin <= AM_CLOSE : nowMin <= PM_CLOSE;
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