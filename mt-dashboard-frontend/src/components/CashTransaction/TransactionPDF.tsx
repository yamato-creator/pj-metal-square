import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// フォントの登録
Font.register({
  family: 'NotoSansJP',
  fonts: [
    {
      src: '/fonts/NotoSansJP-Regular.ttf',
      fontWeight: 'normal',
    },
    {
      src: '/fonts/NotoSansJP-Bold.ttf',
      fontWeight: 'bold',
    },
  ],
});

// PDFのスタイル定義
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'NotoSansJP',
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    marginBottom: 30,
    textAlign: 'left',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 10,
  },
  companyInfo: {
    marginBottom: 20,
    textAlign: 'right',
  },
  companyName: {
    fontSize: 14,
    marginBottom: 5,
  },
  registrationNumber: {
    fontSize: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
  },
  customerInfoBox: {
    border: 1,
    borderColor: '#000',
    padding: 10,
    marginBottom: 20,
  },
  customerInfoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  customerLabel: {
    width: 80,
    fontSize: 12,
  },
  customerValue: {
    fontSize: 12,
  },
  transactionInfoBox: {
    border: 1,
    borderColor: '#000',
    padding: 10,
    marginBottom: 20,
  },
  transactionInfoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  transactionLabel: {
    width: 100,
    fontSize: 12,
  },
  transactionValue: {
    fontSize: 12,
  },
  table: {
    border: 1,
    borderColor: '#000',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    padding: 8,
  },
  tableCell: {
    fontSize: 12,
    textAlign: 'center',
  },
  metalNameCell: {
    flex: 2,
    textAlign: 'left',
  },
  amountCell: {
    flex: 1,
    textAlign: 'right',
  },
  unitPriceCell: {
    flex: 1.5,
    textAlign: 'right',
  },
  totalCell: {
    flex: 1.5,
    textAlign: 'right',
  },
  summaryTable: {
    border: 1,
    borderColor: '#000',
    marginLeft: 'auto',
    width: '40%',
  },
  summaryRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    padding: 8,
  },
  summaryRowLast: {
    flexDirection: 'row',
    padding: 8,
  },
  summaryLabel: {
    flex: 2,
    fontSize: 12,
    textAlign: 'left',
  },
  summaryValue: {
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  depositTable: {
    border: 1,
    borderColor: '#000',
    width: '60%',
    marginHorizontal: 'auto',
    marginBottom: 20,
  },
});

interface TransactionPDFProps {
  transaction: {
    id: string;
    date: string;
    company: string;
    items: {
      metalName: string;
      nameJp: string;
      amount: number;
      unitPrice: number;
      total: number;
    }[];
    subtotal: number;
    tax: number;
    total: number;
    transaction_type?: string;
  };
  userId?: string;
  userName?: string;
}

