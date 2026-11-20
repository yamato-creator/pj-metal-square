import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WithdrawTransactionForm from './WithdrawTransactionForm';

// 2026/11/20 星さん: 現物返却は50g以上・小数も可（50.01g など）
const metals = [{ name: 'Au', nameJp: '金', amount: 123.45, unitPrice: 0 }];

const setup = () => {
  render(
    <MemoryRouter>
      <WithdrawTransactionForm metals={metals} onWithdraw={jest.fn()} />
    </MemoryRouter>
  );
  return screen.getByRole('spinbutton') as HTMLInputElement;
};

test('小数（50.03g）を入力できる', () => {
  const input = setup();
  fireEvent.change(input, { target: { value: '50.03' } });
  fireEvent.blur(input);
  expect(input.value).toBe('50.03');
});

test('小数点以下3桁目は切り詰める', () => {
  const input = setup();
  fireEvent.change(input, { target: { value: '50.039' } });
  expect(input.value).toBe('50.03');
});

test('保有量を超えたら保有量（123.45g）に合わせる', () => {
  const input = setup();
  fireEvent.change(input, { target: { value: '200' } });
  fireEvent.blur(input);
  expect(input.value).toBe('123.45');
});
