import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Dialog, DialogTitle, DialogActions, DialogContent, TextField, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AccountSettings = () => {
  const [openDialog, setOpenDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [openDeactivateDialog, setOpenDeactivateDialog] = useState(false);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openEmailDialog, setOpenEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const { logout, updatePassword, getAuthHeaders, user, updateEmail } = useAuth();
  const navigate = useNavigate();

  const userInfo = {
    email: user?.email || '',
    username: user?.user_name || ''
  };

  const handleLogout = () => {
    logout();  
    navigate('/login');  
  };

  const handlePasswordChange = async () => {
    if (password.length < 8) {
      alert('パスワードは8文字以上で入力してください');
      return;
    }
    
    if (password === passwordConfirm) {
      try {
        setIsProcessing(true);
        const success = await updatePassword(oldPassword, password);
        if (success) {
          setOpenPasswordDialog(false);
          alert('パスワード変更しました');
        }
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.includes('@') || newEmail.split('@')[1] === '') {
      alert('正しいメールアドレスの形式で入力してください');
      return;
    }
    if (newEmail !== emailConfirm) {
      alert('メールアドレスが一致しません');
      return;
    }

    try {
      setIsProcessing(true);
      const success = await updateEmail(newEmail);
      if (success) {
        setOpenEmailDialog(false);
        alert('メールアドレスを変更しました');
        window.location.reload();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/verify-password`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          password: deactivatePassword
        })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || 'パスワード検証に失敗しました');
        return;
      }

      // パスワード検証が成功した場合のみ最終確認ダイアログを表示
      setError(null);
      setOpenConfirmDialog(true);

    } catch (error) {
      setError('通信エラーが発生しました');
    }
  };

  const handleFinalDeactivate = async () => {
    try {
      setIsProcessing(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/users/deactivate`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        }
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.detail || '退会処理に失敗しました');
        return;
      }

      setOpenConfirmDialog(false);
      setOpenDeactivateDialog(false);
      logout();
      navigate('/login', { 
        state: { message: '退会処理が完了しました。ご利用ありがとうございました。' }
      });
    } catch (error) {
      setError('退会処理中にエラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, width: '100%', maxWidth: 600 }}>
          <Typography variant="h5" align="center" gutterBottom>
            登録内容
          </Typography>
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
              ユーザー名
            </Typography>
            <Typography variant="body1" sx={{ pl: 2 }}>
              {userInfo.username}
            </Typography>
          </Box>
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
              メールアドレス
            </Typography>
            <Typography variant="body1" sx={{ pl: 2 }}>
              {userInfo.email}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={() => setOpenPasswordDialog(true)}
            >
              ログイン用パスワード変更
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => setOpenEmailDialog(true)}
            >
              通知用メールアドレス変更
            </Button>
          </Box>
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setOpenDialog(true)}
            >
              ログアウト
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setOpenDeactivateDialog(true)}
            >
              退会する
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* 既存のログアウトダイアログ */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>ログアウトの確認</DialogTitle>
        <DialogContent>ログアウトしますか？</DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>キャンセル</Button>
          <Button 
            onClick={() => {
              handleLogout();
              setOpenDialog(false);
            }} 
            color="primary"
          >
            ログアウト
          </Button>
        </DialogActions>
      </Dialog>

      {/* パスワード変更ダイアログ */}
      <Dialog open={openPasswordDialog} onClose={() => !isProcessing && setOpenPasswordDialog(false)}>
        <DialogTitle>パスワード変更</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="password"
            label="現在のパスワード"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={isProcessing}
          />
          <TextField
            fullWidth
            type="password"
            label="新しいパスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isProcessing}
          />
          <TextField
            fullWidth
            type="password"
            label="新しいパスワード（確認用）"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={isProcessing}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPasswordDialog(false)} disabled={isProcessing}>キャンセル</Button>
          <Button onClick={handlePasswordChange} color="primary" disabled={isProcessing}>
            変更
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEmailDialog} onClose={() => !isProcessing && setOpenEmailDialog(false)}>
        <DialogTitle>メールアドレス変更</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            type="email"
            label="新しいメールアドレス"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isProcessing}
          />
          <TextField
            fullWidth
            type="email"
            label="新しいメールアドレス（確認用）"
            value={emailConfirm}
            onChange={(e) => setEmailConfirm(e.target.value)}
            disabled={isProcessing}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEmailDialog(false)} disabled={isProcessing}>キャンセル</Button>
          <Button onClick={handleEmailChange} color="primary" disabled={isProcessing}>
            変更
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openDeactivateDialog} onClose={() => setOpenDeactivateDialog(false)}>
        <DialogTitle>退会確認</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            退会するには現在のパスワードを入力してください。
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="現在のパスワード"
            value={deactivatePassword}
            onChange={(e) => {
              setDeactivatePassword(e.target.value);
              setError(null);
            }}
            error={!!error}
            helperText={error}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenDeactivateDialog(false);
            setDeactivatePassword('');
            setError(null);
          }}>
            キャンセル
          </Button>
          <Button 
            onClick={handleDeactivate}
            color="error"
          >
            次へ
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)}>
        <DialogTitle>最終確認</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            本当に退会しますか？この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirmDialog(false)} disabled={isProcessing}>
            キャンセル
          </Button>
          <Button onClick={handleFinalDeactivate} color="error" disabled={isProcessing}>
            退会する
          </Button>
        </DialogActions>
      </Dialog>

      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <CircularProgress style={{ color: '#10b981' }} />
        </div>
      )}
    </>
  );
};