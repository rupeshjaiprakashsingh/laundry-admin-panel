import React, { useState } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItemButton, ListItemIcon, ListItemText, Avatar,
  Tooltip, useTheme, alpha, Divider, Chip, Badge,
} from '@mui/material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import PaymentIcon from '@mui/icons-material/Payment';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import StoreIcon from '@mui/icons-material/Store';

import { logout } from '../app/authSlice';
import { useAuth } from '../hooks/useAuth';

const DRAWER_WIDTH = 260;
const DRAWER_COLLAPSED = 72;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles?: string[];
  badge?: number;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { label: 'Orders', icon: <ShoppingBagIcon />, path: '/orders' },
  { label: 'Customers', icon: <PeopleIcon />, path: '/customers' },
  { label: 'Employees', icon: <BadgeIcon />, path: '/employees', roles: ['SuperAdmin', 'BranchManager'] },
  { label: 'Services', icon: <LocalLaundryServiceIcon />, path: '/services', roles: ['SuperAdmin'] },
  { label: 'Pricing', icon: <AttachMoneyIcon />, path: '/pricing', roles: ['SuperAdmin'] },
  { label: 'Pickups', icon: <LocalShippingIcon />, path: '/pickups' },
  { label: 'Deliveries', icon: <DeliveryDiningIcon />, path: '/deliveries' },
  { label: 'Laundry Shops', icon: <StoreIcon />, path: '/laundry-shops', roles: ['SuperAdmin', 'BranchManager', 'Employee'] },
  { label: 'Payments', icon: <PaymentIcon />, path: '/payments', roles: ['SuperAdmin', 'BranchManager'] },
  { label: 'Reports', icon: <BarChartIcon />, path: '/reports', roles: ['SuperAdmin', 'BranchManager'] },
  { label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const roleColors: Record<string, string> = {
  SuperAdmin: '#6366F1',
  BranchManager: '#0EA5E9',
  Employee: '#10B981',
  DeliveryBoy: '#F59E0B',
};

interface AdminLayoutProps {
  onToggleTheme: () => void;
  isDark: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ onToggleTheme, isDark }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH;

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  const DrawerContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Logo */}
      <Box
        sx={{
          px: collapsed ? 1.5 : 3, py: 2.5,
          display: 'flex', alignItems: 'center', gap: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
        }}
      >
        <Box
          sx={{
            width: 38, height: 38, borderRadius: 2, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366F1 0%, #0EA5E9 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <WaterDropIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        {!collapsed && (
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
              Grivana
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
              Admin Panel
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav Items */}
      <Box sx={{ flex: 1, py: 1.5, overflowY: 'auto', overflowX: 'hidden' }}>
        <List disablePadding>
          {filteredNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right">
                <ListItemButton
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  sx={{
                    mx: 1, mb: 0.5, borderRadius: 2,
                    minHeight: 46,
                    px: collapsed ? 1.5 : 2,
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                    transition: 'all 0.2s',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 38,
                      color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    }}
                  >
                    {item.badge ? (
                      <Badge badgeContent={item.badge} color="error">{item.icon}</Badge>
                    ) : item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText>
                      <Typography sx={{ fontWeight: isActive ? 700 : 500, fontSize: '0.875rem', color: 'inherit' }}>
                        {item.label}
                      </Typography>
                    </ListItemText>
                  )}
                  {isActive && !collapsed && (
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'primary.main' }} />
                  )}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ opacity: 0.4 }} />

      {/* User Info */}
      <Box sx={{ p: collapsed ? 1 : 2 }}>
        {!collapsed ? (
          <Box
            sx={{
              p: 1.5, borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: roleColors[user?.role ?? ''] ?? '#6366F1', fontSize: 14, fontWeight: 700 }}>
              {user?.fullName?.charAt(0)}
            </Avatar>
            <Box sx={{ overflow: 'hidden', flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{user?.fullName}</Typography>
              <Chip
                label={user?.role}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha(roleColors[user?.role ?? ''] ?? '#6366F1', 0.15), color: roleColors[user?.role ?? ''] ?? '#6366F1' }}
              />
            </Box>
            <Tooltip title="Logout">
              <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary' }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Tooltip title="Logout" placement="right">
            <IconButton onClick={handleLogout} sx={{ width: '100%', color: 'text.secondary' }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', transition: 'width 0.25s ease' },
        }}
      >
        <DrawerContent />
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        <DrawerContent />
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, transition: 'margin 0.25s' }}>
        {/* AppBar */}
        <AppBar position="sticky" elevation={0} color="default">
          <Toolbar sx={{ gap: 1 }}>
            <IconButton
              onClick={() => { setCollapsed((c) => !c); setMobileOpen((o) => !o); }}
              sx={{ color: 'text.secondary' }}
            >
              {collapsed ? <MenuIcon /> : <ChevronLeftIcon sx={{ display: { xs: 'none', md: 'block' } }} />}
              <MenuIcon sx={{ display: { xs: 'block', md: 'none' } }} />
            </IconButton>

            <Box sx={{ flex: 1 }} />

            <Tooltip title={isDark ? 'Light Mode' : 'Dark Mode'}>
              <IconButton onClick={onToggleTheme} sx={{ color: 'text.secondary' }}>
                {isDark ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Notifications">
              <IconButton sx={{ color: 'text.secondary' }}>
                <Badge badgeContent={3} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Avatar sx={{ width: 34, height: 34, bgcolor: roleColors[user?.role ?? ''] ?? '#6366F1', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {user?.fullName?.charAt(0)}
            </Avatar>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, overflowY: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
