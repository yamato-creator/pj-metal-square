/**
 * ⑦ スプシからの売却入力
 *
 * 「売却入力」シートでスクエア担当者が、見積もり依頼を受けた後に
 * 確定した売却内容（量・単価・日付・ユーザー）を入力し、
 * 「売却確定」で「確定」を選択すると:
 *   1. assetsの保有量を減算
 *   2. transactionsに売却レコードを追加（取引種別=売却, status=申込済）
 *   3. ユーザー・管理者に売却完了メールを送信
 *
 * シート構造（売却入力）:
 *   A: #               B: 貴金属
 *   C: 1. 売却量(g)    D: 2. 買取単価(円/g)
 *   E: 日付            F: 3. ユーザーID
 *   G: ユーザー名       H: 備考
 *   I: 4. 売却確定
 *
 * 行配置:
 *   3 金    4 パラジウム    5 銀    6 プラチナ
 *   E5/F5/G5/H5/I5 に日付・ユーザーID・名前・備考・ステータスを配置
 */

// 既存の onEdit(e) に統合する想定のハンドラ群
// ※ 既存の「シートに入力した時.gs」の onEdit 内に以下のブロックを追加してください。

/**
 * 既存 onEdit から呼び出す売却入力用ハンドラ
 */
function handleSaleInputOnEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;

  if (sheet.getName() !== '売却入力') return;

  // 売却量 C3:C6, 単価 D3:D6 のバリデーション（数値のみ、負の値禁止）
  if ((range.getColumn() === 3 || range.getColumn() === 4) &&
      range.getRow() >= 3 && range.getRow() <= 6) {
    const inputValue = range.getValue();
    if (inputValue === '' || inputValue === null) { updateSalePreview(sheet); return; }

    const strValue = inputValue.toString();
    const cleanedValue = strValue.replace(/[^0-9.]/g, '');
    if (strValue !== cleanedValue) {
      range.clearContent();
      return;
    }
    const numericValue = parseFloat(cleanedValue);
    if (isNaN(numericValue) || numericValue < 0) {
      range.clearContent();
      return;
    }
    if (inputValue !== numericValue) range.setValue(numericValue);
    updateSalePreview(sheet);
    return;
  }

  // 日付バリデーション(E5)
  if (range.getA1Notation() === 'E5') {
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
    return;
  }

  // ユーザーID入力時に名前を自動検索 (F5)
  if (range.getA1Notation() === 'F5') {
    updateSaleUserInfo(sheet, range.getDisplayValue().trim());
    return;
  }

  // 確定実行 (I5) は onEditInstalled（インストーラブルトリガー）で処理する。
  // シンプル onEdit では GmailApp の送信権限（gmail.send）が無く、
  // 売却完了メールが必ず失敗するため、認可を持つインストーラブル側に分離している。
}

/**
 * インストーラブル onEdit トリガー用ハンドラ。
 * 「売却入力」シートで I5 に「確定」が入力されたら売却処理を実行する。
 *
 * ★重要: このトリガーはスプレッドシートのオーナー（suquare.metal）が
 *   「トリガー」画面から onEditInstalled / スプレッドシートから / 編集時 で登録し、
 *   Gmail 権限を承認すること。承認したアカウントから完了メールが送信される。
 *   シンプル onEdit（handleSaleInputOnEdit）は I5 確定を処理しないので二重実行しない。
 */
function onEditInstalled(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== '売却入力') return;
  if (e.range.getA1Notation() === 'I5' && e.value === '確定') {
    Utilities.sleep(100);
    processSale();
  }
}

/**
 * ユーザーIDを10桁ゼロ埋めに正規化する。
 * セルに数値入力すると先頭の0が欠落する（例: 0367150884 -> 367150884）ため、
 * 照合前に両側を10桁ゼロ埋め文字列へそろえて一致判定できるようにする。
 */
function normUserId(v) {
  const digits = String(v == null ? '' : v).replace(/[^0-9]/g, '');
  return digits === '' ? '' : digits.padStart(10, '0');
}

