import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton,
  List, ListItemButton, ListItemIcon, ListItemText, Avatar,
  Tooltip, useTheme, alpha, Divider, Chip, Badge, CircularProgress,
} from '@mui/material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import RefreshIcon from '@mui/icons-material/Refresh';

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
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';

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
  { label: 'Coupons', icon: <LocalOfferIcon />, path: '/coupons', roles: ['SuperAdmin'] },
  { label: 'Banners', icon: <ViewCarouselIcon />, path: '/banners', roles: ['SuperAdmin', 'BranchManager'] },
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

// ── Live Sync Status Pill (Isolated to prevent parent re-renders every 1s) ────
const LiveSyncPill: React.FC<{ isFetchingCount: number }> = ({ isFetchingCount }) => {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (isFetchingCount === 0) {
      setSecondsAgo(0);
    }
  }, [isFetchingCount]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Tooltip title={`Auto-syncing every 5s. ${secondsAgo < 5 ? 'Just updated' : `Last updated ${secondsAgo}s ago`}`}>
      <Chip
        size="small"
        icon={
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: isFetchingCount > 0 ? '#F59E0B' : '#10B981',
              boxShadow: isFetchingCount > 0 ? '0 0 8px #F59E0B' : '0 0 8px #10B981',
              animation: isFetchingCount > 0 ? 'pulse 1s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { transform: 'scale(0.8)', opacity: 0.7 },
                '50%': { transform: 'scale(1.2)', opacity: 1 },
                '100%': { transform: 'scale(0.8)', opacity: 0.7 },
              },
              ml: '6px !important',
            }}
          />
        }
        label={
          isFetchingCount > 0
            ? 'Syncing...'
            : secondsAgo < 5
            ? 'Live Sync'
            : `Sync (${secondsAgo}s)`
        }
        sx={{
          fontWeight: 700,
          fontSize: 11,
          height: 26,
          bgcolor: (t) => alpha(isFetchingCount > 0 ? '#F59E0B' : '#10B981', 0.12),
          color: isFetchingCount > 0 ? '#D97706' : '#059669',
          border: '1px solid',
          borderColor: (t) => alpha(isFetchingCount > 0 ? '#F59E0B' : '#10B981', 0.3),
          display: { xs: 'none', sm: 'inline-flex' },
        }}
      />
    </Tooltip>
  );
};

// ── Drawer Content (Stable component defined outside AdminLayout) ─────────────
interface DrawerContentProps {
  collapsed: boolean;
  filteredNavItems: NavItem[];
  locationPath: string;
  user: any;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

const DrawerContent: React.FC<DrawerContentProps> = ({
  collapsed,
  filteredNavItems,
  locationPath,
  user,
  onNavigate,
  onLogout,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Logo Header */}
      <Box
        sx={{
          px: collapsed ? 1.5 : 2.5,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: 2,
            flexShrink: 0,
            background: 'linear-gradient(135deg, #6366F1 0%, #0EA5E9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
          }}
        >
          <WaterDropIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        {!collapsed && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }} noWrap>
              Grivana
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }} noWrap>
              Admin Panel
            </Typography>
          </Box>
        )}
      </Box>

      {/* Nav Items Scroll Area */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          py: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': {
            width: '5px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.text.secondary, 0.2),
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: alpha(theme.palette.text.secondary, 0.4),
          },
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(theme.palette.text.secondary, 0.2)} transparent`,
        }}
      >
        <List disablePadding sx={{ px: 0.5 }}>
          {filteredNavItems.map((item) => {
            const isActive = locationPath === item.path || locationPath.startsWith(item.path + '/');
            return (
              <Tooltip key={item.path} title={collapsed ? item.label : ''} placement="right">
                <ListItemButton
                  onClick={() => onNavigate(item.path)}
                  sx={{
                    mx: 0.5,
                    mb: 0.35,
                    borderRadius: 2,
                    minHeight: 40,
                    px: collapsed ? 1 : 1.75,
                    py: 0.6,
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
                    color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
                    transition: 'all 0.15s ease',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 34,
                      color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                    }}
                  >
                    {item.badge ? (
                      <Badge badgeContent={item.badge} color="error">{item.icon}</Badge>
                    ) : item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText disableTypography>
                      <Typography sx={{ fontWeight: isActive ? 700 : 500, fontSize: '0.84rem', color: 'inherit' }} noWrap>
                        {item.label}
                      </Typography>
                    </ListItemText>
                  )}
                  {isActive && !collapsed && (
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0, ml: 1 }} />
                  )}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ opacity: 0.4, flexShrink: 0 }} />

      {/* User Info Footer */}
      <Box sx={{ p: collapsed ? 1 : 1.5, flexShrink: 0 }}>
        {!collapsed ? (
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
            }}
          >
            <Avatar sx={{ width: 34, height: 34, bgcolor: roleColors[user?.role ?? ''] ?? '#6366F1', fontSize: 13, fontWeight: 700 }}>
              {user?.fullName?.charAt(0) || 'A'}
            </Avatar>
            <Box sx={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }} noWrap>
                {user?.fullName || 'Admin User'}
              </Typography>
              <Chip
                label={user?.role || 'Admin'}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: alpha(roleColors[user?.role ?? ''] ?? '#6366F1', 0.15),
                  color: roleColors[user?.role ?? ''] ?? '#6366F1',
                }}
              />
            </Box>
            <Tooltip title="Logout">
              <IconButton size="small" onClick={onLogout} sx={{ color: 'text.secondary' }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          <Tooltip title="Logout" placement="right">
            <IconButton onClick={onLogout} sx={{ width: '100%', color: 'text.secondary' }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
};

const AdminLayout: React.FC<AdminLayoutProps> = ({ onToggleTheme, isDark }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isFetchingCount = useIsFetching();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleRefreshAll = useCallback(() => {
    qc.invalidateQueries();
  }, [qc]);

  const drawerWidth = collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH;

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
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
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            transition: 'width 0.25s ease',
            height: '100%',
            overflow: 'hidden',
          },
        }}
      >
        <DrawerContent
          collapsed={collapsed}
          filteredNavItems={filteredNavItems}
          locationPath={location.pathname}
          user={user}
          onNavigate={(path) => { navigate(path); setMobileOpen(false); }}
          onLogout={handleLogout}
        />
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            height: '100%',
            overflow: 'hidden',
          },
        }}
      >
        <DrawerContent
          collapsed={false}
          filteredNavItems={filteredNavItems}
          locationPath={location.pathname}
          user={user}
          onNavigate={(path) => { navigate(path); setMobileOpen(false); }}
          onLogout={handleLogout}
        />
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

            {/* Live Auto-Refresh Status Pill */}
            <LiveSyncPill isFetchingCount={isFetchingCount} />

            {/* Manual Refresh Button */}
            <Tooltip title="Refresh all data now">
              <IconButton
                onClick={handleRefreshAll}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) },
                }}
              >
                {isFetchingCount > 0 ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshIcon
                    fontSize="small"
                    sx={{
                      transition: 'transform 0.3s',
                      '&:hover': { transform: 'rotate(180deg)' },
                    }}
                  />
                )}
              </IconButton>
            </Tooltip>

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
