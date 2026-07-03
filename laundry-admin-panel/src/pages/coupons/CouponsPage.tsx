import React, { useState } from 'react';
import {
  Box, Card, Typography, IconButton, Tooltip, Chip, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Switch, FormControlLabel, CircularProgress,
  Snackbar,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageHeader from '../../components/PageHeader';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '../../api/coupons';
import type { Coupon } from '../../types';

const emptyCoupon = {
  code: '',
  discount: 0,
  description: '',
  isActive: true,
};

const CouponsPage: React.FC = () => {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editCouponData, setEditCouponData] = useState<Coupon | null>(null);
  const [form, setForm] = useState({ ...emptyCoupon });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const { data: coupons = [], isLoading, error } = useQuery({ queryKey: ['coupons'], queryFn: getCoupons });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyCoupon) => createCoupon(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] });
      setFormOpen(false);
      setForm({ ...emptyCoupon });
      setSnack({ open: true, msg: 'Coupon created successfully!', severity: 'success' });
    },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Create failed', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Coupon> }) => updateCoupon(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] });
      setFormOpen(false);
      setEditCouponData(null);
      setSnack({ open: true, msg: 'Coupon updated successfully!', severity: 'success' });
    },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Update failed', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCoupon(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coupons'] });
      setDeleteId(null);
      setSnack({ open: true, msg: 'Coupon deleted!', severity: 'success' });
    },
    onError: (e: any) => {
      setDeleteId(null);
      setSnack({ open: true, msg: e?.response?.data?.message || 'Delete failed', severity: 'error' });
    },
  });

  const openCreate = () => {
    setEditCouponData(null);
    setForm({ ...emptyCoupon });
    setFormOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditCouponData(c);
    setForm({
      code: c.code,
      discount: c.discount,
      description: c.description || '',
      isActive: c.isActive,
    });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    if (!form.code.trim() || form.discount <= 0) return;
    const payload = { ...form, discount: Number(form.discount) };
    if (editCouponData) {
      updateMutation.mutate({ id: editCouponData.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const columns: GridColDef[] = [
    { field: 'code', headerName: 'Coupon Code', flex: 1, minWidth: 150, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'primary.main' }}>{p.value}</Typography> },
    { field: 'discount', headerName: 'Discount (₹)', width: 130, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>₹{p.value}</Typography> },
    { field: 'description', headerName: 'Description', flex: 1.5, renderCell: (p) => <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{p.value || '—'}</Typography> },
    { field: 'isActive', headerName: 'Status', width: 120, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" sx={{ fontWeight: 700 }} /> },
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

  if (error) return <Alert severity="error">Failed to load coupons. Check your API server connection.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Coupon & Discount Management"
        subtitle="Create, edit, and activate discount coupons for festivals and monthly campaigns"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Coupons' }]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Coupon</Button>
      </Box>

      <Card>
        <DataGrid
          rows={coupons}
          columns={columns}
          loading={isLoading}
          autoHeight
          pageSizeOptions={[10, 25]}
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editCouponData ? `Edit Coupon — ${editCouponData.code}` : '➕ Add New Coupon'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="Coupon Code *"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                placeholder="e.g. FESTIVAL30"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="Discount Amount (₹) *"
                type="number"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 30"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                size="small"
                label="Description"
                multiline
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. ₹30 flat discount for Diwali festival"
              />
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
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.code || form.discount <= 0 || createMutation.isPending || updateMutation.isPending}
            startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {editCouponData ? 'Save Changes' : 'Create Coupon'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Coupon</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will permanently delete the discount coupon code.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
          >
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

export default CouponsPage;
