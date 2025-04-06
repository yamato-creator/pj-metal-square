/**
 * すべてのブラウザストレージとキャッシュをクリアする
 * @param {boolean} preserveEssential - 必須データを保持するかどうか
 */
export const clearAllStorage = async (preserveEssential: boolean = false): Promise<void> => {
  try {
    // 保持したいキーのリスト（必要に応じて）
    const essentialKeys: string[] = [];

    // ローカルストレージをクリア
    if (preserveEssential) {
      // 必須キーを保存
      const savedItems: Record<string, string> = {};
      essentialKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) savedItems[key] = value;
      });

      localStorage.clear();

      // 必須キーを復元
      Object.entries(savedItems).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    } else {
      localStorage.clear();
    }

    // セッションストレージをクリア
    sessionStorage.clear();

    // IndexedDBをクリア
    await clearIndexedDB();

    // キャッシュをクリア
    await clearCaches();

    // クッキーをクリア
    clearCookies();
  } catch (error) {
    console.error('ストレージのクリア中にエラーが発生しました:', error);
  }
};

/**
 * IndexedDBデータベースをクリアする
 */
const clearIndexedDB = async (): Promise<void> => {
  try {
    if (!('indexedDB' in window)) return;

    const databases = await window.indexedDB.databases();
    await Promise.all(
      databases.map(db => {
        return new Promise<void>((resolve, reject) => {
          if (!db.name) return resolve();

          const deleteRequest = window.indexedDB.deleteDatabase(db.name);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(new Error(`Failed to delete IndexedDB: ${db.name}`));
        });
      })
    );
  } catch (error) {
    console.error('IndexedDBのクリア中にエラーが発生しました:', error);
  }
};

/**
 * キャッシュストレージをクリアする
 */
const clearCaches = async (): Promise<void> => {
  try {
    if (!('caches' in window)) return;

    const keyList = await caches.keys();
    await Promise.all(keyList.map(key => caches.delete(key)));
  } catch (error) {
    console.error('キャッシュのクリア中にエラーが発生しました:', error);
  }
};

/**
 * クッキーをクリアする
 */
const clearCookies = (): void => {
  try {
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  } catch (error) {
    console.error('クッキーのクリア中にエラーが発生しました:', error);
  }
};