function updateSaleUserInfo(saleSheet, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('users');
  const id = normUserId(userId);
  if (id === '') {
    saleSheet.getRange('G5').clearContent();
    saleSheet.getRange('H5').clearContent();
    return;
  }
  const usersData = usersSheet.getDataRange().getDisplayValues();
  let userName = '';
  let remarks = '';
  for (let i = 1; i < usersData.length; i++) {
    const uid = usersData[i][0];
    const isDel = usersData[i][6];
    const isActive = (isDel === false) || (String(isDel).toUpperCase() === 'FALSE') || isDel === '' || isDel == null;
    if (normUserId(uid) === id && isActive) {
      userName = usersData[i][1] || '';
      remarks = usersData[i][8] || '';
      break;
    }
  }
  saleSheet.getRange('G5').setValue(userName);
  saleSheet.getRange('H5').setValue(remarks);
}

/**
 * 売却処理の結果を「売却入力」シートの A11 セルに表示する。
 * インストーラブルトリガーでは getUi().alert()/toast() が使えない（実行が中断する）ため、
 * セル書き込みで通知する。setValue はトリガー種別に関わらず動作する。
 */
function saleStatus_(message) {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売却入力');
    if (sh) sh.getRange('A11').setValue(message);
  } catch (e) { /* noop */ }
  try { console.log('[売却] ' + message); } catch (e) {}
}

/**
 * 「確定」前の金額プレビューを A11 に表示する（2026/08/18 星さん依頼）。
 * 売却量(C3:C6)・買取単価(D3:D6) を入力した時点で、貴金属ごとの金額と
 * 合計（税抜・消費税・税込）を計算して表示し、内容を確認してから「確定」できるようにする。
 * ※資産・取引には一切影響しない（表示のみ）。シンプル onEdit から呼ばれる。
 */
function updateSalePreview(saleSheet) {
  try {
    const metalNames = ['金', 'パラジウム', '銀', 'プラチナ'];
    const amounts = saleSheet.getRange('C3:C6').getValues();
    const prices = saleSheet.getRange('D3:D6').getValues();
    const lines = [];
    let subtotal = 0;
    for (let i = 0; i < 4; i++) {
      const amount = parseFloat(amounts[i][0]);
      const price = parseFloat(prices[i][0]);
      if (!amount || amount <= 0 || !price || price <= 0) continue;
      const lineTotal = Math.floor(amount * Math.floor(price));
      subtotal += lineTotal;
      lines.push(`${metalNames[i]}: ${amount}g × ${Math.floor(price).toLocaleString()}円/g = ${lineTotal.toLocaleString()}円`);
    }
    if (lines.length === 0) {
      saleStatus_('売却量と買取単価を入力すると、ここに金額プレビューが表示されます。');
      return;
    }
    const tax = Math.floor(subtotal * 0.1);
    const total = subtotal + tax;
    saleStatus_('🔎【確認】内容がよければ「4. 売却確定」で「確定」を選択してください。\n'
      + lines.join('\n')
      + `\n売却合計(税抜): ${subtotal.toLocaleString()}円 / 消費税: ${tax.toLocaleString()}円 / 合計(税込): ${total.toLocaleString()}円`);
  } catch (e) {
    // プレビュー失敗は本処理に影響させない
  }
}

