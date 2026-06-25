import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  InputAdornment, IconButton, Alert, CircularProgress, alpha, useTheme,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginEmployee } from '../../api/auth';
import { loginSuccess } from '../../app/authSlice';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(4, 'Password required'),
});
type FormData = z.infer<typeof schema>;

const LoginPage: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');
    try {
      const res = await loginEmployee(data.email, data.password);
      if (!res.user || !['SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy'].includes(res.user.role)) {
        setError('Access denied. Customer accounts cannot log in here.');
        return;
      }
      dispatch(loginSuccess({ accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user }));
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)'
          : 'linear-gradient(135deg, #EEF2FF 0%, #E0F2FE 50%, #F0FDF4 100%)',
        p: 2,
      }}
    >
      <Box sx={{ position: 'fixed', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: alpha('#6366F1', 0.08), pointerEvents: 'none' }} />
      <Box sx={{ position: 'fixed', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: alpha('#0EA5E9', 0.08), pointerEvents: 'none' }} />

      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: 3, mx: 'auto', mb: 2, background: 'linear-gradient(135deg, #6366F1 0%, #0EA5E9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
            <WaterDropIcon sx={{ color: '#fff', fontSize: 32 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }} gutterBottom>Grivana Admin</Typography>
          <Typography color="text.secondary">Sign in to manage your laundry operations</Typography>
        </Box>

        <Card sx={{ backdropFilter: 'blur(20px)', background: theme.palette.mode === 'dark' ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.9)', border: `1px solid ${alpha(theme.palette.divider, 0.3)}` }}>
          <CardContent sx={{ p: 4 }}>
            {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
            <form onSubmit={handleSubmit(onSubmit)}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField
                  {...register('email')} label="Email Address" type="email" fullWidth
                  error={!!errors.email} helperText={errors.email?.message}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment> } }}
                />
                <TextField
                  {...register('password')} label="Password" type={showPassword ? 'text' : 'password'} fullWidth
                  error={!!errors.password} helperText={errors.password?.message}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>, endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword((s) => !s)} edge="end">{showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment> } }}
                />
                <Button type="submit" variant="contained" fullWidth size="large" disabled={loading}
                  sx={{ mt: 1, py: 1.5, background: 'linear-gradient(135deg, #6366F1 0%, #0EA5E9 100%)', '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #0284C7 100%)' } }}
                  startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </Box>
            </form>
          </CardContent>
        </Card>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          © 2025 Grivana Laundry Services. Admin access only.
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
