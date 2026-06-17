import { authStorage, migrateLegacyAuthFromLocalStorage } from '../authStorage';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('authStorage', () => {
  test('set/get/clear が sessionStorage で動く', () => {
    authStorage.set({ user: { user_id: 'X', api_key: 'k' }, isAuthenticated: true });
    const v: any = authStorage.get();
    expect(v?.user?.user_id).toBe('X');
    expect(v?.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem('auth')).toContain('"user_id":"X"');

    authStorage.clear();
    expect(authStorage.get()).toBeNull();
    expect(sessionStorage.getItem('auth')).toBeNull();
  });

  test('値が無いときは null', () => {
    expect(authStorage.get()).toBeNull();
  });

  test('壊れた JSON は null を返す', () => {
    sessionStorage.setItem('auth', '{not valid json');
    expect(authStorage.get()).toBeNull();
  });
});

describe('migrateLegacyAuthFromLocalStorage', () => {
  test('localStorage の auth を sessionStorage に移して削除する', () => {
    localStorage.setItem(
      'auth',
      JSON.stringify({ user: { user_id: 'LEGACY' }, isAuthenticated: true }),
    );
    expect(sessionStorage.getItem('auth')).toBeNull();

    migrateLegacyAuthFromLocalStorage();

    const v: any = authStorage.get();
    expect(v?.user?.user_id).toBe('LEGACY');
    expect(localStorage.getItem('auth')).toBeNull();
  });

  test('既に sessionStorage に値があれば移行しない', () => {
    sessionStorage.setItem('auth', JSON.stringify({ user: { user_id: 'CURRENT' } }));
    localStorage.setItem('auth', JSON.stringify({ user: { user_id: 'OLD' } }));

    migrateLegacyAuthFromLocalStorage();

    const v: any = authStorage.get();
    expect(v?.user?.user_id).toBe('CURRENT');
  });

  test('localStorage に何もなければ no-op', () => {
    expect(() => migrateLegacyAuthFromLocalStorage()).not.toThrow();
    expect(authStorage.get()).toBeNull();
  });
});
