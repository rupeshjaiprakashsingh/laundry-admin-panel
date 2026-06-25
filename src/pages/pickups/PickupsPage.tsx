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
import { getPickups, assignPickup, updatePickupStatus } from '../../api/pickups';
import { getEmployees } from '../../api/employees';
import { formatDate, formatDateTime } from '../../utils/export';
import type { PickupRequest, Employee } from '../../types';

const STATUS_OPTIONS = ['Pending', 'Assigned', 'Completed', 'Cancelled'];
const statusColors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  Pending: 'warning', Assigned: 'info', Completed: 'success', Cancelled: 'error',
};

const PickupsPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignDialog, setAssignDialog] = useState<PickupRequest | null>(null);
  const [statusDialog, setStatusDialog] = useState<PickupRequest | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | ''>('');
  const [newStatus, setNewStatus] = useState('');

  const { data: pickups = [], isLoading, error } = useQuery({ queryKey: ['pickups'], queryFn: getPickups });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });

  const deliveryBoys = (employees as Employee[]).filter((e) => ['Employee', 'DeliveryBoy'].includes(e.role));

  const assignMutation = useMutation({
    mutationFn: ({ id, empId }: { id: number; empId: number }) => assignPickup(id, empId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pickups'] }); setAssignDialog(null); setSelectedEmployee(''); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updatePickupStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pickups'] }); setStatusDialog(null); },
  });

  const filtered = useMemo(() =>
    pickups.filter((p) => {
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchSearch = `${p.customer?.firstName ?? ''} ${p.customer?.lastName ?? ''} ${p.pickupAddress}`.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    }), [pickups, search, statusFilter]);

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    {
      field: 'customer', headerName: 'Customer', flex: 1, minWidth: 160,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.value?.firstName} {p.value?.lastName}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.value?.mobileNumber}</Typography>
        </Box>
      ),
    },
    { field: 'pickupAddress', headerName: 'Address', flex: 1, minWidth: 180, renderCell: (p) => <Typography sx={{ fontSize: 12 }}>{p.value}</Typography> },
    { field: 'pickupDate', headerName: 'Pickup Date', width: 130, renderCell: (p) => formatDate(p.value) },
    { field: 'pickupTime', headerName: 'Time', width: 100 },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => <Chip label={p.value} color={statusColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} />,
    },
    { field: 'assignedEmployee', headerName: 'Assigned To', width: 140, renderCell: (p) => p.value?.fullName ?? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Unassigned</Typography> },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Assign Employee">
            <IconButton size="small" color="primary" onClick={() => { setAssignDialog(p.row); setSelectedEmployee(p.row.assignedEmployeeId ?? ''); }}>
              <AssignmentIndIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Update Status">
            <IconButton size="small" onClick={() => { setStatusDialog(p.row); setNewStatus(p.row.status); }}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load pickup requests.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Pickup Scheduling"
        subtitle={`${filtered.length} pickup requests`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Pickups' }]}
      />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField size="small" placeholder="Search customer or address..." value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <DataGrid rows={filtered} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      {/* Assign Dialog */}
      <Dialog open={!!assignDialog} onClose={() => setAssignDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign Pickup #{assignDialog?.id}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>Customer: {assignDialog?.customer?.firstName} {assignDialog?.customer?.lastName}</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>Date: {formatDateTime(assignDialog?.pickupDate)}</Typography>
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
            <InputLabel>Assign To</InputLabel>
            <Select value={selectedEmployee} label="Assign To" onChange={(e) => setSelectedEmployee(Number(e.target.value))}>
              {deliveryBoys.map((e) => <MenuItem key={e.id} value={e.id}>{e.fullName} ({e.role})</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={!selectedEmployee || assignMutation.isPending}
            startIcon={assignMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => assignDialog && selectedEmployee && assignMutation.mutate({ id: assignDialog.id, empId: Number(selectedEmployee) })}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={!!statusDialog} onClose={() => setStatusDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Update Pickup Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Status</InputLabel>
            <Select value={newStatus} label="Status" onChange={(e) => setNewStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialog(null)}>Cancel</Button>
          <Button variant="contained" disabled={statusMutation.isPending}
            onClick={() => statusDialog && statusMutation.mutate({ id: statusDialog.id, status: newStatus })}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PickupsPage;
