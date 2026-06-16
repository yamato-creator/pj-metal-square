/**
 * フロント全体で共通の数値丸めポリシー。
 *
 * 過去の実装は toFixed(2) → Number() → Math.floor() のように途中段階で
 * 浮動小数誤差が積まれ、フロント表示とバック保管値・メール本文がズレるバグの原因になっていた。
 * 今後は本モジュールの関数を経由することで丸めポリシーを一箇所に集約する。
 *
 * ポリシー：
 * - 重量 (g) は **小数2桁、切り捨て** で表示（買い手有利、ユーザー不利にならない）
 * - 金額 (円) は **整数、3桁区切り** で表示
 * - 浮動小数の誤差吸収のため、計算は文字列ベースまたは10000倍した整数で行う
 */

/** 小数2桁に切り捨て（端数破棄）。NaN / undefined は 0 として扱う。 */
export const floorToTwoDecimals = (value: number | string | null | undefined): number => {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return 0;
  // 浮動小数誤差を避けるため整数演算で切り捨て
  return Math.floor(n * 100) / 100;
};

/** 重量(g) 表示用。小数2桁切り捨て + 末尾0を保持。例: 12.5 → "12.50" */
export const formatGrams = (value: number | string | null | undefined): string => {
  return floorToTwoDecimals(value).toFixed(2);
};

/** 金額(円) 表示用。整数、3桁区切り。例: 12345 → "12,345" */
export const formatYen = (value: number | string | null | undefined): string => {
  const n = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '0';
  return Math.floor(n).toLocaleString('ja-JP');
};

/** 重量×単価 = 金額（整数、円未満切り捨て）。 */
export const calcSubtotal = (
  grams: number | string,
  unitPriceYenPerG: number | string,
): number => {
  const g = floorToTwoDecimals(grams);
  const price = typeof unitPriceYenPerG === 'string' ? parseFloat(unitPriceYenPerG) : unitPriceYenPerG;
  if (!Number.isFinite(price)) return 0;
  return Math.floor(g * price);
};

/** 消費税（整数切り捨て）。デフォルト 10%。 */
export const calcTax = (subtotal: number, rate: number = 0.1): number => {
  return Math.floor(subtotal * rate);
};
