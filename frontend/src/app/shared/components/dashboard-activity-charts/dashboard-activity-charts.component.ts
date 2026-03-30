import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { SpinnerComponent } from '../spinner/spinner.component';
import type { DayBucket } from '../../utils/activity-buckets.util';

export interface ActivityChartsCopy {
  amount7d: string;
  jobsLabel: string;
  avgLabel: string;
  rideShareLabel: string;
  dailyAmountTitle: string;
}

interface BarSpec {
  label: string;
  ride: { x: number; y: number; w: number; h: number };
  parcel: { x: number; y: number; w: number; h: number };
  labelX: number;
}

@Component({
  selector: 'app-dashboard-activity-charts',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SpinnerComponent],
  template: `
    <section class="dashboard-section activity-charts-root">
      <div class="section-header-flex">
        <h2 class="section-title section-title--flush">
          <lucide-icon name="pie-chart" [size]="18"></lucide-icon>
          {{ sectionTitle() }}
        </h2>
        @if (chartsLoading()) {
          <span class="chart-loading"><app-spinner /></span>
        }
      </div>

      <div class="analysis-grid">
        <div class="analysis-card modern-shadow analysis-card--revenue">
          <span class="analysis-card__icon-wrap">
            <lucide-icon name="banknote" [size]="20" class="analysis-card__icon"></lucide-icon>
          </span>
          <span class="analysis-card__label">{{ copy().amount7d }}</span>
          <strong class="analysis-card__value">KES {{ analysis().weekAmount | number:'1.0-0' }}</strong>
        </div>
        <div class="analysis-card modern-shadow analysis-card--jobs">
          <span class="analysis-card__icon-wrap">
            <lucide-icon name="layers" [size]="20" class="analysis-card__icon"></lucide-icon>
          </span>
          <span class="analysis-card__label">{{ copy().jobsLabel }}</span>
          <strong class="analysis-card__value">{{ analysis().weekJobs }}</strong>
        </div>
      </div>

      <div class="charts-grid">
        <div class="card chart-card modern-shadow">
          <div class="chart-card__head">
            <h3>Daily volume</h3>
            <div class="chart-legend">
              <span class="legend-item"><span class="dot rides"></span> Rides</span>
              <span class="legend-item"><span class="dot parcels"></span> Parcels</span>
            </div>
          </div>
          <div class="chart-svg-wrap">
            @if (barSpecs().length === 0 && !chartsLoading()) {
              <div class="chart-empty">
                <span class="chart-empty__text">No activity data yet</span>
              </div>
            } @else {
              <svg viewBox="0 0 340 150" class="performance-chart" preserveAspectRatio="xMidYMid meet">
                @for (g of yGridLines(); track $index) {
                  <line [attr.x1]="36" [attr.y1]="g" x2="328" [attr.y2]="g" class="chart-grid-line" />
                }
                @for (b of barSpecs(); track $index) {
                  <rect [attr.x]="b.ride.x" [attr.y]="b.ride.y" [attr.width]="b.ride.w" [attr.height]="b.ride.h" class="bar bar-ride" rx="3" />
                  <rect [attr.x]="b.parcel.x" [attr.y]="b.parcel.y" [attr.width]="b.parcel.w" [attr.height]="b.parcel.h" class="bar bar-parcel" rx="3" />
                  <text [attr.x]="b.labelX" y="142" class="chart-label">{{ b.label }}</text>
                }
              </svg>
            }
          </div>
        </div>

        <div class="card chart-card modern-shadow">
          <div class="chart-card__head">
            <h3>{{ copy().dailyAmountTitle }}</h3>
            <span class="chart-sub">KES</span>
          </div>
          <div class="chart-svg-wrap chart-svg-wrap--line">
            <svg viewBox="0 0 340 150" class="performance-chart" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="var(--clr-primary)" stop-opacity="0.45" />
                  <stop offset="100%" stop-color="var(--clr-primary)" stop-opacity="0" />
                </linearGradient>
              </defs>
              @for (g of lineYGrid(); track $index) {
                <line [attr.x1]="28" [attr.y1]="g.y" x2="312" [attr.y2]="g.y" class="chart-grid-line" />
                <text x="4" [attr.y]="g.y + 4" class="chart-axis-label">{{ g.label }}</text>
              }
              @if (amountLine().areaD && !chartsLoading()) {
                <path [attr.d]="amountLine().areaD" [attr.fill]="'url(#' + gradientId() + ')'" class="chart-area-fill" />
                <path [attr.d]="amountLine().lineD" class="chart-line-path" fill="none" />
              }
              @for (p of amountLine().points; track $index) {
                <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" class="chart-dot" />
                <text [attr.x]="p.x" y="146" class="chart-label chart-label--dot">{{ p.label }}</text>
              }
            </svg>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .activity-charts-root {
      margin-top: 0;
      background: linear-gradient(180deg, rgba(64,138,113,0.06), transparent 22%);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg);
      padding: 20px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--clr-text);
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0.9;
    }
    .section-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .section-title--flush { margin-bottom: 0; }
    .chart-loading { display: flex; align-items: center; min-height: 28px; }
    .chart-loading app-spinner { transform: scale(0.75); }
    .modern-shadow { box-shadow: var(--shadow-card); }
    .card {
      background: var(--clr-bg-card);
      border-radius: var(--radius-lg);
      border: 1px solid var(--clr-border);
    }
    .analysis-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 24px;
      width: 100%;
    }
    .analysis-card {
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      border-left-width: 4px;
      border-radius: var(--radius-lg);
      padding: 18px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      box-shadow: var(--shadow-card);
    }
    .analysis-card__icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      box-shadow: var(--shadow-card);
      margin-bottom: 2px;
    }
    .analysis-card__icon { color: var(--clr-primary); opacity: 0.95; }
    .analysis-card--revenue { border-color: color-mix(in srgb, var(--clr-primary-dark) 55%, var(--clr-border)); }
    .analysis-card--jobs { border-color: color-mix(in srgb, var(--clr-primary) 55%, var(--clr-border)); }
    .analysis-card--avg { border-color: color-mix(in srgb, var(--clr-primary-light) 75%, var(--clr-border)); }
    .analysis-card--mix { border-color: color-mix(in srgb, var(--clr-primary) 45%, var(--clr-border)); }
    .analysis-card--revenue .analysis-card__icon-wrap { border-color: color-mix(in srgb, var(--clr-primary-dark) 50%, var(--clr-border)); }
    .analysis-card--jobs .analysis-card__icon-wrap { border-color: color-mix(in srgb, var(--clr-primary) 50%, var(--clr-border)); }
    .analysis-card--avg .analysis-card__icon-wrap { border-color: color-mix(in srgb, var(--clr-primary-light) 70%, var(--clr-border)); }
    .analysis-card--mix .analysis-card__icon-wrap { border-color: color-mix(in srgb, var(--clr-primary) 40%, var(--clr-border)); }
    .analysis-card__label {
      font-size: 11px;
      font-weight: 600;
      color: var(--clr-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .analysis-card__value {
      font-size: 18px;
      font-weight: 800;
      font-family: var(--font-display);
      color: var(--clr-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mix-bar {
      height: 6px;
      border-radius: 3px;
      background: var(--clr-bg-elevated);
      overflow: hidden;
      margin-top: 4px;
    }
    .mix-bar__rides {
      height: 100%;
      background: linear-gradient(90deg, var(--clr-primary), var(--clr-primary-dark));
      border-radius: 3px;
      transition: width 0.4s ease;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 24px;
    }
    .chart-card { padding: 20px 20px 12px; }
    .chart-card__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .chart-card__head h3 {
      font-size: 14px;
      font-weight: 700;
      color: var(--clr-text);
    }
    .chart-sub { font-size: 11px; font-weight: 600; color: var(--clr-text-muted); }
    .chart-svg-wrap {
      width: 100%;
      min-height: 160px;
      aspect-ratio: 340 / 150;
      max-height: 220px;
      position: relative;
    }
    .chart-empty {
      width: 100%; height: 100%; min-height: 160px;
      display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg-elevated); border-radius: var(--radius-md);
      border: 1px dashed var(--clr-border);
    }
    .chart-empty__text { font-size: 13px; color: var(--clr-text-muted); }
    .chart-svg-wrap--line { min-height: 170px; }
    .performance-chart { width: 100%; height: 100%; display: block; overflow: visible; }
    .chart-grid-line {
      stroke: var(--clr-border);
      stroke-width: 1;
      stroke-dasharray: 4;
      opacity: 0.85;
    }
    .bar { transition: height 0.45s ease, y 0.45s ease; }
    .bar-ride { fill: var(--clr-primary); opacity: 0.88; }
    .bar-parcel { fill: var(--clr-primary-dark); opacity: 0.88; }
    .chart-label {
      fill: var(--clr-text-muted);
      font-size: 9px;
      font-weight: 600;
      text-anchor: middle;
    }
    .chart-label--dot { font-size: 8px; }
    .chart-axis-label { fill: var(--clr-text-dim); font-size: 8px; font-weight: 600; }
    .chart-line-path {
      stroke: var(--clr-primary);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .chart-dot { fill: var(--clr-bg-card); stroke: var(--clr-primary); stroke-width: 2; }
    .chart-legend { display: flex; gap: 16px; }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: var(--clr-text-muted);
    }
    .legend-item .dot { width: 8px; height: 8px; border-radius: 50%; }
    .legend-item .dot.rides { background: var(--clr-primary); }
    .legend-item .dot.parcels { background: var(--clr-primary-dark); }
    @media (max-width: 900px) {
      .charts-grid { grid-template-columns: 1fr; }
      .analysis-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 768px) {
      .section-header-flex { flex-wrap: wrap; gap: 12px; }
      .analysis-grid { grid-template-columns: 1fr; }
      .activity-charts-root { padding: 14px; }
    }
  `],
})
export class DashboardActivityChartsComponent {
  readonly chartSeries = input<DayBucket[]>([]);
  readonly chartsLoading = input(false);
  /** Unique per instance — referenced by SVG fill */
  readonly gradientId = input('activity-area-grad');
  readonly sectionTitle = input('Performance & analysis');
  readonly copy = input<ActivityChartsCopy>({
    amount7d: '7-day revenue',
    jobsLabel: 'Jobs completed',
    avgLabel: 'Avg. per job',
    rideShareLabel: 'Ride share',
    dailyAmountTitle: 'Daily earnings',
  });

