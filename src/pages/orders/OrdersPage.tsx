import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Chip, Typography, IconButton, Tooltip, Grid,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Divider,
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
import type { Order, LaundryShop, Employee } from '../../types';
import api from '../../api/axios';

const ORDER_STATUSES = [
  'New Order', 'Picked Up', 'Laundry',
  'Out For Delivery', 'Delivered',
];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partially Paid'];

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  'New Order': 'info', 'Picked Up': 'secondary',
  Laundry: 'warning',
  'Out For Delivery': 'secondary', Delivered: 'success',
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

  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: getOrders });
  const { data: laundryShops = [] } = useQuery({ queryKey: ['laundry-shops'], queryFn: getLaundryShops });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });
  const deliveryBoys = (employees as Employee[]).filter(e => ['DeliveryBoy', 'Employee'].includes(e.role) && e.isActive);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null); },
  });
  const paymentMutation = useMutation({
    mutationFn: ({ id, status, mode }: { id: number; status: string; mode?: string }) => updatePaymentStatus(id, status, mode),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null); },
  });
  const bulkAssignMutation = useMutation({
    mutationFn: ({ orderIds, shopId }: { orderIds: number[]; shopId: number }) =>
      bulkAssignOrdersToShop(orderIds, shopId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['laundry-shops'] });
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
      `${o.customer?.firstName} ${o.customer?.lastName}`.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  }), [orders, search, statusFilter]);

  const columns: GridColDef[] = [
    {
      field: 'orderNumber',
      headerName: 'Order #',
      width: 155,
      renderCell: (p) => {
        const isPriority = p.row.orderItems?.some((item: any) =>
          (item.service?.serviceName || '').toLowerCase().includes('priority') ||
          (item.service?.serviceType || '').toLowerCase().includes('priority')
        ) || (p.row.notes && p.row.notes.toLowerCase().includes('priority'));

        return (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography>
            {isPriority && (
              <Chip
                label="⚡ Priority"
                size="small"
                sx={{
                  height: 18,
                  fontSize: 10,
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
      field: 'customer', headerName: 'Customer', flex: 1, minWidth: 150,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.row.customer?.firstName} {p.row.customer?.lastName}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.row.customer?.mobileNumber}</Typography>
        </Box>
      ),
    },
    { field: 'createdDate', headerName: 'Date', width: 110, renderCell: (p) => formatDate(p.value) },
    { field: 'orderStatus', headerName: 'Status', width: 165, renderCell: (p) => <Chip label={p.value} color={statusColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} /> },
    {
      field: 'paymentStatus', headerName: 'Payment', width: 180,
      renderCell: (p) => {
        const row = p.row;
        const latestPayment = row.payments && row.payments.length > 0 ? row.payments[row.payments.length - 1] : null;
        let mode = latestPayment?.paymentMode;
        if (!mode && row.notes) {
          const lower = row.notes.toLowerCase();
          if (lower.includes('gpay') || lower.includes('google pay')) mode = 'GPay';
          else if (lower.includes('upi') || lower.includes('qr')) mode = 'UPI';
          else if (lower.includes('cash') || lower.includes('cod')) mode = 'Cash';
          else if (lower.includes('online')) mode = 'Online';
          else if (lower.includes('card')) mode = 'Card';
        }

        const isPaid = row.paymentStatus === 'Paid';
        if (isPaid) {
          const resolvedMode = mode || 'Cash';
          if (resolvedMode === 'GPay') {
            return <Chip label="📱 Paid in GPay" size="small" sx={{ fontWeight: 800, bgcolor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE' }} />;
          }
          if (resolvedMode === 'UPI') {
            return <Chip label="📱 Paid in UPI" size="small" sx={{ fontWeight: 800, bgcolor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF' }} />;
          }
          if (resolvedMode === 'Online') {
            return <Chip label="🌐 Paid Online" size="small" sx={{ fontWeight: 800, bgcolor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }} />;
          }
          if (resolvedMode === 'Card') {
            return <Chip label="💳 Paid by Card" size="small" sx={{ fontWeight: 800, bgcolor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC' }} />;
          }
          return <Chip label="💵 Paid in Cash" size="small" sx={{ fontWeight: 800, bgcolor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' }} />;
        }

        if (row.paymentStatus === 'Partially Paid') {
          return <Chip label="⚠️ Partially Paid" size="small" sx={{ fontWeight: 800, bgcolor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }} />;
        }

        return <Chip label={mode ? `⏳ Pending (${mode})` : '⏳ Pending'} size="small" sx={{ fontWeight: 700, bgcolor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' }} />;
      },
    },
    {
      field: 'laundryShop', headerName: 'Laundry Shop', width: 160,
      renderCell: (p) => p.row.laundryShop ? (
        <Chip
          icon={<StoreIcon sx={{ fontSize: '14px !important' }} />}
          label={p.row.laundryShop.shopName}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontWeight: 600, maxWidth: 150, fontSize: 11 }}
        />
      ) : (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', fontStyle: 'italic' }}>Not assigned</Typography>
      ),
    },
    { field: 'netAmount', headerName: 'Amount', width: 110, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(p.value)}</Typography> },
    {
      field: 'actions', headerName: 'Actions', width: 90, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="View Details"><IconButton size="small" onClick={() => setSelectedOrder(p.row)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Update Status"><IconButton size="small" onClick={() => {
            setEditOrder(p.row);
            setNewStatus(p.row.orderStatus);
            setNewPayment(p.row.paymentStatus);
            const lastPayment = p.row.payments && p.row.payments.length > 0 ? p.row.payments[p.row.payments.length - 1] : null;
            let mode = lastPayment?.paymentMode;
            if (!mode && p.row.notes) {
              const lower = p.row.notes.toLowerCase();
              if (lower.includes('gpay') || lower.includes('google pay')) mode = 'GPay';
              else if (lower.includes('upi') || lower.includes('qr')) mode = 'UPI';
              else if (lower.includes('cash') || lower.includes('cod')) mode = 'Cash';
              else if (lower.includes('online')) mode = 'Online';
              else if (lower.includes('card')) mode = 'Card';
            }
            setNewPaymentMode(mode || 'Cash');
          }}><EditIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  const getOrderPaymentLabel = (o: Order) => {
    const latestPayment = o.payments && o.payments.length > 0 ? o.payments[o.payments.length - 1] : null;
    let mode = latestPayment?.paymentMode;
    if (!mode && o.notes) {
      const lower = o.notes.toLowerCase();
      if (lower.includes('gpay') || lower.includes('google pay')) mode = 'GPay';
      else if (lower.includes('upi') || lower.includes('qr')) mode = 'UPI';
      else if (lower.includes('cash') || lower.includes('cod')) mode = 'Cash';
    }
    if (o.paymentStatus === 'Paid') {
      return `Paid (${mode || 'Cash'})`;
    }
    return o.paymentStatus || 'Pending';
  };

  const handleExcelExport = () => exportToExcel(
    filtered.map((o) => ({ 'Order #': o.orderNumber, Customer: `${o.customer?.firstName} ${o.customer?.lastName}`, Date: formatDate(o.createdDate), Status: o.orderStatus, Payment: getOrderPaymentLabel(o), 'Laundry Shop': o.laundryShop?.shopName ?? 'N/A', Amount: o.netAmount })),
    'orders'
  );

  const handlePdfExport = () => exportToPDF(
    'Orders Report', ['Order #', 'Customer', 'Date', 'Status', 'Payment', 'Laundry Shop', 'Amount'],
    filtered.map((o) => [[o.orderNumber, `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`, formatDate(o.createdDate), o.orderStatus, getOrderPaymentLabel(o), o.laundryShop?.shopName ?? 'N/A', formatCurrency(o.netAmount)]]),
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
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { fontWeight: 700 } }}
        />
      </Card>

      {/* ---- View Order Details Dialog ---- */}
      <Dialog open={!!selectedOrder} onClose={() => setSelectedOrder(null)} maxWidth="md" fullWidth>
        <DialogTitle><Typography sx={{ fontWeight: 700 }}>Order #{selectedOrder?.orderNumber}</Typography></DialogTitle>
        <DialogContent dividers>
          {selectedOrder && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">Customer</Typography>
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
                    let mode = latestPayment?.paymentMode;
                    if (!mode && selectedOrder.notes) {
                      const lower = selectedOrder.notes.toLowerCase();
                      if (lower.includes('gpay') || lower.includes('google pay')) mode = 'GPay';
                      else if (lower.includes('upi') || lower.includes('qr')) mode = 'UPI';
                      else if (lower.includes('cash') || lower.includes('cod')) mode = 'Cash';
                      else if (lower.includes('online')) mode = 'Online';
                      else if (lower.includes('card')) mode = 'Card';
                    }
                    const isPaid = selectedOrder.paymentStatus === 'Paid';
                    const resolvedMode = mode || (isPaid ? 'Cash' : 'Pending');
                    return (
                      <Chip
                        label={isPaid ? (resolvedMode === 'GPay' ? '📱 Paid in GPay' : resolvedMode === 'UPI' ? '📱 Paid in UPI' : resolvedMode === 'Cash' ? '💵 Paid in Cash' : `Paid in ${resolvedMode}`) : selectedOrder.paymentStatus}
                        color={isPaid ? 'success' : 'warning'}
                        size="small"
                        sx={{ fontWeight: 800 }}
                      />
                    );
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
                    <Typography variant="caption" color="text.secondary">Scheduled Pickup</Typography>
                    <Typography sx={{ fontWeight: 700 }}>
                      {selectedOrder.pickupDate ? formatDate(selectedOrder.pickupDate) : 'Not scheduled'}
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
                        {selectedOrder.notes ? selectedOrder.notes.split('|').map(p => p.trim()).join('\n') : 'No notes or instructions provided.'}
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
                </Table>
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
                {selectedRowIds.ids.size} order{selectedRowIds.ids.size !== 1 ? 's' : ''} will be assigned for delivery
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
