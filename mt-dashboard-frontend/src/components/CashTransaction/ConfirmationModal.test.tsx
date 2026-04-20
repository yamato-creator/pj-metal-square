/** @jest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmationModal from './ConfirmationModal';

const saleItems = [
  { metalName: 'Au', nameJp: '金', amount: 10, unitPrice: 12000, total: 120000 },
];

describe('ConfirmationModal', () => {
  test('売却(見積依頼)時は「見積もり依頼を送信」ボタンと参考税抜表記になる', () => {
    render(
      <ConfirmationModal
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
        saleItems={saleItems}
        totalAmount={120000}
      />
    );
    expect(screen.getByText('見積もり依頼内容の確認')).toBeInTheDocument();
    expect(screen.getByText(/見積もり依頼金額\(参考・税抜\)/)).toBeInTheDocument();
    expect(screen.getByText('見積もり依頼を送信')).toBeInTheDocument();
    // 税抜の金額がそのまま出ること（表+合計で複数）
    const matches = screen.getAllByText(/120,000円/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  test('預入時は従来の「預入を完了する」ボタンになる', () => {
    render(
      <ConfirmationModal
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
        saleItems={saleItems}
        totalAmount={120000}
        isDeposit
      />
    );
    expect(screen.getByText('預入を完了する')).toBeInTheDocument();
    expect(screen.getByText(/預入合計金額:/)).toBeInTheDocument();
  });

  test('現物返却時は従来の「現物返却を完了する」ボタン + 返却量ラベル', () => {
    render(
      <ConfirmationModal
        isOpen
        onClose={() => {}}
        onConfirm={() => {}}
        saleItems={saleItems}
        totalAmount={0}
        isWithdraw
        hideAmount
      />
    );
    expect(screen.getByText('現物返却を完了する')).toBeInTheDocument();
    expect(screen.getByText(/返却量/)).toBeInTheDocument();
  });
});
