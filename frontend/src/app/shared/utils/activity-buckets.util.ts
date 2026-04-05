import type { Parcel } from '../../core/models/parcel.models';
import type { Ride } from '../../core/models/ride.models';

/** One local calendar day in the 7-day chart window */
export interface DayBucket {
  label: string;
  dateKey: string;
  rides: number;
  parcels: number;
  /** Rider: earnings; customer: spend */
  amount: number;
}

export interface ActivityPoint {
  dateIso: string;
  kind: 'ride' | 'parcel';
  amount: number;
}

export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function localDayKey(iso: string): string {
  return dateKeyFromDate(new Date(iso));
}

/**
 * Last 7 local days as buckets; `prevWeekTotal` is the sum of `amount` for the 7 days before that window.
 */
export function buildWeeklyChartBuckets(points: ActivityPoint[]): {
  current: DayBucket[];
  prevWeekTotal: number;
} {
  const current: DayBucket[] = [];
  let prevWeekTotal = 0;
  for (let off = 13; off >= 0; off--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - off);
    const key = dateKeyFromDate(d);
    const dayPoints = points.filter((p) => localDayKey(p.dateIso) === key);
    const rides = dayPoints.filter((p) => p.kind === 'ride').length;
    const parcels = dayPoints.filter((p) => p.kind === 'parcel').length;
    const amount = dayPoints.reduce((s, p) => s + p.amount, 0);
    if (off >= 7) prevWeekTotal += amount;
    if (off < 7) {
      current.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dateKey: key,
        rides,
        parcels,
        amount,
      });
    }
  }
  return { current, prevWeekTotal };
}

/**
 * One chart point for a ride. Uses completed M-Pesa payment amount + `completedAt` when present
 * so dashboard charts match actual settlements; otherwise fare + trip completion time.
 */
export function activityPointFromRide(r: Ride): ActivityPoint {
  const mpesaPaid =
    r.paymentMethod === 'MPESA' &&
    r.payment?.status === 'COMPLETED' &&
    typeof r.payment.amount === 'number';
  if (mpesaPaid) {
    return {
      dateIso: r.payment!.completedAt ?? r.completedAt ?? r.createdAt,
      kind: 'ride',
      amount: r.payment!.amount,
    };
  }
  return {
    dateIso: r.completedAt ?? r.createdAt,
    kind: 'ride',
    amount: r.finalFare ?? r.estimatedFare,
  };
}

/** Same as {@link activityPointFromRide} for parcel deliveries. */
export function activityPointFromParcel(p: Parcel): ActivityPoint {
  const mpesaPaid =
    p.paymentMethod === 'MPESA' &&
    p.payment?.status === 'COMPLETED' &&
    typeof p.payment.amount === 'number';
  if (mpesaPaid) {
    return {
      dateIso: p.payment!.completedAt ?? p.deliveredAt ?? p.createdAt,
      kind: 'parcel',
      amount: p.payment!.amount,
    };
  }
  return {
    dateIso: p.deliveredAt ?? p.createdAt,
    kind: 'parcel',
    amount: p.deliveryFee,
  };
}

/** Builds chart points from completed / delivered history lists. */
export function ridesAndParcelsToActivityPoints(rides: Ride[], parcels: Parcel[]): ActivityPoint[] {
  return [
    ...rides.map((r) => activityPointFromRide(r)),
    ...parcels.map((p) => activityPointFromParcel(p)),
  ];
}
