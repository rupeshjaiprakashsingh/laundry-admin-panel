import React from 'react';
import { Chip } from '@mui/material';

export interface PaymentResolution {
  isPaid: boolean;
  resolvedMode: string;
  displayLabel: string;
  badgeType: 'upi' | 'gpay' | 'online' | 'card' | 'credits' | 'cash' | 'pending';
}

/**
 * Resolves raw payment mode & notes into normalized payment information.
 * Ensures online/gateway payments (Razorpay, UPI, GPay, etc.) NEVER fall back to Cash!
 */
export function resolvePaymentInfo(
  paymentStatus?: string,
  paymentMode?: string,
  notes?: string
): PaymentResolution {
  let mode = paymentMode?.trim();

  // If mode not directly present, check notes
  if (!mode && notes) {
    const lower = notes.toLowerCase();
    if (lower.includes('gpay') || lower.includes('google pay')) mode = 'GPay';
    else if (lower.includes('razorpay')) mode = 'UPI (Razorpay)';
    else if (lower.includes('upi') || lower.includes('qr')) mode = 'UPI';
    else if (lower.includes('credit') || lower.includes('wallet')) mode = 'Credits';
    else if (lower.includes('cash') || lower.includes('cod')) mode = 'Cash';
    else if (lower.includes('online')) mode = 'Online';
    else if (lower.includes('card')) mode = 'Card';
  }

  const isPaid = paymentStatus === 'Paid' || paymentStatus === 'Completed';
  const lowerMode = (mode || '').toLowerCase();

  let resolvedMode = 'Pending';
  let displayLabel = '⏳ Pending';
  let badgeType: PaymentResolution['badgeType'] = 'pending';

  if (lowerMode.includes('gpay') || lowerMode.includes('google pay')) {
    resolvedMode = 'GPay';
    displayLabel = isPaid ? '📱 Paid in GPay' : '⏳ Pending (GPay)';
    badgeType = 'gpay';
  } else if (lowerMode.includes('razorpay')) {
    resolvedMode = 'UPI (Razorpay)';
    displayLabel = isPaid ? '📱 Paid in UPI (Razorpay)' : '⏳ Pending (UPI)';
    badgeType = 'upi';
  } else if (lowerMode.includes('upi') || lowerMode.includes('qr')) {
    resolvedMode = 'UPI';
    displayLabel = isPaid ? '📱 Paid in UPI' : '⏳ Pending (UPI)';
    badgeType = 'upi';
  } else if (lowerMode.includes('online')) {
    resolvedMode = 'Online';
    displayLabel = isPaid ? '🌐 Paid Online' : '⏳ Pending (Online)';
    badgeType = 'online';
  } else if (lowerMode.includes('card')) {
    resolvedMode = 'Card';
    displayLabel = isPaid ? '💳 Paid by Card' : '⏳ Pending (Card)';
    badgeType = 'card';
  } else if (lowerMode.includes('credit')) {
    resolvedMode = 'Credits';
    displayLabel = isPaid ? '🎁 Paid with Credits' : '⏳ Pending (Credits)';
    badgeType = 'credits';
  } else if (lowerMode.includes('cash') || lowerMode.includes('cod') || lowerMode.includes('pay on delivery')) {
    resolvedMode = 'Cash';
    displayLabel = isPaid ? '💵 Paid in Cash' : '⏳ Pending (Cash)';
    badgeType = 'cash';
  } else if (mode) {
    resolvedMode = mode;
    displayLabel = isPaid ? `Paid in ${mode}` : `⏳ Pending (${mode})`;
    badgeType = isPaid ? 'online' : 'pending';
  } else {
    resolvedMode = isPaid ? 'Cash' : 'Pending';
    displayLabel = isPaid ? '💵 Paid in Cash' : '⏳ Pending';
    badgeType = isPaid ? 'cash' : 'pending';
  }

  return { isPaid, resolvedMode, displayLabel, badgeType };
}

/**
 * Renders consistent, styled MUI Chip for any payment state.
 */
export function renderPaymentChip(
  paymentStatus?: string,
  paymentMode?: string,
  notes?: string,
  options?: { size?: 'small' | 'medium'; fontSize?: number }
): React.ReactElement {
  const { isPaid, displayLabel, badgeType } = resolvePaymentInfo(paymentStatus, paymentMode, notes);
  const size = options?.size || 'small';
  const fontSize = options?.fontSize;

  if (paymentStatus === 'Partially Paid') {
    return (
      <Chip
        label="⚠️ Partially Paid"
        size={size}
        sx={{ fontWeight: 800, bgcolor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', fontSize }}
      />
    );
  }

  if (isPaid) {
    switch (badgeType) {
      case 'gpay':
        return (
          <Chip
            label={displayLabel}
            size={size}
            sx={{ fontWeight: 800, bgcolor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', fontSize }}
          />
        );
      case 'upi':
        return (
          <Chip
            label={displayLabel}
            size={size}
            sx={{ fontWeight: 800, bgcolor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF', fontSize }}
          />
        );
      case 'online':
        return (
          <Chip
            label={displayLabel}
            size={size}
            sx={{ fontWeight: 800, bgcolor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize }}
          />
        );
      case 'card':
        return (
          <Chip
            label={displayLabel}
            size={size}
            sx={{ fontWeight: 800, bgcolor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC', fontSize }}
          />
        );
      case 'credits':
        return (
          <Chip
            label={displayLabel}
            size={size}
            sx={{ fontWeight: 800, bgcolor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize }}
          />
        );
      case 'cash':
      default:
        return (
          <Chip
            label={displayLabel}
            size={size}
            sx={{ fontWeight: 800, bgcolor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontSize }}
          />
        );
    }
  }

  // Pending
  return (
    <Chip
      label={displayLabel}
      size={size}
      sx={{ fontWeight: 700, bgcolor: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', fontSize }}
    />
  );
}

/**
 * Checks whether a resolved payment mode is considered an online / UPI payment.
 */
export function isUpiOrOnlineMode(mode?: string): boolean {
  if (!mode) return false;
  const lower = mode.toLowerCase();
  return (
    lower.includes('upi') ||
    lower.includes('razorpay') ||
    lower.includes('gpay') ||
    lower.includes('google pay') ||
    lower.includes('online') ||
    lower.includes('card')
  );
}
