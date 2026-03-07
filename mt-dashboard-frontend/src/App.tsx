import React, { useState, useEffect } from 'react';
import { CssBaseline, ThemeProvider, IconButton, Drawer, List, ListItem, ListItemText, useMediaQuery, useTheme } from '@mui/material';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link,
  useLocation 
} from 'react-router-dom';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useTransactions } from './hooks/useTransactions';
import theme from './theme/theme';
import AssetStatus from './components/AssetStatus';
import CashTransactionForm from './components/CashTransaction/CashTransactionForm';
import DepositTransactionForm from './components/DepositTransaction/DepositTransactionForm';
import WithdrawTransactionForm from './components/WithdrawTransaction/WithdrawTransactionForm';
import CompletionScreen from './components/CashTransaction/CompletionScreen';
import DepositCompletionScreen from './components/DepositTransaction/DepositCompletionScreen';
import DepositCompletionPage from './pages/DepositCompletionPage';
import WithdrawCompletionPage from './pages/WithdrawCompletionPage';
import TransactionHistory from './components/CashTransaction/TransactionHistory';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
import { Register } from './pages/Register';
import { AccountSettings } from './pages/AccountSettings';
import { HomeIcon, CurrencyYenIcon, ClockIcon, CogIcon } from '@heroicons/react/24/outline';
import { MetalPriceChart } from './components/MetalPriceChart';
import { useAuthCheck } from './hooks/useAuthCheck';
import LandingPage from './pages/LandingPage';
import { TimeRestrictedApp } from './components/TimeRestrictedApp';

interface Metal {
  name: string;
  nameJp: string;
  amount: number;
  unitPrice: number;
}

interface MetalPrice {
  price_id: string;
  metal_type: string;
  retail_price: string;
}

