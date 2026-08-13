function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  // 売却入力シートの編集ハンドラ
  if (sheet.getName() === '売却入力') {
    handleSaleInputOnEdit(e);
    return;
  }

  // 預入入力シートのC3:C6（預入量）が編集された場合の処理
  if (sheet.getName() === '預入入力' &&
      range.getColumn() === 3 &&
      range.getRow() >= 3 &&
      range.getRow() <= 6) {

    const inputValue = range.getValue();

    // 空白の場合は何もしない
    if (inputValue === "" || inputValue === null) {
      return;
    }

    // 文字列に変換
    const strValue = inputValue.toString();

    // 半角数字と小数点以外の文字をチェック（全角数字も含む）
    const cleanedValue = strValue.replace(/[^0-9.]/g, '');

    // 元の文字列と清掃後の文字列が異なる場合は無効な文字が含まれている
    if (strValue !== cleanedValue) {
      range.clearContent();
      return;
    }

    // 数値として有効かチェック（負の値も除外）
    const numericValue = parseFloat(cleanedValue);

    if (cleanedValue === "" || isNaN(numericValue) || numericValue < 0) {
      // 無効な値の場合はセルをクリア
      range.clearContent();
      return;
    }

    // 数値として再設定（念のため）
    if (inputValue !== numericValue) {
      range.setValue(numericValue);
    }
  }

  // シート名が "users" で、A列（user_id）が編集されたときの処理
  if (sheet.getName() === "users") {
    if (range.getColumn() === 1 && range.getRow() > 1) {
      // A列の書式を「文字列」として設定し、先頭の0が消えないようにします
      range.setNumberFormat('@');

      const row = range.getRow();
      // getDisplayValue() を使用して、セルに表示されている通りの文字列を取得します
      const userId = range.getDisplayValue();

      // user_idが空白の場合は何もしない
      if (userId.trim() === "") {
        return;
      }

      // ★ユーザーIDの入力制限（半角数字10桁のみ）
      // 半角数字10桁かチェック
      const isValidUserId = /^[0-9]{10}$/.test(userId);

      if (!isValidUserId) {
        // 無効な値の場合はセルをクリアしてアラート表示
        range.clearContent();
        SpreadsheetApp.getUi().alert('入力エラー', 'ユーザーIDは半角数字10桁で入力してください。', SpreadsheetApp.getUi().ButtonSet.OK);
        return;
      }

      // D列（password）に8桁のパスワードを自動生成（未入力時のみ）
      const passwordCell = sheet.getRange(row, 4);
      if (passwordCell.getValue() === "") {
        const generatedPassword = generatePassword(8);
        passwordCell.setValue(generatedPassword);
      }

      // G列（is_deleted）に FALSE を自動入力（未入力時のみ）
      const isDeletedCell = sheet.getRange(row, 7);
      if (isDeletedCell.getValue() === "") {
        isDeletedCell.setValue("FALSE");
      }

      // 現在の日時を一度だけ取得
      const now = new Date();

      // E列（registered_at）に現在の日時を「yyyy/MM/dd H:mm:ss」形式で自動入力（未入力時のみ）
      const registeredAtCell = sheet.getRange(row, 5);
      if (registeredAtCell.getValue() === "") {
        const formatted = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd H:mm:ss");
        registeredAtCell.setValue(formatted);
      }

      // F列（api_key）に apikey_時刻 を自動入力（未入力時のみ）
      const apiKeyCell = sheet.getRange(row, 6);
      if (apiKeyCell.getValue() === "") {
        // E列と同じ時刻を使ってyyyyMMddHHmmss形式で生成
        const timeString = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
        apiKeyCell.setValue(`apikey_${timeString}`);
      }

      // assetsシートに貴金属レコードを自動作成
      createAssetRecords(userId);
    }
  }

  // 預入入力のD5セル（日付入力）が編集された場合のバリデーション
  if (sheet.getName() === '預入入力' && range.getA1Notation() === 'D5') {
    const dateValue = range.getValue();
    if (dateValue) {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        range.clearContent();
        SpreadsheetApp.getUi().alert('日付の形式が正しくありません。\nyyyy/MM/dd形式で入力してください。');
        return;
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (date > today) {
        range.clearContent();
        SpreadsheetApp.getUi().alert('未来の日付は入力できません。');
        return;
      }
    }
  }

  // 預入入力のE5セル（ユーザーID）が編集された場合の処理
  if (sheet.getName() === '預入入力' && range.getA1Notation() === 'E5') {
    updateUserInfo(sheet, range.getDisplayValue().trim());
  }

  // 預入入力のH5セルで「確定」が選択された場合の処理
  if (sheet.getName() === '預入入力' &&
      range.getA1Notation() === 'H5' &&
      e.value === '確定') {

    Utilities.sleep(100);
    processDeposit();
  }
}

