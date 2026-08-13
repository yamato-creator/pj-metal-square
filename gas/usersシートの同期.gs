// usersシートの同期用（値のみ）
// トリガー設定必須：GASエディタ左の時計アイコン →「トリガーを追加」→
//   関数: onChange / イベントの種類: 変更時（onChange）
function onChange(e) {
  // 変更元シートの判定はしない。
  // API経由（バックエンド）の書き込みでは getActiveSheet() が当てにならず
  // 同期がスキップされるため、どの変更でも常に同期する（数行なのでコストは無視できる）。
  syncUsersToUsersKopy();
}

function syncUsersToUsersKopy() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName('users');
  const targetSheet = ss.getSheetByName('usersコピー');

  // usersコピーシートが存在しない場合は何もしない
  if (!targetSheet) {
    console.log('usersコピーシートが見つかりません');
    return;
  }

  // usersシートの全データを取得
  const sourceData = sourceSheet.getDataRange();
  const values = sourceData.getValues();

  if (values.length > 0) {
    // usersコピーシートの既存データをクリア
    if (targetSheet.getLastRow() > 0) {
      targetSheet.getRange(1, 1, targetSheet.getLastRow(), targetSheet.getLastColumn()).clearContent();
    }

    const targetRange = targetSheet.getRange(1, 1, values.length, values[0].length);
    // 数字のみのパスワード等で先頭0が欠落しないよう、書式なしテキストを強制
    targetRange.setNumberFormat('@');
    // 値のみをコピー
    targetRange.setValues(values);
  }

  console.log('usersシートの値を同期しました');
}
