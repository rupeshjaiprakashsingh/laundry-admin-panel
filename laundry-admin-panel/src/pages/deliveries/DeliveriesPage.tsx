import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Chip, Typography, IconButton, Tooltip,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Stack, InputAdornment, CircularProgress,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import EditIcon from '@mui/icons-material/Edit';
import PageHeader from '../../components/PageHeader';
import { getOrders } from '../../api/orders';
import { getEmployees } from '../../api/employees';
import { formatDate } from '../../utils/export';
import type { Order, Employee, Delivery } from '../../types';
import api from '../../api/axios';

const DELIVERY_STATUSES = ['Pending', 'OutForDelivery', 'Delivered', 'Failed'];
const deliveryColors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  Pending: 'warning', OutForDelivery: 'info', Delivered: 'success', Failed: 'error',
};

const DeliveriesPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignDialog, setAssignDialog] = useState<{ orderId: number; deliveryId?: number } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ deliveryId: number; currentStatus: string } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | ''>('');
  const [newStatus, setNewStatus] = useState('');

  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ['orders'], queryFn: getOrders });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });

  const deliveryBoys = (employees as Employee[]).filter((e) => ['Employee', 'DeliveryBoy'].includes(e.role));

  const assignMutation = useMutation({
    mutationFn: ({ orderId, empId }: { orderId: number; empId: number }) =>
      api.post('/deliveries', { orderId, deliveryEmployeeId: empId }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setAssignDialog(null); setSelectedEmployee(''); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/deliveries/${id}/status`, { deliveryStatus: status }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); setStatusDialog(null); },
  });

  // Flatten deliveries from orders
  const allDeliveries = useMemo(() =>
    (orders as Order[]).flatMap((o) =>
      (o.deliveries ?? []).map((d: Delivery) => ({
        ...d,
        id: d.id,
        orderNumber: o.orderNumber,
        customer: o.customer,
        orderId: o.id,
      }))
    ), [orders]);

  const filtered = useMemo(() =>
    allDeliveries.filter((d) => {
      const matchStatus = statusFilter === 'All' || d.deliveryStatus === statusFilter;
      const matchSearch = `${d.orderNumber} ${d.customer?.firstName ?? ''} ${d.customer?.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    }), [allDeliveries, search, statusFilter]);

  const columns: GridColDef[] = [
    { field: 'orderNumber', headerName: 'Order #', width: 140, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
    {
      field: 'customer', headerName: 'Customer', flex: 1, minWidth: 150,
      renderCell: (p) => <Typography sx={{ fontSize: 13 }}>{p.value?.firstName} {p.value?.lastName}</Typography>,
    },
    {
      field: 'deliveryStatus', headerName: 'Status', width: 150,
      renderCell: (p) => <Chip label={p.value} color={deliveryColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} />,
    },
    { field: 'deliveryEmployee', headerName: 'Delivery Boy', width: 150, renderCell: (p) => p.value?.fullName ?? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Unassigned</Typography> },
    { field: 'deliveryDate', headerName: 'Delivery Date', width: 130, renderCell: (p) => formatDate(p.value) },
    { field: 'deliveryRemarks', headerName: 'Remarks', flex: 1, renderCell: (p) => <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{p.value || '-'}</Typography> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Assign Delivery Boy">
            <IconButton size="small" color="primary" onClick={() => { setAssignDialog({ orderId: p.row.orderId, deliveryId: p.row.id }); setSelectedEmployee(p.row.deliveryEmployeeId ?? ''); }}>
              <AssignmentIndIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Update Status">
            <IconButton size="small" onClick={() => { setStatusDialog({ deliveryId: p.row.id, currentStatus: p.row.deliveryStatus }); setNewStatus(p.row.deliveryStatus); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load deliveries.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Delivery Management"
        subtitle={`${filtered.length} deliveries`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Deliveries' }]}
      />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
             <TextField size="small" placeholder="Search order or customer..." value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                {DELIVERY_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        {filtered.length === 0 && !isLoading ? (
          <Alert severity="info" sx={{ m: 2 }}>No deliveries found. Deliveries are created automatically when orders are placed.</Alert>
        ) : (
          <DataGrid rows={filtered} columns={columns} loading={isLoading} autoHeight
            pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none' }}
          />
        )}
      </Card>

      {/* Assign Dialog */}
      <Dialog open={!!assignDialog} onClose={() => setAssignDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Delivery Boy</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Delivery Boy</InputLabel>
            <Select value={selectedEmployee} label="Delivery Boy" onChange={(e) => setSelectedEmployee(Number(e.target.value))}>
              {deliveryBoys.map((e) => <MenuItem key={e.id} value={e.id}>{e.fullName} ({e.role})</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={!selectedEmployee || assignMutation.isPending}
            startIcon={assignMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => assignDialog && selectedEmployee && assignMutation.mutate({ orderId: assignDialog.orderId, empId: Number(selectedEmployee) })}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={!!statusDialog} onClose={() => setStatusDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Delivery Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Status</InputLabel>
            <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
              {DELIVERY_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={statusMutation.isPending}
            onClick={() => statusDialog && statusMutation.mutate({ id: statusDialog.deliveryId, status: newStatus })}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeliveriesPage;