  protected readonly analysis = computed(() => {
    const s = this.chartSeries();
    const weekJobs = s.reduce((a, d) => a + d.rides + d.parcels, 0);
    const weekRides = s.reduce((a, d) => a + d.rides, 0);
    const weekAmount = s.reduce((a, d) => a + d.amount, 0);
    const avgPerJob = weekJobs ? weekAmount / weekJobs : 0;
    const rideSharePct = weekJobs ? (100 * weekRides) / weekJobs : 0;
    return { weekJobs, weekRides, weekAmount, avgPerJob, rideSharePct };
  });

  protected readonly yGridLines = computed(() => {
    const padT = 14;
    const plotH = 150 - padT - 34;
    return [0, 1, 2, 3].map((i) => padT + (i / 3) * plotH);
  });

  protected readonly barSpecs = computed((): BarSpec[] => {
    const s = this.chartSeries();
    if (s.length === 0) return [];
    const maxV = Math.max(1, ...s.map((d) => Math.max(d.rides, d.parcels)));
    const W = 340;
    const padL = 36;
    const padR = 12;
    const padB = 34;
    const padT = 14;
    const plotW = W - padL - padR;
    const plotH = 150 - padT - padB;
    const n = s.length;
    const slot = plotW / n;
    const bw = Math.min(15, slot * 0.3);
    const gap = Math.max(4, slot * 0.14);
    const base = padT + plotH;
    return s.map((d, i) => {
      const cx = padL + (i + 0.5) * slot;
      const rideH = (d.rides / maxV) * plotH;
      const parcelH = (d.parcels / maxV) * plotH;
      return {
        label: d.label,
        ride: { x: cx - bw - gap / 2, y: base - rideH, w: bw, h: rideH },
        parcel: { x: cx + gap / 2, y: base - parcelH, w: bw, h: parcelH },
        labelX: cx,
      };
    });
  });