function processSale() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const saleSheet = ss.getSheetByName('売却入力');
    saleStatus_('⏳ 売却処理中...');
    const usersSheet = ss.getSheetByName('users');
    const assetsSheet = ss.getSheetByName('assets');
    const transactionsSheet = ss.getSheetByName('transactions');

    // 1. 入力値取得
    const saleAmounts = [
      saleSheet.getRange('C3').getValue(),
      saleSheet.getRange('C4').getValue(),
      saleSheet.getRange('C5').getValue(),
      saleSheet.getRange('C6').getValue(),
    ];
    const unitPrices = [
      saleSheet.getRange('D3').getValue(),
      saleSheet.getRange('D4').getValue(),
      saleSheet.getRange('D5').getValue(),
      saleSheet.getRange('D6').getValue(),
    ];
    const selectedUserId = normUserId(saleSheet.getRange('F5').getDisplayValue());

    // 2. バリデーション
    const hasValidAmount = saleAmounts.some(a => a && a > 0);
    if (!hasValidAmount) {
      saleStatus_('❌ エラー: ' + ('売却量を入力してください。'));
      saleSheet.getRange('I5').setValue('未確定');
      return;
    }
    // 売却量がある金属は必ず単価も入れる
    for (let i = 0; i < saleAmounts.length; i++) {
      if (saleAmounts[i] && saleAmounts[i] > 0) {
        if (!unitPrices[i] || unitPrices[i] <= 0) {
          saleStatus_('❌ エラー: ' + ('売却する貴金属には買取単価を入力してください。'));
          saleSheet.getRange('I5').setValue('未確定');
          return;
        }
      }
    }
    if (!selectedUserId) {
      saleStatus_('❌ エラー: ' + ('ユーザーIDを選択してください。'));
      saleSheet.getRange('I5').setValue('未確定');
      return;
    }

    // 3. ユーザー存在確認 + メールアドレス取得
    const usersData = usersSheet.getDataRange().getDisplayValues();
    let userExists = false;
    let userEmail = '';
    let userName = '';
    for (let i = 1; i < usersData.length; i++) {
      const uid = usersData[i][0];
      const isDel = usersData[i][6];
      const isActive = (isDel === false) || (String(isDel).toUpperCase() === 'FALSE') || isDel === '' || isDel == null;
      if (normUserId(uid) === selectedUserId && isActive) {
        userExists = true;
        userName = usersData[i][1] || '';
        userEmail = usersData[i][2] || ''; // C列: email
        break;
      }
    }
    if (!userExists) {
      saleStatus_('❌ エラー: ' + ('選択されたユーザーIDは無効です。'));
      saleSheet.getRange('I5').setValue('未確定');
      return;
    }

    // 4. 保有量チェック（先行チェック: どれか1つでも不足していれば中断）
    const metalNames = ['金', 'パラジウム', '銀', 'プラチナ'];
    const assetsData = assetsSheet.getDataRange().getValues();
    const assetRowMap = {}; // metalName -> { rowIndex: ..., currentAmount: ... }
    for (let i = 0; i < saleAmounts.length; i++) {
      if (!saleAmounts[i] || saleAmounts[i] <= 0) continue;
      const metalName = metalNames[i];
      let found = false;
      for (let j = 1; j < assetsData.length; j++) {
        if (normUserId(assetsData[j][1]) === selectedUserId && assetsData[j][2] === metalName) {
          const currentAmount = parseFloat(assetsData[j][3]) || 0;
          if (currentAmount < saleAmounts[i]) {
            saleStatus_('❌ エラー: ' + (`${metalName}の売却量(${saleAmounts[i]}g)が保有量(${currentAmount}g)を超えています。`));
            saleSheet.getRange('I5').setValue('未確定');
            return;
          }
          assetRowMap[metalName] = { rowIndex: j + 1, currentAmount: currentAmount };
          found = true;
          break;
        }
      }
      if (!found) {
        saleStatus_('❌ エラー: ' + (`ユーザーの${metalName}の資産レコードが見つかりません。`));
        saleSheet.getRange('I5').setValue('未確定');
        return;
      }
    }

    // 5. 日付・取引ID
    const now = new Date();
    const dateInput = saleSheet.getRange('E5').getValue();
    let transactionDate;
    if (dateInput) {
      transactionDate = new Date(dateInput);
      if (isNaN(transactionDate.getTime())) {
        saleStatus_('❌ エラー: ' + ('日付の形式が正しくありません。'));
        saleSheet.getRange('I5').setValue('未確定');
        return;
      }
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (transactionDate > todayEnd) {
        saleStatus_('❌ エラー: ' + ('未来の日付は入力できません。'));
        saleSheet.getRange('I5').setValue('未確定');
        return;
      }
      transactionDate.setHours(0, 0, 0, 0);
    } else {
      transactionDate = now;
    }
    const idTimeString = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
    const transactionId = 'TRS' + idTimeString;
    const dateTimeString = Utilities.formatDate(transactionDate, Session.getScriptTimeZone(), 'yyyy/MM/dd H:mm:ss');
    const assetUpdateTime = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy/MM/dd H:mm:ss');

    // 6. 資産更新 + 取引履歴追加
    const saleLines = [];
    let subtotalAll = 0;
    for (let i = 0; i < saleAmounts.length; i++) {
      if (!saleAmounts[i] || saleAmounts[i] <= 0) continue;
      const metalName = metalNames[i];
      const amount = saleAmounts[i];
      const unitPrice = unitPrices[i];
      const lineTotal = Math.floor(amount * Math.floor(unitPrice));
      subtotalAll += lineTotal;

      // assetsから減算
      const a = assetRowMap[metalName];
      const newAmount = a.currentAmount - amount;
      assetsSheet.getRange(a.rowIndex, 4).setValue(newAmount);
      assetsSheet.getRange(a.rowIndex, 5).setValue(assetUpdateTime);

      // transactions 追加
      const rowValues = [
        transactionId,
        String(selectedUserId),
        '売却',
        metalName,
        amount,
        Math.floor(unitPrice),
        lineTotal,
        '申込済',
        dateTimeString,
        'スクエア合同会社',
      ];
      const row = transactionsSheet.getLastRow() + 1;
      transactionsSheet.getRange(row, 2).setNumberFormat('@');
      transactionsSheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);

      saleLines.push(`${metalName}: ${amount}g × ${Math.floor(unitPrice).toLocaleString()}円/g = ${lineTotal.toLocaleString()}円`);
    }

    const tax = Math.floor(subtotalAll * 0.1);
    const total = subtotalAll + tax;

    // 7. メール送信（ユーザー + 管理者）
    sendSaleCompletionEmails({
      userEmail: userEmail,
      userName: userName,
      userId: selectedUserId,
      saleLines: saleLines,
      subtotal: subtotalAll,
      tax: tax,
      total: total,
      transactionDate: dateTimeString,
      transactionId: transactionId,
    });

    // 8. 入力クリア
    saleSheet.getRange('C3:D6').clearContent();
    saleSheet.getRange('E5:H5').clearContent();
    saleSheet.getRange('I5').setValue('未確定');

    saleStatus_('✅ ' + (`売却処理が完了しました。\n${saleLines.join('\n')}\n売却合計(税抜): ${subtotalAll.toLocaleString()}円 / 消費税: ${tax.toLocaleString()}円 / 合計(税込): ${total.toLocaleString()}円\nユーザー・管理者にメール送信しました。`));
  } catch (error) {
    console.error('売却処理エラー:', error);
    saleStatus_('❌ エラー: ' + ('システムエラーが発生しました:\n' + error.toString()));
    try {
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売却入力').getRange('I5').setValue('未確定');
    } catch (e) { /* noop */ }
  }
}

