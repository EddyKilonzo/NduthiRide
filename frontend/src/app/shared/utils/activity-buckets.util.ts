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

/** Use completion/delivery timestamps when present so charts reflect real activity dates. */
export function ridesAndParcelsToActivityPoints(rides: Ride[], parcels: Parcel[]): ActivityPoint[] {
  const out: ActivityPoint[] = [];
  for (const r of rides) {
    out.push({
      dateIso: r.completedAt ?? r.createdAt,
      kind: 'ride',
      amount: r.estimatedFare,
    });
  }
  for (const p of parcels) {
    out.push({
      dateIso: p.deliveredAt ?? p.createdAt,
      kind: 'parcel',
      amount: p.deliveryFee,
    });
  }
  return out;
}