  protected readonly amountLine = computed(() => {
    const s = this.chartSeries();
    const W = 340;
    const H = 150;
    const padL = 28;
    const padR = 28;
    const padB = 38;
    const padT = 16;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxA = Math.max(1, ...s.map((d) => d.amount));
    if (s.length === 0) {
      return { lineD: '', areaD: '', points: [] as { x: number; y: number; label: string }[], maxA: 1 };
    }
    const points = s.map((d, i) => {
      const x = padL + (s.length === 1 ? plotW / 2 : (i / (s.length - 1)) * plotW);
      const y = padT + plotH - (d.amount / maxA) * plotH;
      return { x, y, label: d.label };
    });
    const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const last = points[points.length - 1];
    const first = points[0];
    const baseY = padT + plotH;
    const areaD = `${lineD} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
    return { lineD, areaD, points, maxA };
  });

  protected readonly lineYGrid = computed(() => {
    const maxA = this.amountLine().maxA;
    const padT = 16;
    const plotH = 150 - padT - 38;
    const ticks = 3;
    const rows: { y: number; label: string }[] = [];
    for (let i = 0; i <= ticks; i++) {
      const frac = i / ticks;
      const val = maxA * (1 - frac);
      const y = padT + frac * plotH;
      const label = val >= 1000 ? `${Math.round(val / 1000)}k` : `${Math.round(val)}`;
      rows.push({ y, label });
    }
    return rows;
  });
}
