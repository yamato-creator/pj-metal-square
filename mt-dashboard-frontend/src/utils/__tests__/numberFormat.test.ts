import {
  floorToTwoDecimals,
  formatGrams,
  formatYen,
  calcSubtotal,
  calcTax,
} from '../numberFormat';

describe('floorToTwoDecimals', () => {
  test('整数 → 同じ', () => {
    expect(floorToTwoDecimals(10)).toBe(10);
  });
  test('小数3桁 → 2桁切り捨て', () => {
    expect(floorToTwoDecimals(1.239)).toBe(1.23);
  });
  test('浮動小数誤差を吸収する', () => {
    // 0.1 + 0.2 = 0.30000000000000004 だが切り捨て後は 0.30
    expect(floorToTwoDecimals(0.1 + 0.2)).toBe(0.3);
  });
  test('文字列入力', () => {
    expect(floorToTwoDecimals('12.345')).toBe(12.34);
  });
  test('null / undefined / NaN → 0', () => {
    expect(floorToTwoDecimals(null)).toBe(0);
    expect(floorToTwoDecimals(undefined)).toBe(0);
    expect(floorToTwoDecimals('abc')).toBe(0);
  });
});

describe('formatGrams', () => {
  test('小数2桁・末尾0保持', () => {
    expect(formatGrams(12.5)).toBe('12.50');
    expect(formatGrams(12.345)).toBe('12.34');
    expect(formatGrams(0)).toBe('0.00');
  });
});

describe('formatYen', () => {
  test('3桁区切り', () => {
    expect(formatYen(12345)).toBe('12,345');
    expect(formatYen(1234567)).toBe('1,234,567');
  });
  test('小数は切り捨て', () => {
    expect(formatYen(12345.99)).toBe('12,345');
  });
  test('null / NaN → 0', () => {
    expect(formatYen(null)).toBe('0');
    expect(formatYen('abc')).toBe('0');
  });
});

describe('calcSubtotal', () => {
  test('重量×単価で整数返却', () => {
    expect(calcSubtotal(10, 1000)).toBe(10000);
    expect(calcSubtotal(1.5, 1000)).toBe(1500);
  });
  test('小数の浮動小数誤差を吸収', () => {
    // 0.1g × 12345円 = 1234.5円 → 切り捨て1234
    expect(calcSubtotal(0.1, 12345)).toBe(1234);
  });
  test('重量が文字列でもOK', () => {
    expect(calcSubtotal('2.5', '1000')).toBe(2500);
  });
});

describe('calcTax', () => {
  test('10% 切り捨て', () => {
    expect(calcTax(1000)).toBe(100);
    expect(calcTax(1009)).toBe(100); // 100.9 → 100
  });
  test('カスタムレート', () => {
    expect(calcTax(1000, 0.08)).toBe(80);
  });
});
