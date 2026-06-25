import React, { useMemo } from 'react';
import {
  Box, Card, Chip, Typography, Alert, Grid,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import PaymentIcon from '@mui/icons-material/Payment';
import PendingIcon from '@mui/icons-material/Pending';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { getOrders } from '../../api/orders';
import { formatCurrency, formatDateTime } from '../../utils/export';
import type { Order } from '../../types';

const paymentColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  Paid: 'success', Pending: 'warning', 'Partially Paid': 'error',
};

const PaymentsPage: React.FC = () => {
  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: getOrders });

  const allPayments = useMemo(() =>
    (orders as Order[]).flatMap((o) =>
      (o.payments ?? []).map((p) => ({ ...p, orderNumber: o.orderNumber, customer: o.customer, id: p.id }))
    ), [orders]);

  const totalPaid = useMemo(() => (orders as Order[]).filter((o) => o.paymentStatus === 'Paid').reduce((sum, o) => sum + o.netAmount, 0), [orders]);
  const totalPending = useMemo(() => (orders as Order[]).filter((o) => o.paymentStatus === 'Pending').reduce((sum, o) => sum + o.netAmount, 0), [orders]);

  const columns: GridColDef[] = [
    { field: 'orderNumber', headerName: 'Order #', width: 140, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
    { field: 'customer', headerName: 'Customer', flex: 1, minWidth: 160, renderCell: (p) => <Typography sx={{ fontSize: 13 }}>{(p.value as { firstName?: string; lastName?: string })?.firstName} {(p.value as { firstName?: string; lastName?: string })?.lastName}</Typography> },
    { field: 'paymentMode', headerName: 'Mode', width: 120, renderCell: (p) => <Chip label={p.value} size="small" variant="outlined" /> },
    { field: 'paymentStatus', headerName: 'Status', width: 130, renderCell: (p) => <Chip label={p.value} color={paymentColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} /> },
    { field: 'amount', headerName: 'Amount', width: 130, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(p.value)}</Typography> },
    { field: 'transactionReference', headerName: 'Ref #', width: 150, renderCell: (p) => p.value || '-' },
    { field: 'paidDate', headerName: 'Date', width: 180, renderCell: (p) => formatDateTime(p.value) },
  ];

  if (error) return <Alert severity="error">Failed to load payment data.</Alert>;

  return (
    <Box>
      <PageHeader title="Payment Management" subtitle="Overview of all transactions"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Payments' }]}
      />

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Total Revenue" value={formatCurrency(totalPaid + totalPending)} Icon={CurrencyRupeeIcon} color="#10B981" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Collected (Paid)" value={formatCurrency(totalPaid)} Icon={PaymentIcon} color="#6366F1" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="Pending Collection" value={formatCurrency(totalPending)} Icon={PendingIcon} color="#EF4444" />
        </Grid>
      </Grid>

      {allPayments.length > 0 ? (
        <Card>
          <DataGrid rows={allPayments} columns={columns} loading={isLoading} autoHeight
            pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none' }}
          />
        </Card>
      ) : (
        <Card>
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary" gutterBottom sx={{ fontWeight: 700 }}>Orders Summary</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Order #</b></TableCell>
                  <TableCell><b>Customer</b></TableCell>
                  <TableCell><b>Payment Status</b></TableCell>
                  <TableCell align="right"><b>Net Amount</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(orders as Order[]).map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell><Typography sx={{ fontWeight: 700, fontSize: 13 }}>{o.orderNumber}</Typography></TableCell>
                    <TableCell>{o.customer?.firstName} {o.customer?.lastName}</TableCell>
                    <TableCell><Chip label={o.paymentStatus} color={paymentColors[o.paymentStatus] ?? 'default'} size="small" /></TableCell>
                    <TableCell align="right"><Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(o.netAmount)}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default PaymentsPage;
