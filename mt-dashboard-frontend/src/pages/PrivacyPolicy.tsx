import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy: React.FC = () => {
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetch('/privacy-policy.md')
      .then((res) => {
        if (!res.ok) throw new Error('プライバシーポリシーを取得できませんでした');
        return res.text();
      })
      .then(setContent)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded shadow p-6 sm:p-10">
          {error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm sm:text-base leading-relaxed text-gray-800">
              {content}
            </pre>
          )}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/"
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 no-underline"
            >
              トップへ戻る
            </Link>
            <Link
              to="/login"
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 no-underline"
            >
              ログイン画面へ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
