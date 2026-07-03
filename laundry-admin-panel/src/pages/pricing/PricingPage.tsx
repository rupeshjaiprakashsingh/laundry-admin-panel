import React, { useState } from 'react';
import {
  Box, Card, Tab, Tabs, Typography, IconButton, Tooltip, Chip, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Select, MenuItem, FormControl, InputLabel, CircularProgress,
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

  const { data: products = [], isLoading: pLoading } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts });
  const { data: prices = [], isLoading: prLoading } = useQuery<ServicePrice[]>({ queryKey: ['service-prices'], queryFn: getServicePrices });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ['services'], queryFn: getServices });

  const createProductMutation = useMutation({ mutationFn: createProduct, onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setProductFormOpen(false); } });
  const updateProductMutation = useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) => updateProduct(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setEditProduct(null); setProductFormOpen(false); } });
  const deleteProductMutation = useMutation({ mutationFn: deleteProduct, onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setDeleteProductId(null); } });

  const createPriceMutation = useMutation({ mutationFn: createServicePrice, onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-prices'] }); setPriceFormOpen(false); } });
  const updatePriceMutation = useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<ServicePrice> }) => updateServicePrice(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-prices'] }); setEditPrice(null); setPriceFormOpen(false); } });
  const deletePriceMutation = useMutation({ mutationFn: deleteServicePrice, onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-prices'] }); setDeletePriceId(null); } });

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
    { field: 'service', headerName: 'Service', width: 160, renderCell: (p) => <Chip label={(p.value as Service)?.serviceName} color="primary" size="small" /> },
    { field: 'product', headerName: 'Product', width: 160, renderCell: (p) => <Typography>{(p.value as Product)?.emoji} {(p.value as Product)?.name}</Typography> },
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
        subtitle="Manage products and pincode-based service prices"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Pricing' }]}
        action={tab === 0
          ? { label: 'Add Product', icon: <AddIcon />, onClick: () => { setEditProduct(null); setProductName(''); setProductEmoji('👕'); setProductFormOpen(true); } }
          : { label: 'Add Price Rule', icon: <AddIcon />, onClick: () => { setEditPrice(null); setNewPrice({}); setPriceFormOpen(true); } }
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
        <Card>
          <DataGrid rows={prices} columns={priceColumns} loading={prLoading} autoHeight
            pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none' }}
          />
        </Card>
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
        <DialogTitle>{editPrice ? 'Edit Price Rule' : 'Add Price Rule'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Service</InputLabel>
                <Select value={newPrice.serviceId ?? ''} label="Service" onChange={(e) => setNewPrice((p) => ({ ...p, serviceId: Number(e.target.value) }))}>
                  {services.map((s) => <MenuItem key={s.id} value={s.id}>{s.serviceName}</MenuItem>)}
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
                placeholder="DEFAULT or 400001" />
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
    </Box>
  );
};

export default PricingPage;
