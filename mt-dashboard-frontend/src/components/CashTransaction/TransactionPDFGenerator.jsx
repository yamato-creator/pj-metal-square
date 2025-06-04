import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { TransactionPDF } from './TransactionPDF';

const TransactionPDFGenerator = ({ transaction, className, userId, userName }) => {
  const generateFileName = () => {
    const date = new Date(transaction.date);
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    const dateStr = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    return `statement-${dateStr}.pdf`;
  };

  return (
    <PDFDownloadLink
      document={<TransactionPDF transaction={transaction} userId={userId} userName={userName} />}
      fileName={generateFileName()}
    >
      {({ loading, error }) => (
        <button className={className}>
          {error ? 'エラーが発生しました' : (loading ? 'PDF生成中...' : 'PDF出力')}
        </button>
      )}
    </PDFDownloadLink>
  );
};

export default TransactionPDFGenerator; 