import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, IconButton, Tooltip, Grid,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Table, TableBody, TableCell, TableHead, TableRow, Divider,
  Alert, CircularProgress, Stack, InputAdornment, Switch, FormControlLabel,
  Avatar, LinearProgress, Tabs, Tab,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import StoreIcon from '@mui/icons-material/Store';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import PageHeader from '../../components/PageHeader';
import {
  getLaundryShops, getLaundryShop, createLaundryShop, updateLaundryShop, deleteLaundryShop,
} from '../../api/laundryShops';
import type { LaundryShop, Order } from '../../types';
import { formatDate, formatCurrency } from '../../utils/export';

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  'New Order': 'info', 'Pickup Scheduled': 'primary', 'Picked Up': 'secondary',
  Processing: 'warning', Washing: 'warning', 'Dry Cleaning': 'warning', Ironing: 'warning',
  'Ready For Delivery': 'primary', 'Out For Delivery': 'secondary', Delivered: 'success', Cancelled: 'error',
};

const emptyForm: Partial<LaundryShop> = {
  shopName: '', shopCode: '', ownerName: '', contactNumber: '',
  email: '', address: '', city: '', state: '', pincode: '', capacity: undefined, isActive: true,
};

const LaundryShopsPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editShop, setEditShop] = useState<LaundryShop | null>(null);
  const [formData, setFormData] = useState<Partial<LaundryShop>>(emptyForm);
  const [detailShopId, setDetailShopId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LaundryShop | null>(null);
  const [detailTab, setDetailTab] = useState(0);

  const { data: shops = [], isLoading, error } = useQuery({
    queryKey: ['laundry-shops'],
    queryFn: getLaundryShops,
  });

  const { data: detailShop, isLoading: detailLoading } = useQuery({
    queryKey: ['laundry-shop', detailShopId],
    queryFn: () => getLaundryShop(detailShopId!),
    enabled: detailShopId !== null,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<LaundryShop>) => createLaundryShop(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['laundry-shops'] }); setFormOpen(false); setFormData(emptyForm); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LaundryShop> }) => updateLaundryShop(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['laundry-shops'] });
      qc.invalidateQueries({ queryKey: ['laundry-shop', editShop?.id] });
      setFormOpen(false); setEditShop(null); setFormData(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteLaundryShop(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['laundry-shops'] }); setDeleteConfirm(null); },
  });

  const filtered = useMemo(() =>
    shops.filter((s) =>
      s.shopName.toLowerCase().includes(search.toLowerCase()) ||
      s.shopCode.toLowerCase().includes(search.toLowerCase()) ||
      (s.city ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.pincode ?? '').includes(search)
    ), [shops, search]);

  const handleOpenCreate = () => { setEditShop(null); setFormData(emptyForm); setFormOpen(true); };
  const handleOpenEdit = (shop: LaundryShop) => { setEditShop(shop); setFormData({ ...shop }); setFormOpen(true); };
  const handleSubmit = () => {
    if (editShop) updateMutation.mutate({ id: editShop.id, data: formData });
    else createMutation.mutate(formData);
  };

  const columns: GridColDef[] = [
    {
      field: 'shopName', headerName: 'Shop', flex: 1, minWidth: 200,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
            <StoreIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{p.row.shopName}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.row.shopCode}</Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'pincode', headerName: 'Location', width: 180,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13 }}>{p.row.city ?? '—'}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>PIN: {p.row.pincode ?? '—'}</Typography>
        </Box>
      ),
    },
    { field: 'contactNumber', headerName: 'Contact', width: 140, renderCell: (p) => <Typography sx={{ fontSize: 13 }}>{p.value ?? '—'}</Typography> },
    {
      field: 'totalOrders', headerName: 'Total Orders', width: 120,
      renderCell: (p) => (
        <Chip label={p.value ?? 0} size="small" color="primary" sx={{ fontWeight: 700 }} />
      ),
    },
    {
      field: 'activeOrders', headerName: 'Active', width: 100,
      renderCell: (p) => (
        <Chip
          label={p.value ?? 0}
          size="small"
          color={(p.value ?? 0) > 0 ? 'warning' : 'default'}
          sx={{ fontWeight: 700 }}
        />
      ),
    },
    {
      field: 'capacity', headerName: 'Capacity', width: 130,
      renderCell: (p) => {
        const active = p.row.activeOrders ?? 0;
        const cap = p.row.capacity;
        if (!cap) return <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Unlimited</Typography>;
        const pct = Math.min((active / cap) * 100, 100);
        return (
          <Box sx={{ width: '100%' }}>
            <Typography sx={{ fontSize: 11, mb: 0.5 }}>{active}/{cap}</Typography>
            <LinearProgress variant="determinate" value={pct} color={pct > 80 ? 'error' : pct > 50 ? 'warning' : 'success'} sx={{ height: 6, borderRadius: 3 }} />
          </Box>
        );
      },
    },
    {
      field: 'isActive', headerName: 'Status', width: 100,
      renderCell: (p) => (
        <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" sx={{ fontWeight: 700 }} />
      ),
    },
    {
      field: 'actions', headerName: 'Actions', width: 120, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="View Details"><IconButton size="small" onClick={() => setDetailShopId(p.row.id)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => handleOpenEdit(p.row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteConfirm(p.row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load laundry shops.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Laundry Shops"
        subtitle={`${shops.length} shops registered`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Laundry Shops' }]}
        action={{ label: 'Add Shop', icon: <AddIcon />, onClick: handleOpenCreate }}
      />

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          {
            label: 'Total Shops', value: shops.length,
            icon: <StoreIcon />, color: '#6366F1',
          },
          {
            label: 'Active Shops', value: shops.filter((s) => s.isActive).length,
            icon: <CheckCircleIcon />, color: '#10B981',
          },
          {
            label: 'Orders in Processing', value: shops.reduce((a, s) => a + (s.activeOrders ?? 0), 0),
            icon: <LocalLaundryServiceIcon />, color: '#F59E0B',
          },
          {
            label: 'Completed Today', value: shops.reduce((a, s) => a + (s.completedToday ?? 0), 0),
            icon: <PendingIcon />, color: '#0EA5E9',
          },
        ].map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ background: `linear-gradient(135deg, ${stat.color}18 0%, ${stat.color}08 100%)`, border: `1px solid ${stat.color}30` }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '16px !important' }}>
                <Avatar sx={{ bgcolor: `${stat.color}20`, color: stat.color }}>
                  {stat.icon}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{stat.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Search */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <TextField
            size="small" fullWidth
            placeholder="Search by shop name, code, city, or pincode..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
        </CardContent>
      </Card>

      {/* Data Grid */}
      <Card>
        <DataGrid
          rows={filtered} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { fontWeight: 700 } }}
        />
      </Card>

      {/* ---- Create / Edit Dialog ---- */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editShop ? `Edit — ${editShop.shopName}` : '➕ Add New Laundry Shop'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField fullWidth label="Shop Name *" size="small"
                value={formData.shopName ?? ''} onChange={(e) => setFormData({ ...formData, shopName: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Shop Code *" size="small"
                value={formData.shopCode ?? ''} onChange={(e) => setFormData({ ...formData, shopCode: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Owner Name" size="small"
                value={formData.ownerName ?? ''} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Contact Number" size="small"
                value={formData.contactNumber ?? ''} onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Email" size="small" type="email"
                value={formData.email ?? ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Address" size="small" multiline rows={2}
                value={formData.address ?? ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="City" size="small"
                value={formData.city ?? ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="State" size="small"
                value={formData.state ?? ''} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField fullWidth label="Pincode" size="small"
                value={formData.pincode ?? ''} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Daily Capacity (max orders)" size="small" type="number"
                value={formData.capacity ?? ''} onChange={(e) => setFormData({ ...formData, capacity: e.target.value ? Number(e.target.value) : undefined })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Switch checked={formData.isActive ?? true} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />}
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!formData.shopName || !formData.shopCode || createMutation.isPending || updateMutation.isPending}
            startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={handleSubmit}
          >
            {editShop ? 'Save Changes' : 'Create Shop'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Delete Confirm Dialog ---- */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Laundry Shop</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            Are you sure you want to delete <strong>{deleteConfirm?.shopName}</strong>?
            This action cannot be undone. Orders must be unassigned first.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
          >
            {deleteMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---- Shop Detail Dialog ---- */}
      <Dialog open={detailShopId !== null} onClose={() => { setDetailShopId(null); setDetailTab(0); }} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}><StoreIcon /></Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700 }}>{detailShop?.shopName ?? 'Loading...'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {detailShop?.shopCode} · {detailShop?.city}, {detailShop?.state} · PIN: {detailShop?.pincode ?? '—'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
          ) : detailShop ? (
            <>
              {/* Shop Info */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[
                  { label: 'Owner', value: detailShop.ownerName ?? '—' },
                  { label: 'Contact', value: detailShop.contactNumber ?? '—' },
                  { label: 'Email', value: detailShop.email ?? '—' },
                  { label: 'Address', value: detailShop.address ?? '—' },
                  { label: 'Capacity', value: detailShop.capacity ? `${detailShop.activeOrders ?? 0}/${detailShop.capacity} orders` : 'Unlimited' },
                  { label: 'Status', value: <Chip label={detailShop.isActive ? 'Active' : 'Inactive'} color={detailShop.isActive ? 'success' : 'error'} size="small" /> },
                ].map((item) => (
                  <Grid key={item.label} size={{ xs: 6, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
                      {typeof item.value === 'string' ? item.value : item.value}
                    </Typography>
                  </Grid>
                ))}
              </Grid>

              {/* Stats */}
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Card variant="outlined" sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main' }}>{detailShop.totalOrders ?? 0}</Typography>
                  <Typography variant="caption">Total Orders</Typography>
                </Card>
                <Card variant="outlined" sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'warning.main' }}>{detailShop.activeOrders ?? 0}</Typography>
                  <Typography variant="caption">In Processing</Typography>
                </Card>
                <Card variant="outlined" sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'success.main' }}>{detailShop.completedToday ?? 0}</Typography>
                  <Typography variant="caption">Completed Today</Typography>
                </Card>
              </Stack>

              <Divider sx={{ mb: 2 }} />

              {/* Orders Tabs */}
              <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} sx={{ mb: 2 }}>
                <Tab label={`All Orders (${(detailShop.orders ?? []).length})`} />
                <Tab label={`Processing (${(detailShop.orders ?? []).filter((o: Order) => !['Delivered', 'Cancelled'].includes(o.orderStatus)).length})`} />
                <Tab label={`Completed (${(detailShop.orders ?? []).filter((o: Order) => o.orderStatus === 'Delivered').length})`} />
              </Tabs>

              {(() => {
                const orders: Order[] = detailShop.orders ?? [];
                const filtered =
                  detailTab === 1 ? orders.filter((o) => !['Delivered', 'Cancelled'].includes(o.orderStatus))
                  : detailTab === 2 ? orders.filter((o) => o.orderStatus === 'Delivered')
                  : orders;

                return (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell><b>Order #</b></TableCell>
                        <TableCell><b>Customer</b></TableCell>
                        <TableCell><b>Status</b></TableCell>
                        <TableCell align="right"><b>Amount</b></TableCell>
                        <TableCell><b>Date</b></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="text.secondary" variant="body2">No orders found.</Typography>
                          </TableCell>
                        </TableRow>
                      ) : filtered.map((order) => (
                        <TableRow key={order.id} hover>
                          <TableCell><Typography sx={{ fontWeight: 700, fontSize: 13 }}>{order.orderNumber}</Typography></TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 13 }}>{order.customer?.firstName} {order.customer?.lastName}</Typography>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{order.customer?.mobileNumber}</Typography>
                          </TableCell>
                          <TableCell><Chip label={order.orderStatus} color={statusColors[order.orderStatus] ?? 'default'} size="small" sx={{ fontWeight: 700 }} /></TableCell>
                          <TableCell align="right"><Typography sx={{ fontWeight: 700, color: 'success.main', fontSize: 13 }}>{formatCurrency(order.netAmount)}</Typography></TableCell>
                          <TableCell><Typography sx={{ fontSize: 12 }}>{formatDate(order.createdDate)}</Typography></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                );
              })()}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDetailShopId(null); setDetailTab(0); }}>Close</Button>
          {detailShop && (
            <Button variant="outlined" onClick={() => { handleOpenEdit(detailShop as LaundryShop); setDetailShopId(null); }}>
              Edit Shop
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LaundryShopsPage;