/**
 * 売却完了メールを送信する
 * GmailApp で送信（スプシオーナーアカウントから）
 */
function sendSaleCompletionEmails(params) {
  const {
    userEmail, userName, userId, saleLines,
    subtotal, tax, total, transactionDate, transactionId,
  } = params;

  const adminEmails = [
    'precious.metal.mine@gmail.com',
    'square.hirata@gmail.com',
    'square_hoshi@outlook.jp',
    'kobesendaikanto@outlook.jp',
  ];

  const detailsBlock = saleLines.join('\n');

  // ユーザー向け
  if (userEmail) {
    const userSubject = '貴金属売却完了のお知らせ';
    const userBody = [
      `${userName} 様`,
      '',
      'Precious Metal Mineをご利用いただきありがとうございます。',
      '以下の内容で貴金属の売却が完了しましたのでお知らせいたします。',
      '',
      '▼ 売却内容',
      detailsBlock,
      '',
      `売却合計金額(税抜): ${subtotal.toLocaleString()}円`,
      `消費税: ${tax.toLocaleString()}円`,
      `総合計(税込): ${total.toLocaleString()}円`,
      '',
      `取引日時: ${transactionDate}`,
      `取引番号: ${transactionId}`,
      '',
      'ご利用ありがとうございました。',
    ].join('\n');

    try {
      GmailApp.sendEmail(userEmail, userSubject, userBody);
    } catch (e) {
      console.error('ユーザーメール送信失敗:', e);
    }
  }

  // 管理者向け
  const adminSubject = '貴金属売却完了（スプシ入力）通知';
  const adminBody = [
    'スプレッドシート入力による売却が完了しました。',
    '',
    '▼ ユーザー',
    `ユーザー名: ${userName}`,
    `ユーザーID: ${userId}`,
    `メール: ${userEmail}`,
    '',
    '▼ 売却内容',
    detailsBlock,
    '',
    `売却合計金額(税抜): ${subtotal.toLocaleString()}円`,
    `消費税: ${tax.toLocaleString()}円`,
    `総合計(税込): ${total.toLocaleString()}円`,
    '',
    `取引日時: ${transactionDate}`,
    `取引番号: ${transactionId}`,
  ].join('\n');

  adminEmails.forEach(addr => {
    try {
      GmailApp.sendEmail(addr, adminSubject, adminBody);
    } catch (e) {
      console.error(`管理者メール送信失敗(${addr}):`, e);
    }
  });
}
