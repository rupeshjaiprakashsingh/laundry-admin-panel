import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, TextField, Chip, Typography, IconButton, Tooltip, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Stack, InputAdornment, Select, MenuItem, FormControl, InputLabel,
  CircularProgress,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PageHeader from '../../components/PageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getEmployees, deleteEmployee, updateEmployee } from '../../api/employees';
import { registerEmployee } from '../../api/auth';
import { getBranches } from '../../api/branches';
import { formatDate } from '../../utils/export';
import type { Employee } from '../../types';
import { usePermission } from '../../hooks/useAuth';

const roleColors: Record<string, 'default' | 'primary' | 'secondary' | 'warning' | 'info'> = {
  SuperAdmin: 'primary', BranchManager: 'secondary', Employee: 'info', DeliveryBoy: 'warning',
};

const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  mobileNumber: z.string().min(10),
  password: z.string().min(6),
  role: z.enum(['SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy']),
  branchId: z.number().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const EmployeesPage: React.FC = () => {
  const qc = useQueryClient();
  const isSuperAdmin = usePermission('SuperAdmin');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);

  const { data: employees = [], isLoading, error } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: getBranches });

  const createMutation = useMutation({
    mutationFn: (data: CreateForm) => registerEmployee(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setCreateOpen(false); reset(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setDeleteId(null); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Employee> }) => updateEmployee(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setEditEmployee(null); },
  });

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema), defaultValues: { role: 'Employee' },
  });

  const filtered = useMemo(() =>
    employees.filter((e) => {
      const matchRole = roleFilter === 'All' || e.role === roleFilter;
      const matchSearch = `${e.fullName} ${e.email} ${e.mobileNumber} ${e.employeeCode}`.toLowerCase().includes(search.toLowerCase());
      return matchRole && matchSearch;
    }), [employees, search, roleFilter]);

  const columns: GridColDef[] = [
    { field: 'employeeCode', headerName: 'Code', width: 120, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'primary.main' }}>{p.value}</Typography> },
    {
      field: 'fullName', headerName: 'Name', flex: 1, minWidth: 180,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.value}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.row.email}</Typography>
        </Box>
      ),
    },
    { field: 'mobileNumber', headerName: 'Mobile', width: 140 },
    { field: 'role', headerName: 'Role', width: 150, renderCell: (p) => <Chip label={p.value} color={roleColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} /> },
    { field: 'branch', headerName: 'Branch', width: 140, renderCell: (p) => (p.value as { branchName?: string })?.branchName ?? '-' },
    { field: 'isActive', headerName: 'Status', width: 90, renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} color={p.value ? 'success' : 'error'} size="small" /> },
    { field: 'createdDate', headerName: 'Joined', width: 110, renderCell: (p) => formatDate(p.value) },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditEmployee(p.row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          {isSuperAdmin && (
            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => setDeleteId(p.row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  if (error) return <Alert severity="error">Failed to load employees.</Alert>;

  return (
    <Box>
      <PageHeader
        title="Employee Management"
        subtitle={`${filtered.length} employees`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Employees' }]}
        action={isSuperAdmin ? { label: 'Add Employee', icon: <AddIcon />, onClick: () => setCreateOpen(true) } : undefined}
      />

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField size="small" placeholder="Search employees..." value={search}
              onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Role Filter</InputLabel>
              <Select value={roleFilter} label="Role Filter" onChange={(e) => setRoleFilter(e.target.value)}>
                <MenuItem value="All">All Roles</MenuItem>
                {['SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
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

      {/* Create Employee Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle><Typography sx={{ fontWeight: 700 }}>Add New Employee</Typography></DialogTitle>
        <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              {[
                { name: 'fullName' as const, label: 'Full Name' },
                { name: 'email' as const, label: 'Email' },
                { name: 'mobileNumber' as const, label: 'Mobile Number' },
                { name: 'password' as const, label: 'Password', type: 'password' },
              ].map(({ name, label, type }) => (
                <Grid size={{ xs: 12, sm: 6 }} key={name}>
                  <TextField {...register(name)} label={label} type={type} fullWidth size="small"
                    error={!!errors[name]} helperText={errors[name]?.message} />
                </Grid>
              ))}
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Role</InputLabel>
                  <Controller name="role" control={control} render={({ field }) => (
                    <Select {...field} label="Role">
                      {['SuperAdmin', 'BranchManager', 'Employee', 'DeliveryBoy'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  )} />
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Branch</InputLabel>
                  <Controller name="branchId" control={control} render={({ field }) => (
                    <Select {...field} label="Branch" value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}>
                      <MenuItem value="">None</MenuItem>
                      {branches.map((b) => <MenuItem key={b.id} value={b.id}>{b.branchName}</MenuItem>)}
                    </Select>
                  )} />
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}
              startIcon={createMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
              Create Employee
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={!!editEmployee} onClose={() => setEditEmployee(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Employee</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full Name" size="small" fullWidth value={editEmployee?.fullName ?? ''}
              onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, fullName: e.target.value } : null)} />
            <TextField label="Mobile" size="small" fullWidth value={editEmployee?.mobileNumber ?? ''}
              onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, mobileNumber: e.target.value } : null)} />
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select value={editEmployee?.isActive ? 'true' : 'false'} label="Status"
                onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, isActive: e.target.value === 'true' } : null)}>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditEmployee(null)}>Cancel</Button>
          <Button variant="contained" disabled={updateMutation.isPending}
            onClick={() => editEmployee && updateMutation.mutate({ id: editEmployee.id, data: { fullName: editEmployee.fullName, mobileNumber: editEmployee.mobileNumber, isActive: editEmployee.isActive } })}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteId !== null} title="Delete Employee"
        message="Delete this employee permanently?" confirmLabel="Delete" severity="error"
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)} loading={deleteMutation.isPending}
      />
    </Box>
  );
};

export default EmployeesPage;
