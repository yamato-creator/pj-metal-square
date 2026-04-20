/**
 * ===================================================================
 * 🏅 田中貴金属価格自動取得・更新システム v2.0
 * ===================================================================
 *
 * 【変更履歴】
 * • v1.0 初期バージョン
 * • v1.1 再試行機能追加
 * • v1.2 土日スキップ機能追加
 * • v1.3 9:30件名の場合のみ履歴追加機能
 * • v2.0 受信ベース化（20分ポーリング）+ 訂正メール対応 + 全メール履歴追加
 *
 * 【v2.0 変更点】
 * • 固定時刻トリガー（9:58/14:28）→ 20分間隔ポーリングに変更
 * • メールID管理で重複処理を防止
 * • 訂正メール検知（件名に「訂正」「修正」「再送」）→ 最新履歴行を上書き
 * • 午前・午後問わず全メールで履歴追加
 * • 営業時間外（8時前/18時以降）は自動スキップ
 *
 * 【セットアップ方法】
 * 1. このコードをApps Scriptに貼り付け
 * 2. Advanced Google Services で「Google Drive API」を有効化
 * 3. setupPollingTrigger() を一度実行してトリガー設定
 */

// ───── 設定箇所 ────────────────────────────────────────
const SPREADSHEET_ID = '1WoBLYqZojno8_DVGvkeeCmloJAXJWMXVQ9wcgcLDxLM';
const SHEET_NAME     = 'metal-prices';
const GMAIL_SUBJECT  = '貴金属相場のご連絡';
const SENDER_EMAIL   = 'tanaka-souba@ml.tanaka.co.jp';
const RECIPIENT_EMAIL = 'suquare.metal@gmail.com';
// ────────────────────────────────────────────────────────

/**
 * 土日かどうかをチェック
 */
function isWeekend(date = new Date()) {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    Logger.log(`📅 土日のためスキップ: ${Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd (E)')}`);
    return true;
  }
  return false;
}

// ===================================================================
// メイン処理: 20分間隔ポーリング
// ===================================================================

/**
 * 20分間隔で呼ばれるメイン関数
 * 未処理の田中貴金属メールを検索し、価格を更新する
 */
function checkNewEmails() {
  Logger.log('======== checkNewEmails start ========');

  try {
    // 営業時間外スキップ（8時前/18時以降）
    const now = new Date();
    const hour = parseInt(Utilities.formatDate(now, 'Asia/Tokyo', 'H'));

    if (hour < 8 || hour >= 18) {
      Logger.log('⏭️ 営業時間外のためスキップ: ' + hour + '時');
      return;
    }

    // 土日スキップ
    if (isWeekend()) {
      Logger.log('⏭️ 土日のため処理をスキップします');
      return;
    }

    // 今日の日付で田中貴金属メールを検索
    const today = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy/MM/dd');
    const query = `from:${SENDER_EMAIL} subject:"${today}" subject:"${GMAIL_SUBJECT}" has:attachment newer_than:1d`;
    Logger.log('Gmail検索クエリ: ' + query);

    const threads = GmailApp.search(query, 0, 10);

    if (threads.length === 0) {
      Logger.log('📭 新着メールなし');
      return;
    }

    Logger.log(`${threads.length}件のスレッドが見つかりました`);

    // 各メッセージを処理
    for (const thread of threads) {
      const messages = thread.getMessages();
      for (const message of messages) {
        const messageId = message.getId();

        // 処理済みチェック
        if (isMessageProcessed(messageId)) {
          continue;
        }

        Logger.log('📩 未処理メール発見: ' + message.getSubject());

        // PDF取得
        const pdfBlob = findPdfAttachment(message);
        if (!pdfBlob) {
          Logger.log('PDF添付なし、スキップ');
          continue;
        }

        // 価格抽出
        const priceData = extractPricesFromPdf(pdfBlob);
        if (!priceData) {
          Logger.log('❌ 価格抽出失敗');
          continue;
        }

        Logger.log('抽出された価格: ' + JSON.stringify(priceData));

        // 訂正メールチェック
        const subject = message.getSubject();
        const correction = isCorrection(subject);

        // スプレッドシート更新
        if (correction) {
          Logger.log('🔄 訂正メール検出 → 最新履歴を上書き');
          updateSpreadsheetWithCorrection(priceData);
        } else {
          Logger.log('📝 通常メール → 履歴追加');
          updateSpreadsheet(priceData, true);
        }

        // 処理済みとして記録
        addProcessedMessageId(messageId);
        Logger.log('✅ 処理完了: ' + messageId);
      }
    }

  } catch (error) {
    Logger.log('‼️Error: ' + error);
    sendErrorNotification(error.toString());
  } finally {
    Logger.log('======== checkNewEmails end ========');
  }
}

