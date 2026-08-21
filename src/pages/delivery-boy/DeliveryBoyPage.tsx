import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Avatar, IconButton,
  Button, CircularProgress, Snackbar, Alert as MuiAlert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Badge, Divider, Collapse, Select, MenuItem, FormControl, InputLabel, TextField,
  Autocomplete, InputAdornment,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { alpha } from '@mui/material/styles';
import { getLaundryShops, createLaundryShop } from '../../api/laundryShops';

// Icons
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import DirectionsIcon from '@mui/icons-material/Directions';
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LogoutIcon from '@mui/icons-material/Logout';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import HomeIcon from '@mui/icons-material/Home';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import {
  getMyDeliveries,
  getMyPickupAssignments,
  updateMyDeliveryStatus,
  updateMyPickupStatus,
  requestDeliveryOtp,
  type DeliveryAssignment,
  type PickupAssignment,
} from '../../api/deliveryBoy';
import { logout } from '../../app/authSlice';
import { useAuth } from '../../hooks/useAuth';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatPickupDate(dateStr: string, timeStr?: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    const dateLabel = isToday
      ? 'Today'
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return timeStr ? `${dateLabel}, ${timeStr}` : dateLabel;
  } catch {
    return dateStr;
  }
}

function buildAddress(customer: {
  houseDetails?: string;
  landmark?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}): string {
  return [customer.houseDetails, customer.landmark, customer.address, customer.city, customer.state, customer.pincode]
    .filter(Boolean)
    .join(', ');
}

