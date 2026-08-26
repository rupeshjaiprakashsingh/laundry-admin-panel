import React, { useState } from 'react';
import {
  Box, Card, Tab, Tabs, Typography, IconButton, Tooltip, Chip, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Snackbar,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageHeader from '../../components/PageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  getServicePrices, createServicePrice, updateServicePrice, deleteServicePrice,
  getServices,
} from '../../api/services';
import { formatCurrency } from '../../utils/export';
import type { Product, ServicePrice, Service } from '../../types';

const PricingPage: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  const [productFormOpen, setProductFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);
  const [productName, setProductName] = useState('');
  const [productEmoji, setProductEmoji] = useState('👕');

  const [priceFormOpen, setPriceFormOpen] = useState(false);
  const [editPrice, setEditPrice] = useState<ServicePrice | null>(null);
  const [deletePriceId, setDeletePriceId] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<Partial<ServicePrice>>({});
  const [serviceFilter, setServiceFilter] = useState<number | 'ALL'>('ALL');

  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const { data: products = [], isLoading: pLoading } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
  const { data: prices = [], isLoading: prLoading } = useQuery<ServicePrice[]>({ queryKey: ['service-prices'], queryFn: getServicePrices });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: getServices });

  const filteredPrices = prices.filter((p) => {
    if (serviceFilter === 'ALL') return true;
    return p.serviceId === serviceFilter;
  });

  const priorityService = services.find((s) => s.serviceName.toLowerCase().includes('priority'));

  const createProductMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setProductFormOpen(false);
      setSnack({ msg: 'Product created!', severity: 'success' });
    },
    onError: (err: any) => setSnack({ msg: err.response?.data?.message || 'Failed to create product', severity: 'error' }),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => updateProduct(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setEditProduct(null);
      setProductFormOpen(false);
      setSnack({ msg: 'Product updated!', severity: 'success' });
    },
    onError: (err: any) => setSnack({ msg: err.response?.data?.message || 'Failed to update product', severity: 'error' }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setDeleteProductId(null);
      setSnack({ msg: 'Product deleted!', severity: 'success' });
    },
  });

  const createPriceMutation = useMutation({
    mutationFn: (data: Partial<ServicePrice>) => {
      const payload: any = {
        serviceId: Number(data.serviceId),
        productId: Number(data.productId),
        pincode: String(data.pincode || 'DEFAULT').trim(),
        price: Number(data.price),
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      return createServicePrice(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-prices'] });
      setPriceFormOpen(false);
      setSnack({ msg: 'Price rule created successfully!', severity: 'success' });
    },
    onError: (err: any) => setSnack({ msg: err.response?.data?.message || 'Failed to create price rule', severity: 'error' }),
  });

  const updatePriceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ServicePrice> }) => {
      const payload: any = {
        serviceId: data.serviceId ? Number(data.serviceId) : undefined,
        productId: data.productId ? Number(data.productId) : undefined,
        pincode: data.pincode ? String(data.pincode).trim() : undefined,
        price: data.price !== undefined ? Number(data.price) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };
      return updateServicePrice(id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-prices'] });
      setEditPrice(null);
      setPriceFormOpen(false);
      setSnack({ msg: 'Price rule updated successfully!', severity: 'success' });
    },
    onError: (err: any) => setSnack({ msg: err.response?.data?.message || 'Failed to update price rule', severity: 'error' }),
  });

  const deletePriceMutation = useMutation({
    mutationFn: deleteServicePrice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-prices'] });
      setDeletePriceId(null);
      setSnack({ msg: 'Price rule deleted!', severity: 'success' });
    },
  });

  const productColumns: GridColDef[] = [
    { field: 'emoji', headerName: '', width: 60, renderCell: (p) => <Typography sx={{ fontSize: 24 }}>{p.value}</Typography> },
    { field: 'name', headerName: 'Product Name', flex: 1, renderCell: (p) => <Typography sx={{ fontWeight: 700 }}>{p.value}</Typography> },
    { field: 'isActive', headerName: 'Status', width: 100, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" /> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditProduct(p.row); setProductName(p.row.name); setProductEmoji(p.row.emoji); setProductFormOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteProductId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  const priceColumns: GridColDef[] = [
    {
      field: 'service',
      headerName: 'Service',
      width: 180,
      renderCell: (p) => {
        const sName = (p.value as Service)?.serviceName || '';
        const isPriority = sName.toLowerCase().includes('priority');
        if (isPriority) {
          return (
            <Chip
              label={`⚡ ${sName}`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: '#FFF7ED',
                color: '#EA580C',
                border: '1px solid #FED7AA',
              }}
            />
          );
        }
        return <Chip label={sName} color="primary" size="small" sx={{ fontWeight: 600 }} />;
      },
    },
    { field: 'product', headerName: 'Product', width: 180, renderCell: (p) => <Typography>{(p.value as Product)?.emoji} {(p.value as Product)?.name}</Typography> },
    { field: 'pincode', headerName: 'Pincode', width: 130, renderCell: (p) => <Chip label={p.value} size="small" color={p.value === 'DEFAULT' ? 'secondary' : 'default'} /> },
    { field: 'price', headerName: 'Price', width: 120, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(p.value)}</Typography> },
    { field: 'isActive', headerName: 'Status', width: 90, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" /> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => { setEditPrice(p.row); setNewPrice({ serviceId: p.row.serviceId, productId: p.row.productId, pincode: p.row.pincode, price: p.row.price }); setPriceFormOpen(true); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeletePriceId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Pricing Management"
        subtitle="Manage products and pincode-based service prices (including Grivana Priority separate rates)"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Pricing' }]}
        action={tab === 0
          ? { label: 'Add Product', icon: <AddIcon />, onClick: () => { setEditProduct(null); setProductName(''); setProductEmoji('👕'); setProductFormOpen(true); } }
          : { label: 'Add Price Rule', icon: <AddIcon />, onClick: () => { setEditPrice(null); setNewPrice({ pincode: 'DEFAULT' }); setPriceFormOpen(true); } }
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Products (${products.length})`} />
        <Tab label={`Price Rules (${prices.length})`} />
      </Tabs>

      {tab === 0 && (
        <Card>
          <DataGrid rows={products} columns={productColumns} loading={pLoading} autoHeight
            pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none' }}
          />
        </Card>
      )}

      {tab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Filter by Service</InputLabel>
                <Select
                  value={serviceFilter}
                  label="Filter by Service"
                  onChange={(e) => setServiceFilter(e.target.value as any)}
                >
                  <MenuItem value="ALL">All Services ({prices.length})</MenuItem>
                  {services.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.serviceName.toLowerCase().includes('priority') ? `⚡ ${s.serviceName}` : s.serviceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {priorityService && (
                <Button
                  size="small"
                  variant={serviceFilter === priorityService.id ? 'contained' : 'outlined'}
                  color="warning"
                  onClick={() => setServiceFilter(serviceFilter === priorityService.id ? 'ALL' : priorityService.id)}
                  sx={{ fontWeight: 700, textTransform: 'none' }}
                >
                  ⚡ View Grivana Priority Rates
                </Button>
              )}
            </Box>
            {priorityService && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditPrice(null);
                  setNewPrice({
                    serviceId: priorityService.id,
                    productId: products[0]?.id || 0,
                    pincode: 'DEFAULT',
                    price: 30,
                  });
                  setPriceFormOpen(true);
                }}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                + Add Priority Price
              </Button>
            )}
          </Box>
          <Card>
            <DataGrid rows={filteredPrices} columns={priceColumns} loading={prLoading} autoHeight
              pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              sx={{ border: 'none' }}
            />
          </Card>
        </Box>
      )}

      {/* Product Form */}
      <Dialog open={productFormOpen} onClose={() => { setProductFormOpen(false); setEditProduct(null); }} maxWidth="xs" fullWidth>
        <DialogTitle>{editProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Product Name" fullWidth size="small" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Men's Shirt" />
            <TextField label="Emoji" fullWidth size="small" value={productEmoji} onChange={(e) => setProductEmoji(e.target.value)} placeholder="👕" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setProductFormOpen(false); setEditProduct(null); }}>Cancel</Button>
          <Button variant="contained" disabled={createProductMutation.isPending || updateProductMutation.isPending}
            onClick={() => {
              const data = { name: productName, emoji: productEmoji };
              if (editProduct) updateProductMutation.mutate({ id: editProduct.id, data });
              else createProductMutation.mutate(data);
            }}>
            {editProduct ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Price Rule Form */}
      <Dialog open={priceFormOpen} onClose={() => { setPriceFormOpen(false); setEditPrice(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>{editPrice ? 'Edit Price Rule' : '➕ Add Price Rule'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Service</InputLabel>
                <Select value={newPrice.serviceId ?? ''} label="Service" onChange={(e) => setNewPrice((p) => ({ ...p, serviceId: Number(e.target.value) }))}>
                  {services.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.serviceName.toLowerCase().includes('priority') ? `⚡ ${s.serviceName}` : s.serviceName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Product</InputLabel>
                <Select value={newPrice.productId ?? ''} label="Product" onChange={(e) => setNewPrice((p) => ({ ...p, productId: Number(e.target.value) }))}>
                  {products.map((pr) => <MenuItem key={pr.id} value={pr.id}>{pr.emoji} {pr.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Pincode (or DEFAULT)" fullWidth size="small"
                value={newPrice.pincode ?? ''} onChange={(e) => setNewPrice((p) => ({ ...p, pincode: e.target.value }))}
                placeholder="DEFAULT or 500001" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Price (₹)" type="number" fullWidth size="small"
                value={newPrice.price ?? ''} onChange={(e) => setNewPrice((p) => ({ ...p, price: Number(e.target.value) }))} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPriceFormOpen(false); setEditPrice(null); }}>Cancel</Button>
          <Button variant="contained" disabled={createPriceMutation.isPending || updatePriceMutation.isPending}
            startIcon={(createPriceMutation.isPending || updatePriceMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => {
              if (editPrice) updatePriceMutation.mutate({ id: editPrice.id, data: newPrice });
              else createPriceMutation.mutate(newPrice);
            }}>
            {editPrice ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteProductId !== null} title="Delete Product" message="Delete this product?" confirmLabel="Delete" severity="error"
        onConfirm={() => deleteProductId !== null && deleteProductMutation.mutate(deleteProductId)}
        onCancel={() => setDeleteProductId(null)} loading={deleteProductMutation.isPending}
      />
      <ConfirmDialog open={deletePriceId !== null} title="Delete Price Rule" message="Delete this price rule?" confirmLabel="Delete" severity="error"
        onConfirm={() => deletePriceId !== null && deletePriceMutation.mutate(deletePriceId)}
        onCancel={() => setDeletePriceId(null)} loading={deletePriceMutation.isPending}
      />

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

export default PricingPage;