// ===================================================================
// 処理済みメールID管理
// ===================================================================

function getProcessedMessageIds() {
  const props = PropertiesService.getScriptProperties();
  const ids = props.getProperty('PROCESSED_MESSAGE_IDS');
  return ids ? JSON.parse(ids) : [];
}

function addProcessedMessageId(messageId) {
  const ids = getProcessedMessageIds();
  ids.push(messageId);
  // 最新100件のみ保持（古いIDは削除してストレージ節約）
  const trimmed = ids.slice(-100);
  PropertiesService.getScriptProperties().setProperty(
    'PROCESSED_MESSAGE_IDS',
    JSON.stringify(trimmed)
  );
}

function isMessageProcessed(messageId) {
  return getProcessedMessageIds().includes(messageId);
}

// ===================================================================
// 訂正メール対応
// ===================================================================

/**
 * 訂正メールかどうかを判定
 */
function isCorrection(subject) {
  return subject.includes('訂正') || subject.includes('修正') || subject.includes('再送');
}

/**
 * 訂正メール用: 最新価格を更新し、最新の履歴行（10行目）を上書き
 */
function updateSpreadsheetWithCorrection(priceData) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`"${SHEET_NAME}"シートが見つかりません`);
    }

    const timestamp = Utilities.formatDate(priceData.date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    const today = Utilities.formatDate(priceData.date, 'Asia/Tokyo', 'yyyy/MM/dd');

    // 最新価格を更新（C2:C5）
    if (priceData.au !== null) {
      sheet.getRange('C2').setValue(priceData.au);
      sheet.getRange('E2').setValue(timestamp);
    }
    if (priceData.pt !== null) {
      sheet.getRange('C3').setValue(priceData.pt);
      sheet.getRange('E3').setValue(timestamp);
    }
    if (priceData.pd !== null) {
      sheet.getRange('C4').setValue(priceData.pd);
      sheet.getRange('E4').setValue(timestamp);
    }
    if (priceData.ag !== null) {
      sheet.getRange('C5').setValue(priceData.ag);
      sheet.getRange('E5').setValue(timestamp);
    }

    // 最新の履歴行（10行目）を上書き（新規行挿入ではない）
    const currentPrices = sheet.getRange('C2:C5').getValues().flat();
    const correctedData = [today, currentPrices[0], currentPrices[1], currentPrices[2], currentPrices[3], timestamp];
    sheet.getRange(10, 1, 1, 6).setValues([correctedData]);

    Logger.log('✅ 訂正メール処理完了: 履歴行10を上書き');

  } catch (error) {
    Logger.log('訂正メール処理エラー: ' + error);
    throw error;
  }
}

// ===================================================================
// PDF解析・価格抽出（既存ロジック維持）
// ===================================================================

/**
 * PDF添付ファイルを検索
 */
function findPdfAttachment(message) {
  const attachments = message.getAttachments();
  return attachments.find(att => {
    const contentType = att.getContentType();
    const name = att.getName();
    return contentType === 'application/pdf' ||
           contentType.includes('pdf') ||
           name.toLowerCase().endsWith('.pdf');
  });
}

/**
 * PDFから価格データを抽出
 */
function extractPricesFromPdf(pdfBlob) {
  let tempFileId = null;
  let docFileId = null;
  let ocrDocId = null;

  try {
    Logger.log('→PDF解析開始');

    const tempFile = DriveApp.createFile(pdfBlob);
    tempFileId = tempFile.getId();

    const docFile = DriveApp.createFile(tempFile.getBlob().setName('temp_ocr_' + Date.now() + '.pdf'));
    docFileId = docFile.getId();

    const resource = {
      title: 'OCR_' + Date.now(),
      mimeType: MimeType.GOOGLE_DOCS
    };

    const ocrDoc = Drive.Files.copy(resource, docFileId, {
      ocr: true,
      ocrLanguage: 'ja'
    });
    ocrDocId = ocrDoc.id;
    Logger.log('→OCR処理完了');

    const doc = DocumentApp.openById(ocrDocId);
    const docText = doc.getBody().getText();
    Logger.log('→抽出テキスト長: %d文字', docText.length);

    const priceData = extractAccuratePricesAndCreateTable(doc, docText);
    return priceData;

  } catch (error) {
    Logger.log('PDF処理エラー: ' + error);
    return null;
  } finally {
    try {
      if (tempFileId) DriveApp.getFileById(tempFileId).setTrashed(true);
      if (docFileId) DriveApp.getFileById(docFileId).setTrashed(true);
      if (ocrDocId) DriveApp.getFileById(ocrDocId).setTrashed(true);
      Logger.log('→一時ファイルを削除');
    } catch (cleanupError) {
      Logger.log('ファイル削除エラー: ' + cleanupError);
    }
  }
}

