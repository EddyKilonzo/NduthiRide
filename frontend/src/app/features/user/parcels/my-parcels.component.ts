import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-my-parcels',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div><h1>My Parcels</h1><p>Your delivery history</p></div>
        <a [routerLink]="['/user/book-parcel']" class="btn btn--primary btn--sm">+ Send Parcel</a>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (parcels().length === 0) {
        <div class="empty-state">
          <div class="empty-illu" aria-hidden="true"><lucide-icon name="package" [size]="44"></lucide-icon></div>
          <h3>No parcels yet</h3>
          <p>Your delivery history will appear here</p>
        </div>
      } @else {
        <div class="parcels-grid">
          @for (p of parcels(); track p.id) {
            <div class="card parcel-card" [routerLink]="['/user/parcels', p.id]">
              <div class="parcel-card__header">
                <span class="badge badge--{{ badge(p.status) }}">{{ p.status }}</span>
                <span class="parcel-card__date">{{ p.createdAt | date:'dd MMM, HH:mm' }}</span>
              </div>
              
              <div class="parcel-card__content">
                <div class="parcel-card__item">
                  <lucide-icon name="package" [size]="18" class="text-primary"></lucide-icon>
                  <span class="item-desc">{{ p.itemDescription }}</span>
                </div>
                <div class="parcel-card__recipient">
                  <lucide-icon name="user" [size]="16" class="text-dim"></lucide-icon>
                  <span>To: {{ p.recipientName }}</span>
                </div>
              </div>

              <div class="parcel-card__footer">
                <div class="parcel-card__fee">KES {{ p.deliveryFee | number:'1.0-0' }}</div>
                <div class="parcel-card__action">
                  <span>Track Parcel</span>
                  <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
                </div>
              </div>
            </div>
          }
        </div>

        @if (totalPages() > 1) {
          <div class="pagination">
            <button class="btn btn--secondary btn--sm" (click)="prevPage()" [disabled]="page() === 1"><lucide-icon name="chevron-left" [size]="16"></lucide-icon> Prev</button>
            <span class="text-muted">Page {{ page() }} of {{ totalPages() }}</span>
            <button class="btn btn--secondary btn--sm" (click)="nextPage()" [disabled]="page() === totalPages()">Next <lucide-icon name="chevron-right" [size]="16"></lucide-icon></button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .parcels-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
      gap: 20px; 
    }
    .parcel-card { 
      padding: 16px; 
      cursor: pointer; 
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border: 1px solid var(--clr-border);
      box-shadow: rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
    }
    .parcel-card:hover { 
      transform: translateY(-4px); 
      box-shadow: var(--shadow-lg); 
      border-color: var(--clr-primary);
    }
    .parcel-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .parcel-card__date {
      font-size: 0.85rem;
      color: var(--clr-text-dim);
    }
    .parcel-card__content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .parcel-card__item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
    }
    .item-desc {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .parcel-card__recipient {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 0.9rem;
      color: var(--clr-text-dim);
    }
    .parcel-card__footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--clr-border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .parcel-card__fee {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--clr-primary);
    }
    .parcel-card__action {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--clr-text-dim);
    }
    .empty-illu { display: flex; justify-content: center; color: var(--clr-text-dim); opacity: 0.45; margin-bottom: 8px; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 32px; flex-wrap: wrap; }
    .text-primary { color: var(--clr-primary); }
    .text-dim { color: var(--clr-text-dim); }
  `],
})
export class MyParcelsComponent implements OnInit {
  private readonly parcelService = inject(ParcelService);
  protected readonly parcels    = signal<Parcel[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    void this.parcelService.getMyParcels(this.page(), 15).then((res) => {
      this.parcels.set(res.data);
      this.totalPages.set(res.totalPages);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  protected prevPage(): void { this.page.update((p) => p - 1); this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); this.load(); }
  protected badge(status: string): string {
    const m: Record<string,string> = { PENDING:'pending', DELIVERED:'active', CANCELLED:'closed' };
    return m[status] ?? 'info';
  }
}
