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
        <div class="card table-wrapper data-card">
          <table>
            <thead>
              <tr><th>Description</th><th>Recipient</th><th>Status</th><th>Fee</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              @for (p of parcels(); track p.id) {
                <tr>
                  <td class="addr">{{ p.itemDescription }}</td>
                  <td>{{ p.recipientName }}</td>
                  <td><span class="badge badge--{{ badge(p.status) }}">{{ p.status }}</span></td>
                  <td>KES {{ p.deliveryFee | number:'1.0-0' }}</td>
                  <td>{{ p.createdAt | date:'dd MMM, HH:mm' }}</td>
                  <td><a [routerLink]="['/user/parcels', p.id]" class="btn btn--ghost btn--sm">View</a></td>
                </tr>
              }
            </tbody>
          </table>
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
    .data-card { box-shadow: var(--shadow-card); padding: 0; overflow: hidden; }
    .empty-illu { display: flex; justify-content: center; color: var(--clr-text-dim); opacity: 0.45; margin-bottom: 8px; }
    .addr { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
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