/**
 * 正確な価格抽出とドキュメント表作成
 */
function extractAccuratePricesAndCreateTable(doc, ocrText) {
  const prices = {
    pt: null,
    au: null,
    ag: null,
    pd: null,
    date: new Date()
  };

  try {
    Logger.log('→正確な価格抽出開始');

    const extractedData = parseAccuratePriceStructure(ocrText);
    Logger.log('→正確に抽出されたデータ: %s', JSON.stringify(extractedData));

    if (extractedData.pt && extractedData.pt.buyIndustrialPrice !== null) {
      prices.pt = extractedData.pt.buyIndustrialPrice;
    }
    if (extractedData.au && extractedData.au.buyIndustrialPrice !== null) {
      prices.au = extractedData.au.buyIndustrialPrice;
    }
    if (extractedData.ag && extractedData.ag.buyIndustrialPrice !== null) {
      prices.ag = extractedData.ag.buyIndustrialPrice;
    }
    if (extractedData.pd && extractedData.pd.buyIndustrialPrice !== null) {
      prices.pd = extractedData.pd.buyIndustrialPrice;
    }

    createAccurateTable(doc, extractedData);

    Logger.log('→最終価格抽出結果: %s', JSON.stringify(prices));
    return prices;

  } catch (error) {
    Logger.log('正確な価格抽出エラー: ' + error);
    return null;
  }
}

/**
 * OCRテキストから田中貴金属の正確な価格構造を解析
 */
function parseAccuratePriceStructure(text) {
  const extractedData = {
    pt: { retailPrice: null, buyPrice: null, sellPrice: null, buyIndustrialPrice: null },
    au: { retailPrice: null, buyPrice: null, sellPrice: null, buyIndustrialPrice: null },
    ag: { retailPrice: null, buyPrice: null, sellPrice: null, buyIndustrialPrice: null },
    pd: { retailPrice: null, buyPrice: null, sellPrice: null, buyIndustrialPrice: null }
  };

  try {
    Logger.log('→OCR価格構造解析開始');

    const priceSection = extractPriceSectionAccurate(text);
    if (!priceSection) {
      Logger.log('→価格セクションが見つかりません');
      return extractedData;
    }

    Logger.log('→価格セクション: %s', priceSection);

    const allNumbers = priceSection.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g);
    if (!allNumbers) {
      Logger.log('→数値が見つかりません');
      return extractedData;
    }

    const numericValues = allNumbers.map(n => parseFloat(n.replace(/,/g, '')));
    Logger.log('→抽出された全数値: [%s]', numericValues.join(', '));

    if (numericValues.length >= 15) {
      extractedData.pt.retailPrice = numericValues[0];
      extractedData.pt.buyPrice = numericValues[1];
      extractedData.au.retailPrice = numericValues[2];
      extractedData.au.buyPrice = numericValues[3];
      extractedData.ag.retailPrice = numericValues[4];
      extractedData.ag.buyPrice = numericValues[5];
      extractedData.pd.buyPrice = numericValues[6];

      extractedData.pt.sellPrice = numericValues[7];
      extractedData.pt.buyIndustrialPrice = numericValues[8];
      extractedData.au.sellPrice = numericValues[9];
      extractedData.au.buyIndustrialPrice = numericValues[10];
      extractedData.ag.sellPrice = numericValues[11];
      extractedData.ag.buyIndustrialPrice = numericValues[12];
      extractedData.pd.sellPrice = numericValues[13];
      extractedData.pd.buyIndustrialPrice = numericValues[14];

      Logger.log('→Pt工業レート税抜(買い): %s', extractedData.pt.buyIndustrialPrice);
      Logger.log('→Au工業レート税抜(買い): %s', extractedData.au.buyIndustrialPrice);
      Logger.log('→Ag工業レート税抜(買い): %s', extractedData.ag.buyIndustrialPrice);
      Logger.log('→Pd工業レート税抜(買い): %s', extractedData.pd.buyIndustrialPrice);
    } else {
      Logger.log('→数値の数が不足しています: %d個 (最低15個必要)', numericValues.length);
    }

    return extractedData;

  } catch (error) {
    Logger.log('価格構造解析エラー: ' + error);
    return extractedData;
  }
}

