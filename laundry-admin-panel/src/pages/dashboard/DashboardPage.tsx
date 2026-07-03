import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell, TableHead, TableRow, Skeleton, Alert, Chip, useTheme, alpha, LinearProgress, Avatar, Button } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import PeopleIcon from '@mui/icons-material/People';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TodayIcon from '@mui/icons-material/Today';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import StoreIcon from '@mui/icons-material/Store';
import StatCard from '../../components/StatCard';
import PageHeader from '../../components/PageHeader';
import { getDashboardStats } from '../../api/dashboard';
import { getLaundryShops } from '../../api/laundryShops';
import { formatCurrency } from '../../utils/export';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    refetchInterval: 60000,
  });
  const { data: laundryShops = [] } = useQuery({
    queryKey: ['laundry-shops'],
    queryFn: getLaundryShops,
  });

  const chartDefaults = {
    color: isDark ? '#94A3B8' : '#64748B',
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  };

  const lineChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Orders',
      data: [12, 19, 8, 22, 15, 28, 20],
      borderColor: '#6366F1',
      backgroundColor: alpha('#6366F1', 0.1),
      fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366F1',
    }],
  };

  const barChartData = {
    labels: ['Dry Cleaning', 'Steam Press', 'Bed Sheets', 'Washing'],
    datasets: [{
      label: 'Revenue (₹)',
      data: [42000, 28000, 15000, 19000],
      backgroundColor: ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B'],
      borderRadius: 8,
    }],
  };

  const doughnutData = {
    labels: ['New Order', 'Processing', 'Ready', 'Delivered', 'Cancelled'],
    datasets: [{
      data: [35, 15, 12, 20, 18],
      backgroundColor: ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444'],
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: chartDefaults.color } } },
    scales: {
      x: { ticks: { color: chartDefaults.color }, grid: { color: chartDefaults.grid } },
      y: { ticks: { color: chartDefaults.color }, grid: { color: chartDefaults.grid } },
    },
  };

  if (error) return <Alert severity="error">Failed to load dashboard stats. Is the backend running?</Alert>;

  return (
    <Box>
      <PageHeader title="Dashboard" subtitle="Welcome back! Here's what's happening today." />

      {/* Stat Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { title: 'Total Customers', value: isLoading ? '...' : data?.totalCustomers ?? 0, Icon: PeopleIcon, color: '#6366F1' },
          { title: 'Total Orders', value: isLoading ? '...' : data?.totalOrders ?? 0, Icon: ShoppingBagIcon, color: '#0EA5E9' },
          { title: 'Total Revenue', value: isLoading ? '...' : formatCurrency(data?.totalRevenue ?? 0), Icon: CurrencyRupeeIcon, color: '#10B981' },
          { title: 'Pending Deliveries', value: isLoading ? '...' : data?.pendingDeliveries ?? 0, Icon: LocalShippingIcon, color: '#EF4444' },
          { title: "Today's Pickups", value: isLoading ? '...' : data?.todayPickups ?? 0, Icon: TodayIcon, color: '#F59E0B' },
          { title: "Today's Deliveries", value: isLoading ? '...' : data?.todayDeliveries ?? 0, Icon: DeliveryDiningIcon, color: '#8B5CF6' },
        ].map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, lg: 4 }}>
            {isLoading ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 3 }} /> : (
              <StatCard {...card} />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Orders This Week</Typography>
              <Box sx={{ height: 280 }}>
                <Line data={lineChartData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Order Status</Typography>
              <Box sx={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Doughnut data={doughnutData} options={{ ...chartOptions, scales: undefined }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Revenue by Service</Typography>
              <Box sx={{ height: 240 }}>
                <Bar data={barChartData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Top Customers</Typography>
              {isLoading ? <Skeleton height={200} /> : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><b>Customer</b></TableCell>
                      <TableCell align="right"><b>Orders</b></TableCell>
                      <TableCell align="right"><b>Spent</b></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.topCustomers ?? []).map((tc, i) => (
                      <TableRow key={i} hover>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {tc.customer?.firstName} {tc.customer?.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{tc.customer?.customerCode}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip label={tc.orderCount} size="small" color="primary" />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                            {formatCurrency(tc.totalSpent)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(data?.topCustomers ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={3} align="center"><Typography color="text.secondary" variant="body2">No data yet</Typography></TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Laundry Shops Overview */}
      <Card sx={{ mt: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StoreIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Laundry Shops Overview</Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={() => navigate('/laundry-shops')} startIcon={<StoreIcon />}>
              Manage Shops
            </Button>
          </Box>
          {laundryShops.length === 0 ? (
            <Alert severity="info">No laundry shops configured yet. <Button size="small" onClick={() => navigate('/laundry-shops')}>Add your first shop</Button></Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Shop</b></TableCell>
                  <TableCell><b>Location</b></TableCell>
                  <TableCell align="center"><b>Total Orders</b></TableCell>
                  <TableCell align="center"><b>Active / Processing</b></TableCell>
                  <TableCell align="center"><b>Done Today</b></TableCell>
                  <TableCell><b>Capacity</b></TableCell>
                  <TableCell align="center"><b>Status</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {laundryShops.map((shop) => {
                  const pct = shop.capacity ? Math.min(((shop.activeOrders ?? 0) / shop.capacity) * 100, 100) : 0;
                  return (
                    <TableRow key={shop.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/laundry-shops')}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 30, height: 30, bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main' }}>
                            <StoreIcon sx={{ fontSize: 16 }} />
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>{shop.shopName}</Typography>
                            <Typography variant="caption" color="text.secondary">{shop.shopCode}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{shop.city ?? '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">PIN: {shop.pincode ?? '—'}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={shop.totalOrders ?? 0} size="small" color="primary" sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={shop.activeOrders ?? 0}
                          size="small"
                          color={(shop.activeOrders ?? 0) > 0 ? 'warning' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={shop.completedToday ?? 0} size="small" color="success" sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        {shop.capacity ? (
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                              {shop.activeOrders ?? 0}/{shop.capacity}
                            </Typography>
                            <LinearProgress
                              variant="determinate" value={pct}
                              color={pct > 80 ? 'error' : pct > 50 ? 'warning' : 'success'}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">Unlimited</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={shop.isActive ? 'Active' : 'Inactive'}
                          color={shop.isActive ? 'success' : 'error'}
                          size="small" sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DashboardPage;
