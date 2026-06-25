import React, { useState, useMemo } from 'react';
import {
  Box, Card, TextField, Chip, Typography, IconButton, Tooltip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Stack, InputAdornment,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PageHeader from '../../components/PageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getCustomers, deleteCustomer } from '../../api/customers';
import { formatDate, exportToExcel } from '../../utils/export';
import type { Customer } from '../../types';
import { usePermission } from '../../hooks/useAuth';

const CustomersPage: React.FC = () => {
  const qc = useQueryClient();
  const isSuperAdmin = usePermission('SuperAdmin');
  const [search, setSearch] = useState('');
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: customers = [], isLoading, error } = useQuery({ queryKey: ['customers'], queryFn: getCustomers });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setDeleteId(null); },
  });

  const filtered = useMemo(() =>
    customers.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.mobileNumber} ${c.email} ${c.customerCode}`
        .toLowerCase().includes(search.toLowerCase())
    ), [customers, search]);

  const columns: GridColDef[] = [
    { field: 'customerCode', headerName: 'Code', width: 120, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'primary.main' }}>{p.value}</Typography> },
    {
      field: 'name', headerName: 'Name', flex: 1, minWidth: 180,
      valueGetter: (_v: unknown, row: Customer) => `${row.firstName} ${row.lastName}`,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.value}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.row.email}</Typography>
        </Box>
      ),
    },
    { field: 'mobileNumber', headerName: 'Mobile', width: 140 },
    { field: 'city', headerName: 'City', width: 120, renderCell: (p) => p.value || '-' },
    { field: 'pincode', headerName: 'Pincode', width: 100, renderCell: (p) => p.value || '-' },
    {
      field: 'isActive', headerName: 'Status', width: 100,
      renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" sx={{ fontWeight: 700 }} />,
    },
    { field: 'createdDate', headerName: 'Joined', width: 120, renderCell: (p) => formatDate(p.value) },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="View"><IconButton size="small" onClick={() => setViewCustomer(p.row)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          {isSuperAdmin && (
            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load customers.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Customer Management"
        subtitle={`${filtered.length} customers`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Customers' }]}
        action={{ label: 'Export Excel', icon: <FileDownloadIcon />, onClick: () => exportToExcel(filtered.map((c) => ({ Code: c.customerCode, Name: `${c.firstName} ${c.lastName}`, Mobile: c.mobileNumber, Email: c.email, City: c.city, Pincode: c.pincode, Status: c.isActive ? 'Active' : 'Inactive', Joined: formatDate(c.createdDate) })), 'customers') }}
      />

      <Card sx={{ mb: 2, p: 2 }}>
        <TextField
          size="small" placeholder="Search by name, mobile, email, code..." fullWidth
          value={search} onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Card>

      <Card>
        <DataGrid rows={filtered} columns={columns} loading={isLoading} autoHeight
          pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          sx={{ border: 'none' }}
        />
      </Card>

      {/* View Customer */}
      <Dialog open={!!viewCustomer} onClose={() => setViewCustomer(null)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography sx={{ fontWeight: 700 }}>Customer Profile</Typography></DialogTitle>
        <DialogContent dividers>
          {viewCustomer && (
            <Grid container spacing={2}>
              {[
                ['Code', viewCustomer.customerCode], ['Name', `${viewCustomer.firstName} ${viewCustomer.lastName}`],
                ['Mobile', viewCustomer.mobileNumber], ['Email', viewCustomer.email],
                ['Gender', viewCustomer.gender || '-'], ['Date of Birth', viewCustomer.dob || '-'],
                ['Address', viewCustomer.address || '-'], ['City', viewCustomer.city || '-'],
                ['State', viewCustomer.state || '-'], ['Pincode', viewCustomer.pincode || '-'],
                ['Landmark', viewCustomer.landmark || '-'], ['House Details', viewCustomer.houseDetails || '-'],
                ['Joined', formatDate(viewCustomer.createdDate)],
              ].map(([label, value]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={label as string}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label as string}</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{value as string}</Typography>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setViewCustomer(null)}>Close</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null} title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        confirmLabel="Delete" severity="error"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
};

export default CustomersPage;
