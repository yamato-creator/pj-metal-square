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
  test('売却: 見出し・税抜表記・戻るボタンが表示される', () => {
    renderAt({
      totalAmount: 120000,
      message: '売却が完了しました。',
      transactionType: '売却',
    });
    expect(screen.getByText('売却完了')).toBeInTheDocument();
    expect(screen.getByText(/売却金額\(税抜\)/)).toBeInTheDocument();
    expect(screen.getByText(/120,000円/)).toBeInTheDocument();
    expect(screen.getByText('売却画面に戻る')).toBeInTheDocument();
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
