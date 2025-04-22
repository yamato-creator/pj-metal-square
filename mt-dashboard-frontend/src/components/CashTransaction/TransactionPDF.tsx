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
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  dateCompany: {
    marginBottom: 10,
  },
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  metalName: {
    flex: 2,
  },
  amount: {
    flex: 1,
    textAlign: 'right',
  },
  unitPrice: {
    flex: 1,
    textAlign: 'right',
  },
  total: {
    flex: 1,
    textAlign: 'right',
  },
  summary: {
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  summaryLabel: {
    width: 100,
  },
  summaryValue: {
    width: 100,
    textAlign: 'right',
  },
  depositTable: {
    width: '60%',
    marginHorizontal: 'auto',
    marginBottom: 20,
  },
});

interface TransactionPDFProps {
  transaction: {
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
}

export const TransactionPDF: React.FC<TransactionPDFProps> = ({ transaction, userId }) => {
  const isDeposit = transaction.transaction_type === '預入';
  const isWithdraw = transaction.transaction_type === '現物返却';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>決済履歴</Text>
          <View style={styles.dateCompany}>
            <Text>取引日時: {transaction.date}</Text>
            <Text>取引会社: {transaction.company}</Text>
            {transaction.transaction_type && (
              <Text>
                取引種類: {transaction.transaction_type}
              </Text>
            )}
            {userId && (
              <Text>
                ユーザーID: {userId}
              </Text>
            )}
          </View>
        </View>

        {isDeposit ? (
          <View style={styles.depositTable}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.metalName, flex: 3 }}>金属名</Text>
              <Text style={{ ...styles.amount, flex: 1 }}>預入量</Text>
            </View>

            {transaction.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={{ ...styles.metalName, flex: 3 }}>
                  {item.metalName} {item.nameJp}
                </Text>
                <Text style={{ ...styles.amount, flex: 1 }}>
                  {item.amount.toFixed(2)}g
                </Text>
              </View>
            ))}
          </View>
        ) : isWithdraw ? (
          <View style={styles.depositTable}>
            <View style={styles.tableHeader}>
              <Text style={{ ...styles.metalName, flex: 3 }}>金属名</Text>
              <Text style={{ ...styles.amount, flex: 1 }}>返却量</Text>
            </View>

            {transaction.items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={{ ...styles.metalName, flex: 3 }}>
                  {item.metalName} {item.nameJp}
                </Text>
                <Text style={{ ...styles.amount, flex: 1 }}>
                  {item.amount.toFixed(2)}g
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.metalName}>金属名</Text>
                <Text style={styles.amount}>売却量</Text>
                <Text style={styles.unitPrice}>買取価格(税抜)</Text>
                <Text style={styles.total}>金額</Text>
              </View>

              {transaction.items.map((item, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.metalName}>
                    {item.metalName} {item.nameJp}
                  </Text>
                  <Text style={styles.amount}>
                    {item.amount.toFixed(2)}g
                  </Text>
                  <Text style={styles.unitPrice}>
                    {Math.floor(item.unitPrice).toLocaleString()}円/g
                  </Text>
                  <Text style={styles.total}>
                    {Math.floor(item.total).toLocaleString()}円
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>小計</Text>
                <Text style={styles.summaryValue}>
                  {transaction.subtotal.toLocaleString()}円
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>消費税（10%）</Text>
                <Text style={styles.summaryValue}>
                  {Math.floor(transaction.tax).toLocaleString()}円
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>合計</Text>
                <Text style={styles.summaryValue}>
                  {transaction.total.toLocaleString()}円
                </Text>
              </View>
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}; 