function updateUserInfo(depositSheet, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('users');

  const id = (userId ?? '').toString().trim();
  if (id === '') {
    depositSheet.getRange('F5').clearContent();
    depositSheet.getRange('G5').clearContent();
    return;
  }

  // 先頭0を保持するため「表示文字列」で取得
  const usersData = usersSheet.getDataRange().getDisplayValues();
  let userName = '';
  let remarks  = '';

  for (let i = 1; i < usersData.length; i++) {
    const uid   = usersData[i][0]; // A列: user_id（文字列）
    const isDel = usersData[i][6]; // G列: is_deleted（false or "FALSE" 等）
    const isActive = (isDel === false) || (String(isDel).toUpperCase() === 'FALSE') || isDel === '' || isDel == null;

    if (uid === id && isActive) {
      userName = usersData[i][1] || ''; // B列：ユーザー名
      remarks  = usersData[i][8] || ''; // I列：備考
      break;
    }
  }

  depositSheet.getRange('F5').setValue(userName);
  depositSheet.getRange('G5').setValue(remarks);
}

function createAssetRecords(userId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const assetsSheet = spreadsheet.getSheetByName("assets");

  if (!assetsSheet) {
    console.error("assetsシートが見つかりません");
    return;
  }

  // 既存データを取得して、該当ユーザーIDのレコードが存在するかチェック
  const assetsData = assetsSheet.getDataRange().getValues();
  const existingUserIds = new Set();

  for (let i = 1; i < assetsData.length; i++) { // ヘッダー行をスキップ
    if (assetsData[i][1]) { // B列（ユーザーID）が存在する場合
      existingUserIds.add(assetsData[i][1]);
    }
  }

  // 該当ユーザーIDが既に存在する場合は処理を終了
  if (existingUserIds.has(userId)) {
    console.log(`ユーザーID ${userId} の資産レコードは既に存在します`);
    return;
  }

  // 貴金属の種類
  const metals = ["金", "パラジウム", "銀", "プラチナ"];

  // 現在の日時を取得
  const now = new Date();
  const dateTimeString = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyyMMddHHmmss");
  const formattedDateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");

  // A列基準で最後のデータ行を求める。
  // getLastRow() は右側の集計表（G2:H7）も含んだ最終行を返すため、
  // データ削除直後だと8行目から書かれて2〜7行が空白になってしまう。
  const colA = assetsSheet.getRange(1, 1, assetsSheet.getLastRow(), 1).getValues();
  let lastDataRow = 1;
  for (let i = 0; i < colA.length; i++) {
    if (colA[i][0] !== "") lastDataRow = i + 1;
  }

  // 各貴金属のレコードを作成
  metals.forEach((metal, index) => {
    // 資産IDを生成 (AST + 日時分秒 + インデックス)
    const assetId = `AST${dateTimeString}${index}`;
    const newRow = lastDataRow + 1 + index;

    // データを設定（A〜E列を一括書き込み）
    assetsSheet.getRange(newRow, 1, 1, 5).setValues([
      [assetId, userId, metal, 0, formattedDateTime]
    ]);
  });

  console.log(`ユーザーID ${userId} の資産レコードを作成しました`);
}