export const TransactionPDF: React.FC<TransactionPDFProps> = ({ transaction, userId, userName }) => {
  const isDeposit = transaction.transaction_type === '預入';
  const isWithdraw = transaction.transaction_type === '現物返却';

  // 日付から取引日（日付のみ）を取得
  const getTransactionDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  // 決済種別を取得
  const getPaymentType = () => {
    if (isWithdraw) return '現物返却';
    return '現金決済';
  };

  // 金属名を日本語に変換（プラチナ→白金）
  const getMetalNameJp = (nameJp: string) => {
    if (nameJp === 'プラチナ') return '白金';
    return nameJp;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.title}>Precious Metal Mine</Text>
          
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>スクエア</Text>
            <Text style={styles.registrationNumber}>(登録番号:)</Text>
          </View>
        </View>

        {/* 取引明細セクション */}
        <Text style={styles.sectionTitle}>取引明細</Text>

        {/* 顧客情報 */}
        <View style={styles.customerInfoBox}>
          <View style={styles.customerInfoRow}>
            <Text style={{ fontSize: 12 }}>お客様ID: {userId || ''}</Text>
          </View>
          <View style={styles.customerInfoRow}>
            <Text style={{ fontSize: 12 }}>お客様名: {userName || ''} 様</Text>
          </View>
        </View>

        {/* 取引情報 */}
        <View style={styles.transactionInfoBox}>
          <View style={styles.transactionInfoRow}>
            <Text style={{ fontSize: 12 }}>注文日: {transaction.date}</Text>
          </View>
          <View style={styles.transactionInfoRow}>
            <Text style={{ fontSize: 12 }}>取引日: {getTransactionDate(transaction.date)}</Text>
          </View>
          <View style={styles.transactionInfoRow}>
            <Text style={{ fontSize: 12 }}>取引番号: {transaction.id}</Text>
          </View>
          <View style={styles.transactionInfoRow}>
            <Text style={{ fontSize: 12 }}>決済種別: {getPaymentType()}</Text>
          </View>
          <View style={styles.transactionInfoRow}>
            <Text style={{ fontSize: 12 }}>決済状態: 確定</Text>
          </View>
        </View>

        {/* 取引明細テーブル */}
        {isDeposit ? (
          <View style={styles.depositTable}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableCell, ...styles.metalNameCell }}>貴金属名</Text>
              <Text style={{ ...styles.tableCell, ...styles.amountCell }}>預入量</Text>
            </View>
            {transaction.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={{ ...styles.tableCell, ...styles.metalNameCell }}>
                  {item.metalName}({getMetalNameJp(item.nameJp)})
                </Text>
                <Text style={{ ...styles.tableCell, ...styles.amountCell }}>
                  {item.amount.toFixed(2)}g
                </Text>
              </View>
            ))}
          </View>
        ) : isWithdraw ? (
          <View style={styles.depositTable}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.tableCell, ...styles.metalNameCell }}>貴金属名</Text>
              <Text style={{ ...styles.tableCell, ...styles.amountCell }}>返却量</Text>
            </View>
            {transaction.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={{ ...styles.tableCell, ...styles.metalNameCell }}>
                  {item.metalName}({getMetalNameJp(item.nameJp)})
                </Text>
                <Text style={{ ...styles.tableCell, ...styles.amountCell }}>
                  {item.amount.toFixed(2)}g
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableCell, ...styles.metalNameCell }}>貴金属名</Text>
                <Text style={{ ...styles.tableCell, ...styles.amountCell }}>売却量</Text>
                <Text style={{ ...styles.tableCell, ...styles.unitPriceCell }}>買取価格(税抜)</Text>
                <Text style={{ ...styles.tableCell, ...styles.totalCell }}>金額(税抜)</Text>
              </View>
              {transaction.items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, ...styles.metalNameCell }}>
                    {item.metalName}({getMetalNameJp(item.nameJp)})
                  </Text>
                  <Text style={{ ...styles.tableCell, ...styles.amountCell }}>
                    {item.amount.toFixed(2)}g
                  </Text>
                  <Text style={{ ...styles.tableCell, ...styles.unitPriceCell }}>
                    {Math.floor(item.unitPrice).toLocaleString()}円/g
                  </Text>
                  <Text style={{ ...styles.tableCell, ...styles.totalCell }}>
                    {Math.floor(item.total).toLocaleString()}円
                  </Text>
                </View>
              ))}
            </View>

            {/* 合計金額セクション */}
            <View style={styles.summaryTable}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>小計(税抜)</Text>
                <Text style={styles.summaryValue}>{transaction.subtotal.toLocaleString()}円</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>適用税率 10% 消費税</Text>
                <Text style={styles.summaryValue}>{transaction.tax.toLocaleString()}円</Text>
              </View>
              <View style={styles.summaryRowLast}>
                <Text style={styles.summaryLabel}>合計(税込)</Text>
                <Text style={styles.summaryValue}>{transaction.total.toLocaleString()}円</Text>
              </View>
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}; 