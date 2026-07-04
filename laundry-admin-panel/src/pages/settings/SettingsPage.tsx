import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Grid,
  Divider, Alert, Chip, Stack, CircularProgress, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import PageHeader from '../../components/PageHeader';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import { getBranches, createBranch, updateBranch, deleteBranch } from '../../api/branches';
import { updateEmployee } from '../../api/employees';
import { getTimeSlotsAdmin, createTimeSlot, updateTimeSlot, deleteTimeSlot } from '../../api/timeSlots';
import type { Branch } from '../../types';

const profileSchema = z.object({ fullName: z.string().min(2), mobileNumber: z.string().min(10) });
type ProfileForm = z.infer<typeof profileSchema>;

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [snack, setSnack] = useState('');
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranchId, setDeleteBranchId] = useState<number | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchContact, setBranchContact] = useState('');

  // Time Slot states
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<any>(null);
  const [deleteSlotId, setDeleteSlotId] = useState<number | null>(null);
  const [slotName, setSlotName] = useState('');
  const [slotCapacity, setSlotCapacity] = useState(20);
  const [slotActive, setSlotActive] = useState(true);

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: getBranches });
  const { data: timeSlots = [] } = useQuery({ queryKey: ['timeSlots'], queryFn: getTimeSlotsAdmin });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<{ fullName: string; mobileNumber: string }>) => updateEmployee(user!.userId, data),
    onSuccess: () => setSnack('Profile updated successfully!'),
  });

  const createBranchMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setBranchFormOpen(false); setSnack('Branch created!'); },
  });
  const updateBranchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Branch> }) => updateBranch(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setEditBranch(null); setBranchFormOpen(false); setSnack('Branch updated!'); },
  });
  const deleteBranchMutation = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setDeleteBranchId(null); setSnack('Branch deleted!'); },
  });

  // Time Slot mutations
  const createSlotMutation = useMutation({
    mutationFn: createTimeSlot,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timeSlots'] }); setSlotFormOpen(false); setSnack('Time slot created!'); },
  });
  const updateSlotMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateTimeSlot(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timeSlots'] }); setEditSlot(null); setSlotFormOpen(false); setSnack('Time slot updated!'); },
  });
  const deleteSlotMutation = useMutation({
    mutationFn: deleteTimeSlot,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timeSlots'] }); setDeleteSlotId(null); setSnack('Time slot deleted!'); },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName ?? '', mobileNumber: '' },
  });

  const openBranchEdit = (b: Branch) => {
    setEditBranch(b);
    setBranchName(b.branchName); setBranchCode(b.branchCode);
    setBranchAddress(b.address ?? ''); setBranchContact(b.contactNumber ?? '');
    setBranchFormOpen(true);
  };

  return (
    <Box>
      <PageHeader title="Settings" subtitle="Manage your profile and system settings"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
      />

      <Grid container spacing={3}>
        {/* Profile */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <PersonIcon color="primary" />
                <Typography sx={{ fontWeight: 700 }}>My Profile</Typography>
              </Box>
              <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip label={user?.role} color="primary" size="small" sx={{ fontWeight: 700 }} />
                <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              </Box>
              <form onSubmit={handleSubmit((data) => updateProfileMutation.mutate(data))}>
                <Stack spacing={2}>
                  <TextField {...register('fullName')} label="Full Name" size="small" fullWidth
                    error={!!errors.fullName} helperText={errors.fullName?.message} />
                  <TextField {...register('mobileNumber')} label="Mobile Number" size="small" fullWidth
                    error={!!errors.mobileNumber} helperText={errors.mobileNumber?.message} />
                  <Button type="submit" variant="contained" disabled={updateProfileMutation.isPending}
                    startIcon={updateProfileMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}>
                    Update Profile
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* API Info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 700 }} gutterBottom>System Info</Typography>
              <Divider sx={{ mb: 2 }} />
              {[
                ['Panel Version', '1.0.0'],
                ['Backend URL', 'http://localhost:5000'],
                ['Your Role', user?.role ?? '-'],
                ['Employee Code', user?.employeeCode ?? '-'],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Branches (SuperAdmin only) */}
        {user?.role === 'SuperAdmin' && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <BusinessIcon color="primary" />
                    <Typography sx={{ fontWeight: 700 }}>Branch Management</Typography>
                  </Box>
                  <Button variant="contained" size="small" startIcon={<AddIcon />}
                    onClick={() => { setEditBranch(null); setBranchName(''); setBranchCode(''); setBranchAddress(''); setBranchContact(''); setBranchFormOpen(true); }}>
                    Add Branch
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {(branches as Branch[]).map((b) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.id}>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>{b.branchName}</Typography>
                            <Chip label={b.branchCode} size="small" color="secondary" sx={{ my: 0.5 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{b.address || '-'}</Typography>
                            <Typography variant="caption" color="text.secondary">{b.contactNumber || '-'}</Typography>
                          </Box>
                          <Stack>
                            <Button size="small" onClick={() => openBranchEdit(b)}><EditIcon fontSize="small" /></Button>
                            <Button size="small" color="error" onClick={() => setDeleteBranchId(b.id)}><DeleteIcon fontSize="small" /></Button>
                          </Stack>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                  {(branches as Branch[]).length === 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="info">No branches created yet.</Alert>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Time Slots (SuperAdmin only) */}
        {user?.role === 'SuperAdmin' && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <BusinessIcon color="primary" />
                    <Typography sx={{ fontWeight: 700 }}>Time Slot Capacity Management</Typography>
                  </Box>
                  <Button variant="contained" size="small" startIcon={<AddIcon />}
                    onClick={() => { setEditSlot(null); setSlotName(''); setSlotCapacity(20); setSlotActive(true); setSlotFormOpen(true); }}>
                    Add Time Slot
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {timeSlots.map((ts: any) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ts.id}>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: ts.isActive ? 'inherit' : '#F5F5F5' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                              {ts.slotName}
                              {!ts.isActive && <Chip label="Inactive" size="small" color="default" sx={{ height: 16, fontSize: 10 }} />}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              Max Capacity: <strong>{ts.maxCapacity}</strong> orders
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" onClick={() => {
                              setEditSlot(ts);
                              setSlotName(ts.slotName);
                              setSlotCapacity(ts.maxCapacity);
                              setSlotActive(ts.isActive);
                              setSlotFormOpen(true);
                            }}><EditIcon fontSize="small" /></Button>
                            <Button size="small" color="error" onClick={() => setDeleteSlotId(ts.id)}><DeleteIcon fontSize="small" /></Button>
                          </Stack>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                  {timeSlots.length === 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="info">No time slots configured.</Alert>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Branch Form Dialog */}
      <Dialog open={branchFormOpen} onClose={() => setBranchFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editBranch ? 'Edit Branch' : 'Add Branch'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Branch Name" size="small" fullWidth value={branchName} onChange={(e) => setBranchName(e.target.value)} />
            <TextField label="Branch Code" size="small" fullWidth value={branchCode} onChange={(e) => setBranchCode(e.target.value)} disabled={!!editBranch} />
            <TextField label="Address" size="small" fullWidth value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} />
            <TextField label="Contact Number" size="small" fullWidth value={branchContact} onChange={(e) => setBranchContact(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBranchFormOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={createBranchMutation.isPending || updateBranchMutation.isPending}
            onClick={() => {
              const data = { branchName, branchCode, address: branchAddress, contactNumber: branchContact };
              if (editBranch) updateBranchMutation.mutate({ id: editBranch.id, data });
              else createBranchMutation.mutate(data);
            }}>
            {editBranch ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Time Slot Form Dialog */}
      <Dialog open={slotFormOpen} onClose={() => setSlotFormOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editSlot ? 'Edit Time Slot' : 'Add Time Slot'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Slot Name (e.g. 9 AM - 10 AM)" size="small" fullWidth value={slotName} onChange={(e) => setSlotName(e.target.value)} />
            <TextField label="Max Orders Capacity" type="number" size="small" fullWidth value={slotCapacity} onChange={(e) => setSlotCapacity(Number(e.target.value))} />
            {editSlot && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input type="checkbox" id="slot-active-check" checked={slotActive} onChange={(e) => setSlotActive(e.target.checked)} />
                <label htmlFor="slot-active-check" style={{ marginLeft: '8px', cursor: 'pointer', userSelect: 'none' }}>Active / Available for booking</label>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlotFormOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={createSlotMutation.isPending || updateSlotMutation.isPending}
            onClick={() => {
              const data = { slotName, maxCapacity: slotCapacity, isActive: slotActive };
              if (editSlot) updateSlotMutation.mutate({ id: editSlot.id, data });
              else createSlotMutation.mutate(data);
            }}>
            {editSlot ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={deleteBranchId !== null} title="Delete Branch"
        message="Delete this branch? Employees assigned to it will be unlinked." confirmLabel="Delete" severity="error"
        onConfirm={() => deleteBranchId !== null && deleteBranchMutation.mutate(deleteBranchId)}
        onCancel={() => setDeleteBranchId(null)} loading={deleteBranchMutation.isPending}
      />

      <ConfirmDialog open={deleteSlotId !== null} title="Delete Time Slot"
        message="Are you sure you want to delete this time slot? This cannot be undone." confirmLabel="Delete" severity="error"
        onConfirm={() => deleteSlotId !== null && deleteSlotMutation.mutate(deleteSlotId)}
        onCancel={() => setDeleteSlotId(null)} loading={deleteSlotMutation.isPending}
      />

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} />
    </Box>
  );
};

export default SettingsPage;
