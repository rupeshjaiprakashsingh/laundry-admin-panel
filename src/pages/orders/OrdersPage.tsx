import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Chip, Typography, IconButton, Tooltip, Grid,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableFooter, TableHead, TableRow, Divider,
  Alert, CircularProgress, Stack, InputAdornment, Badge, Avatar,
  List, ListItemButton, ListItemText, ListItemAvatar,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowSelectionModel } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StoreIcon from '@mui/icons-material/Store';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import PageHeader from '../../components/PageHeader';
import { getOrders, updateOrderStatus, updatePaymentStatus, bulkAssignOrdersToShop } from '../../api/orders';
import { getLaundryShops } from '../../api/laundryShops';
import { getEmployees } from '../../api/employees';
import { formatCurrency, formatDate, formatDateTime, exportToExcel, exportToPDF } from '../../utils/export';
import { renderPaymentChip, resolvePaymentInfo } from '../../utils/paymentUtils';
import type { Order, LaundryShop, Employee } from '../../types';
import api from '../../api/axios';

const ORDER_STATUSES = [
  'New Order',
  'Pickup Scheduled',
  'Picked Up',
  'Laundry',
  'Processing',
  'Ready For Delivery',
  'Out For Delivery',
  'Delivered',
  'Cancelled',
];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partially Paid'];

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  'New Order': 'info',
  'Pickup Scheduled': 'warning',
  'Picked Up': 'secondary',
  Laundry: 'warning',
  Processing: 'warning',
  Washing: 'warning',
  'Dry Cleaning': 'warning',
  Ironing: 'warning',
  'Ready For Delivery': 'info',
  'Out For Delivery': 'primary',
  Delivered: 'success',
  Cancelled: 'error',
};
const paymentColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  Paid: 'success', Pending: 'warning', 'Partially Paid': 'error',
};

const OrdersPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [newPayment, setNewPayment] = useState('');
  const [newPaymentMode, setNewPaymentMode] = useState('Cash');

  // Multi-select state for bulk assign
  const [selectedRowIds, setSelectedRowIds] = useState<GridRowSelectionModel>({ type: 'include', ids: new Set() });
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [bulkDeliveryOpen, setBulkDeliveryOpen] = useState(false);
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState<number | null>(null);
  const [bulkDeliveryResult, setBulkDeliveryResult] = useState<{ success: number; failed: number } | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });
  const { data: laundryShops = [] } = useQuery({
    queryKey: ['laundry-shops'],
    queryFn: getLaundryShops,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });
  const deliveryBoys = (employees as Employee[]).filter(e => ['DeliveryBoy', 'Employee'].includes(e.role) && e.isActive);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null); },
  });
  const paymentMutation = useMutation({
    mutationFn: ({ id, status, mode }: { id: number; status: string; mode?: string }) => updatePaymentStatus(id, status, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['pickups'] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['my-pickups'] });
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      setEditOrder(null);
    },
  });
  const bulkAssignMutation = useMutation({
    mutationFn: ({ orderIds, shopId }: { orderIds: number[]; shopId: number }) =>
      bulkAssignOrdersToShop(orderIds, shopId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['laundry-shops'] });
      qc.invalidateQueries({ queryKey: ['pickups'] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['my-pickups'] });
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      setBulkAssignOpen(false);
      setSelectedRowIds({ type: 'include', ids: new Set() });
      setSelectedShopId(null);
    },
  });
  const bulkDeliveryMutation = useMutation({
    mutationFn: async ({ orderIds, empId }: { orderIds: number[]; empId: number }) => {
      let success = 0; let failed = 0;
      for (const orderId of orderIds) {
        try {
          await api.post('/deliveries', { orderId, deliveryEmployeeId: empId });
          success++;
        } catch { failed++; }
      }
      return { success, failed };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['pickups'] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['my-pickups'] });
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      setBulkDeliveryOpen(false);
      setSelectedRowIds({ type: 'include', ids: new Set() });
      setSelectedDeliveryBoyId(null);
      setBulkDeliveryResult(result);
    },
  });

  // Auto-suggest: get pincode of the first selected order's customer
  const firstSelectedOrder = useMemo(() => {
    if (selectedRowIds.ids.size === 0) return undefined;
    const firstId = selectedRowIds.ids.values().next().value;
    return firstId ? orders.find((o) => o.id === firstId) : undefined;
  }, [selectedRowIds, orders]);
  const firstPincode = firstSelectedOrder?.customer?.pincode;
  const sortedShops = useMemo(() => {
    if (!firstPincode) return laundryShops.filter((s) => s.isActive);
    const active = laundryShops.filter((s) => s.isActive);
    const exact = active.filter((s) => s.pincode === firstPincode);
    const partial = active.filter((s) => s.pincode !== firstPincode && s.pincode?.startsWith(firstPincode.substring(0, 3)));
    const rest = active.filter((s) => !exact.includes(s) && !partial.includes(s));
    return [...exact, ...partial, ...rest];
  }, [laundryShops, firstPincode]);

  const filtered = useMemo(() => orders.filter((o) => {
    const matchStatus = statusFilter === 'All' || o.orderStatus === statusFilter;
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      `${o.customer?.firstName} ${o.customer?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer?.customerCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.customer?.mobileNumber || '').includes(search);
    return matchStatus && matchSearch;
  }), [orders, search, statusFilter]);

  const columns: GridColDef[] = [
    {
      field: 'orderNumber',
      headerName: 'Order #',
      width: 120,
      renderCell: (p) => {
        const isPriority = p.row.orderItems?.some((item: any) =>
          (item.service?.serviceName || '').toLowerCase().includes('priority') ||
          (item.service?.serviceType || '').toLowerCase().includes('priority')
        ) || (p.row.notes && p.row.notes.toLowerCase().includes('priority'));

        return (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 12.5 }}>{p.value}</Typography>
            {isPriority && (
              <Chip
                label="⚡ Priority"
                size="small"
                sx={{
                  height: 16,
                  fontSize: 9.5,
                  fontWeight: 800,
                  bgcolor: '#FFF7ED',
                  color: '#EA580C',
                  border: '1px solid #FED7AA',
                  mt: 0.25,
                }}
              />
            )}
          </Box>
        );
      },
    },
    {
      field: 'customerCode',
      headerName: 'Customer Code',
      width: 115,
      valueGetter: (_v: unknown, row: Order) => row.customer?.customerCode || '-',
      renderCell: (p) => (
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 11.5,
            color: 'primary.main',
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : '#EEF2FF',
            border: '1px solid',
            borderColor: (t) => t.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE',
            px: 0.8,
            py: 0.2,
            borderRadius: 1,
            display: 'inline-block',
            lineHeight: 1.3,
          }}
        >
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'customer',
      headerName: 'Customer',
      flex: 1,
      minWidth: 130,
      renderCell: (p) => (
        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.row.customer?.firstName} {p.row.customer?.lastName}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>
            {p.row.customer?.mobileNumber}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'createdDate',
      headerName: 'Date',
      width: 92,
      renderCell: (p) => <Typography sx={{ fontSize: 12 }}>{formatDate(p.value)}</Typography>,
    },
    {
      field: 'orderStatus',
      headerName: 'Status',
      width: 135,
      renderCell: (p) => <Chip label={p.value} color={statusColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700, fontSize: 11, height: 22 }} />,
    },
    {
      field: 'paymentStatus',
      headerName: 'Payment',
      width: 135,
      renderCell: (p) => {
        const row = p.row;
        const latestPayment = row.payments && row.payments.length > 0 ? row.payments[row.payments.length - 1] : null;
        return renderPaymentChip(row.paymentStatus, latestPayment?.paymentMode, row.notes);
      },
    },
    {
      field: 'laundryShop',
      headerName: 'Laundry Shop',
      width: 125,
      renderCell: (p) => p.row.laundryShop ? (
        <Chip
          icon={<StoreIcon sx={{ fontSize: '13px !important' }} />}
          label={p.row.laundryShop.shopName}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 600, maxWidth: 115, fontSize: 10.5, height: 22 }}
        />
      ) : (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontStyle: 'italic' }}>Not assigned</Typography>
      ),
    },
    {
      field: 'netAmount',
      headerName: 'Amount',
      width: 85,
      renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: 'success.main' }}>{formatCurrency(p.value)}</Typography>,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 70,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={0}>
          <Tooltip title="View Details"><IconButton size="small" onClick={() => setSelectedOrder(p.row)}><VisibilityIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
          <Tooltip title="Update Status"><IconButton size="small" onClick={() => {
            setEditOrder(p.row);
            setNewStatus(p.row.orderStatus);
            setNewPayment(p.row.paymentStatus);
            const lastPayment = p.row.payments && p.row.payments.length > 0 ? p.row.payments[p.row.payments.length - 1] : null;
            const { resolvedMode } = resolvePaymentInfo(p.row.paymentStatus, lastPayment?.paymentMode, p.row.notes);
            setNewPaymentMode(resolvedMode === 'Pending' ? 'Cash' : resolvedMode);
          }}><EditIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  const getOrderPaymentLabel = (o: Order) => {
    const latestPayment = o.payments && o.payments.length > 0 ? o.payments[o.payments.length - 1] : null;
    const { isPaid, displayLabel } = resolvePaymentInfo(o.paymentStatus, latestPayment?.paymentMode, o.notes);
    return isPaid ? displayLabel.replace(/^[\p{Emoji}\s]+/u, '') : (o.paymentStatus || 'Pending');
  };

  const handleExcelExport = () => exportToExcel(
    filtered.map((o) => ({
      'Order #': o.orderNumber,
      'Customer Code': o.customer?.customerCode ?? 'N/A',
      Customer: `${o.customer?.firstName} ${o.customer?.lastName}`,
      Date: formatDate(o.createdDate),
      Status: o.orderStatus,
      Payment: getOrderPaymentLabel(o),
      'Laundry Shop': o.laundryShop?.shopName ?? 'N/A',
      Amount: o.netAmount,
    })),
    'orders'
  );

  const handlePdfExport = () => exportToPDF(
    'Orders Report',
    ['Order #', 'Customer Code', 'Customer', 'Date', 'Status', 'Payment', 'Laundry Shop', 'Amount'],
    filtered.map((o) => [[
      o.orderNumber,
      o.customer?.customerCode ?? 'N/A',
      `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`,
      formatDate(o.createdDate),
      o.orderStatus,
      getOrderPaymentLabel(o),
      o.laundryShop?.shopName ?? 'N/A',
      formatCurrency(o.netAmount),
    ]]),
    'orders'
  );

  if (error) return <Alert severity="error">Failed to load orders.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Order Management" subtitle={`${filtered.length} orders`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Orders' }]}
        action={{ label: 'Export Excel', icon: <FileDownloadIcon />, onClick: handleExcelExport }}
        secondaryAction={{ label: 'Export PDF', icon: <PictureAsPdfIcon />, onClick: handlePdfExport }}
      />

      {/* Bulk Action Bar — shows when rows are selected */}
      {selectedRowIds.ids.size > 0 && (
        <Card sx={{ mb: 2, border: (t) => `2px solid ${t.palette.primary.main}`, bgcolor: (t) => t.palette.action.hover }}>
          <CardContent sx={{ p: '12px 16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge badgeContent={selectedRowIds.ids.size} color="primary">
              <AssignmentIcon color="primary" />
            </Badge>
            <Typography sx={{ fontWeight: 700, flex: 1 }}>
              {selectedRowIds.ids.size} order{selectedRowIds.ids.size !== 1 ? 's' : ''} selected
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<StoreIcon />}
              onClick={() => setBulkAssignOpen(true)}
            >
              Assign to Laundry Shop
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DeliveryDiningIcon />}
              onClick={() => setBulkDeliveryOpen(true)}
              sx={{ borderColor: '#F59E0B', color: '#D97706', '&:hover': { bgcolor: '#FFFBEB' } }}
            >
              Assign to Delivery Boy
            </Button>
            <Button size="small" onClick={() => setSelectedRowIds({ type: 'include', ids: new Set() })}>Clear Selection</Button>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField size="small" placeholder="Search orders or customers..." value={search} onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select value={statusFilter} label="Status Filter" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="All">All Statuses</MenuItem>
                {ORDER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <DataGrid
          rows={filtered} columns={columns} loading={isLoading} autoHeight
          checkboxSelection
          rowSelectionModel={selectedRowIds}
          onRowSelectionModelChange={setSelectedRowIds}
          getRowId={(row: any) => row.id}
          pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick={false}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaders': { fontWeight: 700 },
            '& .MuiDataGrid-virtualScroller': { overflowX: 'hidden' },
          }}
        />
      </Card>

      {/* ---- View Order Details Dialog ---- */}
      <Dialog open={!!selectedOrder} onClose={() => setSelectedOrder(null)} maxWidth="md" fullWidth>
        <DialogTitle><Typography sx={{ fontWeight: 700 }}>Order #{selectedOrder?.orderNumber}</Typography></DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">Customer</Typography>
                  {selectedOrder.customer?.customerCode && (
                    <Chip
                      label={selectedOrder.customer.customerCode}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 18, fontSize: 10.5, fontWeight: 700 }}
                    />
                  )}
                </Box>
                <Typography sx={{ fontWeight: 700 }}>{selectedOrder.customer?.firstName} {selectedOrder.customer?.lastName}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedOrder.customer?.mobileNumber}</Typography>
                {(selectedOrder.address || selectedOrder.customer) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic', fontSize: 12 }}>
                    📍 {selectedOrder.addressTitle ? `[${selectedOrder.addressTitle}] ` : ''}
                    {selectedOrder.address 
                      ? `${selectedOrder.houseDetails ? `${selectedOrder.houseDetails}, ` : ''}${selectedOrder.landmark ? `${selectedOrder.landmark}, ` : ''}${selectedOrder.address}, ${selectedOrder.city || ''}, ${selectedOrder.state || ''}${selectedOrder.pincode ? ` - ${selectedOrder.pincode}` : ''}`
                      : `${selectedOrder.customer?.houseDetails ? `${selectedOrder.customer.houseDetails}, ` : ''}${selectedOrder.customer?.landmark ? `${selectedOrder.customer.landmark}, ` : ''}${selectedOrder.customer?.address || ''}, ${selectedOrder.customer?.city || ''}, ${selectedOrder.customer?.state || ''}${selectedOrder.customer?.pincode ? ` - ${selectedOrder.customer.pincode}` : ''}`
                    }
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">Order Date</Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatDate(selectedOrder.createdDate)}</Typography>
                {selectedOrder.laundryShop && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">Assigned Laundry Shop</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <StoreIcon fontSize="small" color="primary" />
                      <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>{selectedOrder.laundryShop.shopName}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {selectedOrder.laundryShop.city} · PIN: {selectedOrder.laundryShop.pincode}
                    </Typography>
                  </Box>
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box><Chip label={selectedOrder.orderStatus} color={statusColors[selectedOrder.orderStatus] ?? 'default'} size="small" /></Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">Payment Status & Mode</Typography>
                <Box sx={{ mt: 0.5 }}>
                  {(() => {
                    const latestPayment = selectedOrder.payments && selectedOrder.payments.length > 0 ? selectedOrder.payments[selectedOrder.payments.length - 1] : null;
                    return renderPaymentChip(selectedOrder.paymentStatus, latestPayment?.paymentMode, selectedOrder.notes);
                  })()}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">Net Amount</Typography>
                <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(selectedOrder.netAmount)}</Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Schedule & Instructions</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary">Customer Requested Pickup</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {selectedOrder.pickupDate ? formatDate(selectedOrder.pickupDate) : 'Not requested'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary">Selected Time Slot</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {selectedOrder.notes?.includes('Slot:') 
                        ? selectedOrder.notes.split('|').find(p => p.includes('Slot:'))?.replace('Slot:', '').trim()
                        : selectedOrder.pickupDate 
                          ? new Date(selectedOrder.pickupDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary">Estimated Delivery</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {selectedOrder.deliveryDate ? formatDate(selectedOrder.deliveryDate) : 'Not scheduled'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">Customer Instructions & Order Info</Typography>
                    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider', mt: 0.5 }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontStyle: selectedOrder.notes ? 'normal' : 'italic' }}>
                        {selectedOrder.notes ? selectedOrder.notes.split('|').map(p => {
                          let text = p.trim();
                          if (/First Order Discount:\s*Rs\.\s*20\s*Applied/i.test(text) && selectedOrder.discountAmount >= 50) {
                            text = `First Order Discount: Rs. ${selectedOrder.discountAmount.toFixed(0)} Applied`;
                          }
                          return text;
                        }).join('\n') : 'No notes or instructions provided.'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography sx={{ fontWeight: 700, mb: 1 }}>Order Activity Timeline</Typography>
                {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                  <Stack spacing={1} sx={{ pl: 1, mb: 2 }}>
                    {selectedOrder.statusHistory.map((history, idx) => (
                      <Box key={history.id || idx} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%',
                          bgcolor: idx === selectedOrder.statusHistory!.length - 1 ? 'warning.main' : 'success.main',
                          mr: 1.5
                        }} />
                        <Typography variant="body2" sx={{ fontWeight: idx === selectedOrder.statusHistory!.length - 1 ? 700 : 400, fontSize: 13 }}>
                          {history.status} — <span style={{ color: 'gray', fontSize: 11 }}>{formatDateTime(history.createdDate)}</span>
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No status history logged.</Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1 }} />
                <Typography sx={{ fontWeight: 700 }} gutterBottom>Order Items</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell align="right">Qty</TableCell>
                      <TableCell align="right">Unit Price</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(selectedOrder.orderItems ?? []).map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>{item.clothType}</TableCell>
                        <TableCell>{item.service?.serviceName}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{formatCurrency(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {/* ── Order Items Totals Footer ── */}
                  <TableFooter>
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell
                        colSpan={2}
                        sx={{ fontWeight: 700, fontSize: 13, borderTop: '2px solid', borderColor: 'divider', py: 1 }}
                      >
                        🧺 Total Clothes (Types)
                      </TableCell>
                      <TableCell
                        align="right"
                        colSpan={3}
                        sx={{ fontWeight: 800, fontSize: 14, borderTop: '2px solid', borderColor: 'divider', color: 'primary.main', py: 1 }}
                      >
                        {(selectedOrder.orderItems ?? []).length} item{(selectedOrder.orderItems ?? []).length !== 1 ? 's' : ''}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'primary.main' }}>
                      <TableCell
                        colSpan={2}
                        sx={{ fontWeight: 700, fontSize: 13, color: 'primary.contrastText', py: 1 }}
                      >
                        👕 Total Qty (All Clothes)
                      </TableCell>
                      <TableCell
                        align="right"
                        colSpan={3}
                        sx={{ fontWeight: 900, fontSize: 15, color: 'primary.contrastText', py: 1 }}
                      >
                        {(selectedOrder.orderItems ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)} pcs
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </Grid>

              {/* ── Payment & Billing Breakdown Summary ── */}
              <Grid size={{ xs: 12 }}>
                <Divider sx={{ my: 1.5 }} />
                <Typography sx={{ fontWeight: 700, mb: 1 }}>💳 Payment & Billing Summary</Typography>
                <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={1.2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(selectedOrder.totalAmount)}</Typography>
                    </Grid>

                    {selectedOrder.discountAmount > 0 && (
                      <>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>
                            Discount Applied
                          </Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 800 }}>
                            -{formatCurrency(selectedOrder.discountAmount)}
                          </Typography>
                        </Grid>
                      </>
                    )}

                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Platform Fee</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="body2">{formatCurrency((selectedOrder as any).platformFee ?? 5.0)}</Typography>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">GST (18%)</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="body2">{formatCurrency(selectedOrder.taxAmount)}</Typography>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Delivery Charge</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" color={((selectedOrder as any).deliveryCharge ?? 0) === 0 ? 'success.main' : 'text.primary'} sx={{ fontWeight: ((selectedOrder as any).deliveryCharge ?? 0) === 0 ? 700 : 400 }}>
                        {((selectedOrder as any).deliveryCharge ?? 0) === 0 ? 'Free' : formatCurrency((selectedOrder as any).deliveryCharge)}
                      </Typography>
                    </Grid>

                    {(selectedOrder as any).insuranceCharge && (selectedOrder as any).insuranceCharge > 0 ? (
                      <>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2" color="text.secondary">Order Protection (Insurance)</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                          <Typography variant="body2">{formatCurrency((selectedOrder as any).insuranceCharge)}</Typography>
                        </Grid>
                      </>
                    ) : null}

                    {(selectedOrder as any).totalSavings && (selectedOrder as any).totalSavings > 0 ? (
                      <>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>Total Savings</Typography>
                        </Grid>
                        <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 700 }}>
                            -{formatCurrency((selectedOrder as any).totalSavings)}
                          </Typography>
                        </Grid>
                      </>
                    ) : null}

                    <Grid size={{ xs: 12 }}>
                      <Divider sx={{ my: 0.5 }} />
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Total Payable / Net Amount</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'success.main', fontSize: 18 }}>
                        {formatCurrency(selectedOrder.netAmount)}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedOrder(null)}>Close</Button></DialogActions>
      </Dialog>

      {/* ---- Edit Status Dialog ---- */}
      <Dialog open={!!editOrder} onClose={() => setEditOrder(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Update Order #{editOrder?.orderNumber}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Order Status</InputLabel>
              <Select value={newStatus} label="Order Status" onChange={(e) => setNewStatus(e.target.value)}>
                {ORDER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Payment Status</InputLabel>
              <Select value={newPayment} label="Payment Status" onChange={(e) => setNewPayment(e.target.value)}>
                {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>

            {newPayment === 'Paid' && (
              <FormControl fullWidth size="small">
                <InputLabel>Payment Mode</InputLabel>
                <Select value={newPaymentMode} label="Payment Mode" onChange={(e) => setNewPaymentMode(e.target.value)}>
                  <MenuItem value="UPI (Razorpay)">📱 Paid in UPI (Razorpay)</MenuItem>
                  <MenuItem value="UPI">📱 Paid in UPI / QR Code</MenuItem>
                  <MenuItem value="GPay">📱 Paid in GPay (Google Pay)</MenuItem>
                  <MenuItem value="Online">🌐 Paid Online / NetBanking</MenuItem>
                  <MenuItem value="Card">💳 Paid by Card</MenuItem>
                  <MenuItem value="Cash">💵 Paid in Cash</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOrder(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained"
            disabled={statusMutation.isPending || paymentMutation.isPending}
            startIcon={(statusMutation.isPending || paymentMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => {
              if (editOrder) {
                if (newStatus !== editOrder.orderStatus) statusMutation.mutate({ id: editOrder.id, status: newStatus });
                if (newPayment !== editOrder.paymentStatus || newPayment === 'Paid') {
                  paymentMutation.mutate({ id: editOrder.id, status: newPayment, mode: newPaymentMode });
                }
                if (newStatus === editOrder.orderStatus && newPayment === editOrder.paymentStatus && newPayment !== 'Paid') {
                  setEditOrder(null);
                }
              }
            }}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Bulk Assign Shop Dialog ---- */}
      <Dialog open={bulkAssignOpen} onClose={() => { setBulkAssignOpen(false); setSelectedShopId(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StoreIcon color="primary" />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Assign to Laundry Shop</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedRowIds.ids.size} order{selectedRowIds.ids.size !== 1 ? 's' : ''} selected
                {firstPincode && ` · Suggesting shops near PIN: ${firstPincode}`}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {sortedShops.length === 0 ? (
            <Alert severity="warning">No active laundry shops found. Please add one first.</Alert>
          ) : (
            <List disablePadding>
              {sortedShops.map((shop: LaundryShop, idx) => {
                const isExact = shop.pincode === firstPincode;
                const isNear = !isExact && firstPincode && shop.pincode?.startsWith(firstPincode.substring(0, 3));
                return (
                  <ListItemButton
                    key={shop.id}
                    selected={selectedShopId === shop.id}
                    onClick={() => setSelectedShopId(shop.id)}
                    sx={{ borderRadius: 2, mb: 1, border: (t) => selectedShopId === shop.id ? `2px solid ${t.palette.primary.main}` : '2px solid transparent' }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: isExact ? 'success.main' : isNear ? 'warning.main' : 'action.selected' }}>
                        <StoreIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                           <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{shop.shopName}</Typography>
                          {isExact && <Chip label="📍 Exact Match" size="small" color="success" sx={{ fontSize: 10, height: 20 }} />}
                          {isNear && <Chip label="Near Match" size="small" color="warning" sx={{ fontSize: 10, height: 20 }} />}
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {shop.shopCode} · {shop.city ?? '—'} · PIN: {shop.pincode ?? '—'} ·
                          {shop.capacity
                            ? ` Capacity: ${shop.activeOrders ?? 0}/${shop.capacity}`
                            : ' Unlimited capacity'}
                        </Typography>
                      }
                    />
                    {selectedShopId === shop.id && <CheckCircleIcon color="primary" />}
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBulkAssignOpen(false); setSelectedShopId(null); }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedShopId || bulkAssignMutation.isPending}
            startIcon={bulkAssignMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <AssignmentIcon />}
            onClick={() => {
              if (selectedShopId) {
                bulkAssignMutation.mutate({ orderIds: Array.from(selectedRowIds.ids) as number[], shopId: selectedShopId });
              }
            }}
          >
            {bulkAssignMutation.isPending ? 'Assigning...' : `Assign ${selectedRowIds.ids.size} Order${selectedRowIds.ids.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Bulk Assign Delivery Boy Dialog ---- */}
      <Dialog open={bulkDeliveryOpen} onClose={() => { setBulkDeliveryOpen(false); setSelectedDeliveryBoyId(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeliveryDiningIcon sx={{ color: '#F59E0B' }} />
            <Box>
              <Typography sx={{ fontWeight: 700 }}>Assign to Delivery Boy</Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedRowIds.ids.size} order{selectedRowIds.ids.size !== 1 ? 's' : ''} will be assigned for pickup & delivery
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {deliveryBoys.length === 0 ? (
            <Alert severity="warning">No active Delivery Boys found. Go to Employees and add one with role 'DeliveryBoy'.</Alert>
          ) : (
            <List disablePadding>
              {deliveryBoys.map((emp) => (
                <ListItemButton
                  key={emp.id}
                  selected={selectedDeliveryBoyId === emp.id}
                  onClick={() => setSelectedDeliveryBoyId(emp.id)}
                  sx={{ borderRadius: 2, mb: 1, border: (t) => selectedDeliveryBoyId === emp.id ? `2px solid ${t.palette.primary.main}` : '2px solid transparent' }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#F59E0B', fontWeight: 700, fontSize: 14 }}>
                      {emp.fullName.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 700, fontSize: 14 }}>{emp.fullName}</Typography>}
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {emp.employeeCode} · {emp.mobileNumber} · <Chip label={emp.role} size="small" color="warning" sx={{ fontSize: 9, height: 16 }} />
                      </Typography>
                    }
                  />
                  {selectedDeliveryBoyId === emp.id && <CheckCircleIcon color="primary" />}
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBulkDeliveryOpen(false); setSelectedDeliveryBoyId(null); }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedDeliveryBoyId || bulkDeliveryMutation.isPending}
            startIcon={bulkDeliveryMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeliveryDiningIcon />}
            sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
            onClick={() => {
              if (selectedDeliveryBoyId) {
                bulkDeliveryMutation.mutate({ orderIds: Array.from(selectedRowIds.ids) as number[], empId: selectedDeliveryBoyId });
              }
            }}
          >
            {bulkDeliveryMutation.isPending ? 'Assigning...' : `Assign ${selectedRowIds.ids.size} Order${selectedRowIds.ids.size !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Bulk Delivery Result Dialog ---- */}
      <Dialog open={!!bulkDeliveryResult} onClose={() => setBulkDeliveryResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assignment Result</DialogTitle>
        <DialogContent>
          {bulkDeliveryResult && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography sx={{ fontSize: 32, mb: 1 }}>{bulkDeliveryResult.failed === 0 ? '✅' : '⚠️'}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>
                {bulkDeliveryResult.success} order{bulkDeliveryResult.success !== 1 ? 's' : ''} assigned!
              </Typography>
              {bulkDeliveryResult.failed > 0 && (
                <Typography color="error">{bulkDeliveryResult.failed} order(s) failed (may already have a delivery)</Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setBulkDeliveryResult(null)}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersPage;