/**
 * 価格セクションを正確に抽出
 */
function extractPriceSectionAccurate(text) {
  try {
    const patterns = [
      /税抜参考小売価格.*?税込買取価格.*?税抜.*?売り.*?Ｐ\s*ｔ.*?税抜.*?買い.*?(?=\[２\]|$)/s,
      /Ｐ\s*ｔ.*?税抜.*?買い.*?Ａ\s*ｕ.*?Ａ\s*ｇ.*?Ｐ\s*ｄ.*?(?=\[２\]|$)/s
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        Logger.log('→価格セクション抽出成功（パターンマッチ）');
        return match[0];
      }
    }

    Logger.log('→フォールバック: 数値密度による抽出');
    const lines = text.split(/[\r\n]+/);
    let bestSection = '';
    let maxNumbers = 0;

    for (let i = 0; i < lines.length - 5; i++) {
      const section = lines.slice(i, i + 6).join(' ');
      const numbers = section.match(/\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g);
      if (numbers && numbers.length > maxNumbers) {
        maxNumbers = numbers.length;
        bestSection = section;
      }
    }

    if (bestSection) {
      Logger.log('→数値密度による抽出成功: %d個の数値', maxNumbers);
      return bestSection;
    }

    return null;

  } catch (error) {
    Logger.log('価格セクション抽出エラー: ' + error);
    return null;
  }
}

/**
 * ドキュメントに正確な表を作成
 */
function createAccurateTable(doc, extractedData) {
  try {
    Logger.log('→正確な表作成開始');

    const body = doc.getBody();

    body.appendParagraph('\n\n【田中貴金属 貴金属相場表】');
    body.appendParagraph('抽出日時: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日 HH:mm:ss'));

    const tableData = [
      ['品種', '税抜参考小売価格', '税込買取価格', '工業レート税抜(売り)', '工業レート税抜(買い)']
    ];

    ['pt', 'au', 'ag', 'pd'].forEach(metal => {
      const data = extractedData[metal];
      const row = [
        metal.toUpperCase(),
        data.retailPrice !== null ? data.retailPrice.toString() : '-',
        data.buyPrice !== null ? data.buyPrice.toString() : '-',
        data.sellPrice !== null ? data.sellPrice.toString() : '-',
        data.buyIndustrialPrice !== null ? data.buyIndustrialPrice.toString() : '-'
      ];
      tableData.push(row);
    });

    const table = body.appendTable(tableData);
    styleAccurateTable(table);

    Logger.log('→正確な表作成完了');

  } catch (error) {
    Logger.log('表作成エラー: ' + error);
  }
}

/**
 * 表にスタイルを適用
 */
function styleAccurateTable(table) {
  try {
    const headerRow = table.getRow(0);
    for (let col = 0; col < headerRow.getNumCells(); col++) {
      const cell = headerRow.getCell(col);
      cell.setBackgroundColor('#4a90e2');
      cell.getChild(0).asParagraph().getChild(0).asText().setBold(true).setForegroundColor('#ffffff');
      cell.setPaddingTop(8);
      cell.setPaddingBottom(8);
      cell.setPaddingLeft(10);
      cell.setPaddingRight(10);
    }

    for (let row = 1; row < table.getNumRows(); row++) {
      for (let col = 0; col < table.getRow(row).getNumCells(); col++) {
        const cell = table.getCell(row, col);
        cell.setPaddingTop(5);
        cell.setPaddingBottom(5);
        cell.setPaddingLeft(10);
        cell.setPaddingRight(10);

        if (col === 0) {
          cell.setBackgroundColor('#f0f8ff');
          cell.getChild(0).asParagraph().getChild(0).asText().setBold(true);
        } else if (col === 4) {
          cell.setBackgroundColor('#fff2cc');
          cell.getChild(0).asParagraph().getChild(0).asText().setBold(true).setForegroundColor('#d4851f');
        } else if (row % 2 === 0) {
          cell.setBackgroundColor('#f9f9f9');
        }
      }
    }

    table.setBorderWidth(1);
    table.setBorderColor('#cccccc');

  } catch (error) {
    Logger.log('表スタイル適用エラー: ' + error);
  }
}

// ===================================================================
// スプレッドシート更新（通常）
// ===================================================================

