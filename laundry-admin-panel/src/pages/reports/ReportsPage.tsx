import React from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button,
  Chip, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PageHeader from '../../components/PageHeader';
import { getDashboardStats } from '../../api/dashboard';
import { getOrders } from '../../api/orders';
import { formatCurrency, formatDate, exportToExcel, exportToPDF } from '../../utils/export';
import type { Order } from '../../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const ReportsPage: React.FC = () => {
  const { data: stats } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboardStats });
  const { data: orders = [] } = useQuery({ queryKey: ['orders'], queryFn: getOrders });

  const statusGroups = (orders as Order[]).reduce<Record<string, number>>((acc, o) => {
    acc[o.orderStatus] = (acc[o.orderStatus] ?? 0) + 1;
    return acc;
  }, {});

  const pieData = {
    labels: Object.keys(statusGroups),
    datasets: [{ data: Object.values(statusGroups), backgroundColor: ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'], borderWidth: 0 }],
  };

  const serviceRevenue = (orders as Order[]).reduce<Record<string, number>>((acc, o) => {
    (o.orderItems ?? []).forEach((item) => {
      const name = item.service?.serviceName ?? 'Unknown';
      acc[name] = (acc[name] ?? 0) + item.totalPrice;
    });
    return acc;
  }, {});

  const barData = {
    labels: Object.keys(serviceRevenue),
    datasets: [{ label: 'Revenue (₹)', data: Object.values(serviceRevenue), backgroundColor: '#6366F1', borderRadius: 8 }],
  };

  const handleExportOrders = () => exportToExcel(
    (orders as Order[]).map((o) => ({ 'Order #': o.orderNumber, Customer: `${o.customer?.firstName} ${o.customer?.lastName}`, Date: formatDate(o.createdDate), Status: o.orderStatus, Payment: o.paymentStatus, 'Net Amount': o.netAmount })),
    'orders_report'
  );

  const handleExportPDF = () => exportToPDF(
    'Orders Report', ['Order #', 'Customer', 'Date', 'Status', 'Payment', 'Amount'],
    (orders as Order[]).map((o) => [[o.orderNumber, `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`, formatDate(o.createdDate), o.orderStatus, o.paymentStatus, formatCurrency(o.netAmount)]]),
    'orders_report'
  );

  return (
    <Box>
      <PageHeader title="Reports & Analytics" subtitle="Business performance overview"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]}
        action={{ label: 'Export Excel', icon: <FileDownloadIcon />, onClick: handleExportOrders }}
        secondaryAction={{ label: 'Export PDF', icon: <PictureAsPdfIcon />, onClick: handleExportPDF }}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Order Status Distribution</Typography>
              <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {Object.keys(statusGroups).length > 0
                  ? <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                  : <Typography color="text.secondary">No data yet</Typography>
                }
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Revenue by Service</Typography>
              <Box sx={{ height: 300 }}>
                {Object.keys(serviceRevenue).length > 0
                  ? <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => `₹${Number(v).toLocaleString('en-IN')}` } } } }} />
                  : <Typography color="text.secondary">No data yet</Typography>
                }
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Top 5 Customers by Revenue</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><b>#</b></TableCell>
                    <TableCell><b>Customer</b></TableCell>
                    <TableCell align="right"><b>Orders</b></TableCell>
                    <TableCell align="right"><b>Total Spent</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(stats?.topCustomers ?? []).map((tc, i) => (
                    <TableRow key={i} hover>
                      <TableCell><Chip label={i + 1} size="small" color="primary" /></TableCell>
                      <TableCell><Typography sx={{ fontWeight: 600, fontSize: 13 }}>{tc.customer?.firstName} {tc.customer?.lastName}</Typography></TableCell>
                      <TableCell align="right">{tc.orderCount}</TableCell>
                      <TableCell align="right"><Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(tc.totalSpent)}</Typography></TableCell>
                    </TableRow>
                  ))}
                  {!stats?.topCustomers?.length && (
                    <TableRow><TableCell colSpan={4} align="center"><Typography color="text.secondary" variant="body2">No data</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Top Services by Volume</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><b>#</b></TableCell>
                    <TableCell><b>Service</b></TableCell>
                    <TableCell align="right"><b>Items Processed</b></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(stats?.topServices ?? []).map((ts, i) => (
                    <TableRow key={i} hover>
                      <TableCell><Chip label={i + 1} size="small" /></TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{ts.service?.serviceName}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{ts.service?.serviceType}</Typography>
                      </TableCell>
                      <TableCell align="right"><Typography sx={{ fontWeight: 700 }}>{ts.totalQuantity}</Typography></TableCell>
                    </TableRow>
                  ))}
                  {!stats?.topServices?.length && (
                    <TableRow><TableCell colSpan={3} align="center"><Typography color="text.secondary" variant="body2">No data</Typography></TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReportsPage;
