import React from 'react';
import { Box, Button, Typography, Container, Link, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Container maxWidth="sm">
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center'
          }}
        >
          <Typography 
            variant="h4" 
            component="h1" 
            gutterBottom 
            sx={{ fontWeight: 'bold', mb: 3, textAlign: 'center' }}
          >
            Nippon Gold Market
          </Typography>
          
          <Typography 
            variant="body1" 
            sx={{ mb: 4, textAlign: 'center' }}
          >
            貴金属の資産管理と取引プラットフォーム
          </Typography>

          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button 
              variant="contained" 
              fullWidth 
              size="large"
              onClick={() => navigate('/login')}
              sx={{ py: 1.5 }}
            >
              ログイン
            </Button>

            <Button 
              variant="outlined" 
              fullWidth 
              size="large"
              onClick={() => navigate('/register')}
              sx={{ py: 1.5 }}
            >
              新規登録
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default LandingPage; 