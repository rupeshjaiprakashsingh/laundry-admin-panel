import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Chip, Typography, IconButton, Tooltip, Grid,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Divider,
  Alert, CircularProgress, Stack, InputAdornment, Badge, Avatar,
  List, ListItemButton, ListItemText, ListItemAvatar,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StoreIcon from '@mui/icons-material/Store';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PageHeader from '../../components/PageHeader';
import { getOrders, updateOrderStatus, updatePaymentStatus, bulkAssignOrdersToShop } from '../../api/orders';
import { getLaundryShops } from '../../api/laundryShops';
import { formatCurrency, formatDate, exportToExcel, exportToPDF } from '../../utils/export';
import type { Order, LaundryShop } from '../../types';

const ORDER_STATUSES = [
  'New Order', 'Pickup Scheduled', 'Picked Up', 'Processing',
  'Washing', 'Dry Cleaning', 'Ironing', 'Ready For Delivery',
  'Out For Delivery', 'Delivered', 'Cancelled',
];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Partially Paid'];

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  'New Order': 'info', 'Pickup Scheduled': 'primary', 'Picked Up': 'secondary',
  Processing: 'warning', Washing: 'warning', 'Dry Cleaning': 'warning', Ironing: 'warning',
  'Ready For Delivery': 'primary', 'Out For Delivery': 'secondary', Delivered: 'success', Cancelled: 'error',
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

  // Multi-select state for bulk assign
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: getOrders });
  const { data: laundryShops = [] } = useQuery({ queryKey: ['laundry-shops'], queryFn: getLaundryShops });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateOrderStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null); },
  });
  const paymentMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updatePaymentStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setEditOrder(null); },
  });
  const bulkAssignMutation = useMutation({
    mutationFn: ({ orderIds, shopId }: { orderIds: number[]; shopId: number }) =>
      bulkAssignOrdersToShop(orderIds, shopId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['laundry-shops'] });
      setBulkAssignOpen(false);
      setSelectedRowIds([]);
      setSelectedShopId(null);
    },
  });

  // Auto-suggest: get pincode of the first selected order's customer
  const firstSelectedOrder = useMemo(() =>
    selectedRowIds.length > 0 ? orders.find((o) => o.id === selectedRowIds[0]) : undefined,
    [selectedRowIds, orders]
  );
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
    { field: 'orderNumber', headerName: 'Order #', width: 140, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
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
    { field: 'paymentStatus', headerName: 'Payment', width: 120, renderCell: (p) => <Chip label={p.value} color={paymentColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} /> },
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
          <Tooltip title="Update Status"><IconButton size="small" onClick={() => { setEditOrder(p.row); setNewStatus(p.row.orderStatus); setNewPayment(p.row.paymentStatus); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  const handleExcelExport = () => exportToExcel(
    filtered.map((o) => ({ 'Order #': o.orderNumber, Customer: `${o.customer?.firstName} ${o.customer?.lastName}`, Date: formatDate(o.createdDate), Status: o.orderStatus, Payment: o.paymentStatus, 'Laundry Shop': o.laundryShop?.shopName ?? 'N/A', Amount: o.netAmount })),
    'orders'
  );

  const handlePdfExport = () => exportToPDF(
    'Orders Report', ['Order #', 'Customer', 'Date', 'Status', 'Payment', 'Laundry Shop', 'Amount'],
    filtered.map((o) => [[o.orderNumber, `${o.customer?.firstName ?? ''} ${o.customer?.lastName ?? ''}`, formatDate(o.createdDate), o.orderStatus, o.paymentStatus, o.laundryShop?.shopName ?? 'N/A', formatCurrency(o.netAmount)]]),
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
      {selectedRowIds.length > 0 && (
        <Card sx={{ mb: 2, border: (t) => `2px solid ${t.palette.primary.main}`, bgcolor: (t) => t.palette.action.hover }}>
          <CardContent sx={{ p: '12px 16px !important', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Badge badgeContent={selectedRowIds.length} color="primary">
              <AssignmentIcon color="primary" />
            </Badge>
            <Typography sx={{ fontWeight: 700, flex: 1 }}>
              {selectedRowIds.length} order{selectedRowIds.length !== 1 ? 's' : ''} selected
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<StoreIcon />}
              onClick={() => setBulkAssignOpen(true)}
            >
              Assign to Laundry Shop
            </Button>
            <Button size="small" onClick={() => setSelectedRowIds([])}>Clear Selection</Button>
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
          onRowSelectionModelChange={(ids) => setSelectedRowIds(ids as number[])}
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
                {selectedOrder.customer && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic', fontSize: 12 }}>
                    📍 {selectedOrder.customer.houseDetails ? `${selectedOrder.customer.houseDetails}, ` : ''}
                    {selectedOrder.customer.landmark ? `${selectedOrder.customer.landmark}, ` : ''}
                    {selectedOrder.customer.address}, {selectedOrder.customer.city}, {selectedOrder.customer.state} - {selectedOrder.customer.pincode}
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
                <Typography variant="caption" color="text.secondary">Payment</Typography>
                <Box><Chip label={selectedOrder.paymentStatus} color={paymentColors[selectedOrder.paymentStatus] ?? 'default'} size="small" /></Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">Net Amount</Typography>
                <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(selectedOrder.netAmount)}</Typography>
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
                          {history.status} — <span style={{ color: 'gray', fontSize: 11 }}>{formatDate(history.createdDate)}</span>
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
        <DialogTitle>Update Order #{editOrder?.orderNumber}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Order Status</InputLabel>
              <Select value={newStatus} label="Order Status" onChange={(e) => setNewStatus(e.target.value)}>
                {ORDER_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Payment Status</InputLabel>
              <Select value={newPayment} label="Payment Status" onChange={(e) => setNewPayment(e.target.value)}>
                {PAYMENT_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOrder(null)}>Cancel</Button>
          <Button variant="contained"
            disabled={statusMutation.isPending || paymentMutation.isPending}
            startIcon={(statusMutation.isPending || paymentMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => {
              if (editOrder) {
                if (newStatus !== editOrder.orderStatus) statusMutation.mutate({ id: editOrder.id, status: newStatus });
                if (newPayment !== editOrder.paymentStatus) paymentMutation.mutate({ id: editOrder.id, status: newPayment });
                if (newStatus === editOrder.orderStatus && newPayment === editOrder.paymentStatus) setEditOrder(null);
              }
            }}
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
                {selectedRowIds.length} order{selectedRowIds.length !== 1 ? 's' : ''} selected
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
                bulkAssignMutation.mutate({ orderIds: selectedRowIds, shopId: selectedShopId });
              }
            }}
          >
            {bulkAssignMutation.isPending ? 'Assigning...' : `Assign ${selectedRowIds.length} Order${selectedRowIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersPage;
