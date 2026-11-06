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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import StorefrontIcon from '@mui/icons-material/Storefront';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddCircleOutlineIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/Delete';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import api from '../../api/axios';

import {
  getMyDeliveries,
  getMyPickupAssignments,
  updateMyDeliveryStatus,
  updateMyPickupStatus,
  requestDeliveryOtp,
  verifyOrderItems,
  type DeliveryAssignment,
  type PickupAssignment,
  type OrderItemInfo,
} from '../../api/deliveryBoy';
import { logout } from '../../app/authSlice';
import { useAuth } from '../../hooks/useAuth';
import {
  buildInlineGarmentRows,
  extractScriptBundleName,
  getItemsSignature,
  getPhysicalClothesSummary,
  hasPhysicalAdjustments,
  toVerifyOrderPayload,
  type InlineGarmentRow,
} from './clothesMatcher';

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

interface AddressHolder {
  addressTitle?: string | null;
  houseDetails?: string | null;
  landmark?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

function resolveDisplayAddress(
  order?: AddressHolder | null,
  customer?: AddressHolder | null,
  fallbackAddress?: string | null
): { title: string | null; fullAddress: string; pincode?: string | null } {
  const pin = order?.pincode || customer?.pincode || (fallbackAddress ? fallbackAddress.match(/\b\d{6}\b/)?.[0] : null) || null;

  // 1. Order-specific snapshot address (takes top priority for the order)
  if (order && (order.houseDetails || order.address || order.city || order.pincode)) {
    const parts = [
      order.houseDetails,
      order.landmark ? `(Landmark: ${order.landmark})` : null,
      order.address,
      order.city,
      order.state,
      order.pincode,
    ].filter(Boolean);
    if (parts.length > 0) {
      return {
        title: order.addressTitle || null,
        fullAddress: parts.join(', '),
        pincode: pin,
      };
    }
  }

  // 2. Specific fallback string if provided and not generic
  if (fallbackAddress && fallbackAddress.trim() && fallbackAddress.trim() !== 'Customer Address') {
    return {
      title: order?.addressTitle || null,
      fullAddress: fallbackAddress.trim(),
      pincode: pin,
    };
  }

  // 3. Customer profile fallback
  if (customer && (customer.houseDetails || customer.address || customer.city || customer.pincode)) {
    const parts = [
      customer.houseDetails,
      customer.landmark ? `(Landmark: ${customer.landmark})` : null,
      customer.address,
      customer.city,
      customer.state,
      customer.pincode,
    ].filter(Boolean);
    if (parts.length > 0) {
      return {
        title: customer.addressTitle || null,
        fullAddress: parts.join(', '),
        pincode: pin,
      };
    }
  }

  return { title: null, fullAddress: fallbackAddress?.trim() || '', pincode: pin };
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

const orderStatusBadgeConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  'New Order':          { color: '#1E40AF', bg: '#DBEAFE', border: '#93C5FD', label: 'New Order' },
  'Pickup Scheduled':   { color: '#92400E', bg: '#FEF3C7', border: '#FDE68A', label: 'Pickup Scheduled' },
  'Picked Up':          { color: '#5B21B6', bg: '#EDE9FE', border: '#C4B5FD', label: 'Picked Up' },
  'Laundry':            { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', label: '🧺 In Laundry' },
  'Processing':         { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', label: 'Processing' },
  'Ready For Delivery': { color: '#0369A1', bg: '#E0F2FE', border: '#7DD3FC', label: 'Ready For Delivery' },
  'Out For Delivery':   { color: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD', label: 'Out For Delivery' },
  'Delivered':          { color: '#065F46', bg: '#D1FAE5', border: '#6EE7B7', label: 'Delivered ✓' },
  'Cancelled':          { color: '#991B1B', bg: '#FEE2E2', border: '#FCA5A5', label: 'Cancelled' },
};

const DEFAULT_GARMENT_TYPES = [
  'Shirt',
  'T-Shirt',
  'Pant',
  'Trouser',
  'Jeans',
  'Suit',
  'Suit (2 Pc)',
  'Suit (3 Pc)',
  'Blazer',
  'Coat',
  'Kurta',
  'Pajama',
  'Saree',
  'Blouse',
  'Dupatta',
  'Dress',
  'Gown',
  'Lehenga',
  'Skirt',
  'Top',
  'Shorts',
  'Track Pant',
  'Jacket',
  'Sweater',
  'Hoodie',
  'Bedsheet (Single)',
  'Bedsheet (Double)',
  'Pillow Cover',
  'Blanket',
  'Quilt',
  'Curtain',
  'Towel',
];

function getTotalClothesCount(order?: { orderItems?: OrderItemInfo[]; totalClothes?: number } | null): number {
  if (!order) return 0;
  if (Array.isArray(order.orderItems) && order.orderItems.length > 0) {
    return order.orderItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }
  return Number(order.totalClothes) || 0;
}

// ── Pickup Card ──────────────────────────────────────────────────────────────

interface EditableGarmentRow {
  clothType: string;
  serviceId: number;
  quantity: number;
  checked: boolean;
}

const PickupCard: React.FC<{
  pickup: PickupAssignment;
  laundryShops: any[];
  services: any[];
  garmentCatalog: string[];
  onAction: (id: number, status: string, laundryShopId?: number) => void;
  onClothesVerified: (msg: string) => void;
  isLoading: boolean;
}> = ({ pickup, laundryShops: rawLaundryShops, services, garmentCatalog, onAction, onClothesVerified, isLoading }) => {
  const [expanded, setExpanded] = useState(pickup.status !== 'Completed' && pickup.status !== 'Cancelled');
  const [confirmDialog, setConfirmDialog] = useState<{ status: string; label: string } | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableGarmentRow[]>([]);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [savingClothes, setSavingClothes] = useState(false);
  const [clothesApprovedInSession, setClothesApprovedInSession] = useState(false);

  const defaultServiceId = useMemo(() => {
    const firstOrderServiceId = pickup.order?.orderItems?.[0]?.serviceId || pickup.order?.orderItems?.[0]?.service?.id;
    if (firstOrderServiceId) return Number(firstOrderServiceId);
    if (services && services.length > 0) return Number(services[0].id);
    return 1;
  }, [pickup.order, services]);

  const defaultServiceName = useMemo(() => {
    const firstOrderServiceName = pickup.order?.orderItems?.[0]?.service?.serviceName;
    if (firstOrderServiceName) return firstOrderServiceName;
    if (services && services.length > 0) return services[0].serviceName || 'Press / Ironing';
    return 'Press / Ironing';
  }, [pickup.order, services]);

  const itemsSig = useMemo(() => getItemsSignature(pickup.order?.orderItems), [pickup.order?.orderItems]);
  const [inlineRows, setInlineRows] = useState<InlineGarmentRow[]>(() =>
    buildInlineGarmentRows(pickup.order?.orderItems, defaultServiceId, defaultServiceName),
  );

  const prevSigRef = useRef(itemsSig);
  useEffect(() => {
    if (prevSigRef.current !== itemsSig) {
      prevSigRef.current = itemsSig;
      setInlineRows(buildInlineGarmentRows(pickup.order?.orderItems, defaultServiceId, defaultServiceName));
    }
  }, [itemsSig, pickup.order?.orderItems, defaultServiceId, defaultServiceName]);

  const hasInlineDiff = useMemo(() => hasPhysicalAdjustments(inlineRows), [inlineRows]);
  const clothesSummary = useMemo(() => getPhysicalClothesSummary(inlineRows), [inlineRows]);

  const openVerifyModal = useCallback(() => {
    const activeInline = inlineRows.filter((r) => r.physicalQty > 0);
    if (activeInline.length > 0) {
      setEditableItems(
        activeInline.map((row) => ({
          clothType: row.clothType || 'Shirt',
          serviceId: Number(row.serviceId || defaultServiceId),
          quantity: Math.max(1, Number(row.physicalQty) || 1),
          checked: true,
        })),
      );
    } else {
      const existing = pickup.order?.orderItems || [];
      if (existing.length > 0) {
        setEditableItems(
          existing.map((item) => ({
            clothType: item.clothType || 'Shirt',
            serviceId: Number(item.serviceId || item.service?.id || defaultServiceId),
            quantity: Math.max(1, Number(item.quantity) || 1),
            checked: true,
          })),
        );
      } else {
        setEditableItems([
          {
            clothType: 'Shirt',
            serviceId: defaultServiceId,
            quantity: 1,
            checked: true,
          },
        ]);
      }
    }
    setVerifyOpen(true);
  }, [inlineRows, pickup.order, defaultServiceId]);

  const handleSaveVerifiedClothes = async () => {
    if (!pickup.order?.id) return;
    const validItems = editableItems
      .filter((r) => r.clothType.trim() && r.quantity > 0)
      .map((r) => ({
        clothType: r.clothType.trim(),
        serviceId: Number(r.serviceId || defaultServiceId),
        quantity: Number(r.quantity),
      }));

    if (validItems.length === 0) {
      alert('Please keep at least 1 garment in the order.');
      return;
    }

    setSavingClothes(true);
    try {
      const updatedOrder = await verifyOrderItems(
        pickup.order.id,
        validItems,
        verificationNotes.trim() || undefined,
      );
      setClothesApprovedInSession(true);
      setVerifyOpen(false);
      await qc.invalidateQueries({ queryKey: ['my-pickups'] });
      await qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      await qc.invalidateQueries({ queryKey: ['orders'] });
      await qc.invalidateQueries({ queryKey: ['pickups'] });
      const totalPcs = validItems.reduce((s, i) => s + i.quantity, 0);
      const newNet = updatedOrder?.netAmount !== undefined ? ` (₹${Number(updatedOrder.netAmount).toFixed(2)})` : '';
      onClothesVerified(`✅ Clothes verified & approved! Total: ${totalPcs} clothes${newNet}`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update clothes. Please try again.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingClothes(false);
    }
  };

  const handleSaveInlineAdjustments = async (): Promise<boolean> => {
    if (!pickup.order?.id) return false;
    const validItems = toVerifyOrderPayload(inlineRows, defaultServiceId);
    if (validItems.length === 0) {
      alert('At least 1 cloth must remain in the order. If the customer handed over 0 clothes, please cancel the pickup instead.');
      return false;
    }

    setSavingClothes(true);
    try {
      const updatedOrder = await verifyOrderItems(
        pickup.order.id,
        validItems,
        'Physical clothes count matched & adjusted by Delivery Partner at pickup',
      );
      setClothesApprovedInSession(true);
      await qc.invalidateQueries({ queryKey: ['my-pickups'] });
      await qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      await qc.invalidateQueries({ queryKey: ['orders'] });
      await qc.invalidateQueries({ queryKey: ['pickups'] });
      const totalPcs = validItems.reduce((s, i) => s + i.quantity, 0);
      const newNet = updatedOrder?.netAmount !== undefined ? ` (₹${Number(updatedOrder.netAmount).toFixed(2)})` : '';
      onClothesVerified(`✅ Physical clothes adjusted & saved! Total: ${totalPcs} clothes${newNet}`);
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update clothes. Please try again.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
      return false;
    } finally {
      setSavingClothes(false);
    }
  };

  const totalClothesCount = useMemo(() => getTotalClothesCount(pickup.order), [pickup.order]);
  const orderStatusCfg = pickup.order?.orderStatus
    ? (orderStatusBadgeConfig[pickup.order.orderStatus] || {
        color: '#374151',
        bg: '#F3F4F6',
        border: '#D1D5DB',
        label: pickup.order.orderStatus,
      })
    : null;

  // Normalize laundryShops to guaranteed array
  const laundryShops = useMemo(() => {
    const list = Array.isArray(rawLaundryShops)
      ? rawLaundryShops
      : (rawLaundryShops as any)?.data || [];
    return list.filter((s: any) => s && s.isActive !== false);
  }, [rawLaundryShops]);

  // Pre-select laundry shop if already assigned to this order
  const assignedShopId = (pickup.order as any)?.laundryShopId || (pickup as any).laundryShopId || pickup.order?.laundryShop?.id || '';
  const [selectedShopId, setSelectedShopId] = useState<number | string>(assignedShopId);
  const [shopFilter, setShopFilter] = useState('');
  const [showAddShop, setShowAddShop] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopPincode, setNewShopPincode] = useState('');
  const [creatingShop, setCreatingShop] = useState(false);
  const addShopRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (assignedShopId && !selectedShopId) {
      setSelectedShopId(assignedShopId);
    }
  }, [assignedShopId]);

  useEffect(() => {
    if (showAddShop && addShopRef.current) {
      setTimeout(() => {
        addShopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [showAddShop]);

  const handleCreateShop = async () => {
    if (!newShopName.trim()) return;
    setCreatingShop(true);
    try {
      const payload: any = {
        shopName: newShopName.trim(),
        isActive: true,
      };
      if (newShopPincode?.trim()) {
        payload.pincode = newShopPincode.trim();
      }
      const res = await createLaundryShop(payload);

      const newShop = (res as any)?.data || res;
      const createdId = newShop?.id;

      // Immediately inject into React Query cache so it shows instantly in the dropdown
      qc.setQueryData(['laundry-shops'], (old: any) => {
        const currentList = Array.isArray(old) ? old : (old?.data || []);
        if (newShop && createdId) {
          return [newShop, ...currentList.filter((s: any) => s.id !== createdId)];
        }
        return currentList;
      });
      await qc.invalidateQueries({ queryKey: ['laundry-shops'] });

      if (createdId) {
        setSelectedShopId(createdId);
      }
      setShowAddShop(false);
      setNewShopName('');
      setNewShopPincode('');
    } catch (err: any) {
      console.error('Failed to create shop', err);
      const msg = err?.response?.data?.message || 'Failed to create laundry shop. Please check details and try again.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setCreatingShop(false);
    }
  };

  const statusCfg = pickupStatusConfig[pickup.status] ?? pickupStatusConfig.Pending;
  const isDone = pickup.status === 'Completed' || pickup.status === 'Cancelled';
  const addrInfo = resolveDisplayAddress(pickup.order, pickup.customer, pickup.pickupAddress);
  const address = addrInfo.fullAddress;
  const customerPincode = addrInfo.pincode || pickup.customer?.pincode || (pickup.order as any)?.pincode || '';
  const customerPin = String(customerPincode || '').trim();

  // Find currently selected shop
  const selectedShop = useMemo(() => {
    if (!selectedShopId) return null;
    return laundryShops.find((s: any) => String(s.id) === String(selectedShopId)) || null;
  }, [laundryShops, selectedShopId]);

  // Filtered & sorted laundry shops for inline selector
  const filteredShops = useMemo(() => {
    let list = [...laundryShops];
    if (shopFilter.trim()) {
      const q = shopFilter.toLowerCase().trim();
      list = list.filter((shop: any) => {
        const name = (shop.shopName || '').toLowerCase();
        const pin = String(shop.pincode || '');
        const addr = (shop.address || '').toLowerCase();
        const city = (shop.city || '').toLowerCase();
        return name.includes(q) || pin.includes(q) || addr.includes(q) || city.includes(q);
      });
    }

    return list.sort((a: any, b: any) => {
      const aSelected = String(a.id) === String(selectedShopId);
      const bSelected = String(b.id) === String(selectedShopId);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const aNear = Boolean(customerPin && a.pincode && String(a.pincode).trim() === customerPin);
      const bNear = Boolean(customerPin && b.pincode && String(b.pincode).trim() === customerPin);
      if (aNear && !bNear) return -1;
      if (!aNear && bNear) return 1;

      return (a.shopName || '').localeCompare(b.shopName || '');
    });
  }, [laundryShops, shopFilter, customerPin, selectedShopId]);

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: 2,
                  background: isDone
                    ? 'linear-gradient(135deg, #9CA3AF, #6B7280)'
                    : 'linear-gradient(135deg, #6366F1, #4F46E5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: isDone ? 'none' : '0 2px 6px rgba(99, 102, 241, 0.3)',
                }}
              >
                <LocalShippingIcon sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {/* 1. ORDER NUMBER (Displayed directly above Pickup #) */}
                <Typography sx={{ fontWeight: 900, fontSize: 15, color: isDone ? '#374151' : '#1E1B4B', lineHeight: 1.2, mb: 0.25 }}>
                  Order #{pickup.order?.orderNumber || (pickup as any).orderNumber || `ORD-${String(pickup.id).padStart(5, '0')}`}
                </Typography>
                {/* 2. PICKUP # and TIME SLOT */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 12, color: isDone ? '#4B5563' : '#4F46E5', fontWeight: 800 }}>
                    Pickup #{pickup.id}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>•</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                    <AccessTimeIcon sx={{ fontSize: 12, color: '#6B7280' }} />
                    <Typography sx={{ fontSize: 11, color: '#4B5563', fontWeight: 600 }}>
                      {formatPickupDate(pickup.pickupDate, pickup.pickupTime)}
                    </Typography>
                  </Box>
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
            {/* Prominent Order No + Order Status + Total Clothes Badge */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 0.75,
                px: 1.5,
                py: 1,
                mb: 1.5,
                bgcolor: '#EEF2FF',
                borderRadius: 2,
                border: '1.5px solid #6366F1',
                boxShadow: '0 1px 3px rgba(99, 102, 241, 0.1)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#312E81' }}>
                  📦 Order:
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#4F46E5', letterSpacing: '0.5px' }}>
                  {pickup.order?.orderNumber || (pickup as any).orderNumber || `ORD-${String(pickup.id).padStart(5, '0')}`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                {orderStatusCfg && (
                  <Chip
                    label={orderStatusCfg.label}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 10.5,
                      fontWeight: 800,
                      bgcolor: orderStatusCfg.bg,
                      color: orderStatusCfg.color,
                      border: `1px solid ${orderStatusCfg.border}`,
                    }}
                  />
                )}
                <Chip
                  label={`🧺 ${totalClothesCount} ${totalClothesCount === 1 ? 'Cloth' : 'Clothes'}`}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: 11,
                    fontWeight: 900,
                    bgcolor: '#4F46E5',
                    color: '#FFFFFF',
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#111827', mb: 0.25 }}>
                  {pickup.customer.firstName} {pickup.customer.lastName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                  <LocationOnIcon sx={{ fontSize: 14, color: '#6366F1', mt: 0.2, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    {addrInfo.title && (
                      <Chip
                        icon={<HomeIcon sx={{ fontSize: '11px !important' }} />}
                        label={addrInfo.title}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 800,
                          mr: 0.75,
                          mb: 0.25,
                          bgcolor: addrInfo.title.toLowerCase() === 'work' ? '#EEF2FF' : '#DCFCE7',
                          color: addrInfo.title.toLowerCase() === 'work' ? '#4338CA' : '#15803D',
                          border: addrInfo.title.toLowerCase() === 'work' ? '1px solid #C7D2FE' : '1px solid #BBF7D0',
                        }}
                      />
                    )}
                    <Typography component="span" sx={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
                      {address || 'Address not specified'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            {/* ── Physical vs Ordered Clothes Match & Inline Adjustment Section ── */}
            <Box
              sx={{
                mt: 1,
                mb: 1.25,
                p: 1.5,
                bgcolor: hasInlineDiff ? '#FFFBEB' : '#F8FAFC',
                borderRadius: 2.5,
                border: hasInlineDiff
                  ? '2px solid #F59E0B'
                  : clothesApprovedInSession || (clothesSummary.totalRows > 0 && clothesSummary.matchedRows === clothesSummary.totalRows)
                  ? '1.5px solid #10B981'
                  : '1.5px solid #6366F1',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    🧺 Clothes to Match ({hasInlineDiff ? `${clothesSummary.physicalTotal} / ${clothesSummary.orderedTotal}` : totalClothesCount} pcs)
                  </Typography>
                  {(clothesApprovedInSession || (pickup.order?.notes && pickup.order.notes.includes('[Verified:'))) && !hasInlineDiff && (
                    <Chip
                      label="Verified ✓"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 9.5,
                        fontWeight: 800,
                        bgcolor: '#DCFCE7',
                        color: '#15803D',
                        border: '1px solid #86EFAC',
                      }}
                    />
                  )}
                  {clothesSummary.totalRows > 0 && clothesSummary.matchedRows === clothesSummary.totalRows && !hasInlineDiff && (
                    <Chip
                      label="All Matched ✓"
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 9.5,
                        fontWeight: 800,
                        bgcolor: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #6EE7B7',
                      }}
                    />
                  )}
                </Box>
                {pickup.order && !isDone && (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<EditNoteIcon sx={{ fontSize: '15px !important' }} />}
                    onClick={openVerifyModal}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: 11,
                      py: 0.4,
                      px: 1.1,
                      borderRadius: 1.5,
                      bgcolor: '#4F46E5',
                      color: '#fff',
                      boxShadow: '0 1px 4px rgba(79, 70, 229, 0.25)',
                      '&:hover': { bgcolor: '#4338CA' },
                    }}
                  >
                    Add / Swap Cloth
                  </Button>
                )}
              </Box>

              {/* Service Breakdown Chips + Check All Toggle */}
              {clothesSummary.serviceBreakdown.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {clothesSummary.serviceBreakdown.map((svc) => (
                      <Chip
                        key={svc.serviceName}
                        label={`${svc.serviceName}: ${svc.count} ${svc.count === 1 ? 'pc' : 'pcs'}`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: 10.5,
                          fontWeight: 800,
                          bgcolor: '#E0E7FF',
                          color: '#3730A3',
                        }}
                      />
                    ))}
                  </Box>
                  {!isDone && inlineRows.length > 0 && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        const allChecked = inlineRows.every((r) => r.matched);
                        setInlineRows((prev) => prev.map((r) => ({ ...r, matched: !allChecked })));
                      }}
                      sx={{
                        textTransform: 'none',
                        fontSize: 10.5,
                        fontWeight: 800,
                        py: 0,
                        px: 0.75,
                        minWidth: 0,
                        color: '#059669',
                      }}
                    >
                      {inlineRows.every((r) => r.matched) ? 'Uncheck All' : '☑ Match All'}
                    </Button>
                  )}
                </Box>
              )}

              {inlineRows.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65 }}>
                  {inlineRows.map((row, idx) => {
                    const isMissingAll = row.physicalQty === 0;
                    const diff = row.physicalQty - row.orderedQty;
                    return (
                      <Box
                        key={row.key}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 0.75,
                          px: 1,
                          py: 0.75,
                          bgcolor: isMissingAll ? '#FEF2F2' : row.matched ? '#F0FDF4' : '#FFFFFF',
                          borderRadius: 1.5,
                          border: isMissingAll
                            ? '1px dashed #EF4444'
                            : diff !== 0
                            ? '1.5px solid #F59E0B'
                            : row.matched
                            ? '1.5px solid #10B981'
                            : '1px solid #E2E8F0',
                        }}
                      >
                        <Box
                          onClick={() => {
                            if (isDone) return;
                            setInlineRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, matched: !r.matched } : r)),
                            );
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.75,
                            minWidth: 0,
                            flex: 1,
                            cursor: isDone ? 'default' : 'pointer',
                          }}
                        >
                          {!isDone && (
                            row.matched ? (
                              <CheckBoxIcon sx={{ color: '#10B981', fontSize: 20, flexShrink: 0 }} />
                            ) : (
                              <CheckBoxOutlineBlankIcon sx={{ color: '#94A3B8', fontSize: 20, flexShrink: 0 }} />
                            )
                          )}
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              <Typography
                                sx={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: isMissingAll ? '#991B1B' : '#0F172A',
                                  lineHeight: 1.2,
                                  textDecoration: isMissingAll ? 'line-through' : 'none',
                                }}
                              >
                                {idx + 1}. {row.clothType}
                              </Typography>
                              {diff !== 0 && (
                                <Chip
                                  label={
                                    isMissingAll
                                      ? `Missing (Ordered ${row.orderedQty})`
                                      : `Ordered ${row.orderedQty} (${diff > 0 ? `+${diff}` : diff})`
                                  }
                                  size="small"
                                  sx={{
                                    height: 17,
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    bgcolor: isMissingAll ? '#FEE2E2' : '#FEF3C7',
                                    color: isMissingAll ? '#991B1B' : '#92400E',
                                  }}
                                />
                              )}
                            </Box>
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#6366F1' }}>
                              {row.serviceName}
                              {row.unitPrice !== undefined ? ` • ₹${Number(row.unitPrice).toFixed(0)}/pc` : ''}
                            </Typography>
                          </Box>
                        </Box>

                        {!isDone ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              border: '1.5px solid #CBD5E1',
                              borderRadius: 1.5,
                              bgcolor: '#F8FAFC',
                              height: 30,
                              flexShrink: 0,
                            }}
                          >
                            <IconButton
                              size="small"
                              disabled={savingClothes || row.physicalQty <= 0}
                              onClick={() =>
                                setInlineRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? {
                                          ...r,
                                          physicalQty: Math.max(0, r.physicalQty - 1),
                                          matched: Math.max(0, r.physicalQty - 1) > 0,
                                        }
                                      : r,
                                  ),
                                )
                              }
                              sx={{ width: 26, height: 26, fontWeight: 900, fontSize: 15, color: '#DC2626' }}
                              title="Decrease physical count (missing cloth)"
                            >
                              −
                            </IconButton>
                            <Typography
                              sx={{
                                minWidth: 24,
                                textAlign: 'center',
                                fontWeight: 900,
                                fontSize: 13,
                                color: isMissingAll ? '#DC2626' : '#0F172A',
                              }}
                            >
                              {row.physicalQty}
                            </Typography>
                            <IconButton
                              size="small"
                              disabled={savingClothes}
                              onClick={() =>
                                setInlineRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx
                                      ? { ...r, physicalQty: r.physicalQty + 1, matched: true }
                                      : r,
                                  ),
                                )
                              }
                              sx={{ width: 26, height: 26, fontWeight: 900, fontSize: 15, color: '#059669' }}
                              title="Increase physical count (extra cloth)"
                            >
                              +
                            </IconButton>
                          </Box>
                        ) : (
                          <Chip
                            label={`Qty: ${row.physicalQty}`}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: 11.5,
                              fontWeight: 900,
                              bgcolor: '#EEF2FF',
                              color: '#3730A3',
                              border: '1px solid #C7D2FE',
                            }}
                          />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ py: 0.5 }}>
                  <Typography sx={{ fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
                    No clothes listed on this order yet. Tap "Add / Swap Cloth" to record the physical clothes collected from the customer.
                  </Typography>
                </Box>
              )}

              {/* Sticky Inline Save Bar when physical count differs from ordered count */}
              {!isDone && hasInlineDiff && pickup.order && (
                <Box
                  sx={{
                    mt: 1.25,
                    p: 1.1,
                    borderRadius: 2,
                    bgcolor: '#ECFDF5',
                    border: '1.5px solid #10B981',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.75,
                  }}
                >
                  <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: '#065F46' }}>
                    ⚠️ Physical count adjusted: Ordered {clothesSummary.orderedTotal} pcs → Collecting {clothesSummary.physicalTotal} pcs
                    {clothesSummary.missingTotal > 0 ? ` (-${clothesSummary.missingTotal} missing)` : ''}
                    {clothesSummary.extraTotal > 0 ? ` (+${clothesSummary.extraTotal} extra)` : ''}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={savingClothes}
                      onClick={() =>
                        setInlineRows(
                          buildInlineGarmentRows(pickup.order?.orderItems, defaultServiceId, defaultServiceName),
                        )
                      }
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: 11,
                        borderRadius: 1.5,
                        borderColor: '#64748B',
                        color: '#334155',
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      fullWidth
                      size="small"
                      variant="contained"
                      disabled={savingClothes || clothesSummary.physicalTotal === 0}
                      onClick={() => void handleSaveInlineAdjustments()}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 900,
                        fontSize: 11.5,
                        borderRadius: 1.5,
                        bgcolor: '#10B981',
                        color: '#FFFFFF',
                        '&:hover': { bgcolor: '#059669' },
                      }}
                    >
                      {savingClothes
                        ? 'Saving...'
                        : `💾 Save Adjusted Clothes (${clothesSummary.physicalTotal} pcs)`}
                    </Button>
                  </Box>
                </Box>
              )}

              {!isDone && (
                <Typography sx={{ fontSize: 10.5, color: '#475569', mt: 0.85, fontWeight: 600 }}>
                  💡 Match physical clothes using ☑ &amp; <strong>− / +</strong> for missing/extra items, or tap <strong>Add / Swap Cloth</strong> if customer gave a different garment type!
                </Typography>
              )}
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
                    : `Payment: ₹${pickup.order.netAmount ? pickup.order.netAmount.toFixed(2) : '0.00'}`}
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
                  onClick={() => {
                    const existingShopId = (pickup.order as any)?.laundryShopId || (pickup as any).laundryShopId || pickup.order?.laundryShop?.id || '';
                    if (existingShopId) {
                      setSelectedShopId(existingShopId);
                    }
                    setConfirmDialog({ status: 'Completed', label: 'Mark as Picked Up' });
                  }}
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
      <Dialog
        open={!!confirmDialog}
        onClose={() => {
          setConfirmDialog(null);
          setShowAddShop(false);
          setNewShopName('');
          setNewShopPincode('');
          setShopFilter('');
        }}
        maxWidth="xs"
        fullWidth
        scroll="paper"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              bgcolor: '#FFFFFF !important',
              color: '#0F172A !important',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              m: { xs: 1.5, sm: 2 },
              maxHeight: 'calc(100% - 32px)',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1, color: '#0F172A !important', fontSize: { xs: 16, sm: 18 } }}>
          {confirmDialog?.label}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            color: '#0F172A !important',
            maxHeight: 'calc(75vh - 100px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            px: { xs: 2, sm: 2.5 },
            py: 2,
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: '#F1F5F9',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#94A3B8',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#64748B',
            },
          }}
        >
          <Typography variant="body2" sx={{ color: '#475569 !important', mb: 1.5, fontSize: 13.5, lineHeight: 1.5 }}>
            {confirmDialog?.status === 'Completed'
              ? `Confirm that you have collected the clothes for Order #${pickup.order?.orderNumber || (pickup as any).orderNumber || `ORD-${String(pickup.id).padStart(5, '0')}`} from ${pickup.customer?.firstName || ''} ${pickup.customer?.lastName || ''}?`
              : `Are you sure you want to cancel pickup #${pickup.id} (Order #${pickup.order?.orderNumber || (pickup as any).orderNumber || `ORD-${String(pickup.id).padStart(5, '0')}`})?`}
          </Typography>

          {confirmDialog?.status === 'Completed' && (
            <Box sx={{ mt: 1.5 }}>
              {/* Quick Clothes Verification Summary inside Pickup Confirmation */}
              {pickup.order && (
                <Box
                  sx={{
                    p: 1.25,
                    mb: 1.5,
                    bgcolor: clothesApprovedInSession ? '#ECFDF5' : '#F8FAFC',
                    borderRadius: 2,
                    border: clothesApprovedInSession ? '1.5px solid #10B981' : '1.5px solid #CBD5E1',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#0F172A !important' }}>
                      🧺 Clothes Count: {totalClothesCount} pcs
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={openVerifyModal}
                      sx={{
                        textTransform: 'none',
                        fontSize: 11,
                        fontWeight: 800,
                        py: 0.2,
                        px: 1,
                        borderRadius: 1.5,
                        borderColor: '#4F46E5',
                        color: '#4F46E5 !important',
                      }}
                    >
                      ✏️ Fix / Approve Clothes
                    </Button>
                  </Box>
                  {pickup.order.orderItems && pickup.order.orderItems.length > 0 && (
                    <Typography sx={{ fontSize: 11.5, color: '#334155 !important', fontWeight: 600 }}>
                      {pickup.order.orderItems.map((i) => `${i.clothType} (${i.service?.serviceName || 'Service'}) ×${i.quantity}`).join(' • ')}
                    </Typography>
                  )}
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#1E293B !important', fontSize: 13 }}>
                  Select Laundry Shop to drop clothes:
                </Typography>
                {selectedShop && (
                  <Chip
                    label="Shop Selected ✓"
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: 10,
                      fontWeight: 800,
                      bgcolor: '#DCFCE7 !important',
                      color: '#166534 !important',
                      border: '1px solid #BBF7D0',
                    }}
                  />
                )}
              </Box>

              {/* Selected Shop Active Banner */}
              {selectedShop && (
                <Box
                  sx={{
                    p: 1.25,
                    mb: 1.5,
                    bgcolor: '#EEF2FF',
                    borderRadius: 2,
                    border: '1.5px solid #6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <StorefrontIcon sx={{ color: '#4F46E5', fontSize: 20, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1E1B4B' }} noWrap>
                        {selectedShop.shopName}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#4338CA', fontWeight: 600 }}>
                        {selectedShop.pincode ? `PIN: ${selectedShop.pincode}` : ''}
                        {selectedShop.address ? ` • ${selectedShop.address}` : ''}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setSelectedShopId('')}
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#6366F1 !important',
                      p: 0.5,
                      minWidth: 0,
                      textTransform: 'none',
                      '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
                    }}
                  >
                    Change
                  </Button>
                </Box>
              )}

              {/* Instant Search Bar */}
              <TextField
                fullWidth
                size="small"
                placeholder="🔍 Search shop name or pincode..."
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#6366F1', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    endAdornment: shopFilter ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShopFilter('')} sx={{ p: 0.25 }}>
                          <ClearIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
                sx={{
                  mb: 1.5,
                  bgcolor: '#FFFFFF !important',
                  borderRadius: 2,
                  '& .MuiInputBase-root': {
                    bgcolor: '#F8FAFC !important',
                    borderRadius: 2,
                    height: 40,
                  },
                  '& .MuiInputBase-input': {
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0F172A !important',
                    WebkitTextFillColor: '#0F172A !important',
                    py: 1,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#CBD5E1 !important',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#6366F1 !important',
                  },
                  '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4F46E5 !important',
                    borderWidth: '2px !important',
                  },
                }}
              />

              {/* Inline Scrollable Shop Selection List (NO floating popovers) */}
              <Box
                sx={{
                  maxHeight: 210,
                  overflowY: 'auto',
                  pr: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                  '&::-webkit-scrollbar': { width: '5px' },
                  '&::-webkit-scrollbar-track': { background: '#F1F5F9', borderRadius: '3px' },
                  '&::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: '3px' },
                  '&::-webkit-scrollbar-thumb:hover': { background: '#94A3B8' },
                }}
              >
                {filteredShops.length === 0 ? (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: 'center',
                      bgcolor: '#F8FAFC',
                      borderRadius: 2,
                      border: '1px dashed #CBD5E1',
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748B !important', mb: 1 }}>
                      {shopFilter ? `No shops found matching "${shopFilter}"` : 'No active laundry shops found.'}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        if (shopFilter.trim()) setNewShopName(shopFilter.trim());
                        if (customerPin) setNewShopPincode(customerPin);
                        setShowAddShop(true);
                      }}
                      sx={{
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'none',
                        borderRadius: 1.5,
                        borderColor: '#6366F1',
                        color: '#4F46E5',
                      }}
                    >
                      + Add {shopFilter ? `"${shopFilter.trim()}"` : 'New Shop'}
                    </Button>
                  </Box>
                ) : (
                  filteredShops.map((shop: any) => {
                    const isSelected = String(shop.id) === String(selectedShopId);
                    const isNear = Boolean(customerPin && shop.pincode && String(shop.pincode).trim() === customerPin);

                    return (
                      <Box
                        key={shop.id}
                        onClick={() => {
                          setSelectedShopId(shop.id);
                          setShowAddShop(false);
                        }}
                        sx={{
                          p: 1.25,
                          borderRadius: 2,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          bgcolor: isSelected ? '#EEF2FF !important' : '#FFFFFF !important',
                          border: isSelected ? '2px solid #4F46E5 !important' : '1px solid #E2E8F0 !important',
                          boxShadow: isSelected ? '0 2px 8px rgba(79, 70, 229, 0.18)' : '0 1px 2px rgba(0,0,0,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          '&:hover': {
                            bgcolor: isSelected ? '#EEF2FF !important' : '#F8FAFC !important',
                            borderColor: isSelected ? '#4F46E5 !important' : '#CBD5E1 !important',
                          },
                        }}
                      >
                        {isSelected ? (
                          <CheckCircleIcon sx={{ color: '#4F46E5', fontSize: 20, flexShrink: 0 }} />
                        ) : (
                          <RadioButtonUncheckedIcon sx={{ color: '#94A3B8', fontSize: 20, flexShrink: 0 }} />
                        )}

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography
                              sx={{
                                fontWeight: isSelected ? 800 : 700,
                                fontSize: 13,
                                color: isSelected ? '#1E1B4B !important' : '#0F172A !important',
                              }}
                            >
                              🏪 {shop.shopName}
                            </Typography>
                            {isNear && (
                              <Chip
                                label="📍 Near Customer"
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  bgcolor: '#DCFCE7 !important',
                                  color: '#15803D !important',
                                  border: '1px solid #BBF7D0',
                                }}
                              />
                            )}
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                            {shop.pincode && (
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: isSelected ? '#4338CA !important' : '#6366F1 !important',
                                }}
                              >
                                PIN: {shop.pincode}
                              </Typography>
                            )}
                            {(shop.address || shop.city) && (
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  color: '#64748B !important',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: 200,
                                }}
                              >
                                {[shop.address, shop.city].filter(Boolean).join(', ')}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>

              {/* Add New Shop Button Toggle */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 1.5,
                  pt: 1,
                  borderTop: '1px solid #F1F5F9',
                }}
              >
                <Typography sx={{ fontSize: 11, color: '#64748B !important' }}>
                  Don't see the laundry shop in list?
                </Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => {
                    if (!showAddShop && customerPin && !newShopPincode) {
                      setNewShopPincode(customerPin);
                    }
                    setShowAddShop(!showAddShop);
                  }}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: 12,
                    color: '#4F46E5 !important',
                    p: 0.5,
                    '&:hover': { bgcolor: '#EEF2FF' },
                  }}
                >
                  {showAddShop ? 'Cancel Add' : '+ Add New Shop'}
                </Button>
              </Box>

              {/* Add New Shop Collapsible Form */}
              {showAddShop && (
                <Box ref={addShopRef} sx={{ scrollMarginTop: '16px', mt: 1 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.75,
                      bgcolor: '#F8FAFC !important',
                      borderRadius: 2,
                      border: '2px solid #6366F1',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 800,
                        display: 'block',
                        mb: 1.25,
                        color: '#1E293B !important',
                        fontSize: 12,
                        letterSpacing: 0.5,
                      }}
                    >
                      ✨ NEW LAUNDRY SHOP DETAILS:
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      label="Shop Name *"
                      placeholder="e.g. Ashok Laundry"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      slotProps={{
                        input: {
                          style: {
                            color: '#0F172A',
                            backgroundColor: '#FFFFFF',
                            fontSize: 13.5,
                            fontWeight: 600,
                          },
                        },
                        htmlInput: {
                          style: {
                            color: '#0F172A',
                            WebkitTextFillColor: '#0F172A',
                            backgroundColor: '#FFFFFF',
                            fontSize: 13.5,
                            fontWeight: 600,
                          },
                        },
                        inputLabel: {
                          shrink: true,
                          style: {
                            color: '#1E293B',
                            fontWeight: 800,
                            fontSize: 13,
                          },
                        },
                      }}
                      sx={{
                        mb: 1.25,
                        bgcolor: '#FFFFFF !important',
                        borderRadius: 1.5,
                        '& .MuiInputBase-root': { bgcolor: '#FFFFFF !important', color: '#0F172A !important' },
                        '& .MuiInputBase-input': { color: '#0F172A !important', WebkitTextFillColor: '#0F172A !important' },
                        '& .MuiInputLabel-root': { color: '#1E293B !important', fontWeight: 800 },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8 !important', borderWidth: '1.5px !important' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4F46E5 !important' },
                        '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4F46E5 !important', borderWidth: '2px !important' },
                      }}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Pincode (Optional)"
                      placeholder="e.g. 400078"
                      value={newShopPincode}
                      onChange={(e) => setNewShopPincode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                      slotProps={{
                        input: {
                          style: {
                            color: '#0F172A',
                            backgroundColor: '#FFFFFF',
                            fontSize: 13.5,
                            fontWeight: 600,
                          },
                        },
                        htmlInput: {
                          style: {
                            color: '#0F172A',
                            WebkitTextFillColor: '#0F172A',
                            backgroundColor: '#FFFFFF',
                            fontSize: 13.5,
                            fontWeight: 600,
                          },
                        },
                        inputLabel: {
                          shrink: true,
                          style: {
                            color: '#1E293B',
                            fontWeight: 800,
                            fontSize: 13,
                          },
                        },
                      }}
                      sx={{
                        mb: 1.5,
                        bgcolor: '#FFFFFF !important',
                        borderRadius: 1.5,
                        '& .MuiInputBase-root': { bgcolor: '#FFFFFF !important', color: '#0F172A !important' },
                        '& .MuiInputBase-input': { color: '#0F172A !important', WebkitTextFillColor: '#0F172A !important' },
                        '& .MuiInputLabel-root': { color: '#1E293B !important', fontWeight: 800 },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#94A3B8 !important', borderWidth: '1.5px !important' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4F46E5 !important' },
                        '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#4F46E5 !important', borderWidth: '2px !important' },
                      }}
                    />
                    <Button
                      fullWidth
                      size="medium"
                      variant="contained"
                      disabled={creatingShop || !newShopName.trim()}
                      onClick={handleCreateShop}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 800,
                        py: 1,
                        fontSize: 13,
                        bgcolor: '#4F46E5 !important',
                        color: '#FFFFFF !important',
                        borderRadius: 1.5,
                        boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
                        '&:hover': { bgcolor: '#4338CA !important' },
                        '&.Mui-disabled': { bgcolor: '#E2E8F0 !important', color: '#94A3B8 !important' },
                      }}
                    >
                      {creatingShop ? 'Creating Shop...' : '+ Create & Select Shop'}
                    </Button>
                  </Card>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 2.5 },
            pb: { xs: 2, sm: 2.5 },
            pt: 1.5,
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            gap: 1,
            bgcolor: '#FAFAFA',
            borderBottomLeftRadius: 12,
            borderBottomRightRadius: 12,
          }}
        >
          <Button
            onClick={() => {
              setConfirmDialog(null);
              setShowAddShop(false);
              setNewShopName('');
              setNewShopPincode('');
              setShopFilter('');
            }}
            sx={{
              flex: 1,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              color: '#475569 !important',
              bgcolor: '#F1F5F9',
              '&:hover': { bgcolor: '#E2E8F0' },
            }}
          >
            No, Go Back
          </Button>
          <Button
            variant="contained"
            disabled={isLoading || savingClothes || (confirmDialog?.status === 'Completed' && !selectedShopId)}
            onClick={async () => {
              if (confirmDialog) {
                if (confirmDialog.status === 'Completed' && hasInlineDiff && pickup.order?.id) {
                  const ok = await handleSaveInlineAdjustments();
                  if (!ok) return;
                }
                onAction(pickup.id, confirmDialog.status, selectedShopId ? Number(selectedShopId) : undefined);
                setConfirmDialog(null);
                setShowAddShop(false);
                setNewShopName('');
                setNewShopPincode('');
                setShopFilter('');
              }
            }}
            sx={{
              flex: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 13,
              bgcolor: confirmDialog?.status === 'Completed' ? '#10B981 !important' : '#EF4444 !important',
              color: '#FFFFFF !important',
              boxShadow: confirmDialog?.status === 'Completed'
                ? '0 2px 8px rgba(16, 185, 129, 0.35)'
                : '0 2px 8px rgba(239, 68, 68, 0.35)',
              '&:hover': {
                bgcolor: confirmDialog?.status === 'Completed' ? '#059669 !important' : '#DC2626 !important',
              },
              '&.Mui-disabled': {
                bgcolor: '#E2E8F0 !important',
                color: '#94A3B8 !important',
                boxShadow: 'none',
              },
            }}
          >
            {isLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : confirmDialog?.status === 'Completed' ? (
              selectedShop ? `Drop to ${selectedShop.shopName.length > 15 ? selectedShop.shopName.substring(0, 15) + '...' : selectedShop.shopName} ✓` : 'Select Shop to Confirm'
            ) : (
              'Yes, Cancel Pickup'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Verify, Edit & Approve Clothes Dialog (Task 1) ── */}
      <Dialog
        open={verifyOpen}
        onClose={() => !savingClothes && setVerifyOpen(false)}
        maxWidth="sm"
        fullWidth
        scroll="paper"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              bgcolor: '#FFFFFF !important',
              color: '#0F172A !important',
              m: { xs: 1, sm: 2 },
              maxHeight: 'calc(100% - 24px)',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 1, color: '#0F172A !important', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FactCheckIcon sx={{ color: '#4F46E5' }} />
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 15, color: '#0F172A !important', lineHeight: 1.2 }}>
                Verify & Approve Clothes
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#475569 !important', fontWeight: 600 }}>
                Order #{pickup.order?.orderNumber} • {pickup.customer.firstName} {pickup.customer.lastName}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={`🧺 ${editableItems.reduce((s, r) => s + (Number(r.quantity) || 0), 0)} pcs`}
            size="small"
            sx={{ bgcolor: '#4F46E5 !important', color: '#FFFFFF !important', fontWeight: 900, fontSize: 12 }}
          />
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 1.5, sm: 2.5 }, py: 2, bgcolor: '#F8FAFC !important' }}>
          <Typography sx={{ fontSize: 12, color: '#334155 !important', mb: 1.5, fontWeight: 600, lineHeight: 1.4 }}>
            Count the clothes handed over by the customer. You can change any garment type (e.g. <strong>T-Shirt → Shirt</strong>), split a <strong>Suit → Pant + Shirt</strong>, adjust quantities, or add/remove items before approving.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {editableItems.map((row, idx) => {
              const isSuit = row.clothType.toLowerCase().includes('suit');
              return (
                <Box
                  key={idx}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: '#FFFFFF !important',
                    border: row.checked ? '1.5px solid #4F46E5' : '1px solid #CBD5E1',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box
                      onClick={() =>
                        setEditableItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item))
                        )
                      }
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                    >
                      {row.checked ? (
                        <CheckBoxIcon sx={{ color: '#10B981', fontSize: 20 }} />
                      ) : (
                        <CheckBoxOutlineBlankIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                      )}
                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1E293B !important' }}>
                        Garment #{idx + 1} {row.checked ? '(Checked ✓)' : '(Tap to check)'}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {isSuit && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            // Replace Suit with Pant + Shirt of same service & quantity
                            setEditableItems((prev) => {
                              const next = [...prev];
                              next.splice(
                                idx,
                                1,
                                { clothType: 'Pant', serviceId: row.serviceId, quantity: row.quantity, checked: true },
                                { clothType: 'Shirt', serviceId: row.serviceId, quantity: row.quantity, checked: true },
                              );
                              return next;
                            });
                          }}
                          sx={{
                            textTransform: 'none',
                            fontSize: 10.5,
                            fontWeight: 800,
                            py: 0.2,
                            px: 0.8,
                            borderRadius: 1,
                            borderColor: '#F59E0B',
                            color: '#B45309 !important',
                            bgcolor: '#FFFBEB',
                          }}
                        >
                          ⇄ Split to Pant + Shirt
                        </Button>
                      )}
                      <IconButton
                        size="small"
                        color="error"
                        disabled={editableItems.length <= 1}
                        onClick={() =>
                          setEditableItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        title="Remove item"
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {/* Cloth / Garment Type Selector (Autocomplete freeSolo so any cloth can be picked or typed) */}
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={garmentCatalog}
                      value={row.clothType}
                      onChange={(_e, newVal) => {
                        setEditableItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, clothType: newVal || '' } : item))
                        );
                      }}
                      onInputChange={(_e, newInputVal) => {
                        setEditableItems((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, clothType: newInputVal || '' } : item))
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Cloth / Garment Type"
                          placeholder="e.g. Shirt, T-Shirt, Pant, Suit"
                          sx={{
                            '& .MuiInputBase-root': { bgcolor: '#FFFFFF !important', color: '#0F172A !important', fontWeight: 700, fontSize: 13 },
                            '& .MuiInputBase-input': { color: '#0F172A !important', WebkitTextFillColor: '#0F172A !important' },
                            '& .MuiInputLabel-root': { color: '#475569 !important', fontWeight: 700 },
                          }}
                        />
                      )}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* Service Selector */}
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <InputLabel sx={{ color: '#475569 !important', fontWeight: 700 }}>Service</InputLabel>
                        <Select
                          label="Service"
                          value={row.serviceId}
                          onChange={(e) =>
                            setEditableItems((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, serviceId: Number(e.target.value) } : item
                              )
                            )
                          }
                          sx={{
                            bgcolor: '#FFFFFF !important',
                            color: '#0F172A !important',
                            fontWeight: 700,
                            fontSize: 12.5,
                          }}
                        >
                          {services.map((s: any) => (
                            <MenuItem key={s.id} value={s.id} sx={{ fontSize: 12.5, fontWeight: 600 }}>
                              {s.serviceName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      {/* Quantity Stepper */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: 1.5,
                          bgcolor: '#F8FAFC',
                          px: 0.5,
                          height: 40,
                        }}
                      >
                        <Button
                          size="small"
                          onClick={() =>
                            setEditableItems((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item
                              )
                            )
                          }
                          sx={{ minWidth: 28, p: 0, fontWeight: 900, fontSize: 16, color: '#334155 !important' }}
                        >
                          −
                        </Button>
                        <Typography sx={{ px: 1.25, fontWeight: 900, fontSize: 14, color: '#0F172A !important' }}>
                          {row.quantity}
                        </Typography>
                        <Button
                          size="small"
                          onClick={() =>
                            setEditableItems((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, quantity: item.quantity + 1 } : item
                              )
                            )
                          }
                          sx={{ minWidth: 28, p: 0, fontWeight: 900, fontSize: 16, color: '#4F46E5 !important' }}
                        >
                          +
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Add Garment Row Button */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() =>
              setEditableItems((prev) => [
                ...prev,
                {
                  clothType: 'Shirt',
                  serviceId: editableItems[editableItems.length - 1]?.serviceId || defaultServiceId,
                  quantity: 1,
                  checked: true,
                },
              ])
            }
            sx={{
              mt: 1.5,
              py: 1,
              borderRadius: 2,
              borderStyle: 'dashed',
              borderWidth: 1.5,
              borderColor: '#4F46E5',
              color: '#4F46E5 !important',
              fontWeight: 800,
              textTransform: 'none',
              fontSize: 13,
              bgcolor: '#EEF2FF',
            }}
          >
            + Add Another Cloth / Garment (e.g. Shirt, Pant)
          </Button>

          {/* Optional Verification Note */}
          <TextField
            fullWidth
            size="small"
            label="Verification Note (Optional)"
            placeholder="e.g. Customer gave Shirt instead of T-Shirt, verified on pickup"
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            sx={{
              mt: 2,
              bgcolor: '#FFFFFF !important',
              borderRadius: 1.5,
              '& .MuiInputBase-root': { bgcolor: '#FFFFFF !important', color: '#0F172A !important', fontSize: 12.5 },
              '& .MuiInputBase-input': { color: '#0F172A !important', WebkitTextFillColor: '#0F172A !important' },
              '& .MuiInputLabel-root': { color: '#475569 !important', fontWeight: 700 },
            }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 2, py: 1.5, bgcolor: '#FFFFFF !important', borderTop: '1px solid #E2E8F0', gap: 1 }}>
          <Button
            onClick={() => setVerifyOpen(false)}
            disabled={savingClothes}
            sx={{
              flex: 1,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 700,
              color: '#475569 !important',
              bgcolor: '#F1F5F9',
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={savingClothes}
            onClick={handleSaveVerifiedClothes}
            sx={{
              flex: 1.6,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 900,
              fontSize: 13,
              bgcolor: '#10B981 !important',
              color: '#FFFFFF !important',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              '&:hover': { bgcolor: '#059669 !important' },
            }}
          >
            {savingClothes
              ? 'Approving...'
              : `✅ Approve (${editableItems.reduce((s, r) => s + (Number(r.quantity) || 0), 0)} Clothes)`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ── Delivery Card ────────────────────────────────────────────────────────────

const DeliveryCard: React.FC<{
  delivery: DeliveryAssignment;
  onAction: (id: number, status: string, remarks?: string, otp?: string, paymentMode?: string) => void;
  isLoading: boolean;
}> = ({ delivery, onAction, isLoading }) => {
  const [expanded, setExpanded] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ status: string; label: string } | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sentOtpCode, setSentOtpCode] = useState<string>('');
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [collectedPaymentMode, setCollectedPaymentMode] = useState<string>('Cash');

  const handleRequestOtp = async () => {
    setRequestingOtp(true);
    setOtpError('');
    try {
      const res = await requestDeliveryOtp(delivery.id);
      setOtpSent(true);
      if (res.otp) {
        setSentOtpCode(res.otp);
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
  const addrInfo = resolveDisplayAddress(delivery.order, customer, null);
  const address = addrInfo.fullAddress;

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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: 2,
                  background: isDone
                    ? 'linear-gradient(135deg, #9CA3AF, #6B7280)'
                    : 'linear-gradient(135deg, #F59E0B, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: isDone ? 'none' : '0 2px 6px rgba(245, 158, 11, 0.3)',
                }}
              >
                <LocalLaundryServiceIcon sx={{ color: '#fff', fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {/* 1. ORDER NUMBER (Displayed directly above Delivery #) */}
                <Typography sx={{ fontWeight: 900, fontSize: 15, color: isDone ? '#374151' : '#78350F', lineHeight: 1.2, mb: 0.25 }}>
                  Order #{delivery.order?.orderNumber || (delivery as any).orderNumber || `ORD-${String(delivery.orderId).padStart(5, '0')}`}
                </Typography>
                {/* 2. DELIVERY # and CUSTOMER PHONE */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontSize: 12, color: isDone ? '#4B5563' : '#D97706', fontWeight: 800 }}>
                    Delivery #{delivery.id}
                  </Typography>
                  {delivery.order?.customer?.mobileNumber && (
                    <>
                      <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>•</Typography>
                      <Typography sx={{ fontSize: 11, color: '#4B5563', fontWeight: 600 }}>
                        {delivery.order.customer.mobileNumber}
                      </Typography>
                    </>
                  )}
                </Box>
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
            {/* Prominent Order No + Order Status + Total Clothes Badge */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 0.75,
                px: 1.5,
                py: 1,
                mb: 1.5,
                bgcolor: '#FEF3C7',
                borderRadius: 2,
                border: '1.5px solid #F59E0B',
                boxShadow: '0 1px 3px rgba(245, 158, 11, 0.1)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#78350F' }}>
                  📦 Order:
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#D97706', letterSpacing: '0.5px' }}>
                  {delivery.order?.orderNumber || (delivery as any).orderNumber || `ORD-${String(delivery.orderId).padStart(5, '0')}`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexWrap: 'wrap' }}>
                {delivery.order?.orderStatus && (
                  <Chip
                    label={(orderStatusBadgeConfig[delivery.order.orderStatus]?.label) || delivery.order.orderStatus}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 10.5,
                      fontWeight: 800,
                      bgcolor: orderStatusBadgeConfig[delivery.order.orderStatus]?.bg || '#FDE68A',
                      color: orderStatusBadgeConfig[delivery.order.orderStatus]?.color || '#92400E',
                      border: `1px solid ${orderStatusBadgeConfig[delivery.order.orderStatus]?.border || '#F59E0B'}`,
                    }}
                  />
                )}
                <Chip
                  label={`🧺 ${getTotalClothesCount(delivery.order)} Clothes`}
                  size="small"
                  sx={{ height: 22, fontSize: 11, fontWeight: 900, bgcolor: '#D97706', color: '#FFFFFF' }}
                />
              </Box>
            </Box>

            {customer && (
              <>
                <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#111827', mb: 0.25 }}>
                  {customer.firstName} {customer.lastName}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 1 }}>
                  <LocationOnIcon sx={{ fontSize: 14, color: '#F59E0B', mt: 0.2, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    {addrInfo.title && (
                      <Chip
                        icon={<HomeIcon sx={{ fontSize: '11px !important' }} />}
                        label={addrInfo.title}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 800,
                          mr: 0.75,
                          mb: 0.25,
                          bgcolor: addrInfo.title.toLowerCase() === 'work' ? '#EEF2FF' : '#DCFCE7',
                          color: addrInfo.title.toLowerCase() === 'work' ? '#4338CA' : '#15803D',
                          border: addrInfo.title.toLowerCase() === 'work' ? '1px solid #C7D2FE' : '1px solid #BBF7D0',
                        }}
                      />
                    )}
                    <Typography component="span" sx={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>
                      {address || 'Address not specified'}
                    </Typography>
                  </Box>
                </Box>
              </>
            )}

            {/* Order items summary with full clothes count & service breakdown */}
            {delivery.order?.orderItems && delivery.order.orderItems.length > 0 && (
              <Box
                sx={{
                  mb: 1.25, p: 1.25,
                  bgcolor: '#FFFBEB', borderRadius: 2,
                  border: '1px solid #FDE68A',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    🧺 Clothes to Deliver ({getTotalClothesCount(delivery.order)} pcs)
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {delivery.order.orderItems.map((item, idx) => (
                    <Box
                      key={item.id || idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 1,
                        py: 0.5,
                        bgcolor: '#FFFFFF',
                        borderRadius: 1.25,
                        border: '1px solid #FDE68A',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#111827' }}>
                          {idx + 1}. {item.clothType}
                        </Typography>
                        {item.service?.serviceName && (
                          <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: '#D97706' }}>
                            {item.service.serviceName}
                          </Typography>
                        )}
                      </Box>
                      <Chip
                        label={`× ${item.quantity}`}
                        size="small"
                        sx={{ height: 20, fontSize: 11, fontWeight: 900, bgcolor: '#FEF3C7', color: '#92400E' }}
                      />
                    </Box>
                  ))}
                </Box>
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
                    : `Payment: ₹${delivery.order.netAmount ? delivery.order.netAmount.toFixed(2) : '0.00'}`}
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
      <Dialog
        open={!!confirmDialog}
        onClose={() => { setConfirmDialog(null); setOtpSent(false); setSentOtpCode(''); setEnteredOtp(''); setOtpError(''); }}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              bgcolor: '#FFFFFF !important',
              color: '#0F172A !important',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5, color: '#0F172A !important' }}>
          {confirmDialog?.label}
        </DialogTitle>
        <DialogContent sx={{ color: '#0F172A !important' }}>
          <Typography variant="body2" sx={{ color: '#475569 !important', mb: 2 }}>
            {confirmDialog?.status === 'Delivered'
              ? `Confirm that you have delivered Order #${delivery.order?.orderNumber || `ORD-${String(delivery.orderId).padStart(5, '0')}`} (Delivery #${delivery.id}) to ${customer?.firstName} ${customer?.lastName}?`
              : `Mark this delivery as failed? Order #${delivery.order?.orderNumber || `ORD-${String(delivery.orderId).padStart(5, '0')}`} will return to "Laundry" status.`}
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
                    💵 Payment Collection Required
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#92400E', fontWeight: 600, mb: 1.5 }}>
                    Please collect <strong>₹{delivery.order?.netAmount ? delivery.order.netAmount.toFixed(2) : '0.00'}</strong> from {customer?.firstName} {customer?.lastName}.
                  </Typography>

                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#78350F', display: 'block', mb: 0.5 }}>
                    Select Payment Mode Collected:
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={collectedPaymentMode}
                      onChange={(e) => setCollectedPaymentMode(e.target.value)}
                      MenuProps={{
                        slotProps: {
                          paper: {
                            sx: {
                              bgcolor: '#FFFFFF !important',
                              color: '#0F172A !important',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                              '& .MuiMenuItem-root': {
                                color: '#0F172A !important',
                                fontWeight: 600,
                                fontSize: 13,
                                '&:hover': { bgcolor: '#F1F5F9' },
                                '&.Mui-selected': { bgcolor: '#EEF2FF !important', color: '#4F46E5 !important', fontWeight: 800 },
                              },
                            },
                          },
                        },
                      }}
                      sx={{
                        bgcolor: '#FFFFFF !important',
                        color: '#0F172A !important',
                        fontWeight: 700,
                        fontSize: 13,
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#F59E0B' },
                      }}
                    >
                      <MenuItem value="Cash">💵 Paid in Cash</MenuItem>
                      <MenuItem value="GPay">📱 Paid in GPay (Google Pay)</MenuItem>
                      <MenuItem value="UPI">📱 Paid in UPI / QR Code</MenuItem>
                    </Select>
                  </FormControl>
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
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    py: 1.2,
                    background: 'linear-gradient(135deg, #4F46E5, #4338CA)',
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
                    '&:hover': { background: 'linear-gradient(135deg, #4338CA, #3730A3)' },
                  }}
                >
                  {requestingOtp ? <CircularProgress size={16} color="inherit" /> : '🔑 Send Verification OTP to Customer'}
                </Button>
              ) : (
                <Box>
                  <Box
                    sx={{
                      p: 1.5, mb: 2, bgcolor: '#ECFDF5', borderRadius: 2,
                      border: '1.5px solid #10B981',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#047857', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      ✅ OTP Sent to Customer!
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#065F46', lineHeight: 1.5 }}>
                      Delivery verification OTP has been sent via SMS to <strong>{customer?.mobileNumber}</strong> and Email to <strong>{(customer as any)?.email}</strong>.
                    </Typography>
                    {sentOtpCode && (
                      <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px dashed #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#065F46' }}>
                          🔑 Verification Code:
                        </Typography>
                        <Chip
                          label={sentOtpCode}
                          size="small"
                          sx={{
                            bgcolor: '#047857',
                            color: '#FFFFFF',
                            fontWeight: 900,
                            fontSize: 14,
                            letterSpacing: 2,
                            px: 1,
                          }}
                        />
                      </Box>
                    )}
                  </Box>

                  <Typography variant="body2" sx={{ fontWeight: 800, mb: 1, color: '#1E293B !important' }}>
                    Enter 6-digit Delivery OTP:
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Enter 6-digit OTP"
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    slotProps={{
                      input: {
                        style: {
                          color: '#0F172A',
                          backgroundColor: '#FFFFFF',
                          fontWeight: 900,
                          fontSize: 22,
                          textAlign: 'center',
                        },
                      },
                      htmlInput: {
                        style: {
                          color: '#0F172A',
                          WebkitTextFillColor: '#0F172A',
                          backgroundColor: '#FFFFFF',
                          fontWeight: 900,
                          fontSize: 22,
                          textAlign: 'center',
                          letterSpacing: '8px',
                        },
                      },
                    }}
                    sx={{
                      mb: 1.5,
                      bgcolor: '#FFFFFF !important',
                      borderRadius: 1.5,
                      '& .MuiInputBase-root': {
                        bgcolor: '#FFFFFF !important',
                        color: '#0F172A !important',
                      },
                      '& .MuiInputBase-input': {
                        color: '#0F172A !important',
                        WebkitTextFillColor: '#0F172A !important',
                        textAlign: 'center',
                        letterSpacing: '8px',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#94A3B8 !important',
                        borderWidth: '1.5px !important',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#4F46E5 !important',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#4F46E5 !important',
                        borderWidth: '2px !important',
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11, color: '#64748B' }}>
                      Customer provides OTP upon receiving clothes
                    </Typography>
                    <Button
                      size="small" variant="text"
                      disabled={requestingOtp}
                      onClick={handleRequestOtp}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, color: '#4F46E5' }}
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
          <Button onClick={() => { setConfirmDialog(null); setOtpSent(false); setSentOtpCode(''); setEnteredOtp(''); setOtpError(''); }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>No, Go Back</Button>
          <Button
            variant="contained"
            disabled={isLoading || (confirmDialog?.status === 'Delivered' && (!otpSent || enteredOtp.length !== 6))}
            onClick={() => {
              if (confirmDialog) {
                onAction(
                  delivery.id,
                  confirmDialog.status,
                  undefined,
                  enteredOtp || undefined,
                  delivery.order?.paymentStatus === 'Paid' ? undefined : collectedPaymentMode
                );
                setConfirmDialog(null);
                setOtpSent(false);
                setSentOtpCode('');
                setEnteredOtp('');
              }
            }}
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
  const { data: resolvedCatalog } = useQuery({
    queryKey: ['delivery-boy-catalog'],
    queryFn: () => api.get('/services/pricing/resolve').then((r) => r.data),
    staleTime: 60_000,
  });

  const activeServices = useMemo(() => {
    const list = resolvedCatalog?.services || [];
    if (Array.isArray(list) && list.length > 0) return list;
    return [
      { id: 1, serviceName: 'Press / Ironing' },
      { id: 2, serviceName: 'Dry Cleaning' },
      { id: 6, serviceName: 'Grivana Priority' },
    ];
  }, [resolvedCatalog]);

  const garmentCatalog = useMemo(() => {
    const prodNames = Array.isArray(resolvedCatalog?.products)
      ? resolvedCatalog.products.map((p: any) => p.productName).filter(Boolean)
      : [];
    return Array.from(new Set([...DEFAULT_GARMENT_TYPES, ...prodNames]));
  }, [resolvedCatalog]);

  const {
    data: rawPickups = [],
    isLoading: pickupsLoading,
    isFetching: pickupsFetching,
    refetch: refetchPickups,
  } = useQuery({
    queryKey: ['my-pickups'],
    queryFn: getMyPickupAssignments,
    refetchInterval: 3_000,               // Auto-poll every 3 seconds for instant real-time live sync
    refetchIntervalInBackground: true,    // Keep polling in background so updates arrive immediately
    refetchOnWindowFocus: 'always',       // Immediately refresh when switching back to tab
    staleTime: 0,                         // Always consider stale so refetch triggers immediate API call
  });

  const {
    data: rawDeliveries = [],
    isLoading: deliveriesLoading,
    isFetching: deliveriesFetching,
    refetch: refetchDeliveries,
  } = useQuery({
    queryKey: ['my-deliveries'],
    queryFn: getMyDeliveries,
    refetchInterval: 3_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    staleTime: 0,
  });

  // Deduplicate pickups: one active card per order
  const pickups = useMemo(() => {
    const map = new Map<string, PickupAssignment>();
    // Sort rawPickups: completed/cancelled first, then active so active replaces completed if same order
    const sorted = [...(rawPickups as PickupAssignment[])].sort((a, b) => {
      const aDone = a.status === 'Completed' || a.status === 'Cancelled' ? 0 : 1;
      const bDone = b.status === 'Completed' || b.status === 'Cancelled' ? 0 : 1;
      if (aDone !== bDone) return aDone - bDone;
      return a.id - b.id;
    });

    for (const p of sorted) {
      const dedupeKey = p.order?.id ? `order_${p.order.id}` : `pickup_${p.id}`;
      map.set(dedupeKey, p);
    }

    // Sort active ones first, followed by newest ID
    return Array.from(map.values()).sort((a, b) => {
      const aDone = a.status === 'Completed' || a.status === 'Cancelled' ? 1 : 0;
      const bDone = b.status === 'Completed' || b.status === 'Cancelled' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return b.id - a.id;
    });
  }, [rawPickups]);

  // Active heartbeat timer every 3 seconds to ensure polling never sleeps
  useEffect(() => {
    const liveTimer = setInterval(() => {
      refetchPickups();
      refetchDeliveries();
    }, 3_000);
    return () => clearInterval(liveTimer);
  }, [refetchPickups, refetchDeliveries]);

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
      d.order && ['Laundry', 'Processing', 'Washing', 'Dry Cleaning', 'Ironing', 'Ready For Delivery', 'Out For Delivery', 'Delivered'].includes(d.order.orderStatus)
    );
    const latestMap = new Map<number, any>();
    for (const d of filtered) {
      const existing = latestMap.get(d.orderId);
      if (!existing || d.id > existing.id) {
        latestMap.set(d.orderId, d);
      }
    }
    return Array.from(latestMap.values()).sort((a, b) => {
      const aActive = a.deliveryStatus === 'Pending' || a.deliveryStatus === 'OutForDelivery' ? 0 : 1;
      const bActive = b.deliveryStatus === 'Pending' || b.deliveryStatus === 'OutForDelivery' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return b.id - a.id;
    });
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
      const addrInfo = resolveDisplayAddress(p.order, cust, p.pickupAddress);
      const fullAddr = addrInfo.fullAddress.toLowerCase();
      const pin = (addrInfo.pincode || '').toLowerCase();
      const orderNum = (p.order?.orderNumber || (p as any).orderNumber || '').toLowerCase();
      const pickupIdStr = String(p.id);
      const shopName = (p.order?.laundryShop?.shopName || '').toLowerCase();
      const shopPincode = (p.order?.laundryShop?.pincode || '').toLowerCase();
      const status = (p.status || '').toLowerCase();

      return firstName.includes(query) ||
             lastName.includes(query) ||
             `${firstName} ${lastName}`.includes(query) ||
             mobile.includes(query) ||
             fullAddr.includes(query) ||
             pin.includes(query) ||
             orderNum.includes(query) ||
             pickupIdStr.includes(query) ||
             shopName.includes(query) ||
             shopPincode.includes(query) ||
             status.includes(query);
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
      const addrInfo = resolveDisplayAddress(order, cust, null);
      const fullAddr = addrInfo.fullAddress.toLowerCase();
      const pin = (addrInfo.pincode || '').toLowerCase();
      const orderNum = (order?.orderNumber || '').toLowerCase();
      const deliveryIdStr = String(d.id);
      const shopName = (order?.laundryShop?.shopName || '').toLowerCase();
      const shopPincode = (order?.laundryShop?.pincode || '').toLowerCase();
      const status = (d.deliveryStatus || '').toLowerCase();

      return firstName.includes(query) ||
             lastName.includes(query) ||
             `${firstName} ${lastName}`.includes(query) ||
             mobile.includes(query) ||
             fullAddr.includes(query) ||
             pin.includes(query) ||
             orderNum.includes(query) ||
             deliveryIdStr.includes(query) ||
             shopName.includes(query) ||
             shopPincode.includes(query) ||
             status.includes(query);
    });
  }, [deliveries, searchQuery]);

  // Mutations
  const pickupMutation = useMutation({
    mutationFn: ({ id, status, laundryShopId }: { id: number; status: string; laundryShopId?: number }) =>
      updateMyPickupStatus(id, status, laundryShopId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['my-pickups'] });
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['pickups'] });
      setToast({
        msg: variables.laundryShopId
          ? 'Pickup completed & Order moved to Laundry!'
          : 'Pickup status updated!',
        severity: 'success',
      });
    },
    onError: () => setToast({ msg: 'Failed to update. Try again.', severity: 'error' }),
  });

  const deliveryMutation = useMutation({
    mutationFn: ({ id, status, remarks, otp, paymentMode }: { id: number; status: string; remarks?: string; otp?: string; paymentMode?: string }) =>
      updateMyDeliveryStatus(id, status, remarks, otp, paymentMode),
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

  const checkForUpdatedBundle = useCallback(async (): Promise<boolean> => {
    try {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const currentSrc = scripts
        .map((s) => s.getAttribute('src') || '')
        .find((src) => /assets\/index-[A-Za-z0-9_-]+\.js/.test(src));
      const currentBundle = currentSrc ? extractScriptBundleName(currentSrc) : null;
      if (!currentBundle) return false;

      const res = await fetch(`/admin/index.html?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (!res.ok) return false;
      const html = await res.text();
      const latestBundle = extractScriptBundleName(html);
      if (latestBundle && latestBundle !== currentBundle) {
        window.location.reload();
        return true;
      }
    } catch {
      // Ignore transient offline errors
    }
    return false;
  }, []);

  useEffect(() => {
    void checkForUpdatedBundle();
    const versionTimer = setInterval(() => {
      void checkForUpdatedBundle();
    }, 30_000);
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdatedBundle();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      clearInterval(versionTimer);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [checkForUpdatedBundle]);

  const handleRefresh = useCallback(() => {
    void checkForUpdatedBundle();
    refetchPickups();
    refetchDeliveries();
    setToast({ msg: 'Refreshing...', severity: 'success' });
  }, [checkForUpdatedBundle, refetchPickups, refetchDeliveries]);

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
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehaviorY: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          px: 2,
          pt: 2,
          pb: '120px',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#CBD5E1',
            borderRadius: '3px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#94A3B8',
          },
        }}
      >

        {/* Search Bar */}
        {activeTab !== 'profile' && (
          <TextField
            fullWidth
            size="small"
            placeholder="🔍 Search customer, phone, address, shop, or order #..."
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
                ) : null,
                sx: {
                  color: '#0F172A !important',
                  fontWeight: 600,
                  fontSize: 14,
                  '& input': {
                    color: '#0F172A !important',
                    WebkitTextFillColor: '#0F172A !important',
                  },
                },
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
            ) : (() => {
              const activeList = filteredPickups.filter(p => p.status === 'Pending' || p.status === 'Assigned');
              const doneList = filteredPickups.filter(p => p.status === 'Completed' || p.status === 'Cancelled');
              return (
                <>
                  {activeList.map((pickup) => (
                    <PickupCard
                      key={pickup.id}
                      pickup={pickup}
                      laundryShops={laundryShops}
                      services={activeServices}
                      garmentCatalog={garmentCatalog}
                      onAction={(id, status, shopId) => pickupMutation.mutate({ id, status, laundryShopId: shopId })}
                      onClothesVerified={(msg) => setToast({ msg, severity: 'success' })}
                      isLoading={pickupMutation.isPending}
                    />
                  ))}
                  {doneList.length > 0 && (
                    <Box sx={{ mt: 3, mb: 1.5 }}>
                      <Divider sx={{ mb: 2 }}>
                        <Chip
                          label={`Completed Pickups (${doneList.length})`}
                          size="small"
                          sx={{ fontSize: 11, fontWeight: 800, bgcolor: '#F3F4F6', color: '#6B7280' }}
                        />
                      </Divider>
                      {doneList.map((pickup) => (
                        <PickupCard
                          key={pickup.id}
                          pickup={pickup}
                          laundryShops={laundryShops}
                          services={activeServices}
                          garmentCatalog={garmentCatalog}
                          onAction={(id, status, shopId) => pickupMutation.mutate({ id, status, laundryShopId: shopId })}
                          onClothesVerified={(msg) => setToast({ msg, severity: 'success' })}
                          isLoading={pickupMutation.isPending}
                        />
                      ))}
                    </Box>
                  )}
                </>
              );
            })()}
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
            ) : (() => {
              const activeDeliveries = filteredDeliveries.filter(d => d.deliveryStatus === 'Pending' || d.deliveryStatus === 'OutForDelivery');
              const doneDeliveries = filteredDeliveries.filter(d => d.deliveryStatus === 'Delivered' || d.deliveryStatus === 'Failed');
              return (
                <>
                  {activeDeliveries.map((delivery) => (
                    <DeliveryCard
                      key={delivery.id}
                      delivery={delivery}
                      onAction={(id, status, remarks, otp, paymentMode) => deliveryMutation.mutate({ id, status, remarks, otp, paymentMode })}
                      isLoading={deliveryMutation.isPending}
                    />
                  ))}
                  {doneDeliveries.length > 0 && (
                    <Box sx={{ mt: 3, mb: 1.5 }}>
                      <Divider sx={{ mb: 2 }}>
                        <Chip
                          label={`Completed Deliveries (${doneDeliveries.length})`}
                          size="small"
                          sx={{ fontSize: 11, fontWeight: 800, bgcolor: '#F3F4F6', color: '#6B7280' }}
                        />
                      </Divider>
                      {doneDeliveries.map((delivery) => (
                        <DeliveryCard
                          key={delivery.id}
                          delivery={delivery}
                          onAction={(id, status, remarks, otp, paymentMode) => deliveryMutation.mutate({ id, status, remarks, otp, paymentMode })}
                          isLoading={deliveryMutation.isPending}
                        />
                      ))}
                    </Box>
                  )}
                </>
              );
            })()}
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
