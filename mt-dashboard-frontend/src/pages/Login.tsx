import React, { useState } from 'react';
import { Box, TextField, Button, Paper, Typography, Alert, Link } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

export const Login = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const success = await login(userId, password);
      if (success) {
        navigate('/dashboard');
      }
    } catch (error: any) {
      setError(error.message || 'ログイン処理中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 退会完了メッセージの表示
  React.useEffect(() => {
    const message = location.state?.message;
    if (message) {
      setError(message);
    }
  }, [location]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Typography variant="h5" align="center" gutterBottom>
          ログイン
        </Typography>
        {error && (
          <Alert 
            severity={
              error.includes('ご利用ありがとうございました') || 
              error.includes('ユーザー登録が完了しました') 
                ? 'success' 
                : 'error'
            } 
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="ユーザーID"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            margin="normal"
            disabled={isLoading}
          />
          <TextField
            fullWidth
            label="パスワード"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            disabled={isLoading}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isLoading}
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => navigate('/')}
            sx={{ 
              mt: 1, 
              mb: 2,
              backgroundColor: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
              },
            }}
            disabled={isLoading}
          >
            戻る
          </Button>
        </form>
      </Paper>
    </Box>
  );
};