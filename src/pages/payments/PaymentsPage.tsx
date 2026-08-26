import React, { useState, useMemo } from 'react';
import {
  Box, Card, Chip, Typography, Alert, Grid, Tabs, Tab,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Stack, Snackbar,
  IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import PaymentsIcon from '@mui/icons-material/Payments';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EditIcon from '@mui/icons-material/Edit';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { getOrders, updatePaymentStatus } from '../../api/orders';
import { formatCurrency, formatDateTime } from '../../utils/export';
import type { Order } from '../../types';

const modeColors: Record<string, { label: string; color: 'success' | 'secondary' | 'primary' | 'warning' | 'default'; bg?: string; text?: string; border?: string }> = {
  Cash:    { label: '💵 Paid in Cash', color: 'success', bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  GPay:    { label: '📱 Paid in GPay', color: 'secondary', bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  UPI:     { label: '📱 Paid in UPI', color: 'secondary', bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' },
  Online:  { label: '🌐 Paid Online', color: 'primary', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  Card:    { label: '💳 Paid by Card', color: 'primary', bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  Pending: { label: '⏳ Pending', color: 'warning', bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
};

const PaymentsPage: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Paid');
  const [selectedMode, setSelectedMode] = useState<string>('Cash');
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, status, mode }: { id: number; status: string; mode: string }) =>
      updatePaymentStatus(id, status, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      setEditOrder(null);
      setSnack({ msg: 'Payment status updated successfully!', severity: 'success' });
    },
    onError: (err: any) => {
      setSnack({ msg: err.response?.data?.message || 'Failed to update payment', severity: 'error' });
    },
  });

  // Unified rows: Every order has a payment state
  const allRows = useMemo(() => {
    return (orders as Order[]).map((o) => {
      const latestPayment = o.payments && o.payments.length > 0
        ? o.payments[o.payments.length - 1]
        : null;

      let rawMode = latestPayment?.paymentMode;
      if (!rawMode && o.notes) {
        const lower = o.notes.toLowerCase();
        if (lower.includes('gpay') || lower.includes('google pay')) rawMode = 'GPay';
        else if (lower.includes('upi') || lower.includes('qr')) rawMode = 'UPI';
        else if (lower.includes('cash') || lower.includes('cod')) rawMode = 'Cash';
        else if (lower.includes('online')) rawMode = 'Online';
        else if (lower.includes('card')) rawMode = 'Card';
      }
      const isPaid = o.paymentStatus === 'Paid';

      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customer,
        customerName: `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`.trim() || 'Customer',
        customerPhone: o.customer?.mobileNumber || '',
        paymentStatus: o.paymentStatus || 'Pending',
        paymentMode: isPaid ? (rawMode || 'Cash') : 'Pending',
        amount: o.netAmount,
        transactionReference: latestPayment?.transactionReference || '-',
        paidDate: latestPayment?.paidDate || o.createdDate,
      };
    });
  }, [orders]);

  // Statistics
  const totalRevenue = useMemo(() =>
    allRows.reduce((sum, r) => sum + (r.amount || 0), 0), [allRows]);

  const cashPaid = useMemo(() =>
    allRows
      .filter((r) => r.paymentStatus === 'Paid' && r.paymentMode === 'Cash')
      .reduce((sum, r) => sum + (r.amount || 0), 0), [allRows]);

  const upiPaid = useMemo(() =>
    allRows
      .filter((r) => r.paymentStatus === 'Paid' && (r.paymentMode === 'GPay' || r.paymentMode === 'UPI' || r.paymentMode === 'Online' || r.paymentMode === 'Card'))
      .reduce((sum, r) => sum + (r.amount || 0), 0), [allRows]);

  const pendingCollection = useMemo(() =>
    allRows
      .filter((r) => r.paymentStatus === 'Pending')
      .reduce((sum, r) => sum + (r.amount || 0), 0), [allRows]);

  // Filtered rows by tab
  const filteredRows = useMemo(() => {
    if (tab === 1) return allRows.filter((r) => r.paymentStatus === 'Paid' && r.paymentMode === 'Cash');
    if (tab === 2) return allRows.filter((r) => r.paymentStatus === 'Paid' && (r.paymentMode === 'GPay' || r.paymentMode === 'UPI' || r.paymentMode === 'Online' || r.paymentMode === 'Card'));
    if (tab === 3) return allRows.filter((r) => r.paymentStatus === 'Pending');
    return allRows;
  }, [allRows, tab]);

  const columns: GridColDef[] = [
    {
      field: 'orderNumber', headerName: 'Order #', width: 130,
      renderCell: (p) => <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{p.value}</Typography>,
    },
    {
      field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 160,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.value}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.row.customerPhone}</Typography>
        </Box>
      ),
    },
    {
      field: 'paymentMode', headerName: 'Payment Mode', width: 170,
      renderCell: (p) => {
        const mode = modeColors[p.value] || modeColors.Pending;
        return (
          <Chip
            label={mode.label}
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: 11,
              bgcolor: mode.bg || '#F3F4F6',
              color: mode.text || '#374151',
              border: `1px solid ${mode.border || '#E5E7EB'}`,
            }}
          />
        );
      },
    },
    {
      field: 'paymentStatus', headerName: 'Status', width: 120,
      renderCell: (p) => (
        <Chip
          label={p.value}
          color={p.value === 'Paid' ? 'success' : 'warning'}
          size="small"
          sx={{ fontWeight: 800, fontSize: 11 }}
        />
      ),
    },
    {
      field: 'amount', headerName: 'Net Amount', width: 130,
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 800, color: 'success.main', fontSize: 13 }}>
          {formatCurrency(p.value)}
        </Typography>
      ),
    },
    {
      field: 'paidDate', headerName: 'Date / Time', width: 180,
      renderCell: (p) => (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          {formatDateTime(p.value)}
        </Typography>
      ),
    },
    {
      field: 'actions', headerName: 'Actions', width: 90, sortable: false,
      renderCell: (p) => (
        <Tooltip title="Update Payment">
          <IconButton
            size="small"
            onClick={() => {
              setEditOrder(p.row);
              setSelectedStatus(p.row.paymentStatus);
              setSelectedMode(p.row.paymentMode === 'Pending' ? 'Cash' : p.row.paymentMode);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load payment data.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Payments & Collections"
        subtitle="Track cash collections, GPay/UPI transfers, and pending order payments in real-time"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Payments' }]}
      />

      {/* 4 Stat Cards: Total, Cash, UPI, Pending */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total Orders" value={formatCurrency(totalRevenue)} Icon={CurrencyRupeeIcon} color="#3B82F6" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Paid in Cash" value={formatCurrency(cashPaid)} Icon={PaymentsIcon} color="#10B981" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Paid in GPay / UPI" value={formatCurrency(upiPaid)} Icon={QrCodeIcon} color="#8B5CF6" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Pending Collection" value={formatCurrency(pendingCollection)} Icon={PendingActionsIcon} color="#EF4444" />
        </Grid>
      </Grid>

      {/* Filter Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All Transactions (${allRows.length})`} />
        <Tab label={`💵 Paid in Cash (${allRows.filter((r) => r.paymentStatus === 'Paid' && r.paymentMode === 'Cash').length})`} />
        <Tab label={`📱 Paid in GPay / UPI (${allRows.filter((r) => r.paymentStatus === 'Paid' && (r.paymentMode === 'GPay' || r.paymentMode === 'UPI' || r.paymentMode === 'Online' || r.paymentMode === 'Card')).length})`} />
        <Tab label={`⏳ Pending (${allRows.filter((r) => r.paymentStatus === 'Pending').length})`} />
      </Tabs>

      {/* Transactions DataGrid */}
      <Card>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={isLoading}
          autoHeight
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      {/* Update Payment Status & Mode Dialog */}
      <Dialog open={!!editOrder} onClose={() => setEditOrder(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Update Payment #{editOrder?.orderNumber}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Customer: <b>{editOrder?.customerName}</b> | Amount: <b>{formatCurrency(editOrder?.amount || 0)}</b>
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Payment Status</InputLabel>
              <Select
                value={selectedStatus}
                label="Payment Status"
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <MenuItem value="Paid">Paid</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Partially Paid">Partially Paid</MenuItem>
              </Select>
            </FormControl>

            {selectedStatus === 'Paid' && (
              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select
                  value={selectedMode}
                  label="Payment Mode"
                  onChange={(e) => setSelectedMode(e.target.value)}
                >
                  <MenuItem value="Cash">💵 Paid in Cash</MenuItem>
                  <MenuItem value="GPay">📱 Paid in GPay (Google Pay)</MenuItem>
                  <MenuItem value="UPI">📱 Paid in UPI / QR Code</MenuItem>
                  <MenuItem value="Online">🌐 Paid Online / NetBanking</MenuItem>
                  <MenuItem value="Card">💳 Paid by Card</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOrder(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={paymentMutation.isPending}
            startIcon={paymentMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => {
              if (editOrder) {
                paymentMutation.mutate({
                  id: editOrder.id,
                  status: selectedStatus,
                  mode: selectedStatus === 'Paid' ? selectedMode : 'Pending',
                });
              }
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Save Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Toast */}
      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack?.severity || 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PaymentsPage;
