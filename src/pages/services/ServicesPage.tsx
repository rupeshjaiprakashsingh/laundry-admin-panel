import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, IconButton, Tooltip, Chip, Button, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert, Stack, Switch, FormControlLabel, CircularProgress,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageHeader from '../../components/PageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getServices, createService, updateService, deleteService } from '../../api/services';
import { formatCurrency } from '../../utils/export';
import type { Service } from '../../types';

const schema = z.object({
  serviceName: z.string().min(2, 'Required'),
  serviceType: z.string().min(2, 'Required'),
  price: z.coerce.number().min(0),
  description: z.string().optional(),
  estimatedHours: z.coerce.number().optional(),
});
type FormData = z.infer<typeof schema>;

const ServicesPage: React.FC = () => {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: services = [], isLoading, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Service>) => createService(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setFormOpen(false); reset(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Service> }) => updateService(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setEditService(null); reset(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteService(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['services'] }); setDeleteId(null); },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) as any });

  const openEdit = (service: Service) => {
    setEditService(service);
    reset({ serviceName: service.serviceName, serviceType: service.serviceType, price: service.price, description: service.description, estimatedHours: service.estimatedHours });
    setFormOpen(true);
  };

  const onSubmit = (data: FormData) => {
    if (editService) updateMutation.mutate({ id: editService.id, data });
    else createMutation.mutate(data);
  };

  const columns: GridColDef[] = [
    { field: 'serviceName', headerName: 'Service Name', flex: 1, minWidth: 160, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
    { field: 'serviceType', headerName: 'Type', width: 150, renderCell: (p) => <Chip label={p.value} size="small" color="primary" sx={{ fontWeight: 600 }} /> },
    { field: 'price', headerName: 'Base Price', width: 130, renderCell: (p) => <Typography sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(p.value)}</Typography> },
    { field: 'estimatedHours', headerName: 'Est. Hours', width: 120, renderCell: (p) => p.value ? `${p.value}h` : '-' },
    { field: 'description', headerName: 'Description', flex: 1, renderCell: (p) => <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{p.value || '-'}</Typography> },
    { field: 'isActive', headerName: 'Status', width: 90, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" /> },
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

  if (error) return <Alert severity="error">Failed to load services.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Service Management"
        subtitle={`${services.length} services configured`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Services' }]}
        action={{ label: 'Add Service', icon: <AddIcon />, onClick: () => { setEditService(null); reset({ serviceName: '', serviceType: '', price: 0 }); setFormOpen(true); } }}
      />
      <Card>
        <DataGrid rows={services} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      <Dialog open={formOpen} onClose={() => { setFormOpen(false); setEditService(null); }} maxWidth="sm" fullWidth>
        <DialogTitle><Typography sx={{ fontWeight: 700 }}>{editService ? 'Edit Service' : 'Add New Service'}</Typography></DialogTitle>
        <form onSubmit={handleSubmit(onSubmit as any)}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField {...register('serviceName')} label="Service Name" fullWidth size="small"
                  error={!!errors.serviceName} helperText={errors.serviceName?.message} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField {...register('serviceType')} label="Service Type" fullWidth size="small"
                  error={!!errors.serviceType} helperText={errors.serviceType?.message}
                  placeholder="e.g. Dry Cleaning, Ironing" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField {...register('price')} label="Base Price (₹)" type="number" fullWidth size="small"
                  error={!!errors.price} helperText={errors.price?.message} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField {...register('estimatedHours')} label="Estimated Hours" type="number" fullWidth size="small" />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField {...register('description')} label="Description" fullWidth size="small" multiline rows={2} />
              </Grid>
              {editService && (
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={<Switch defaultChecked={editService.isActive} onChange={(e) => setEditService((prev) => prev ? { ...prev, isActive: e.target.checked } : null)} />}
                    label="Active"
                  />
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setFormOpen(false); setEditService(null); }}>Cancel</Button>
            <Button type="submit" variant="contained"
              disabled={createMutation.isPending || updateMutation.isPending}
              startIcon={(createMutation.isPending || updateMutation.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}>
              {editService ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} title="Delete Service"
        message="This will delete the service." confirmLabel="Delete" severity="error"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)} loading={deleteMutation.isPending}
      />
    </Box>
  );
};

export default ServicesPage;
