import React, { useState } from 'react';
import {
  Box, Card, CardMedia, CardContent, CardActions, Typography, IconButton, Tooltip, Chip, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Switch, FormControlLabel, CircularProgress,
  Snackbar,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageHeader from '../../components/PageHeader';
import { getBanners, createBanner, updateBanner, deleteBanner } from '../../api/banners';
import type { Banner } from '../../types';

const emptyBanner = {
  title: '',
  imageUrl: '',
  isActive: true,
};

const BannersPage: React.FC = () => {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editBannerData, setEditBannerData] = useState<Banner | null>(null);
  const [form, setForm] = useState({ ...emptyBanner });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });

  const { data: banners = [], isLoading, error } = useQuery({ queryKey: ['banners'], queryFn: getBanners });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyBanner) => createBanner(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setFormOpen(false);
      setForm({ ...emptyBanner });
      setSnack({ open: true, msg: 'Banner created successfully!', severity: 'success' });
    },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Create failed', severity: 'error' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Banner> }) => updateBanner(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setFormOpen(false);
      setEditBannerData(null);
      setSnack({ open: true, msg: 'Banner updated successfully!', severity: 'success' });
    },
    onError: (e: any) => setSnack({ open: true, msg: e?.response?.data?.message || 'Update failed', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBanner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['banners'] });
      setDeleteId(null);
      setSnack({ open: true, msg: 'Banner deleted!', severity: 'success' });
    },
    onError: (e: any) => {
      setDeleteId(null);
      setSnack({ open: true, msg: e?.response?.data?.message || 'Delete failed', severity: 'error' });
    },
  });

  const openCreate = () => {
    setEditBannerData(null);
    setForm({ ...emptyBanner });
    setFormOpen(true);
  };

  const openEdit = (b: Banner) => {
    setEditBannerData(b);
    setForm({
      title: b.title,
      imageUrl: b.imageUrl,
      isActive: b.isActive,
    });
    setFormOpen(true);
  };

  const toggleActive = (b: Banner) => {
    updateMutation.mutate({ id: b.id, data: { isActive: !b.isActive } });
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.imageUrl.trim()) return;
    if (editBannerData) {
      updateMutation.mutate({ id: editBannerData.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  if (error) return <Alert severity="error">Failed to load banners. Check your API server connection.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Promotional Banners"
        subtitle="Manage dynamic home screen banners and sliders for the mobile app"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Banners' }]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Banner</Button>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : banners.length === 0 ? (
        <Alert severity="info" sx={{ py: 3 }}>No promotional banners defined yet. Click Add Banner to create one!</Alert>
      ) : (
        <Grid container spacing={3}>
          {banners.map((banner) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={banner.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <CardMedia
                  component="img"
                  height="160"
                  image={banner.imageUrl}
                  alt={banner.title}
                  onError={(e: any) => {
                    e.target.src = 'https://placehold.co/600x300?text=Invalid+Image+URL';
                  }}
                  sx={{ objectFit: 'cover' }}
                />
                <Chip
                  label={banner.isActive ? 'Active' : 'Inactive'}
                  color={banner.isActive ? 'success' : 'default'}
                  size="small"
                  sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 700, backdropFilter: 'blur(4dp)' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 1 }} noWrap>
                    {banner.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                    URL: {banner.imageUrl}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={banner.isActive}
                        onChange={() => toggleActive(banner)}
                        disabled={updateMutation.isPending}
                      />
                    }
                    label={<Typography variant="body2">Active</Typography>}
                  />
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(banner)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteId(banner.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editBannerData ? `Edit Banner — ${editBannerData.title}` : '➕ Add New Promo Banner'}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Banner Title *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Free Delivery"
            />
            <TextField
              fullWidth
              size="small"
              label="Banner Image URL *"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="e.g. https://images.unsplash.com/photo-1545173168-9f1947eebd01"
            />
            {form.imageUrl && (
              <Box sx={{ border: '1px dashed #ccc', borderRadius: 1, p: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Image Preview</Typography>
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  style={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
                  onError={(e: any) => {
                    e.target.src = 'https://placehold.co/600x300?text=Invalid+Image+URL';
                  }}
                />
              </Box>
            )}
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
              label="Active (visible on Android app home slider)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!form.title.trim() || !form.imageUrl.trim() || createMutation.isPending || updateMutation.isPending}
            startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {editBannerData ? 'Save Changes' : 'Create Banner'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Banner</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will permanently remove the promotional banner from the database and the app slider.
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

export default BannersPage;
