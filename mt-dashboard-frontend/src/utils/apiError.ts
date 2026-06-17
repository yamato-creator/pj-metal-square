/**
 * バックエンドの HTTPException が返す JSON  {"detail": "..."} を文字列メッセージに変換する。
 *
 * 既定値: response.ok === true 以外で、detail があれば detail を返す。
 *         なければ status コード別に標準メッセージ。
 *
 * 主要ステータス:
 *   403: 取引可能時間外、または他人のリソース閲覧
 *   401: 認証失敗 / API キー無効
 *   429: レート制限
 */
export const extractApiErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  let detail: string | undefined;
  try {
    const data = await response.clone().json();
    if (data && typeof data.detail === 'string') {
      detail = data.detail;
    }
  } catch {
    // ボディが JSON でないケース
  }
  if (detail) return detail;
  switch (response.status) {
    case 401:
      return '認証エラーが発生しました。再度ログインしてください。';
    case 403:
      return '権限エラー、または取引可能時間外です（JST 10:00 - 24:00 のみ受付）。';
    case 429:
      return 'リクエストが多すぎます。少し時間を置いて再度お試しください。';
    case 500:
      return 'サーバーエラーが発生しました。';
    default:
      return fallback;
  }
};
