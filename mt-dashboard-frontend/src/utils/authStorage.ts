/**
 * 認証情報（APIキーを含む）専用のセキュアストレージユーティリティ。
 *
 * 設計方針：
 * - localStorage は XSS で全部抜かれるため、認証情報は sessionStorage を使う
 * - sessionStorage はタブ単位 / セッション単位で隔離され、タブを閉じると消える
 * - 数値キャッシュやUI設定など、ログアウト後も保持してよいデータは localStorage
 *
 * 将来的には HttpOnly Cookie + CSRF トークンへ移行することが望ましい。
 */

const AUTH_KEY = 'auth';

export const authStorage = {
  set: (value: unknown): boolean => {
    try {
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(value));
      // 別タブ等への通知はしないが、同一タブ内のコンポーネント更新は React state で行う
      return true;
    } catch (error) {
      console.error('authStorage.set failed:', error);
      return false;
    }
  },

  get: <T = any>(): T | null => {
    try {
      const raw = sessionStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error('authStorage.get failed (corrupt data?):', error);
      // 破損データはクリア
      try { sessionStorage.removeItem(AUTH_KEY); } catch {}
      return null;
    }
  },

  clear: (): void => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
    } catch (error) {
      console.error('authStorage.clear failed:', error);
    }
  },
};

/**
 * 旧localStorageに保管されていたauthデータを sessionStorage に移行する
 * （ユーザーが既にログイン済みの場合のスムーズな移行のため）。
 *
 * 移行後はlocalStorage側からは削除する。
 */
export const migrateLegacyAuthFromLocalStorage = (): void => {
  try {
    const legacy = localStorage.getItem(AUTH_KEY);
    if (legacy && !sessionStorage.getItem(AUTH_KEY)) {
      sessionStorage.setItem(AUTH_KEY, legacy);
    }
    if (legacy) {
      localStorage.removeItem(AUTH_KEY);
    }
  } catch (error) {
    console.warn('legacy auth migration skipped:', error);
  }
};