function processDeposit() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const depositSheet = ss.getSheetByName('預入入力');
    const usersSheet = ss.getSheetByName('users');
    const assetsSheet = ss.getSheetByName('assets');
    const transactionsSheet = ss.getSheetByName('transactions');

    console.log('処理開始');

    // 1. 入力値の取得と検証（C3:C6から取得）
    const depositAmounts = [
      depositSheet.getRange('C3').getValue(), // 金
      depositSheet.getRange('C4').getValue(), // パラジウム
      depositSheet.getRange('C5').getValue(), // 銀
      depositSheet.getRange('C6').getValue()  // プラチナ
    ];

    const selectedUserId = depositSheet.getRange('E5').getDisplayValue().trim(); // E5はユーザーID（列シフト後）

    // 入力値の検証
    const hasValidAmount = depositAmounts.some(amount => amount && amount > 0);

    if (!hasValidAmount) {
      SpreadsheetApp.getUi().alert('エラー', '預入量を入力してください。\n（金額は0より大きい値を入力してください）', SpreadsheetApp.getUi().ButtonSet.OK);
      depositSheet.getRange('H5').setValue('未確定');
      return;
    }

    if (!selectedUserId) {
      SpreadsheetApp.getUi().alert('エラー', 'ユーザーIDを選択してください。', SpreadsheetApp.getUi().ButtonSet.OK);
      depositSheet.getRange('H5').setValue('未確定');
      return;
    }

    // 2. ユーザーの存在確認
    const usersData = usersSheet.getDataRange().getDisplayValues();
    let userExists = false;

    for (let i = 1; i < usersData.length; i++) {
      const uid   = usersData[i][0];
      const isDel = usersData[i][6];
      const isActive = (isDel === false) || (String(isDel).toUpperCase() === 'FALSE') || isDel === '' || isDel == null;
      if (uid === selectedUserId && isActive) {
        userExists = true;
        break;
      }
    }

    if (!userExists) {
      SpreadsheetApp.getUi().alert('エラー', '選択されたユーザーIDは無効です。\n（削除済みまたは存在しないユーザーです）', SpreadsheetApp.getUi().ButtonSet.OK);
      depositSheet.getRange('H5').setValue('未確定');
      return;
    }

    // 3. 日時と取引IDの生成（過去日付対応）
    const now = new Date();
    const dateInput = depositSheet.getRange('D5').getValue();
    let transactionDate;

    if (dateInput) {
      // === 過去日付が入力されている場合 ===
      transactionDate = new Date(dateInput);

      // 日付の妥当性チェック
      if (isNaN(transactionDate.getTime())) {
        SpreadsheetApp.getUi().alert('エラー', '日付の形式が正しくありません。\nyyyy/MM/dd形式で入力してください。', SpreadsheetApp.getUi().ButtonSet.OK);
        depositSheet.getRange('H5').setValue('未確定');
        return;
      }

      // 未来日付のチェック
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (transactionDate > todayEnd) {
        SpreadsheetApp.getUi().alert('エラー', '未来の日付は入力できません。', SpreadsheetApp.getUi().ButtonSet.OK);
        depositSheet.getRange('H5').setValue('未確定');
        return;
      }

      // 【対策: リスク6】過去日付の時刻は 00:00:00 固定
      transactionDate.setHours(0, 0, 0, 0);
    } else {
      // === 日付入力なし → 当日日付（現行と同じ動作） ===
      transactionDate = now;
    }

    // 【対策: リスク2】トランザクションIDは常に現在日時から生成（一意性保証）
    const idTimeString = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
    const transactionId = 'TRS' + idTimeString;

    // 取引日時はtransactionsシートのI列に記録（入力された日付 or 当日）
    const dateTimeString = Utilities.formatDate(transactionDate, Session.getScriptTimeZone(), 'yyyy/MM/dd H:mm:ss');

    // 【対策: リスク1】assetsのE列（更新日時）は常に現在日時を使用
    const assetUpdateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy/MM/dd H:mm:ss');

    // 4. 資産の更新と取引履歴の追加
    const metalNames = ['金', 'パラジウム', '銀', 'プラチナ'];
    const assetsData = assetsSheet.getDataRange().getValues();

    for (let i = 0; i < depositAmounts.length; i++) {
      if (depositAmounts[i] && depositAmounts[i] > 0) {
        const metalName = metalNames[i];

        // 該当する資産を検索
        for (let j = 1; j < assetsData.length; j++) {
          if (assetsData[j][1] === selectedUserId && assetsData[j][2] === metalName) {
            const currentAmount = assetsData[j][3] || 0;
            const newAmount = currentAmount + depositAmounts[i];
            assetsSheet.getRange(j + 1, 4).setValue(newAmount);
            assetsSheet.getRange(j + 1, 5).setValue(assetUpdateTime); // 常に現在日時
            break;
          }
        }

        // 取引履歴の追加
        addTransaction(transactionsSheet, selectedUserId, metalName, depositAmounts[i], transactionId, dateTimeString);
      }
    }

    console.log('処理完了、クリア処理開始');

    // 入力欄をクリア
    depositSheet.getRange('C3:C6').clearContent();     // 預入量クリア
    depositSheet.getRange('D5:G5').clearContent();      // 日付・ユーザーID・ユーザー名・備考クリア
    depositSheet.getRange('H5').setValue('未確定');      // ステータスリセット

    // 成功メッセージ
    SpreadsheetApp.getUi().alert('成功', '預入処理が完了しました！\n\n資産が正常に更新され、取引履歴に記録されました。', SpreadsheetApp.getUi().ButtonSet.OK);

    console.log('全処理完了');

  } catch (error) {
    console.error('エラー発生:', error);
    SpreadsheetApp.getUi().alert('エラー', 'システムエラーが発生しました:\n' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);

    // エラー時もH5を未確定に戻す
    try {
      const depositSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('預入入力');
      depositSheet.getRange('H5').setValue('未確定');
    } catch (e) {
      console.error('H5リセットエラー:', e);
    }
  }
}

function addTransaction(transactionsSheet, userId, metalName, amount, transactionId, dateTimeString) {
  const rowValues = [
    transactionId,
    String(userId),       // 文字列で保持
    '預入',
    metalName,
    amount,
    0,
    0,
    '申込済',
    dateTimeString,
    'スクエア合同会社'
  ];

  // 挿入先の行を決定
  const row = transactionsSheet.getLastRow() + 1;

  // B列（ユーザーID）をプレーンテキストに設定してから書き込む
  transactionsSheet.getRange(row, 2).setNumberFormat('@');
  transactionsSheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
}

function generatePassword(length) {
  // 使用する文字セット（大文字、小文字、数字）
  const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const allChars = upperCase + lowerCase + numbers;

  let password = '';

  // 最低1つずつは含むように設定
  password += upperCase[Math.floor(Math.random() * upperCase.length)]; // 大文字1つ
  password += lowerCase[Math.floor(Math.random() * lowerCase.length)]; // 小文字1つ
  password += numbers[Math.floor(Math.random() * numbers.length)];     // 数字1つ

  // 残りの文字をランダムに生成
  for (let i = 3; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // パスワードの文字順をシャッフル
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
