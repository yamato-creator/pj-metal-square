/**
 * LINE公式アカウント「スクエア<square>」への相場自動配信
 *
 * 2026/09/26 星さん確定:
 *   ・弁護士NGのため「相場（価格）のみ」を配信する（なんぼや等の解説文・AI生成は無し）
 *   ・配信タイミングは価格更新のたび（田中貴金属のメール着→反映の直後。通常1日2回）
 *   ・注意書きとして「何時から何時まで売却可能か」を入れる
 *
 * 仕組み:
 *   貴金属価格取得プログラム.gs の updateSpreadsheet() が価格を更新・履歴を追加した直後に
 *   sendMarketPriceBroadcast() を呼ぶ。metal-prices シートの履歴（行10=最新, 行11=前回）から
 *   前回比を計算し、LINE Messaging API の broadcast で友だち全員へ1通送る。
 *
 * セットアップ（初回のみ）:
 *   1. LINE Developers でチャネル（Messaging API）を作成し、チャネルアクセストークン（長期）を発行
 *   2. Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に
 *        キー: LINE_CHANNEL_ACCESS_TOKEN   値: 発行したトークン
 *      を登録（コードに直接書かない）
 *   3. previewMarketPriceMessage() を実行して本文を確認（送信はしない）
 *   4. sendTestPushToSelf() で自分だけに試送（任意。LINE_TEST_USER_ID が要る）
 *
 * 注意:
 *   ・配信は broadcast = 友だち全員。テストは必ず preview / push で行う
 *   ・LINE側の無料枠を超えるとエラーになるため、送信失敗はログとメールで通知するだけにして
 *     価格更新処理は止めない（相場データの方が重要なため）
 */

const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const PRICE_SHEET_NAME = 'metal-prices';
// 売却可能時間（締め）: 午前は 12:30、午後は 15:30 まで（2026/09/26 星さん）
const SALE_CLOSE_AM = '12:30';
const SALE_CLOSE_PM = '15:30';
// 午後の相場更新とみなす時刻（これ以降の更新は「午後」扱い）
const PM_BOUNDARY_HOUR = 13;

/**
 * 相場をLINEへ配信する（価格更新の直後に呼ばれる）。
 * @return {boolean} 送信できたら true
 */
function sendMarketPriceBroadcast() {
  try {
    const msg = buildMarketPriceMessage_();
    if (!msg) {
      Logger.log('[LINE] 本文を作れなかったため配信をスキップ');
      return false;
    }
    return lineSend_(LINE_BROADCAST_URL, { messages: [{ type: 'text', text: msg }] });
  } catch (e) {
    Logger.log('[LINE] 配信エラー: ' + e);
    notifyLineError_(e);
    return false;
  }
}

/**
 * 送信せずに本文だけ確認する（テスト用）。実行ログに出力する。
 */
function previewMarketPriceMessage() {
  const msg = buildMarketPriceMessage_();
  Logger.log('--- LINE配信プレビュー ---\n' + msg);
  return msg;
}

/**
 * 「誰にも送らずに」LINE連携が成立しているかを確認する（テスト用）。
 *
 *   ・GET /v2/bot/info        … トークンが有効か＋どのアカウントに紐づいているか
 *   ・GET /v2/bot/message/quota … 当月の送信上限（無料枠）
 *
 * メッセージは1通も送らない。
 * ★必ず「トリガー所有者（suquare.metal）」でログインしたGASエディタから実行すること。
 *   実際の配信はトリガー所有者の権限で動くため、別アカウントで実行しても
 *   外部リクエスト（script.external_request）の承認確認にはならない。
 */
function checkLineConnection() {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) throw new Error('スクリプトプロパティ LINE_CHANNEL_ACCESS_TOKEN が未設定です');
  const opt = { method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };

  const info = UrlFetchApp.fetch('https://api.line.me/v2/bot/info', opt);
  Logger.log('[LINE] bot/info   code=%s body=%s', info.getResponseCode(), info.getContentText());

  const quota = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota', opt);
  Logger.log('[LINE] quota      code=%s body=%s', quota.getResponseCode(), quota.getContentText());

  // 当月の消費数。broadcast 1回 = 友だち人数ぶん増える（届いたかどうかの確実な証拠になる）
  const cons = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota/consumption', opt);
  Logger.log('[LINE] consumption code=%s body=%s', cons.getResponseCode(), cons.getContentText());

  const ok = info.getResponseCode() === 200;
  Logger.log(ok
    ? '[LINE] ✅ トークン有効・外部リクエスト承認済み（メッセージは送っていません）'
    : '[LINE] ❌ 連携NG。上のcode/bodyを確認してください');
  return ok;
}

