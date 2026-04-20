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
    if (inputValue === '' || inputValue === null) return;

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

  // 確定実行 (I5)
  if (range.getA1Notation() === 'I5' && e.value === '確定') {
    Utilities.sleep(100);
    processSale();
  }
}

function updateSaleUserInfo(saleSheet, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = ss.getSheetByName('users');
  const id = (userId ?? '').toString().trim();
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
    if (uid === id && isActive) {
      userName = usersData[i][1] || '';
      remarks = usersData[i][8] || '';
      break;
    }
  }
  saleSheet.getRange('G5').setValue(userName);
  saleSheet.getRange('H5').setValue(remarks);
}

function processSale() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const saleSheet = ss.getSheetByName('売却入力');
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
    const selectedUserId = saleSheet.getRange('F5').getDisplayValue().trim();

    // 2. バリデーション
    const hasValidAmount = saleAmounts.some(a => a && a > 0);
    if (!hasValidAmount) {
      SpreadsheetApp.getUi().alert('エラー', '売却量を入力してください。', SpreadsheetApp.getUi().ButtonSet.OK);
      saleSheet.getRange('I5').setValue('未確定');
      return;
    }
    // 売却量がある金属は必ず単価も入れる
    for (let i = 0; i < saleAmounts.length; i++) {
      if (saleAmounts[i] && saleAmounts[i] > 0) {
        if (!unitPrices[i] || unitPrices[i] <= 0) {
          SpreadsheetApp.getUi().alert('エラー', '売却する貴金属には買取単価を入力してください。', SpreadsheetApp.getUi().ButtonSet.OK);
          saleSheet.getRange('I5').setValue('未確定');
          return;
        }
      }
    }
    if (!selectedUserId) {
      SpreadsheetApp.getUi().alert('エラー', 'ユーザーIDを選択してください。', SpreadsheetApp.getUi().ButtonSet.OK);
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
      if (uid === selectedUserId && isActive) {
        userExists = true;
        userName = usersData[i][1] || '';
        userEmail = usersData[i][2] || ''; // C列: email
        break;
      }
    }
    if (!userExists) {
      SpreadsheetApp.getUi().alert('エラー', '選択されたユーザーIDは無効です。', SpreadsheetApp.getUi().ButtonSet.OK);
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
        if (assetsData[j][1] === selectedUserId && assetsData[j][2] === metalName) {
          const currentAmount = parseFloat(assetsData[j][3]) || 0;
          if (currentAmount < saleAmounts[i]) {
            SpreadsheetApp.getUi().alert('エラー', `${metalName}の売却量(${saleAmounts[i]}g)が保有量(${currentAmount}g)を超えています。`, SpreadsheetApp.getUi().ButtonSet.OK);
            saleSheet.getRange('I5').setValue('未確定');
            return;
          }
          assetRowMap[metalName] = { rowIndex: j + 1, currentAmount: currentAmount };
          found = true;
          break;
        }
      }
      if (!found) {
        SpreadsheetApp.getUi().alert('エラー', `ユーザーの${metalName}の資産レコードが見つかりません。`, SpreadsheetApp.getUi().ButtonSet.OK);
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
        SpreadsheetApp.getUi().alert('エラー', '日付の形式が正しくありません。', SpreadsheetApp.getUi().ButtonSet.OK);
        saleSheet.getRange('I5').setValue('未確定');
        return;
      }
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      if (transactionDate > todayEnd) {
        SpreadsheetApp.getUi().alert('エラー', '未来の日付は入力できません。', SpreadsheetApp.getUi().ButtonSet.OK);
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

    SpreadsheetApp.getUi().alert('成功', `売却処理が完了しました。\n\n合計: ${subtotalAll.toLocaleString()}円（税込 ${total.toLocaleString()}円）\n\nユーザー・管理者にメール送信しました。`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    console.error('売却処理エラー:', error);
    SpreadsheetApp.getUi().alert('エラー', 'システムエラーが発生しました:\n' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
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
