import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, IconButton, Tooltip, Chip, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Switch, FormControlLabel, CircularProgress,
  Tabs, Tab, MenuItem, Select, FormControl, InputLabel, Snackbar,
  Table, TableBody, TableCell, TableHead, TableRow, Divider,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import CategoryIcon from '@mui/icons-material/Category';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PageHeader from '../../components/PageHeader';
import {
  getServices, createService, updateService, deleteService,
  getProducts, createProduct, updateProduct, deleteProduct,
  getServicePrices, createServicePrice, updateServicePrice, deleteServicePrice,
} from '../../api/services';
import { formatCurrency } from '../../utils/export';
import type { Service, Product, ServicePrice } from '../../types';

const SERVICE_TYPES = ['Washing', 'Dry Cleaning', 'Ironing', 'Other'];

const emptyService = {
  serviceName: '',
  serviceType: '',
  price: 0,
  description: '',
  estimatedHours: undefined as number | undefined,
  isActive: true,
  linkedServiceIds: [] as number[],
};
const emptyProduct = { name: '', emoji: '👕', isActive: true };

// ─── Service Tab ──────────────────────────────────────────────────────────────
const ServicesTab: React.FC = () => {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [form, setForm] = useState({ ...emptyService });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const { data: services = [], isLoading, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyService) => createService(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setFormOpen(false); setForm({ ...emptyService }); setSnack({ open: true, msg: 'Service created!', severity: 'success' }); },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Create failed', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Service> }) => updateService(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setFormOpen(false); setEditService(null); setSnack({ open: true, msg: 'Service updated!', severity: 'success' }); },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Update failed', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteService(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setDeleteId(null); setSnack({ open: true, msg: 'Service deleted!', severity: 'success' }); },
    onError: (e: any) => { setDeleteId(null); setSnack({ open: true, msg: e?.response?.data?.message || 'Delete failed — service may have linked orders.', severity: 'error' }); },
  });

  const openCreate = () => { setEditService(null); setForm({ ...emptyService }); setFormOpen(true); };
  const openEdit = (s: Service) => {
    setEditService(s);
    setForm({
      serviceName: s.serviceName,
      serviceType: s.serviceType,
      price: s.price,
      description: s.description || '',
      estimatedHours: s.estimatedHours,
      isActive: s.isActive,
      linkedServiceIds: Array.isArray(s.linkedServiceIds) ? (s.linkedServiceIds as number[]) : [],
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.serviceName.trim() || !form.serviceType.trim()) return;
    const payload = { ...form, price: Number(form.price), estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined };
    if (editService) updateMutation.mutate({ id: editService.id, data: payload });
    else createMutation.mutate(payload as any);
  };

  const columns: GridColDef[] = [
    { field: 'serviceName', headerName: 'Service Name', flex: 1, minWidth: 160, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
    { field: 'serviceType', headerName: 'Type', width: 140, renderCell: (p) => <Chip label={p.value} size="small" color="primary" sx={{ fontWeight: 600 }} /> },
    { field: 'price', headerName: 'Base Price', width: 120, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(p.value)}</Typography> },
    { field: 'estimatedHours', headerName: 'Est. Hours', width: 110, renderCell: (p) => p.value ? `${p.value}h` : '—' },
    { field: 'description', headerName: 'Description', flex: 1, renderCell: (p) => <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{p.value || '—'}</Typography> },
    { field: 'isActive', headerName: 'Status', width: 90, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" sx={{ fontWeight: 700 }} /> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p.row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load services. Check API connection.</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Service</Button>
      </Box>
      <Card>
        <DataGrid rows={services} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editService ? `Edit — ${editService.serviceName}` : '➕ Add New Service'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField fullWidth size="small" label="Service Name *" value={form.serviceName}
                onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                placeholder="e.g. Premium Laundry" />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Service Type *</InputLabel>
                <Select value={form.serviceType} label="Service Type *" onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
                  {SERVICE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Base Price (₹) *" type="number" value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Estimated Hours" type="number" value={form.estimatedHours ?? ''}
                onChange={(e) => setForm({ ...form, estimatedHours: e.target.value ? Number(e.target.value) : undefined })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth size="small" label="Description" multiline rows={2} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. ₹79 / kg | 48 Hrs" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Link Other Services (display products below)</InputLabel>
                <Select
                  multiple
                  value={form.linkedServiceIds || []}
                  label="Link Other Services (display products below)"
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({ ...form, linkedServiceIds: typeof val === 'string' ? val.split(',').map(Number) : val as number[] });
                  }}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as number[]).map((id) => {
                        const matched = services.find((s: Service) => s.id === id);
                        return <Chip key={id} label={matched ? matched.serviceName : id} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {services
                    .filter((s: Service) => !editService || s.id !== editService.id)
                    .map((s: Service) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.serviceName} ({s.serviceType})
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
                label="Active (visible on Android app)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}
            disabled={!form.serviceName || !form.serviceType || createMutation.isPending || updateMutation.isPending}
            startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {editService ? 'Save Changes' : 'Create Service'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Service</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will permanently delete the service. If orders reference this service, deletion will fail — deactivate it instead.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

// ─── Products Tab ─────────────────────────────────────────────────────────────
const ProductsTab: React.FC = () => {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...emptyProduct });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const { data: products = [], isLoading, error } = useQuery({ queryKey: ['products'], queryFn: getProducts });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyProduct) => createProduct(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setFormOpen(false); setForm({ ...emptyProduct }); setSnack({ open: true, msg: 'Product created!', severity: 'success' }); },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Create failed', severity: 'error' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => updateProduct(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setFormOpen(false); setSnack({ open: true, msg: 'Product updated!', severity: 'success' }); },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Update failed', severity: 'error' }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteId(null); setSnack({ open: true, msg: 'Product deleted!', severity: 'success' }); },
    onError: (e: any) => { setDeleteId(null); setSnack({ open: true, msg: e?.response?.data?.message || 'Delete failed — may have linked prices.', severity: 'error' }); },
  });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.emoji.trim()) return;
    if (editProduct) updateMutation.mutate({ id: editProduct.id, data: form });
    else createMutation.mutate(form);
  };

  const columns: GridColDef[] = [
    { field: 'emoji', headerName: '', width: 60, renderCell: (p) => <Typography sx={{ fontSize: 22 }}>{p.value}</Typography> },
    { field: 'name', headerName: 'Product Name', flex: 1, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
    { field: 'isActive', headerName: 'Status', width: 100, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" /> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditProduct(p.row); setForm({ name: p.row.name, emoji: p.row.emoji, isActive: p.row.isActive }); setFormOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load products.</Alert>;

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Products</strong> are individual clothing items (e.g. Men's Shirt, Saree). They appear in the Android app when a customer selects a service.
      </Alert>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditProduct(null); setForm({ ...emptyProduct }); setFormOpen(true); }}>Add Product</Button>
      </Box>
      <Card>
        <DataGrid rows={products} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editProduct ? 'Edit Product' : '➕ Add Product'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth size="small" label="Product Name *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Men's Shirt" />
            <TextField fullWidth size="small" label="Emoji *" value={form.emoji}
              onChange={(e) => setForm({ ...form, emoji: e.target.value })}
              placeholder="e.g. 👕" slotProps={{ htmlInput: { maxLength: 4 } }} />
            <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}
            disabled={!form.name || !form.emoji || createMutation.isPending || updateMutation.isPending}
            startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {editProduct ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Product</DialogTitle>
        <DialogContent><Alert severity="warning" sx={{ mt: 1 }}>This will delete the product and all linked prices.</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending}
            onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

// ─── Pricing Tab ──────────────────────────────────────────────────────────────
const PricingTab: React.FC = () => {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editPrice, setEditPrice] = useState<ServicePrice | null>(null);
  const [form, setForm] = useState({ serviceId: 0, productId: 0, pincode: 'DEFAULT', price: 0, isActive: true });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const { data: prices = [], isLoading, error } = useQuery({ queryKey: ['service-prices'], queryFn: getServicePrices });
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: getProducts });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => createServicePrice(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-prices'] }); setFormOpen(false); setSnack({ open: true, msg: 'Price created!', severity: 'success' }); },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Create failed — may already exist for this combo', severity: 'error' }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof form> }) => updateServicePrice(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-prices'] }); setFormOpen(false); setSnack({ open: true, msg: 'Price updated!', severity: 'success' }); },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Update failed', severity: 'error' }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteServicePrice(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-prices'] }); setDeleteId(null); setSnack({ open: true, msg: 'Price deleted!', severity: 'success' }); },
    onError: (e: any) => { setDeleteId(null); setSnack({ open: true, msg: e?.response?.data?.message || 'Delete failed', severity: 'error' }); },
  });

  const handleSubmit = () => {
    if (!form.serviceId || !form.productId || !form.pincode || form.price <= 0) return;
    if (editPrice) updateMutation.mutate({ id: editPrice.id, data: { price: form.price, pincode: form.pincode, isActive: form.isActive } });
    else createMutation.mutate(form);
  };

  const columns: GridColDef[] = [
    { field: 'service', headerName: 'Service', flex: 1, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.row.service?.serviceName || '—'}</Typography> },
    { field: 'product', headerName: 'Product', flex: 1, renderCell: (p) => <Typography sx={{ fontSize: 13 }}>{p.row.product?.emoji} {p.row.product?.name || '—'}</Typography> },
    { field: 'pincode', headerName: 'Pincode', width: 120, renderCell: (p) => <Chip label={p.value} size="small" color={p.value === 'DEFAULT' ? 'default' : 'primary'} /> },
    { field: 'price', headerName: 'Price', width: 110, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(p.value)}</Typography> },
    { field: 'isActive', headerName: 'Active', width: 80, renderCell: (p) => <Chip label={p.value ? '✓' : '✗'} color={p.value ? 'success' : 'error'} size="small" /> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => {
            setEditPrice(p.row);
            setForm({ serviceId: p.row.serviceId, productId: p.row.productId, pincode: p.row.pincode, price: p.row.price, isActive: p.row.isActive });
            setFormOpen(true);
          }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load pricing.</Alert>;

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Pricing</strong> maps a Service + Product + Pincode → Price.
        Use pincode <strong>DEFAULT</strong> for the standard price (applies to all locations unless overridden).
        Pincode-specific prices override DEFAULT for customers in that area.
      </Alert>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
          setEditPrice(null);
          setForm({ serviceId: services[0]?.id || 0, productId: products[0]?.id || 0, pincode: 'DEFAULT', price: 0, isActive: true });
          setFormOpen(true);
        }}>Add Price</Button>
      </Box>
      <Card>
        <DataGrid rows={prices} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editPrice ? 'Edit Price' : '➕ Add Price'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={!!editPrice}>
                <InputLabel>Service *</InputLabel>
                <Select value={form.serviceId} label="Service *" onChange={(e) => setForm({ ...form, serviceId: Number(e.target.value) })}>
                  {services.map((s: Service) => <MenuItem key={s.id} value={s.id}>{s.serviceName}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" disabled={!!editPrice}>
                <InputLabel>Product (Cloth Type) *</InputLabel>
                <Select value={form.productId} label="Product (Cloth Type) *" onChange={(e) => setForm({ ...form, productId: Number(e.target.value) })}>
                  {products.map((p: Product) => <MenuItem key={p.id} value={p.id}>{p.emoji} {p.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Pincode (or DEFAULT)" value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value.trim().toUpperCase() })}
                placeholder="DEFAULT or 400001" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth size="small" label="Price (₹) *" type="number" value={form.price}
                onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />} label="Active" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit}
            disabled={!form.serviceId || !form.productId || !form.pincode || form.price <= 0 || createMutation.isPending || updateMutation.isPending}
            startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {editPrice ? 'Save' : 'Add Price'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Price</DialogTitle>
        <DialogContent><Alert severity="warning" sx={{ mt: 1 }}>Delete this price entry?</Alert></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={deleteMutation.isPending}
            onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ServicesPage: React.FC = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Service Management"
        subtitle="Manage services, cloth types (products), and pricing — all appear live on the Android app"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Services' }]}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab icon={<LocalLaundryServiceIcon />} iconPosition="start" label="Services" />
            <Tab icon={<CategoryIcon />} iconPosition="start" label="Products (Cloth Types)" />
            <Tab icon={<AttachMoneyIcon />} iconPosition="start" label="Pricing" />
          </Tabs>
        </CardContent>
      </Card>

      <Box sx={{ mb: 2 }}>
        <Alert severity="success" icon={false}>
          <strong>How it works:</strong>
          {' '}①&nbsp;Add a <strong>Service</strong> (e.g. Dry Cleaning) →
          {' '}②&nbsp;Add <strong>Products</strong> (e.g. Men's Shirt, Saree) →
          {' '}③&nbsp;Set <strong>Prices</strong> for each Service+Product combination.
          Everything updates live on the Android app instantly.
        </Alert>
      </Box>

      {tab === 0 && <ServicesTab />}
      {tab === 1 && <ProductsTab />}
      {tab === 2 && <PricingTab />}
    </Box>
  );
};

export default ServicesPage;
