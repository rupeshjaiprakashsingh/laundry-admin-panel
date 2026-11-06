import type { OrderItemInfo } from '../../api/deliveryBoy';

export interface InlineGarmentRow {
  key: string;
  id?: number;
  clothType: string;
  serviceId: number;
  serviceName: string;
  unitPrice?: number;
  orderedQty: number;
  physicalQty: number;
  matched: boolean;
}

export function buildInlineGarmentRows(
  orderItems: OrderItemInfo[] | undefined | null,
  defaultServiceId: number,
  defaultServiceName = 'Laundry Service',
): InlineGarmentRow[] {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return [];
  }

  return orderItems.map((item, idx) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const resolvedServiceId = Number(item.serviceId || item.service?.id || defaultServiceId || 1);
    const resolvedServiceName = item.service?.serviceName || defaultServiceName;
    return {
      key: `${item.id ?? 'row'}_${idx}_${item.clothType}_${resolvedServiceId}`,
      id: item.id,
      clothType: item.clothType || 'Garment',
      serviceId: resolvedServiceId,
      serviceName: resolvedServiceName,
      unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : undefined,
      orderedQty: qty,
      physicalQty: qty,
      matched: false,
    };
  });
}

export function getItemsSignature(orderItems: OrderItemInfo[] | undefined | null): string {
  if (!Array.isArray(orderItems) || orderItems.length === 0) return 'empty';
  return orderItems
    .map((i) => `${i.id ?? ''}:${i.clothType}:${i.serviceId ?? i.service?.id ?? ''}:${i.quantity}`)
    .join('|');
}

export function hasPhysicalAdjustments(rows: InlineGarmentRow[]): boolean {
  return rows.some((r) => r.physicalQty !== r.orderedQty);
}

export function getPhysicalClothesSummary(rows: InlineGarmentRow[]) {
  let orderedTotal = 0;
  let physicalTotal = 0;
  let matchedRows = 0;
  let missingTotal = 0;
  let extraTotal = 0;
  const serviceMap = new Map<string, number>();

  for (const r of rows) {
    orderedTotal += r.orderedQty;
    physicalTotal += r.physicalQty;
    if (r.matched) matchedRows += 1;
    if (r.physicalQty < r.orderedQty) {
      missingTotal += r.orderedQty - r.physicalQty;
    } else if (r.physicalQty > r.orderedQty) {
      extraTotal += r.physicalQty - r.orderedQty;
    }
    if (r.physicalQty > 0) {
      const sName = r.serviceName || 'Laundry Service';
      serviceMap.set(sName, (serviceMap.get(sName) || 0) + r.physicalQty);
    }
  }

  const serviceBreakdown = Array.from(serviceMap.entries()).map(([serviceName, count]) => ({
    serviceName,
    count,
  }));

  return {
    orderedTotal,
    physicalTotal,
    matchedRows,
    totalRows: rows.length,
    missingTotal,
    extraTotal,
    serviceBreakdown,
  };
}

export function toVerifyOrderPayload(
  rows: InlineGarmentRow[],
  defaultServiceId: number,
): Array<{ clothType: string; serviceId: number; quantity: number }> {
  return rows
    .filter((r) => r.clothType.trim().length > 0 && r.physicalQty > 0)
    .map((r) => ({
      clothType: r.clothType.trim(),
      serviceId: Number(r.serviceId || defaultServiceId || 1),
      quantity: Number(r.physicalQty),
    }));
}

export function extractScriptBundleName(html: string): string | null {
  if (!html) return null;
  const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  return match ? match[1] : null;
}
