import { extractApiErrorMessage } from '../apiError';

/** TS の Response モック生成ヘルパ。FastAPI HTTPException 風の JSON ボディを返す。 */
const makeResponse = (status: number, body: unknown): Response => {
  const json = JSON.stringify(body);
  return new Response(json, {
    status,
    headers: { 'content-type': 'application/json' },
  });
};

describe('extractApiErrorMessage', () => {
  test('detail があればそれを返す（status 関わらず）', async () => {
    const r = makeResponse(403, { detail: '取引可能時間外です' });
    expect(await extractApiErrorMessage(r, 'fallback')).toBe('取引可能時間外です');
  });

  test('detail が空で 401 → 認証エラーメッセージ', async () => {
    const r = makeResponse(401, {});
    expect(await extractApiErrorMessage(r, 'fb')).toMatch(/認証エラー|再度ログイン/);
  });

  test('detail が空で 403 → 時間外メッセージ', async () => {
    const r = makeResponse(403, {});
    expect(await extractApiErrorMessage(r, 'fb')).toMatch(/取引可能時間外|JST/);
  });

  test('detail が空で 429 → レート制限メッセージ', async () => {
    const r = makeResponse(429, {});
    expect(await extractApiErrorMessage(r, 'fb')).toMatch(/リクエストが多すぎ|時間を置いて/);
  });

  test('detail が空で 500 → サーバーエラー', async () => {
    const r = makeResponse(500, {});
    expect(await extractApiErrorMessage(r, 'fb')).toMatch(/サーバーエラー/);
  });

  test('detail も status マッチもなければ fallback', async () => {
    const r = makeResponse(418, {});
    expect(await extractApiErrorMessage(r, 'カスタムfallback')).toBe('カスタムfallback');
  });

  test('JSON でないボディでも fallback で動く', async () => {
    const r = new Response('not json', { status: 500 });
    expect(await extractApiErrorMessage(r, 'fb')).toMatch(/サーバーエラー/);
  });
});