/**
 * スプレッドシートを更新（全メールで履歴追加）
 */
function updateSpreadsheet(priceData, shouldAddHistory = true) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      throw new Error(`"${SHEET_NAME}"シートが見つかりません`);
    }

    const timestamp = Utilities.formatDate(priceData.date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    const today = Utilities.formatDate(priceData.date, 'Asia/Tokyo', 'yyyy/MM/dd');

    // 現在価格を更新（C2:C5）
    if (priceData.au !== null) {
      sheet.getRange('C2').setValue(priceData.au);
      sheet.getRange('E2').setValue(timestamp);
      Logger.log(`→金価格を更新: ${priceData.au}`);
    }
    if (priceData.pt !== null) {
      sheet.getRange('C3').setValue(priceData.pt);
      sheet.getRange('E3').setValue(timestamp);
      Logger.log(`→プラチナ価格を更新: ${priceData.pt}`);
    }
    if (priceData.pd !== null) {
      sheet.getRange('C4').setValue(priceData.pd);
      sheet.getRange('E4').setValue(timestamp);
      Logger.log(`→パラジウム価格を更新: ${priceData.pd}`);
    }
    if (priceData.ag !== null) {
      sheet.getRange('C5').setValue(priceData.ag);
      sheet.getRange('E5').setValue(timestamp);
      Logger.log(`→銀価格を更新: ${priceData.ag}`);
    }

    // 履歴追加
    if (shouldAddHistory) {
      Logger.log('→履歴を追加します');

      // 10行目の上に新しい行を挿入
      sheet.insertRowBefore(10);

      const currentPrices = sheet.getRange('C2:C5').getValues().flat();
      const newRowData = [
        today,
        currentPrices[0], // 金
        currentPrices[1], // プラチナ
        currentPrices[2], // パラジウム
        currentPrices[3], // 銀
        timestamp
      ];

      sheet.getRange(10, 1, 1, 6).setValues([newRowData]);
      Logger.log('→履歴データを追加: %s', JSON.stringify(newRowData));
    }

    Logger.log('スプレッドシートの更新が完了しました');

  } catch (error) {
    Logger.log('スプレッドシート更新エラー: ' + error);
    throw error;
  }
}

// ===================================================================
// トリガー管理
// ===================================================================

/**
 * 20分間隔ポーリングトリガーを設定（初回セットアップ用）
 */
function setupPollingTrigger() {
  // 既存のトリガーをすべて削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    ScriptApp.deleteTrigger(t);
    Logger.log(`→既存トリガー削除: ${t.getHandlerFunction()} (ID: ${t.getUniqueId()})`);
  });

  // 20分間隔トリガーを作成
  ScriptApp.newTrigger('checkNewEmails')
    .timeBased()
    .everyMinutes(15)
    .create();

  Logger.log('✅ 15分ポーリングトリガーを作成しました');
  Logger.log('営業時間（平日8:00-18:00）のみ処理を実行します');
}

// ===================================================================
// エラー通知
// ===================================================================

/**
 * エラー通知メール送信
 */
function sendErrorNotification(errorMessage) {
  try {
    const currentTime = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    GmailApp.sendEmail(
      RECIPIENT_EMAIL,
      '【エラー】貴金属価格更新処理',
      `価格更新処理でエラーが発生しました（メールが届かない祝日は必ずエラーが発生します）：\n\n${errorMessage}\n\n時刻: ${currentTime}`
    );
    Logger.log('エラー通知メールを送信しました');
  } catch (error) {
    Logger.log('エラー通知送信失敗: ' + error);
  }
}

// ===================================================================
// テスト・ユーティリティ関数
// ===================================================================

/**
 * 手動テスト: checkNewEmails を実行
 */
function testCheckNewEmails() {
  Logger.log('=== checkNewEmails テスト ===');
  checkNewEmails();
}

/**
 * 処理済みメールIDをリセット（デバッグ用）
 */
function resetProcessedMessageIds() {
  PropertiesService.getScriptProperties().deleteProperty('PROCESSED_MESSAGE_IDS');
  Logger.log('✅ 処理済みメールIDをリセットしました');
}

/**
 * 処理済みメールIDの状態確認
 */
function checkProcessedStatus() {
  const ids = getProcessedMessageIds();
  Logger.log('=== 処理済みメールID ===');
  Logger.log(`件数: ${ids.length}`);
  ids.forEach((id, i) => Logger.log(`  ${i + 1}. ${id}`));
}