/**
 * 自分（または指定ユーザー）にだけ試送する（テスト用）。
 * スクリプトプロパティ LINE_TEST_USER_ID に自分のLINEユーザーIDを入れておく。
 */
function sendTestPushToSelf() {
  const to = PropertiesService.getScriptProperties().getProperty('LINE_TEST_USER_ID');
  if (!to) throw new Error('スクリプトプロパティ LINE_TEST_USER_ID が未設定です');
  const msg = buildMarketPriceMessage_();
  return lineSend_(LINE_PUSH_URL, { to: to, messages: [{ type: 'text', text: '[テスト送信]\n' + msg }] });
}

/**
 * 配信本文を組み立てる。
 * metal-prices の履歴（行10=今回, 行11=前回）から前回比を出す。
 * 表示順は現行の手動配信に合わせて 金 → パラジウム → 銀 → プラチナ。
 */
function buildMarketPriceMessage_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PRICE_SHEET_NAME);
  if (!sheet) throw new Error(PRICE_SHEET_NAME + ' シートが見つかりません');

  // 履歴: A=日時, B=金, C=プラチナ, D=パラジウム, E=銀, F=更新日時（行10が最新）
  const rows = sheet.getRange(10, 1, 2, 6).getValues();
  const cur = rows[0];
  const prev = rows[1];
  if (!cur || !cur[5]) throw new Error('最新の価格履歴が取得できません');

  const updatedAt = new Date(cur[5]);
  const dateLabel = Utilities.formatDate(updatedAt, 'Asia/Tokyo', 'yyyy年M月d日') +
    '（' + ['日', '月', '火', '水', '木', '金', '土'][updatedAt.getDay()] + '）';
  const timeLabel = Utilities.formatDate(updatedAt, 'Asia/Tokyo', 'H:mm');
  const closeLabel = updatedAt.getHours() < PM_BOUNDARY_HOUR ? SALE_CLOSE_AM : SALE_CLOSE_PM;

  // [表示名, 今回の列, 前回の列]
  const metals = [
    ['金', 1],
    ['パラジウム', 3],
    ['銀', 4],
    ['プラチナ', 2],
  ];

  const lines = [];
  metals.forEach(function (m) {
    const name = m[0];
    const idx = m[1];
    const now = Number(cur[idx]);
    if (!now && now !== 0) return;
    const before = prev ? Number(prev[idx]) : NaN;
    lines.push(name);
    lines.push(formatPrice_(now) + '円/g' + formatDiff_(now, before));
    lines.push('');
  });
  if (lines.length === 0) return null;
  lines.pop(); // 末尾の空行を落とす

  return [
    dateLabel + ' ' + timeLabel + '更新',
    '',
    '💥買取価格💥税抜き',
    '（田中貴金属相場）',
    '',
    lines.join('\n'),
    '',
    '※売却は本日 ' + timeLabel + '〜' + closeLabel + ' のみ可能です',
    '※上記は消費税を含まない価格です',
    'ご検討の方はアプリからお手続きください。',
  ].join('\n');
}

/** 価格を 21,050 形式にする（小数は切り捨て） */
function formatPrice_(v) {
  return Math.floor(Number(v)).toLocaleString('ja-JP');
}

/** 前回比を「　前回比 -120円 ↘」の形で返す。前回が無ければ空文字 */
function formatDiff_(now, before) {
  if (isNaN(before)) return '';
  const diff = Math.floor(Number(now)) - Math.floor(Number(before));
  if (diff > 0) return '　前回比 +' + diff.toLocaleString('ja-JP') + '円 ↗';
  if (diff < 0) return '　前回比 ' + diff.toLocaleString('ja-JP') + '円 ↘';
  return '　前回比 ±0円 →';
}

/** LINE API 共通送信。成功で true */
function lineSend_(url, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) throw new Error('スクリプトプロパティ LINE_CHANNEL_ACCESS_TOKEN が未設定です');

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 200) {
    Logger.log('[LINE] 送信成功');
    return true;
  }
  Logger.log('[LINE] 送信失敗 code=' + code + ' body=' + res.getContentText());
  notifyLineError_('HTTP ' + code + ' / ' + res.getContentText());
  return false;
}

/** 配信失敗を管理者にメール通知（価格更新処理は止めない） */
function notifyLineError_(detail) {
  try {
    GmailApp.sendEmail(
      RECIPIENT_EMAIL,
      '【エラー】LINE相場配信に失敗しました',
      'LINEへの相場配信に失敗しました。\n\n' + detail + '\n\n' +
      '※価格の取得・スプレッドシート更新は正常に完了しています。'
    );
  } catch (e) {
    Logger.log('[LINE] エラー通知の送信も失敗: ' + e);
  }
}