function openMaps(address: string) {
  if (!address || !address.trim()) {
    alert('Address not available for navigation.');
    return;
  }
  const encoded = encodeURIComponent(address.trim());
  // Use Google Maps directions URL — works on Android (opens app), desktop (opens web)
  // The 'daddr' param is the destination address for navigation
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`,
    '_blank',
    'noopener,noreferrer',
  );
}

function openPhone(number: string) {
  window.open(`tel:${number}`);
}

// ── Status configs ──────────────────────────────────────────────────────────

const pickupStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  Pending:   { color: '#92400E', bg: '#FEF3C7', label: 'Pending' },
  Assigned:  { color: '#1D4ED8', bg: '#DBEAFE', label: 'Assigned' },
  Completed: { color: '#065F46', bg: '#D1FAE5', label: 'Completed' },
  Cancelled: { color: '#991B1B', bg: '#FEE2E2', label: 'Cancelled' },
};

const deliveryStatusConfig: Record<string, { color: string; bg: string; label: string }> = {
  Pending:        { color: '#92400E', bg: '#FEF3C7',  label: 'Pending' },
  OutForDelivery: { color: '#1D4ED8', bg: '#DBEAFE',  label: 'Out For Delivery' },
  Delivered:      { color: '#065F46', bg: '#D1FAE5',  label: 'Delivered ✓' },
  Failed:         { color: '#991B1B', bg: '#FEE2E2',  label: 'Failed' },
};

// ── Pickup Card ──────────────────────────────────────────────────────────────

const PickupCard: React.FC<{
  pickup: PickupAssignment;
  laundryShops: any[];
  onAction: (id: number, status: string, laundryShopId?: number) => void;
  isLoading: boolean;
}> = ({ pickup, laundryShops, onAction, isLoading }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ status: string; label: string } | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<number | string>('');
  const [showAddShop, setShowAddShop] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPincode, setNewShopPincode] = useState('');
  const [creatingShop, setCreatingShop] = useState(false);
  const qc = useQueryClient();

  const handleCreateShop = async () => {
    if (!newShopName.trim() || !newShopPincode.trim()) return;
    setCreatingShop(true);
    try {
      const randomCode = 'SHOP-' + Math.floor(1000 + Math.random() * 9000);
      const newShop = await createLaundryShop({
        shopName: newShopName,
        shopCode: randomCode,
        pincode: newShopPincode,
        isActive: true,
      });
      qc.invalidateQueries({ queryKey: ['laundry-shops'] });
      setSelectedShopId(newShop.id);
      setShowAddShop(false);
      setNewShopName('');
      setNewShopPincode('');
    } catch (err) {
      console.error('Failed to create shop', err);
    } finally {
      setCreatingShop(false);
    }
  };

  const statusCfg = pickupStatusConfig[pickup.status] ?? pickupStatusConfig.Pending;
  const isDone = pickup.status === 'Completed' || pickup.status === 'Cancelled';
  const address = buildAddress(pickup.customer) || pickup.pickupAddress;

  return (
    <>
      <Card
        elevation={0}
        sx={{
          mb: 2,
          borderRadius: 3,
          border: '1.5px solid',
          borderColor: isDone ? '#E5E7EB' : '#C7D2FE',
          background: isDone ? '#FAFAFA' : '#fff',
          opacity: isDone ? 0.75 : 1,
          transition: 'all 0.2s',
          overflow: 'visible',
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {/* Card Header */}
          <Box
            sx={{
              px: 2, py: 1.5,
              background: isDone
                ? 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)'
                : 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
              borderRadius: '12px 12px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: 2,
                  background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <LocalShippingIcon sx={{ color: '#fff', fontSize: 18 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1E1B4B' }}>
                  Pickup #{pickup.id}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTimeIcon sx={{ fontSize: 11, color: '#6B7280' }} />
                  <Typography sx={{ fontSize: 11, color: '#6B7280' }}>
                    {formatPickupDate(pickup.pickupDate, pickup.pickupTime)}
                  </Typography>
                </Box>
              </Box>
            </Box>
            <Chip
              label={statusCfg.label}
              size="small"
              sx={{
                fontWeight: 700, fontSize: 10, height: 22,
                bgcolor: statusCfg.bg, color: statusCfg.color,
                border: 'none',
              }}
            />
          </Box>

          {/* Customer Info */}
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#111827', mb: 0.25 }}>
                  {pickup.customer.firstName} {pickup.customer.lastName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 13, color: '#6366F1' }} />
                  <Typography sx={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
                    {address}
                    {pickup.customer.pincode && ` - ${pickup.customer.pincode}`}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Payment Details */}
            {pickup.order && (
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1,
                  px: 1.5, py: 0.85,
                  bgcolor: pickup.order.paymentStatus === 'Paid' ? '#ECFDF5' : '#FFFBEB',
                  borderRadius: 2,
                  border: pickup.order.paymentStatus === 'Paid' ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                }}
              >
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: pickup.order.paymentStatus === 'Paid' ? '#10B981' : '#F59E0B',
                  }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: pickup.order.paymentStatus === 'Paid' ? '#047857' : '#B45309' }}>
                  {pickup.order.paymentStatus === 'Paid'
                    ? 'Payment: Paid'
                    : `Payment: ₹${pickup.order.netAmount ? pickup.order.netAmount.toFixed(0) : '0'}`}
                </Typography>
              </Box>
            )}

            {/* Drop Off Laundry Shop Info */}
            {pickup.order?.laundryShop && (
              <Box
                sx={{
                  mt: 1.5, mb: 1.5, px: 1.5, py: 1.25,
                  bgcolor: '#ECFDF5', borderRadius: 2,
                  border: '1.5px dashed #10B981',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#047857', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  🏪 Drop Clothes to Laundry
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>
                  {pickup.order.laundryShop.shopName}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#047857', mt: 0.25 }}>
                  📍 {[pickup.order.laundryShop.address, pickup.order.laundryShop.city, pickup.order.laundryShop.pincode].filter(Boolean).join(', ')}
                </Typography>
                {pickup.order.laundryShop.contactNumber && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<PhoneIcon sx={{ fontSize: '12px !important' }} />}
                    onClick={() => pickup.order?.laundryShop?.contactNumber && openPhone(pickup.order.laundryShop.contactNumber)}
                    sx={{
                      p: 0, mt: 0.75, fontSize: 11, fontWeight: 700, color: '#059669',
                      textTransform: 'none', minWidth: 0,
                      '&:hover': { color: '#047857', bgcolor: 'transparent' }
                    }}
                  >
                    Call Shop: {pickup.order.laundryShop.contactNumber}
                  </Button>
                )}
              </Box>
            )}

            {pickup.order && !pickup.order.laundryShop && (
              <Box
                sx={{
                  mt: 1.5, mb: 1.5, px: 1.5, py: 1.25,
                  bgcolor: '#FFFBEB', borderRadius: 2,
                  border: '1.5px dashed #F59E0B',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#B45309', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  🏪 Drop Clothes to Laundry
                </Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>
                  ⚠️ No Laundry Shop Assigned yet
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#B45309', mt: 0.25 }}>
                  You will select the shop when marking the clothes as Picked Up.
                </Typography>
              </Box>
            )}

            {/* Action Buttons Row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PhoneIcon sx={{ fontSize: '14px !important' }} />}
                onClick={() => openPhone(pickup.customer.mobileNumber)}
                sx={{
                  flex: 1, borderRadius: 2, fontSize: 11, fontWeight: 700,
                  borderColor: '#10B981', color: '#059669',
                  '&:hover': { bgcolor: '#ECFDF5', borderColor: '#059669' },
                  textTransform: 'none',
                }}
              >
                {pickup.customer.mobileNumber}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DirectionsIcon sx={{ fontSize: '14px !important' }} />}
                onClick={() => openMaps(address + (pickup.customer.pincode ? ` ${pickup.customer.pincode}` : ''))}
                sx={{
                  flex: 1, borderRadius: 2, fontSize: 11, fontWeight: 700,
                  borderColor: '#3B82F6', color: '#2563EB',
                  '&:hover': { bgcolor: '#EFF6FF', borderColor: '#2563EB' },
                  textTransform: 'none',
                }}
              >
                Open Maps
              </Button>
            </Box>

            {/* Expand toggle */}
            {!isDone && (
              <Box
                onClick={() => setExpanded((e) => !e)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 0.5, cursor: 'pointer', py: 0.5, color: '#6B7280',
                  '&:hover': { color: '#374151' },
                }}
              >
                <Typography sx={{ fontSize: 11 }}>
                  {expanded ? 'Hide actions' : 'Update status'}
                </Typography>
                {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
              </Box>
            )}
          </Box>

          {/* Expandable Action Panel */}
          {!isDone && (
            <Collapse in={expanded}>
              <Divider />
              <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1 }}>
                <Button
                  fullWidth variant="contained" size="medium"
                  startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon />}
                  disabled={isLoading || pickup.status === 'Completed'}
                  onClick={() => setConfirmDialog({ status: 'Completed', label: 'Mark as Picked Up' })}
                  sx={{
                    borderRadius: 2, fontWeight: 700, textTransform: 'none', fontSize: 13,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
                  }}
                >
                  Picked Up ✓
                </Button>
                <Button
                  fullWidth variant="outlined" size="medium"
                  startIcon={<CancelOutlinedIcon />}
                  disabled={isLoading}
                  onClick={() => setConfirmDialog({ status: 'Cancelled', label: 'Cancel this pickup' })}
                  sx={{
                    borderRadius: 2, fontWeight: 700, textTransform: 'none', fontSize: 13,
                    borderColor: '#EF4444', color: '#DC2626',
                    '&:hover': { bgcolor: '#FEF2F2', borderColor: '#DC2626' },
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Collapse>
          )}

          {isDone && (
            <Box sx={{ px: 2, pb: 1.5, display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: pickup.status === 'Completed' ? '#059669' : '#DC2626' }}>
                {pickup.status === 'Completed'
                  ? <CheckIcon sx={{ fontSize: 14 }} />
                  : <CloseIcon sx={{ fontSize: 14 }} />}
                <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                  {pickup.status === 'Completed' ? 'Clothes Collected' : 'Pickup Cancelled'}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onClose={() => setConfirmDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>
          {confirmDialog?.label}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmDialog?.status === 'Completed'
              ? `Confirm that you have collected the clothes from ${pickup.customer.firstName} ${pickup.customer.lastName}?`
              : `Are you sure you want to cancel pickup #${pickup.id}?`}
          </Typography>

          {confirmDialog?.status === 'Completed' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#374151' }}>
                Select Laundry Shop to drop clothes:
              </Typography>
              <Autocomplete
                size="small"
                options={laundryShops}
                getOptionLabel={(shop) => `${shop.shopName} (${shop.pincode})`}
                value={laundryShops.find(s => s.id === Number(selectedShopId)) || null}
                onChange={(_, newValue) => {
                  setSelectedShopId(newValue ? newValue.id : '');
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Search & Select Laundry Shop" />
                )}
                sx={{ mb: 1.5 }}
              />

              <Box sx={{ textAlign: 'right' }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowAddShop(!showAddShop)}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}
                >
                  {showAddShop ? 'Cancel Add New Shop' : '+ Add New Laundry Shop'}
                </Button>
              </Box>

              {showAddShop && (
                <Card variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: '#fff', borderRadius: 2, border: '1.5px solid #E0E7FF' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 1, color: '#4B5563' }}>
                    NEW LAUNDRY SHOP DETAILS:
                  </Typography>
                  <TextField
                    fullWidth size="small" label="Shop Name"
                    value={newShopName} onChange={(e) => setNewShopName(e.target.value)}
                    sx={{
                      mb: 1,
                      '& .MuiInputBase-input': { color: '#111827' },
                      '& .MuiInputLabel-root': { color: '#6B7280' },
                    }}
                  />
                  <TextField
                    fullWidth size="small" label="Pincode"
                    value={newShopPincode} onChange={(e) => setNewShopPincode(e.target.value)}
                    sx={{
                      mb: 1.5,
                      '& .MuiInputBase-input': { color: '#111827' },
                      '& .MuiInputLabel-root': { color: '#6B7280' },
                    }}
                  />
                  <Button
                    fullWidth size="small" variant="contained"
                    disabled={creatingShop || !newShopName.trim() || !newShopPincode.trim()}
                    onClick={handleCreateShop}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {creatingShop ? 'Creating...' : 'Create & Select Shop'}
                  </Button>
                </Card>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setConfirmDialog(null)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>No, Go Back</Button>
          <Button
            variant="contained"
            disabled={isLoading || (confirmDialog?.status === 'Completed' && !selectedShopId)}
            onClick={() => { if (confirmDialog) { onAction(pickup.id, confirmDialog.status, selectedShopId ? Number(selectedShopId) : undefined); setConfirmDialog(null); } }}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 700,
              bgcolor: confirmDialog?.status === 'Completed' ? '#10B981' : '#EF4444',
              '&:hover': { bgcolor: confirmDialog?.status === 'Completed' ? '#059669' : '#DC2626' },
            }}
          >
            {isLoading ? <CircularProgress size={16} color="inherit" /> : 'Yes, Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ── Delivery Card ────────────────────────────────────────────────────────────

const DeliveryCard: React.FC<{
  delivery: DeliveryAssignment;
  onAction: (id: number, status: string, remarks?: string, otp?: string) => void;
  isLoading: boolean;
}> = ({ delivery, onAction, isLoading }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ status: string; label: string } | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  const handleRequestOtp = async () => {
    setRequestingOtp(true);
    setOtpError('');
    try {
      const res = await requestDeliveryOtp(delivery.id);
      setOtpSent(true);
      // For development/mock, let's display the OTP in a toast or notification!
      if (res.otp) {
        alert(`[DEV MODE] Delivery Completion OTP sent to customer is: ${res.otp}`);
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setRequestingOtp(false);
    }
  };

  const statusCfg = deliveryStatusConfig[delivery.deliveryStatus] ?? deliveryStatusConfig.Pending;
  const isDone = delivery.deliveryStatus === 'Delivered' || delivery.deliveryStatus === 'Failed';
  const customer = delivery.order?.customer;
  const address = customer ? buildAddress(customer) : '';

  return (
    <>
      <Card
        elevation={0}
        sx={{
          mb: 2, borderRadius: 3,
          border: '1.5px solid',
          borderColor: isDone ? '#E5E7EB' : '#FDE68A',
          background: isDone ? '#FAFAFA' : '#fff',
          opacity: isDone ? 0.75 : 1,
          transition: 'all 0.2s',
        }}
      >
        <CardContent sx={{ p: 0 }}>
          {/* Card Header */}
          <Box
            sx={{
              px: 2, py: 1.5,
              background: isDone
                ? 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)'
                : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
              borderRadius: '12px 12px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: 2,
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <LocalLaundryServiceIcon sx={{ color: '#fff', fontSize: 18 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#78350F' }}>
                  {delivery.order?.orderNumber ?? `Delivery #${delivery.id}`}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#92400E' }}>
                  Delivery #{delivery.id}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={statusCfg.label}
              size="small"
              sx={{
                fontWeight: 700, fontSize: 10, height: 22,
                bgcolor: statusCfg.bg, color: statusCfg.color,
              }}
            />
          </Box>

          {/* Customer Info */}
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            {customer && (
              <>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#111827', mb: 0.25 }}>
                  {customer.firstName} {customer.lastName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1 }}>
                  <LocationOnIcon sx={{ fontSize: 13, color: '#F59E0B', mt: 0.1 }} />
                  <Typography sx={{ fontSize: 12, color: '#374151', lineHeight: 1.4, flex: 1 }}>
                    {address}
                    {customer.pincode && ` - ${customer.pincode}`}
                  </Typography>
                </Box>
              </>
            )}

            {/* Order items summary */}
            {delivery.order?.orderItems && delivery.order.orderItems.length > 0 && (
              <Box
                sx={{
                  mb: 1, px: 1.5, py: 0.75,
                  bgcolor: '#F9FAFB', borderRadius: 2,
                  border: '1px solid #E5E7EB',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#6B7280', mb: 0.25, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Items to Deliver
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#374151' }}>
                  {delivery.order.orderItems.map((i) => `${i.clothType} ×${i.quantity}`).join('  •  ')}
                </Typography>
              </Box>
            )}

            {/* Payment Details */}
            {delivery.order && (
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1,
                  px: 1.5, py: 0.85,
                  bgcolor: delivery.order.paymentStatus === 'Paid' ? '#ECFDF5' : '#FFFBEB',
                  borderRadius: 2,
                  border: delivery.order.paymentStatus === 'Paid' ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                }}
              >
                <Box
                  sx={{
                    width: 8, height: 8, borderRadius: '50%',
                    bgcolor: delivery.order.paymentStatus === 'Paid' ? '#10B981' : '#F59E0B',
                  }}
                />
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: delivery.order.paymentStatus === 'Paid' ? '#047857' : '#B45309' }}>
                  {delivery.order.paymentStatus === 'Paid'
                    ? 'Payment: Paid'
                    : `Payment: ₹${delivery.order.netAmount ? delivery.order.netAmount.toFixed(0) : '0'}`}
                </Typography>
              </Box>
            )}

            {/* Collection Laundry Shop Info */}
            {delivery.order?.laundryShop && (
              <Box
                sx={{
                  mb: 1.5, px: 1.5, py: 1.25,
                  bgcolor: '#EEF2FF', borderRadius: 2,
                  border: '1.5px dashed #6366F1',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#4338CA', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  🏪 Collect Clothes From
                </Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#312E81' }}>
                  {delivery.order.laundryShop.shopName}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#4338CA', mt: 0.25 }}>
                  📍 {[delivery.order.laundryShop.address, delivery.order.laundryShop.city, delivery.order.laundryShop.pincode].filter(Boolean).join(', ')}
                </Typography>
                {delivery.order.laundryShop.contactNumber && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<PhoneIcon sx={{ fontSize: '12px !important' }} />}
                    onClick={() => delivery.order?.laundryShop?.contactNumber && openPhone(delivery.order.laundryShop.contactNumber)}
                    sx={{
                      p: 0, mt: 0.75, fontSize: 11, fontWeight: 700, color: '#4F46E5',
                      textTransform: 'none', minWidth: 0,
                      '&:hover': { color: '#4338CA', bgcolor: 'transparent' }
                    }}
                  >
                    Call Shop: {delivery.order.laundryShop.contactNumber}
                  </Button>
                )}
              </Box>
            )}

            {/* Action Buttons Row */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
              {customer && (
                <Button
                  variant="outlined" size="small"
                  startIcon={<PhoneIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => openPhone(customer.mobileNumber)}
                  sx={{
                    flex: 1, borderRadius: 2, fontSize: 11, fontWeight: 700,
                    borderColor: '#10B981', color: '#059669',
                    '&:hover': { bgcolor: '#ECFDF5', borderColor: '#059669' },
                    textTransform: 'none',
                  }}
                >
                  {customer.mobileNumber}
                </Button>
              )}
              {address && (
                <Button
                  variant="outlined" size="small"
                  startIcon={<DirectionsIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => openMaps(address + (customer?.pincode ? ` ${customer.pincode}` : ''))}
                  sx={{
                    flex: 1, borderRadius: 2, fontSize: 11, fontWeight: 700,
                    borderColor: '#3B82F6', color: '#2563EB',
                    '&:hover': { bgcolor: '#EFF6FF', borderColor: '#2563EB' },
                    textTransform: 'none',
                  }}
                >
                  Open Maps
                </Button>
              )}
            </Box>

            {/* Expand toggle */}
            {!isDone && (
              <Box
                onClick={() => setExpanded((e) => !e)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 0.5, cursor: 'pointer', py: 0.5, color: '#6B7280',
                  '&:hover': { color: '#374151' },
                }}
              >
                <Typography sx={{ fontSize: 11 }}>
                  {expanded ? 'Hide actions' : 'Update status'}
                </Typography>
                {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
              </Box>
            )}
          </Box>

          {/* Expandable Action Panel */}
          {!isDone && (
            <Collapse in={expanded}>
              <Divider />
              <Box sx={{ px: 2, py: 1.5, display: 'flex', gap: 1 }}>
                <Button
                  fullWidth variant="contained" size="medium"
                  startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : <AssignmentTurnedInIcon />}
                  disabled={isLoading}
                  onClick={() => setConfirmDialog({ status: 'Delivered', label: 'Mark as Delivered' })}
                  sx={{
                    borderRadius: 2, fontWeight: 700, textTransform: 'none', fontSize: 13,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #059669, #047857)' },
                  }}
                >
                  Delivered ✓
                </Button>
                <Button
                  fullWidth variant="outlined" size="medium"
                  startIcon={<ErrorOutlineIcon />}
                  disabled={isLoading}
                  onClick={() => setConfirmDialog({ status: 'Failed', label: 'Mark as Failed' })}
                  sx={{
                    borderRadius: 2, fontWeight: 700, textTransform: 'none', fontSize: 13,
                    borderColor: '#EF4444', color: '#DC2626',
                    '&:hover': { bgcolor: '#FEF2F2', borderColor: '#DC2626' },
                  }}
                >
                  Failed
                </Button>
              </Box>
            </Collapse>
          )}

          {isDone && (
            <Box sx={{ px: 2, pb: 1.5, display: 'flex', justifyContent: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: delivery.deliveryStatus === 'Delivered' ? '#059669' : '#DC2626' }}>
                {delivery.deliveryStatus === 'Delivered'
                  ? <CheckIcon sx={{ fontSize: 14 }} />
                  : <CloseIcon sx={{ fontSize: 14 }} />}
                <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                  {delivery.deliveryStatus === 'Delivered' ? 'Successfully Delivered' : 'Delivery Failed'}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDialog} onClose={() => { setConfirmDialog(null); setOtpSent(false); setEnteredOtp(''); setOtpError(''); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>
          {confirmDialog?.label}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {confirmDialog?.status === 'Delivered'
              ? `Confirm that you have delivered the order ${delivery.order?.orderNumber} to ${customer?.firstName} ${customer?.lastName}?`
              : `Mark this delivery as failed? The order will return to "Laundry" status.`}
          </Typography>

          {confirmDialog?.status === 'Delivered' && (
            <Box sx={{ mt: 1 }}>
              {delivery.order?.paymentStatus !== 'Paid' ? (
                <Box
                  sx={{
                    p: 1.5, mb: 2, bgcolor: '#FFFBEB', borderRadius: 2,
                    border: '1.5px solid #F59E0B',
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#B45309', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    💵 COD Cash Collection Required
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                    Please collect <strong>₹{delivery.order?.netAmount ? delivery.order.netAmount.toFixed(0) : '0'}</strong> from {customer?.firstName} {customer?.lastName} in Cash / UPI before completing delivery.
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 1.5, mb: 2, bgcolor: '#ECFDF5', borderRadius: 2,
                    border: '1.5px solid #10B981',
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#047857', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    💳 Payment Received (Paid)
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#065F46', mt: 0.25 }}>
                    No cash collection required. Verify OTP to complete delivery.
                  </Typography>
                </Box>
              )}

              {!otpSent ? (
                <Button
                  fullWidth variant="contained"
                  disabled={requestingOtp}
                  onClick={handleRequestOtp}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  {requestingOtp ? <CircularProgress size={16} color="inherit" /> : '🔑 Send Verification OTP to Customer'}
                </Button>
              ) : (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#374151' }}>
                    Enter 6-digit Delivery OTP:
                  </Typography>
                  <TextField
                    fullWidth size="small" placeholder="Enter OTP"
                    value={enteredOtp} onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    slotProps={{ htmlInput: { maxLength: 6, style: { textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold' } } }}
                    sx={{ mb: 1.5 }}
                  />
                  <Box sx={{ textAlign: 'right' }}>
                    <Button
                      size="small" variant="text"
                      disabled={requestingOtp}
                      onClick={handleRequestOtp}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}
                    >
                      Resend OTP
                    </Button>
                  </Box>
                </Box>
              )}

              {otpError && (
                <MuiAlert severity="error" sx={{ mt: 1 }}>{otpError}</MuiAlert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => { setConfirmDialog(null); setOtpSent(false); setEnteredOtp(''); setOtpError(''); }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>No, Go Back</Button>
          <Button
            variant="contained"
            disabled={isLoading || (confirmDialog?.status === 'Delivered' && (!otpSent || enteredOtp.length !== 6))}
            onClick={() => { if (confirmDialog) { onAction(delivery.id, confirmDialog.status, undefined, enteredOtp || undefined); setConfirmDialog(null); setOtpSent(false); setEnteredOtp(''); } }}
            sx={{
              borderRadius: 2, textTransform: 'none', fontWeight: 700,
              bgcolor: confirmDialog?.status === 'Delivered' ? '#10B981' : '#EF4444',
              '&:hover': { bgcolor: confirmDialog?.status === 'Delivered' ? '#059669' : '#DC2626' },
            }}
          >
            {isLoading ? <CircularProgress size={16} color="inherit" /> : 'Yes, Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
  <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
    <Box sx={{
      width: 72, height: 72, mx: 'auto', mb: 2, borderRadius: 4,
      bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {icon}
    </Box>
    <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#374151', mb: 0.5 }}>{title}</Typography>
    <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>{subtitle}</Typography>
  </Box>
);

// ── Tab Bar ──────────────────────────────────────────────────────────────────

type TabId = 'pickups' | 'deliveries' | 'profile';

// ── Main Page ────────────────────────────────────────────────────────────────

const DeliveryBoyPage: React.FC = () => {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('pickups');
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Auto-Refresh: 30-second polling ──────────────────────────────────────
  // Queries auto-poll every 30s when tab is visible, immediately on tab focus
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const prevPickupCount = useRef<number>(-1);
  const prevDeliveryCount = useRef<number>(-1);

  const { data: laundryShops = [] } = useQuery({ queryKey: ['laundry-shops'], queryFn: getLaundryShops });

  const {
    data: pickups = [],
    isLoading: pickupsLoading,
    isFetching: pickupsFetching,
    refetch: refetchPickups,
  } = useQuery({
    queryKey: ['my-pickups'],
    queryFn: getMyPickupAssignments,
    refetchInterval: 30_000,              // Auto-poll every 30 seconds
    refetchIntervalInBackground: false,   // Pause polling when tab is hidden (saves mobile data)
    refetchOnWindowFocus: true,           // Immediately refresh when delivery boy switches back to tab
    staleTime: 20_000,                    // Consider data fresh for 20s to avoid over-fetching
  });

  const {
    data: rawDeliveries = [],
    isLoading: deliveriesLoading,
    isFetching: deliveriesFetching,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: getMyDeliveries,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 20_000,
  });

  // Update last-updated timestamp whenever a fetch completes
  useEffect(() => {
    if (!pickupsFetching && !deliveriesFetching) {
      setLastUpdated(new Date());
      setSecondsAgo(0);
    }
  }, [pickupsFetching, deliveriesFetching]);

  // Tick the "last updated X seconds ago" counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Detect new pickup assignments and show toast notification
  useEffect(() => {
    if (prevPickupCount.current === -1) {
      prevPickupCount.current = pickups.length;
      return;
    }
    const newCount = pickups.filter((p: any) => p.status === 'Assigned' || p.status === 'Pending').length;
    if (newCount > prevPickupCount.current) {
      setToast({ msg: `🚴 New pickup assigned! You have ${newCount} pickup${newCount > 1 ? 's' : ''} today.`, severity: 'success' });
    }
    prevPickupCount.current = newCount;
  }, [pickups]);

  // Detect new delivery assignments and show toast notification
  useEffect(() => {
    if (prevDeliveryCount.current === -1) {
      prevDeliveryCount.current = rawDeliveries.length;
      return;
    }
    const newCount = (rawDeliveries as any[]).filter(d => d.deliveryStatus === 'Pending').length;
    if (newCount > prevDeliveryCount.current) {
      setToast({ msg: `📦 New delivery assigned! Check your deliveries.`, severity: 'success' });
    }
    prevDeliveryCount.current = newCount;
  }, [rawDeliveries]);

  const deliveries = useMemo(() => {
    const filtered = (rawDeliveries as any[]).filter(d =>
      d.order && ['Laundry', 'Out For Delivery', 'Delivered'].includes(d.order.orderStatus)
    );
    const latestMap = new Map<number, any>();
    for (const d of filtered) {
      const existing = latestMap.get(d.orderId);
      if (!existing || d.id > existing.id) {
        latestMap.set(d.orderId, d);
      }
    }
    return Array.from(latestMap.values());
  }, [rawDeliveries]);

  // Filtered lists
  const filteredPickups = useMemo(() => {
    if (!searchQuery.trim()) return pickups;
    const query = searchQuery.toLowerCase().trim();
    return pickups.filter(p => {
      const cust = p.customer;
      const firstName = cust?.firstName?.toLowerCase() || '';
      const lastName = cust?.lastName?.toLowerCase() || '';
      const mobile = cust?.mobileNumber || '';
      const addr = p.pickupAddress?.toLowerCase() || '';
      const pickupIdStr = String(p.id);

      return firstName.includes(query) ||
             lastName.includes(query) ||
             `${firstName} ${lastName}`.includes(query) ||
             mobile.includes(query) ||
             addr.includes(query) ||
             pickupIdStr.includes(query);
    });
  }, [pickups, searchQuery]);

  const filteredDeliveries = useMemo(() => {
    if (!searchQuery.trim()) return deliveries;
    const query = searchQuery.toLowerCase().trim();
    return deliveries.filter(d => {
      const order = d.order;
      const cust = order?.customer;
      const firstName = cust?.firstName?.toLowerCase() || '';
      const lastName = cust?.lastName?.toLowerCase() || '';
      const mobile = cust?.mobileNumber || '';
      const orderNum = order?.orderNumber?.toLowerCase() || '';
      const deliveryIdStr = String(d.id);

      return firstName.includes(query) ||
             lastName.includes(query) ||
             `${firstName} ${lastName}`.includes(query) ||
             mobile.includes(query) ||
             orderNum.includes(query) ||
             deliveryIdStr.includes(query);
    });
  }, [deliveries, searchQuery]);

  // Mutations
  const pickupMutation = useMutation({
    mutationFn: ({ id, status, laundryShopId }: { id: number; status: string; laundryShopId?: number }) =>
      updateMyPickupStatus(id, status, laundryShopId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-pickups'] });
      setToast({ msg: 'Pickup status updated!', severity: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to update. Try again.', severity: 'error' }),
  });

  const deliveryMutation = useMutation({
    mutationFn: ({ id, status, remarks, otp }: { id: number; status: string; remarks?: string; otp?: string }) =>
      updateMyDeliveryStatus(id, status, remarks, otp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      setToast({ msg: 'Delivery status updated!', severity: 'success' });
    },
    onError: () => setToast({ msg: 'Failed to update. Try again.', severity: 'error' }),
  });

  // Stats
  const pendingPickups = useMemo(
    () => pickups.filter((p) => p.status === 'Pending' || p.status === 'Assigned').length,
    [pickups],
  );
  const pendingDeliveries = useMemo(
    () => deliveries.filter((d) => d.deliveryStatus === 'Pending' || d.deliveryStatus === 'OutForDelivery').length,
    [deliveries],
  );

  const handleRefresh = useCallback(() => {
    refetchPickups();
    refetchDeliveries();
    setToast({ msg: 'Refreshing...', severity: 'success' });
  }, [refetchPickups, refetchDeliveries]);

  const handleLogout = () => {
    dispatch(logout());
    window.location.href = '/admin/login';
  };

  // Show spinner on initial load OR during any background fetch
  const isLoading = pickupsLoading || deliveriesLoading;
  const isFetching = pickupsFetching || deliveriesFetching;

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#F3F4F6',
        maxWidth: 480,
        mx: 'auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── App Header ──────────────────────────────────────────────── */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)',
          px: 2.5, pt: 3, pb: 2.5,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
        <Box sx={{ position: 'absolute', top: 10, right: 30, width: 60, height: 60, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />

        {/* Top Row: Logo + Refresh */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32, height: 32, borderRadius: 1.5,
                bgcolor: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <WaterDropIcon sx={{ color: '#fff', fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
                Grivana
              </Typography>
              {/* Live indicator: shows last updated time */}
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, lineHeight: 1 }}>
                {isFetching
                  ? 'Updating...'
                  : lastUpdated
                  ? secondsAgo < 5
                    ? '✅ Just updated'
                    : `Updated ${secondsAgo}s ago`
                  : 'Loading...'}
              </Typography>
            </Box>
          </Box>
          {/* Refresh button — spins during auto-fetch */}
          <IconButton
            onClick={handleRefresh}
            size="small"
            title="Refresh now"
            sx={{
              color: 'rgba(255,255,255,0.8)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            }}
          >
            {(isLoading || isFetching)
              ? <CircularProgress size={18} sx={{ color: '#fff' }} />
              : <RefreshIcon
                  fontSize="small"
                  sx={{
                    transition: 'transform 0.3s',
                    '&:hover': { transform: 'rotate(180deg)' },
                  }}
                />
            }
          </IconButton>
        </Box>

        {/* Greeting + Name */}
        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, mb: 0.25 }}>
          {getGreeting()},
        </Typography>
        <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 900, mb: 2, letterSpacing: -0.3 }}>
          {user?.fullName?.split(' ')[0] ?? 'Delivery Boy'} 👋
        </Typography>

        {/* Stats Strip */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Box
            sx={{
              flex: 1, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2.5, p: 1.5,
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, mb: 0.25 }}>Pickups Today</Typography>
            <Typography sx={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>
              {pendingPickups}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2.5, p: 1.5,
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, mb: 0.25 }}>Deliveries</Typography>
            <Typography sx={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>
              {pendingDeliveries}
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1, bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2.5, p: 1.5,
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, mb: 0.25 }}>Done Today</Typography>
            <Typography sx={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1 }}>
              {
                pickups.filter((p) => p.status === 'Completed').length +
                deliveries.filter((d) => d.deliveryStatus === 'Delivered').length
              }
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Content Area ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 2, pb: '90px' }}>

        {/* Search Bar */}
        {activeTab !== 'profile' && (
          <TextField
            fullWidth
            size="small"
            placeholder="Search customer, phone, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              mb: 2,
              bgcolor: '#fff',
              borderRadius: 2,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '& fieldset': { borderColor: '#E5E7EB' },
                '&:hover fieldset': { borderColor: '#D1D5DB' },
                '&.Mui-focused fieldset': { borderColor: '#6366F1' },
              },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#9CA3AF', fontSize: 18 }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25 }}>
                      <ClearIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </InputAdornment>
                ) : null
              }
            }}
          />
        )}

        {/* Pickups Tab */}
        {activeTab === 'pickups' && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>
                Pickup Assignments
              </Typography>
              <Chip
                label={filteredPickups.length === pickups.length ? `${pickups.length} total` : `${filteredPickups.length} found`}
                size="small"
                sx={{ bgcolor: '#E0E7FF', color: '#4338CA', fontWeight: 700, fontSize: 10 }}
              />
            </Box>
            {pickupsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress sx={{ color: '#6366F1' }} />
              </Box>
            ) : filteredPickups.length === 0 ? (
              <EmptyState
                icon={<LocalShippingIcon sx={{ fontSize: 32, color: '#9CA3AF' }} />}
                title={searchQuery ? "No Matching Pickups" : "No Pickups Assigned"}
                subtitle={searchQuery ? "Try refining your search terms." : "You have no pickup tasks right now. Check back later or contact your manager."}
              />
            ) : (
              filteredPickups.map((pickup) => (
                <PickupCard
                  key={pickup.id}
                  pickup={pickup}
                  laundryShops={laundryShops}
                  onAction={(id, status, shopId) => pickupMutation.mutate({ id, status, laundryShopId: shopId })}
                  isLoading={pickupMutation.isPending}
                />
              ))
            )}
          </>
        )}

        {/* Deliveries Tab */}
        {activeTab === 'deliveries' && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>
                Delivery Assignments
              </Typography>
              <Chip
                label={filteredDeliveries.length === deliveries.length ? `${deliveries.length} total` : `${filteredDeliveries.length} found`}
                size="small"
                sx={{ bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 10 }}
              />
            </Box>
            {deliveriesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress sx={{ color: '#F59E0B' }} />
              </Box>
            ) : filteredDeliveries.length === 0 ? (
              <EmptyState
                icon={<LocalLaundryServiceIcon sx={{ fontSize: 32, color: '#9CA3AF' }} />}
                title={searchQuery ? "No Matching Deliveries" : "No Deliveries Assigned"}
                subtitle={searchQuery ? "Try refining your search terms." : "No delivery tasks yet. You'll see them here once assigned by admin."}
              />
            ) : (
              filteredDeliveries.map((delivery) => (
                <DeliveryCard
                  key={delivery.id}
                  delivery={delivery}
                  onAction={(id, status, remarks, otp) => deliveryMutation.mutate({ id, status, remarks, otp })}
                  isLoading={deliveryMutation.isPending}
                />
              ))
            )}
          </>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Box sx={{ py: 2 }}>
            {/* Avatar & Name */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Avatar
                sx={{
                  width: 80, height: 80, mx: 'auto', mb: 1.5,
                  background: 'linear-gradient(135deg, #4F46E5, #818CF8)',
                  fontSize: 32, fontWeight: 900,
                }}
              >
                {user?.fullName?.charAt(0) ?? 'D'}
              </Avatar>
              <Typography sx={{ fontWeight: 900, fontSize: 20, color: '#111827' }}>
                {user?.fullName}
              </Typography>
              <Chip
                label="🛵 Delivery Boy"
                size="small"
                sx={{ mt: 0.5, bgcolor: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: 11 }}
              />
            </Box>

            {/* Info Cards */}
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #E5E7EB', mb: 2 }}>
              <CardContent sx={{ p: 0 }}>
                {[
                  { label: 'Employee Code', value: user?.employeeCode },
                  { label: 'Email', value: user?.email },
                  { label: 'Role', value: user?.role },
                ].map((item, i, arr) => (
                  <Box key={item.label}>
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{item.label}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.value ?? '—'}</Typography>
                    </Box>
                    {i < arr.length - 1 && <Divider />}
                  </Box>
                ))}
              </CardContent>
            </Card>

            {/* Today's Summary */}
            <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid #E5E7EB', mb: 3 }}>
              <CardContent>
                <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#374151', mb: 1.5 }}>
                  Today's Summary
                </Typography>
                {[
                  { label: 'Pending Pickups', value: pendingPickups, color: '#6366F1' },
                  { label: 'Pending Deliveries', value: pendingDeliveries, color: '#F59E0B' },
                  { label: 'Completed Pickups', value: pickups.filter((p) => p.status === 'Completed').length, color: '#10B981' },
                  { label: 'Completed Deliveries', value: deliveries.filter((d) => d.deliveryStatus === 'Delivered').length, color: '#10B981' },
                ].map((item) => (
                  <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{item.label}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: item.color }}>{item.value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>

            {/* Logout */}
            <Button
              fullWidth variant="outlined" size="large"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{
                borderRadius: 3, textTransform: 'none', fontWeight: 700, fontSize: 15,
                borderColor: '#EF4444', color: '#DC2626', borderWidth: 1.5,
                '&:hover': { bgcolor: '#FEF2F2', borderColor: '#DC2626' },
              }}
            >
              Logout
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Bottom Navigation Bar ────────────────────────────────────── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 480,
          bgcolor: '#fff',
          borderTop: '1px solid #E5E7EB',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          display: 'flex',
          zIndex: 100,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        {(
          [
            {
              id: 'pickups' as TabId,
              label: 'Pickups',
              icon: <LocalShippingIcon />,
              badge: pendingPickups,
              activeColor: '#4F46E5',
              activeBg: '#EEF2FF',
            },
            {
              id: 'deliveries' as TabId,
              label: 'Deliveries',
              icon: <LocalLaundryServiceIcon />,
              badge: pendingDeliveries,
              activeColor: '#D97706',
              activeBg: '#FFFBEB',
            },
            {
              id: 'profile' as TabId,
              label: 'Profile',
              icon: <PersonIcon />,
              badge: 0,
              activeColor: '#059669',
              activeBg: '#ECFDF5',
            },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Box
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 1.25,
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s',
                '&:active': { transform: 'scale(0.93)' },
              }}
            >
              {/* Active indicator pill */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: tab.activeBg,
                    transition: 'all 0.2s',
                  }}
                />
              )}

              <Badge
                badgeContent={tab.badge}
                color="error"
                max={9}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: 10, minWidth: 16, height: 16, top: 2, right: 2,
                  },
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    color: isActive ? tab.activeColor : '#9CA3AF',
                    transition: 'color 0.2s',
                    '& svg': { fontSize: 22 },
                  }}
                >
                  {tab.icon}
                </Box>
              </Badge>
              <Typography
                sx={{
                  fontSize: 10,
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? tab.activeColor : '#9CA3AF',
                  mt: 0.25,
                  transition: 'all 0.2s',
                  position: 'relative', zIndex: 1,
                }}
              >
                {tab.label}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* ── Toast Notification ───────────────────────────────────────── */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: '80px !important' }}
      >
        <MuiAlert
          onClose={() => setToast(null)}
          severity={toast?.severity ?? 'success'}
          variant="filled"
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          {toast?.msg}
        </MuiAlert>
      </Snackbar>
    </Box>
  );
};

export default DeliveryBoyPage;
