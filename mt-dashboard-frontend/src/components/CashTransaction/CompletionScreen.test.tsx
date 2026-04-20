/** @jest-environment jsdom */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompletionScreen from './CompletionScreen';

function renderAt(state: any) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/completion', state }]}>
      <Routes>
        <Route path="/completion" element={<CompletionScreen />} />
        <Route path="/cash-transaction" element={<div>cash</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CompletionScreen', () => {
  test('見積依頼: 見出し・税抜表記・補足メッセージが表示される', () => {
    renderAt({
      totalAmount: 120000,
      message: '見積もり依頼を受け付けました。',
      transactionType: '見積依頼',
    });
    expect(screen.getByText('見積もり依頼を受け付けました')).toBeInTheDocument();
    expect(screen.getByText(/見積もり依頼金額\(参考・税抜\)/)).toBeInTheDocument();
    expect(screen.getByText(/120,000円/)).toBeInTheDocument();
    expect(screen.getByText(/担当者が内容を確認のうえ/)).toBeInTheDocument();
    expect(screen.getByText('見積もり依頼画面に戻る')).toBeInTheDocument();
  });

  test('預入: 預入完了の表示', () => {
    renderAt({
      totalAmount: 0,
      message: '預入完了',
      transactionType: '預入',
    });
    expect(screen.getByText('決済完了')).toBeInTheDocument();
    expect(screen.getByText(/預入合計金額/)).toBeInTheDocument();
  });
});
