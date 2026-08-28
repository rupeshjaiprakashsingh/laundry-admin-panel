import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Chip, Typography, IconButton, Tooltip,
  TextField, MenuItem, Select, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Alert, Stack, InputAdornment, CircularProgress, Avatar,
  Grid, Divider, List, ListItemButton, ListItemAvatar, ListItemText,
  LinearProgress, Tabs, Tab,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import EditIcon from '@mui/icons-material/Edit';
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PageHeader from '../../components/PageHeader';
import { getOrders } from '../../api/orders';
import { getEmployees } from '../../api/employees';
import { formatDate, formatDateTime } from '../../utils/export';
import type { Order, Employee, Delivery } from '../../types';
import api from '../../api/axios';

const DELIVERY_STATUSES = ['Pending', 'OutForDelivery', 'Delivered', 'Failed'];
const deliveryColors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  Pending: 'warning', OutForDelivery: 'info', Delivered: 'success', Failed: 'error',
};

// Delivery boy avatar colors
const avatarColors = ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899'];

interface DeliveryRow extends Delivery {
  orderNumber: string;
  customer: Order['customer'];
  orderId: number;
}

// ── Delivery Boy Stats Card ──────────────────────────────────────────────────
const DeliveryBoyCard: React.FC<{
  employee: Employee;
  deliveries: DeliveryRow[];
  colorIdx: number;
  onSelectBoy: (id: number) => void;
}> = ({ employee, deliveries, colorIdx, onSelectBoy }) => {
  const myDeliveries = deliveries.filter(d => d.deliveryEmployeeId === employee.id);
  const pending = myDeliveries.filter(d => d.deliveryStatus === 'Pending' || d.deliveryStatus === 'OutForDelivery').length;
  const delivered = myDeliveries.filter(d => d.deliveryStatus === 'Delivered').length;
  const failed = myDeliveries.filter(d => d.deliveryStatus === 'Failed').length;
  const total = myDeliveries.length;
  const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const color = avatarColors[colorIdx % avatarColors.length];

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        border: '1.5px solid',
        borderColor: '#E5E7EB',
        transition: 'all 0.2s',
        cursor: 'pointer',
        '&:hover': { borderColor: color, boxShadow: `0 4px 20px ${alpha(color, 0.2)}` },
      }}
      onClick={() => onSelectBoy(employee.id)}
    >
      <CardContent sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: color, fontWeight: 900, width: 42, height: 42 }}>
            {employee.fullName.charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#111827' }} noWrap>
              {employee.fullName}
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#6B7280' }}>
              {employee.employeeCode} · {employee.mobileNumber}
            </Typography>
          </Box>
          <Chip
            label={employee.role === 'DeliveryBoy' ? '🛵 DB' : '👷 Staff'}
            size="small"
            sx={{ fontSize: 10, fontWeight: 700, bgcolor: alpha(color, 0.1), color }}
          />
        </Box>

        {/* Stats Row */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          {[
            { label: 'Pending', value: pending, color: '#F59E0B', bg: '#FFFBEB' },
            { label: 'Delivered', value: delivered, color: '#10B981', bg: '#ECFDF5' },
            { label: 'Failed', value: failed, color: '#EF4444', bg: '#FEF2F2' },
          ].map(s => (
            <Box key={s.label} sx={{ flex: 1, textAlign: 'center', bgcolor: s.bg, borderRadius: 1.5, py: 0.75 }}>
              <Typography sx={{ fontWeight: 900, fontSize: 18, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Success Rate */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 11, color: '#6B7280' }}>Success Rate</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: successRate >= 70 ? '#10B981' : '#F59E0B' }}>
              {successRate}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={successRate}
            sx={{
              height: 6, borderRadius: 3,
              bgcolor: '#F3F4F6',
              '& .MuiLinearProgress-bar': { bgcolor: successRate >= 70 ? '#10B981' : '#F59E0B', borderRadius: 3 },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const DeliveriesPage: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [boyFilter, setBoyFilter] = useState<number | 'All'>('All');
  const [assignDialog, setAssignDialog] = useState<{ orderId: number; deliveryId?: number } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ deliveryId: number; currentStatus: string } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<number | ''>('');
  const [newStatus, setNewStatus] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedBoyProfile, setSelectedBoyProfile] = useState<number | null>(null);

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['orders'],
    queryFn: getOrders,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
  });

  const deliveryBoys = useMemo(
    () => (employees as Employee[]).filter((e) => ['Employee', 'DeliveryBoy'].includes(e.role) && e.isActive),
    [employees],
  );

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

  // Flatten deliveries from orders, keeping only the latest delivery for each order to avoid duplicates in the UI
  const allDeliveries = useMemo(() =>
    (orders as Order[]).flatMap((o) => {
      if (!o.deliveries || o.deliveries.length === 0) return [];
      const sorted = [...o.deliveries].sort((a, b) => b.id - a.id);
      const d = sorted[0];
      return [{
        ...d,
        id: d.id,
        orderNumber: o.orderNumber,
        customer: o.customer,
        orderId: o.id,
        order: o,
      }];
    }), [orders]);

  // Orders ready for delivery but NOT yet assigned
  const unassignedReadyOrders = useMemo(() =>
    (orders as Order[]).filter(o =>
      o.orderStatus === 'Laundry' &&
      (!o.deliveries || o.deliveries.length === 0)
    ), [orders]);

  const filtered = useMemo(() =>
    allDeliveries.filter((d) => {
      const matchStatus = statusFilter === 'All' || d.deliveryStatus === statusFilter;
      const matchBoy = boyFilter === 'All' || d.deliveryEmployeeId === boyFilter;
      const matchSearch = `${d.orderNumber} ${d.customer?.firstName ?? ''} ${d.customer?.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchBoy && matchSearch;
    }), [allDeliveries, search, statusFilter, boyFilter]);

  // Overview stats
  const totalPending = allDeliveries.filter(d => d.deliveryStatus === 'Pending' || d.deliveryStatus === 'OutForDelivery').length;
  const totalDelivered = allDeliveries.filter(d => d.deliveryStatus === 'Delivered').length;
  const totalFailed = allDeliveries.filter(d => d.deliveryStatus === 'Failed').length;

  const columns: GridColDef[] = [
    { field: 'orderNumber', headerName: 'Order #', width: 140, renderCell: (p) => <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{p.value}</Typography> },
    {
      field: 'customer', headerName: 'Customer', flex: 1, minWidth: 150,
      renderCell: (p) => (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.value?.firstName} {p.value?.lastName}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.value?.mobileNumber}</Typography>
        </Box>
      ),
    },
    {
      field: 'deliveryStatus', headerName: 'Status', width: 150,
      renderCell: (p) => <Chip label={p.value} color={deliveryColors[p.value] ?? 'default'} size="small" sx={{ fontWeight: 700 }} />,
    },
    {
      field: 'payment', headerName: 'Payment', width: 160,
      renderCell: (p) => {
        const order = p.row.order;
        if (!order) return <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>;
        const latestPayment = order.payments && order.payments.length > 0 ? order.payments[order.payments.length - 1] : null;
        let mode = latestPayment?.paymentMode;
        if (!mode && order.notes) {
          const lower = order.notes.toLowerCase();
          if (lower.includes('gpay') || lower.includes('google pay')) mode = 'GPay';
          else if (lower.includes('upi') || lower.includes('qr')) mode = 'UPI';
          else if (lower.includes('cash') || lower.includes('cod')) mode = 'Cash';
        }
        const isPaid = order.paymentStatus === 'Paid';
        if (isPaid) {
          const resolvedMode = mode || 'Cash';
          if (resolvedMode === 'GPay') return <Chip label="📱 Paid in GPay" size="small" sx={{ fontWeight: 800, bgcolor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', fontSize: 11 }} />;
          if (resolvedMode === 'UPI') return <Chip label="📱 Paid in UPI" size="small" sx={{ fontWeight: 800, bgcolor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF', fontSize: 11 }} />;
          return <Chip label="💵 Paid in Cash" size="small" sx={{ fontWeight: 800, bgcolor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize: 11 }} />;
        }
        return <Chip label="⏳ Pending" size="small" sx={{ fontWeight: 700, bgcolor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize: 11 }} />;
      },
    },
    {
      field: 'deliveryEmployee', headerName: 'Delivery Boy', width: 160,
      renderCell: (p) => p.value?.fullName ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: '#F59E0B', fontWeight: 700 }}>
            {p.value.fullName.charAt(0)}
          </Avatar>
          <Typography sx={{ fontSize: 12 }}>{p.value.fullName}</Typography>
        </Box>
      ) : <Typography sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>Unassigned</Typography>,
    },
    {
      field: 'customer_address', headerName: 'Address', flex: 1, minWidth: 160,
      renderCell: (p) => {
        const c = p.row.customer;
        const addr = [c?.houseDetails, c?.address, c?.city].filter(Boolean).join(', ');
        return <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{addr || '—'}</Typography>;
      },
    },
    { field: 'deliveryDate', headerName: 'Delivered At', width: 130, renderCell: (p) => formatDate(p.value) },
    {
      field: 'actions', headerName: 'Actions', width: 100, sortable: false,
      renderCell: (p) => (
        <Stack direction="row">
          <Tooltip title="Assign / Reassign Delivery Boy">
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
        subtitle={`${allDeliveries.length} deliveries · ${unassignedReadyOrders.length} orders ready to assign`}
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Deliveries' }]}
      />

      {/* ── Overview Stat Strip ─────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Pending / Out', value: totalPending, color: '#F59E0B', bg: '#FFFBEB', icon: <PendingActionsIcon /> },
          { label: 'Delivered', value: totalDelivered, color: '#10B981', bg: '#ECFDF5', icon: <TaskAltIcon /> },
          { label: 'Failed', value: totalFailed, color: '#EF4444', bg: '#FEF2F2', icon: <LocalShippingIcon /> },
          { label: 'Ready to Assign', value: unassignedReadyOrders.length, color: '#6366F1', bg: '#EEF2FF', icon: <DeliveryDiningIcon /> },
        ].map(s => (
          <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
            <Card elevation={0} sx={{ borderRadius: 3, border: '1.5px solid', borderColor: '#E5E7EB' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ color: s.color }}>{s.icon}</Box>
                  <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{s.label}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 900, fontSize: 28, color: s.color }}>{s.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ── Tabs ────────────────────────────────────────────────────── */}
      <Card elevation={0} sx={{ borderRadius: 3, border: '1.5px solid', borderColor: '#E5E7EB', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Tab label="All Deliveries" />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Delivery Boys
              <Chip label={deliveryBoys.length} size="small" sx={{ height: 18, fontSize: 10 }} />
            </Box>
          } />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              Ready to Assign
              {unassignedReadyOrders.length > 0 && (
                <Chip label={unassignedReadyOrders.length} size="small" color="warning" sx={{ height: 18, fontSize: 10 }} />
              )}
            </Box>
          } />
        </Tabs>

        {/* Tab 0 — All Deliveries */}
        {activeTab === 0 && (
          <Box sx={{ p: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField size="small" placeholder="Search order or customer..." value={search}
                onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1 }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
              />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                  <MenuItem value="All">All Statuses</MenuItem>
                  {DELIVERY_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Delivery Boy</InputLabel>
                <Select value={boyFilter} label="Delivery Boy" onChange={(e) => setBoyFilter(e.target.value as number | 'All')}>
                  <MenuItem value="All">All</MenuItem>
                  {deliveryBoys.map(e => <MenuItem key={e.id} value={e.id}>{e.fullName}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            {filtered.length === 0 && !isLoading ? (
              <Alert severity="info">No deliveries found. Deliveries are created when orders are assigned to delivery boys.</Alert>
            ) : (
              <DataGrid rows={filtered} columns={columns} loading={isLoading} autoHeight
                pageSizeOptions={[10, 25, 50]} disableRowSelectionOnClick
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                sx={{ border: 'none' }}
              />
            )}
          </Box>
        )}

        {/* Tab 1 — Delivery Boys */}
        {activeTab === 1 && (
          <Box sx={{ p: 2 }}>
            {deliveryBoys.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                No delivery boys yet. Go to <strong>Employees</strong> → Add Employee → set Role to <strong>DeliveryBoy</strong>.
              </Alert>
            ) : (
              <Grid container spacing={2}>
                {deliveryBoys.map((emp, idx) => (
                  <Grid key={emp.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <DeliveryBoyCard
                      employee={emp}
                      deliveries={allDeliveries}
                      colorIdx={idx}
                      onSelectBoy={(id) => setSelectedBoyProfile(id)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        )}

        {/* Tab 2 — Ready to Assign */}
        {activeTab === 2 && (
          <Box sx={{ p: 2 }}>
            {unassignedReadyOrders.length === 0 ? (
              <Alert severity="success">All orders with delivery status have been assigned to a delivery boy! 🎉</Alert>
            ) : (
              <Stack spacing={1.5}>
                <Alert severity="info">
                  These orders are processed in <strong>Laundry</strong> but have no delivery boy assigned yet. Click <strong>Assign</strong> to assign one.
                </Alert>
                {unassignedReadyOrders.map((order) => (
                  <Card key={order.id} elevation={0} sx={{ border: '1.5px solid #FDE68A', borderRadius: 2, bgcolor: '#FFFBEB' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography sx={{ fontWeight: 800, fontSize: 14 }}>{order.orderNumber}</Typography>
                          <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                            {order.customer?.firstName} {order.customer?.lastName} · {order.customer?.mobileNumber}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                            <LocationOnIcon sx={{ fontSize: 12, color: '#F59E0B' }} />
                            <Typography sx={{ fontSize: 11, color: '#92400E' }}>
                              {[order.customer?.houseDetails, order.customer?.address, order.customer?.city, order.customer?.pincode].filter(Boolean).join(', ')}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <Chip label={order.orderStatus} color="warning" size="small" sx={{ fontWeight: 700 }} />
                          <Button
                            variant="contained" size="small"
                            startIcon={<AssignmentIndIcon />}
                            onClick={() => { setAssignDialog({ orderId: order.id }); setSelectedEmployee(''); }}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: 12, bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}
                          >
                            Assign Delivery Boy
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Card>

      {/* ── Assign Delivery Boy Dialog ──────────────────────────────── */}
      <Dialog open={!!assignDialog} onClose={() => setAssignDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeliveryDiningIcon sx={{ color: '#F59E0B' }} />
            <Typography sx={{ fontWeight: 700 }}>Assign Delivery Boy</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {deliveryBoys.length === 0 ? (
            <Alert severity="warning">
              No active delivery boys found. Go to <strong>Employees</strong> and add one with role 'DeliveryBoy'.
            </Alert>
          ) : (
            <List disablePadding>
              {deliveryBoys.map((emp, idx) => {
                const empDeliveries = allDeliveries.filter(d => d.deliveryEmployeeId === emp.id && (d.deliveryStatus === 'Pending' || d.deliveryStatus === 'OutForDelivery'));
                const color = avatarColors[idx % avatarColors.length];
                return (
                  <ListItemButton
                    key={emp.id}
                    selected={selectedEmployee === emp.id}
                    onClick={() => setSelectedEmployee(emp.id)}
                    sx={{ borderRadius: 2, mb: 1, border: (t) => selectedEmployee === emp.id ? `2px solid ${t.palette.primary.main}` : '2px solid transparent' }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: color, fontWeight: 700 }}>{emp.fullName.charAt(0)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{emp.fullName}</Typography>
                          <Chip label={emp.role} size="small" color="warning" sx={{ fontSize: 10, height: 18 }} />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {emp.employeeCode} · {emp.mobileNumber} · {empDeliveries.length} active deliveries
                        </Typography>
                      }
                    />
                    {selectedEmployee === emp.id && <CheckCircleIcon color="primary" />}
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!selectedEmployee || assignMutation.isPending}
            startIcon={assignMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <AssignmentIndIcon />}
            onClick={() => assignDialog && selectedEmployee && assignMutation.mutate({ orderId: assignDialog.orderId, empId: Number(selectedEmployee) })}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Status Update Dialog ────────────────────────────────────── */}
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
          <Button
            variant="contained"
            disabled={statusMutation.isPending}
            onClick={() => statusDialog && statusMutation.mutate({ id: statusDialog.deliveryId, status: newStatus })}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delivery Boy Profile Dialog ─────────────────────────────── */}
      <Dialog
        open={!!selectedBoyProfile}
        onClose={() => setSelectedBoyProfile(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedBoyProfile && (() => {
          const emp = (employees as Employee[]).find(e => e.id === selectedBoyProfile);
          if (!emp) return null;
          const boyDeliveries = allDeliveries.filter(d => d.deliveryEmployeeId === emp.id);
          const pending = boyDeliveries.filter(d => d.deliveryStatus === 'Pending' || d.deliveryStatus === 'OutForDelivery');
          const delivered = boyDeliveries.filter(d => d.deliveryStatus === 'Delivered');
          const failed = boyDeliveries.filter(d => d.deliveryStatus === 'Failed');
          return (
            <>
              <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: '#F59E0B', width: 48, height: 48, fontSize: 20, fontWeight: 900 }}>
                    {emp.fullName.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{emp.fullName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {emp.employeeCode} · {emp.role} · {emp.mobileNumber}
                    </Typography>
                  </Box>
                </Box>
              </DialogTitle>
              <DialogContent dividers>
                {/* Stats */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  {[
                    { label: 'Active', value: pending.length, color: '#F59E0B' },
                    { label: 'Delivered', value: delivered.length, color: '#10B981' },
                    { label: 'Failed', value: failed.length, color: '#EF4444' },
                    { label: 'Total', value: boyDeliveries.length, color: '#6366F1' },
                  ].map(s => (
                    <Grid key={s.label} size={{ xs: 3 }}>
                      <Box sx={{ textAlign: 'center', p: 1.5, bgcolor: '#F9FAFB', borderRadius: 2 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 24, color: s.color }}>{s.value}</Typography>
                        <Typography sx={{ fontSize: 11, color: '#6B7280' }}>{s.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Typography sx={{ fontWeight: 700, mb: 1 }}>Active Deliveries</Typography>
                {pending.length === 0 ? (
                  <Alert severity="success">No pending deliveries 🎉</Alert>
                ) : (
                  <Stack spacing={1}>
                    {pending.map(d => (
                      <Box key={d.id} sx={{ p: 1.5, bgcolor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{d.orderNumber}</Typography>
                            <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                              {d.customer?.firstName} {d.customer?.lastName} · {d.customer?.mobileNumber}
                            </Typography>
                          </Box>
                          <Chip label={d.deliveryStatus} color={deliveryColors[d.deliveryStatus] ?? 'default'} size="small" sx={{ fontWeight: 700 }} />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setSelectedBoyProfile(null)}>Close</Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>
    </Box>
  );
};

export default DeliveriesPage;