interface Transaction {
  id: string;
  date: string;
  company: string;
  items: {
    metalName: string;
    nameJp: string;
    amount: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, user } = useAuthCheck();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen text-emerald-600">読み込み中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const menuItems = [
    { path: '/dashboard', emoji: <img src="/icons/home-icon.png" alt="トップ" className="w-5 h-5" />, label: 'トップ' },
    { path: '/cash-transaction', emoji: <img src="/icons/yen-icon.png" alt="現金決済" className="w-5 h-5" />, label: '現金決済' },
    { path: '/withdraw-transaction', emoji: <img src="/icons/gold-icon.png" alt="現物返却" className="w-5 h-5" />, label: '現物返却' },
    { path: '/transaction-history', emoji: <img src="/icons/document-icon.png" alt="取引履歴" className="w-5 h-5" />, label: '取引履歴' },
    { path: '/account-settings', emoji: <img src="/icons/settings-icon.png" alt="アカウント設定" className="w-5 h-5" />, label: 'アカウント設定' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="bg-emerald-600 text-white py-2 px-2 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          {/* Mobile menu button */}
          {isMobile && (
            <div className="flex items-center">
              <button
                onClick={toggleMobileMenu}
                className="focus:outline-none"
                aria-label="メニュー"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M4 6h16M4 12h16M4 18h16" 
                  />
                </svg>
              </button>
              <img src="/logo.png" alt="会社ロゴ" className="h-auto w-28 ml-1 mr-2 object-contain" />
              <span className="ml-1 text-sm font-semibold">Precious Metal Mine</span>
            </div>
          )}
          
          {/* Desktop menu */}
          {!isMobile && (
            <div className="flex items-center justify-between w-full pl-0">
              <div className="flex items-center flex-grow">
                <img src="/logo.png" alt="会社ロゴ" className="h-auto w-48 mr-3 object-contain pl-0" />
                <span className="text-xl font-semibold mr-4">Precious Metal Mine</span>
                <div className="flex items-center space-x-1 overflow-x-auto hide-scrollbar">
                  {menuItems.map((item) => (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={`flex items-center px-2 py-2 rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap text-base font-medium ${location.pathname === item.path ? 'bg-emerald-700' : ''}`}
                    >
                      <span className="mr-1">{item.emoji}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <span className="text-white px-3 py-2 ml-2 font-bold">{user?.user_name || ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Mobile menu drawer */}
      {isMobile && (
        <div 
          className={`fixed inset-0 z-50 bg-black bg-opacity-50 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={closeMobileMenu}
        >
          <div 
            className={`fixed top-0 left-0 w-64 h-full bg-emerald-600 transform transition-transform duration-300 ease-in-out shadow-xl ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-emerald-500">
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold">メニュー</span>
                <button 
                  onClick={closeMobileMenu}
                  className="text-white focus:outline-none"
                  aria-label="閉じる"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-6 w-6" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="py-2">
              {menuItems.map((item) => (
                <Link 
                  key={item.path}
                  to={item.path} 
                  className={`flex items-center px-4 py-3 hover:bg-emerald-700 transition-colors ${location.pathname === item.path ? 'bg-emerald-700' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <span className="mr-3">{item.emoji}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
              <div className="mt-4 border-t border-emerald-500 pt-4 px-4">
                <span className="text-white font-bold">{user?.user_name || ''}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 bg-gray-100">
        {children}
      </main>
    </div>
  );
};

function MainContent() {
  const { getAuthHeaders, isAuthenticated } = useAuth();
  const { clearCache } = useTransactions();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [priceUpdateTime, setPriceUpdateTime] = useState<string>('');
  const [metals, setMetals] = useState<Metal[]>([
    { name: 'Au', nameJp: '(金)', amount: 0, unitPrice: 0 },
    { name: 'Pd', nameJp: '(パラジウム)', amount: 0, unitPrice: 0 },
    { name: 'Ag', nameJp: '(銀)', amount: 0, unitPrice: 0 },
    { name: 'Pt', nameJp: '(プラチナ)', amount: 0, unitPrice: 0 }
  ]);

  // 資産情報を取得する関数
  const fetchAssets = async () => {
    setIsLoadingAssets(true);
    try {
      const authData = localStorage.getItem('auth');
      const userId = authData ? JSON.parse(authData).user.user_id : null;
      
      if (!userId) {
        return;
      }
      //URL変更 
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/user/${userId}/assets`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('資産情報の取得に失敗しました');
      }

      const data = await response.json();
      
      if (data.status === 'success' && data.assets) {
        setMetals(prevMetals => {
          const newMetals = prevMetals.map(metal => {
            const metalTypeMap: { [key: string]: string } = {
              'Au': '金',
              'Pd': 'パラジウム',
              'Ag': '銀',
              'Pt': 'プラチナ'
            };
            
            const assetData = data.assets.find(
              (asset: any) => asset.metal_type === metalTypeMap[metal.name]
            );
            return {
              ...metal,
              amount: assetData ? parseFloat(assetData.weight_g) : 0
            };
          });
          return newMetals;
        });
      }
    } catch (error) {
      console.error('資産情報の取得に失敗:', error);
    } finally {
      setIsLoadingAssets(false);
    }
  };

  // 取引キャンセル時の資産更新イベントをリッスン
  useEffect(() => {
    const handleAssetUpdated = (event: CustomEvent<any>) => {
      const updatedAssets = event.detail;
      if (updatedAssets) {
        setMetals(prevMetals => 
          prevMetals.map(metal => {
            const metalTypeMap: { [key: string]: string } = {
              'Au': '金',
              'Pd': 'パラジウム',
              'Ag': '銀',
              'Pt': 'プラチナ'
            };
            
            const assetData = updatedAssets.find(
              (asset: any) => asset.metal_type === metalTypeMap[metal.name]
            );
            return {
              ...metal,
              amount: assetData ? parseFloat(assetData.weight_g) : 0
            };
          })
        );
      }
    };

    // カスタムイベントリスナーを追加
    window.addEventListener('assetUpdated', handleAssetUpdated as EventListener);

    // クリーンアップ関数
    return () => {
      window.removeEventListener('assetUpdated', handleAssetUpdated as EventListener);
    };
  }, []);

  // ログイン時に資産情報を取得
  useEffect(() => {
    if (isAuthenticated) {
     setMetals([
       { name: 'Au', nameJp: '(金)', amount: 0, unitPrice: 0 },
       { name: 'Pd', nameJp: '(パラジウム)', amount: 0, unitPrice: 0 },
       { name: 'Ag', nameJp: '(銀)', amount: 0, unitPrice: 0 },
       { name: 'Pt', nameJp: '(プラチナ)', amount: 0, unitPrice: 0 }
     ]);
      fetchAssets();
    }
  }, [isAuthenticated]);

  // 金属価格の取得
  useEffect(() => {
    // 金属価格と更新日時を並行して取得
    Promise.all([
      fetch(`${process.env.REACT_APP_API_URL}/api/metal-prices`, {
        headers: getAuthHeaders()
      }),
      fetch(`${process.env.REACT_APP_API_URL}/api/metal-prices/update-time`, {
        headers: getAuthHeaders()
      })
    ])
      .then(([pricesRes, updateTimeRes]) => Promise.all([pricesRes.json(), updateTimeRes.json()]))
      .then(([pricesData, updateTimeData]) => {
        // 価格データの処理
        if (pricesData.status === 'success') {
          const prices = pricesData.data;
          
          setMetals(prevMetals => 
            prevMetals.map(metal => {
              let matchedPrice;
              switch (metal.name) {
                case 'Au':
                  matchedPrice = prices.find((p: MetalPrice) => p.metal_type === '金');
                  break;
                case 'Pd':
                  matchedPrice = prices.find((p: MetalPrice) => p.metal_type === 'パラジウム');
                  break;
                case 'Ag':
                  matchedPrice = prices.find((p: MetalPrice) => p.metal_type === '銀');
                  break;
                case 'Pt':
                  matchedPrice = prices.find((p: MetalPrice) => p.metal_type === 'プラチナ');
                  break;
              }
              
              return {
                ...metal,
                unitPrice: matchedPrice ? Number(matchedPrice.retail_price) : 0
              };
            })
          );
        }
        
        // 更新日時データの処理
        if (updateTimeData.status === 'success') {
          setPriceUpdateTime(updateTimeData.update_time);
        }
      })
      .catch(error => console.error('価格データの取得に失敗:', error));
  }, [getAuthHeaders]);

  const handleSale = async (saleAmounts: { [key: string]: number }) => {
    const totalSaleAmount = Object.values(saleAmounts).reduce((sum, amount) => sum + amount, 0);
    if (totalSaleAmount <= 0) {
      alert('売却金額が0円以上である必要があります');
      return null;
    }

    const saleItems = metals
      .filter(metal => saleAmounts[metal.name] > 0)
      .map(metal => ({
        metalName: metal.name,
        nameJp: metal.nameJp,
        amount: saleAmounts[metal.name],
        unitPrice: Math.floor(metal.unitPrice),
        total: Math.floor(saleAmounts[metal.name] * Math.floor(metal.unitPrice))
      }));

    const subtotal = Math.floor(saleItems.reduce((sum, item) => sum + item.total, 0));
    const tax = Math.floor(subtotal * 0.1);
    const total = subtotal + tax;

    // 一時的な表示用のトランザクションオブジェクト
    const tempTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      company: 'B会社',
      items: saleItems,
      subtotal,
      tax,
      total
    };

    // 一時的に表示用のトランザクションを追加
    // APIレスポンスの形式に合わせて処理
    setTransactions(prev => {
      if (Array.isArray(prev)) {
        return [tempTransaction, ...prev];
      } else {
        return [tempTransaction];
      }
    });
    
    // 売却処理後に最新の取引履歴を再取得
    setTimeout(() => {
      fetchTransactions();
    }, 1000); // 1秒後に再取得（バックエンドの処理完了を待つ）
    
    return { subtotal, tax, total };
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('取引履歴の取得に失敗しました');
      }
      
      const data = await response.json();
      
      // APIレスポンスの形式を確認し、適切に処理
      if (Array.isArray(data)) {
        setTransactions(data);
      } else if (data.transactions && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      } else {
        console.error('予期しない形式のレスポンス:', data);
        setTransactions([]);
      }
    } catch (error) {
      console.error('取引履歴取得エラー:', error);
      setTransactions([]);
    }
  };

  const handleCalculate = (amounts: { [key: string]: number }) => {
    const subtotal = Math.floor(Object.entries(amounts).reduce(
      (sum, [key, amount]) => sum + amount * Math.floor(metals.find(m => m.name === key)?.unitPrice || 0),
      0
    ));
    const tax = Math.floor(subtotal * 0.1);
    return { subtotal, tax, total: subtotal + tax };
  };

  // 売却完了後の資産更新
  const handleSaleComplete = async (result: any) => {
    if (result.status === 'success' && result.updated_assets) {
      // 資産情報を更新
      setMetals(prevMetals => 
        prevMetals.map(metal => {
          const metalTypeMap: { [key: string]: string } = {
            'Au': '金',
            'Pd': 'パラジウム',
            'Ag': '銀',
            'Pt': 'プラチナ'
          };
          
          const assetData = result.updated_assets.find(
            (asset: any) => asset.metal_type === metalTypeMap[metal.name]
          );
          return {
            ...metal,
            amount: assetData ? parseFloat(assetData.weight_g) : 0
          };
        })
      );

      // 取引履歴のキャッシュをクリア
      clearCache();
    }
  };

  // 預入処理のハンドラー
  const handleDeposit = async (depositAmounts: { [key: string]: number }) => {
    const totalDepositAmount = Object.values(depositAmounts).reduce((sum, amount) => sum + amount, 0);
    if (totalDepositAmount <= 0) {
      alert('預入金額が0円以上である必要があります');
      return null;
    }

    const depositItems = metals
      .filter(metal => depositAmounts[metal.name] > 0)
      .map(metal => ({
        metalName: metal.name,
        nameJp: metal.nameJp,
        amount: depositAmounts[metal.name],
        unitPrice: metal.unitPrice,
        total: Math.floor(depositAmounts[metal.name] * metal.unitPrice)
      }));

    try {
      const metalTypeMap: { [key: string]: string } = {
        'Au': '金',
        'Pd': 'パラジウム',
        'Ag': '銀',
        'Pt': 'プラチナ'
      };

      const depositData = {
        user_id: (() => {
          const auth = localStorage.getItem('auth');
          return auth ? JSON.parse(auth).user.user_id : '';
        })(),
        metals: metals
          .filter(metal => depositAmounts[metal.name] > 0)
          .map(metal => ({
            metal_type: metalTypeMap[metal.name],
            amount: depositAmounts[metal.name],
            unit_price: metal.unitPrice,
            total: Math.floor(depositAmounts[metal.name] * metal.unitPrice)
          }))
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': (() => {
            const auth = localStorage.getItem('auth');
            return auth ? JSON.parse(auth).user.api_key : '';
          })()
        },
        body: JSON.stringify(depositData)
      });

      if (!response.ok) {
        throw new Error('預入処理に失敗しました');
      }

      const responseData = await response.json();
      
      // 資産情報を更新
      if (responseData.status === 'success' && responseData.updated_assets) {
        setMetals(prevMetals => 
          prevMetals.map(metal => {
            const metalTypeMap: { [key: string]: string } = {
              'Au': '金',
              'Pd': 'パラジウム',
              'Ag': '銀',
              'Pt': 'プラチナ'
            };
            
            const assetData = responseData.updated_assets.find(
              (asset: any) => asset.metal_type === metalTypeMap[metal.name]
            );
            return {
              ...metal,
              amount: assetData ? parseFloat(assetData.weight_g) : metal.amount
            };
          })
        );

        // 取引履歴のキャッシュをクリア
        clearCache();
      }

      // 取引履歴を更新
      setTimeout(() => {
        fetchTransactions();
      }, 1000);

      return responseData;
    } catch (error) {
      console.error('預入処理エラー:', error);
      return null;
    }
  };

  // 現物返却処理のハンドラー
  const handleWithdraw = async (withdrawAmounts: { [key: string]: number }) => {
    const totalWithdrawAmount = Object.values(withdrawAmounts).reduce((sum, amount) => sum + amount, 0);
    if (totalWithdrawAmount <= 0) {
      alert('返却する金属を選択してください');
      return null;
    }

    try {
      const metalTypeMap: { [key: string]: string } = {
        'Au': '金',
        'Pd': 'パラジウム',
        'Ag': '銀',
        'Pt': 'プラチナ'
      };

      const withdrawData = {
        user_id: (() => {
          const auth = localStorage.getItem('auth');
          return auth ? JSON.parse(auth).user.user_id : '';
        })(),
        metals: metals
          .filter(metal => withdrawAmounts[metal.name] > 0)
          .map(metal => ({
            metal_type: metalTypeMap[metal.name],
            amount: withdrawAmounts[metal.name],
            unit_price: 0, // 金額は使用しないので0を設定
            total: 0 // 金額は使用しないので0を設定
          }))
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/transactions/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': (() => {
            const auth = localStorage.getItem('auth');
            return auth ? JSON.parse(auth).user.api_key : '';
          })()
        },
        body: JSON.stringify(withdrawData)
      });

      if (!response.ok) {
        throw new Error('現物返却処理に失敗しました');
      }

      const responseData = await response.json();
      
      // 資産情報を更新
      if (responseData.status === 'success' && responseData.updated_assets) {
        setMetals(prevMetals => 
          prevMetals.map(metal => {
            const metalTypeMap: { [key: string]: string } = {
              'Au': '金',
              'Pd': 'パラジウム',
              'Ag': '銀',
              'Pt': 'プラチナ'
            };
            
            const assetData = responseData.updated_assets.find(
              (asset: any) => asset.metal_type === metalTypeMap[metal.name]
            );
            return {
              ...metal,
              amount: assetData ? parseFloat(assetData.weight_g) : metal.amount
            };
          })
        );

        // 取引履歴のキャッシュをクリア
        clearCache();
      }

      // 取引履歴を更新
      setTimeout(() => {
        fetchTransactions();
      }, 1000);

      return responseData;
    } catch (error) {
      console.error('現物返却処理エラー:', error);
      return null;
    }
  };

  return (
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div className="container mx-auto px-4 py-8">
                  <AssetStatus metals={metals} isLoading={isLoadingAssets} priceUpdateTime={priceUpdateTime} />
                  <div className="mt-8 chart-container">
                    <MetalPriceChart />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposit-transaction"
            element={
              <Navigate to="/dashboard" replace />
            }
          />
          <Route
            path="/withdraw-transaction"
            element={
              <ProtectedRoute>
                <WithdrawTransactionForm 
                  metals={metals} 
                  onWithdraw={handleWithdraw}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cash-transaction"
            element={
              <ProtectedRoute>
                <CashTransactionForm 
                  metals={metals}
                  onSale={handleSale}
                  onCalculate={handleCalculate}
                  onSaleComplete={handleSaleComplete}
                  priceUpdateTime={priceUpdateTime}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/completion"
            element={
              <ProtectedRoute>
                <CompletionScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposit-completion"
            element={
              <Navigate to="/dashboard" replace />
            }
          />
          <Route
            path="/withdraw-completion"
            element={
              <ProtectedRoute>
                <WithdrawCompletionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transaction-history"
            element={
              <ProtectedRoute>
                <TransactionHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account-settings"
            element={
              <ProtectedRoute>
                <AccountSettings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </ThemeProvider>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <TimeRestrictedApp>
        <MainContent />
      </TimeRestrictedApp>
    </AuthProvider>
  );
}

export default App;
