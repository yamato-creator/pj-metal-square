// usersシートの同期用（値のみ）
function onChange(e) {
  // usersシートの変更のみを対象
  const changedSheet = e.source.getActiveSheet();
  
  if (changedSheet.getName() === 'users') {
    syncUsersToUsersKopy();
  }
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
    
    // 値のみをコピー
    targetSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
  
  console.log('usersシートの値を同期しました');
}