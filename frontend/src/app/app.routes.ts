import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { authGuard }  from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard }  from './core/guards/role.guard';
import { AuthService } from './core/services/auth.service';

import { ShellComponent }           from './features/shell/shell.component';
import { LandingPageComponent }     from './features/landing/landing-page.component';

// Auth
import { LoginComponent }           from './features/auth/login/login.component';
import { RegisterComponent }        from './features/auth/register/register.component';
import { RegisterRiderComponent }   from './features/auth/register-rider/register-rider.component';

// User
import { UserHomeComponent }        from './features/user/home/user-home.component';
import { BookRideComponent }        from './features/user/book-ride/book-ride.component';
import { BookParcelComponent }      from './features/user/book-parcel/book-parcel.component';
import { MyRidesComponent }         from './features/user/rides/my-rides.component';
import { RideDetailComponent }      from './features/user/rides/ride-detail.component';
import { MyParcelsComponent }       from './features/user/parcels/my-parcels.component';
import { ParcelDetailComponent }    from './features/user/parcels/parcel-detail.component';
import { UserProfileComponent }     from './features/user/profile/user-profile.component';

// Rider
import { RiderDashboardComponent }  from './features/rider/dashboard/rider-dashboard.component';
import { RiderActiveComponent }     from './features/rider/active/rider-active.component';
import { RiderHistoryComponent }    from './features/rider/history/rider-history.component';
import { RiderEarningsComponent }   from './features/rider/earnings/rider-earnings.component';
import { RiderProfileComponent }    from './features/rider/profile/rider-profile.component';

// Admin
import { AdminDashboardComponent }  from './features/admin/dashboard/admin-dashboard.component';
import { AdminAccountsComponent }   from './features/admin/accounts/admin-accounts.component';
import { AdminRidesComponent }      from './features/admin/rides/admin-rides.component';
import { AdminParcelsComponent }    from './features/admin/parcels/admin-parcels.component';
import { AdminPaymentsComponent }   from './features/admin/payments/admin-payments.component';

export const routes: Routes = [

  // ── Landing Page (unauthenticated only) ─────────────────────────────────
  {
    path: '',
    component: LandingPageComponent,
    pathMatch: 'full',
    canActivate: [guestGuard]
  },

  // ── Auth (unauthenticated only) ─────────────────────────────────────────
  {
    path: 'auth',
    children: [
      { path: '',               redirectTo: 'login', pathMatch: 'full' },
      { path: 'login',          component: LoginComponent,        canActivate: [guestGuard] },
      { path: 'register',       component: RegisterComponent,     canActivate: [guestGuard] },
      { path: 'register-rider', component: RegisterRiderComponent, canActivate: [guestGuard] },
    ],
  },

  // ── User shell ──────────────────────────────────────────────────────────
  {
    path: 'user',
    component: ShellComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['USER'] },
    children: [
      { path: '',            component: UserHomeComponent },
      { path: 'book-ride',   component: BookRideComponent },
      { path: 'book-parcel', component: BookParcelComponent },
      { path: 'rides',       component: MyRidesComponent },
      { path: 'rides/:id',   component: RideDetailComponent },
      { path: 'parcels',     component: MyParcelsComponent },
      { path: 'parcels/:id', component: ParcelDetailComponent },
      { path: 'profile',     component: UserProfileComponent },
    ],
  },

  // ── Rider shell ─────────────────────────────────────────────────────────
  {
    path: 'rider',
    component: ShellComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['RIDER'] },
    children: [
      { path: '',         component: RiderDashboardComponent },
      { path: 'active',   component: RiderActiveComponent },
      { path: 'history',  component: RiderHistoryComponent },
      { path: 'earnings', component: RiderEarningsComponent },
      { path: 'profile',  component: RiderProfileComponent },
    ],
  },

  // ── Admin shell ─────────────────────────────────────────────────────────
  {
    path: 'admin',
    component: ShellComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    children: [
      { path: '',          component: AdminDashboardComponent },
      { path: 'accounts',  component: AdminAccountsComponent },
      { path: 'rides',     component: AdminRidesComponent },
      { path: 'parcels',   component: AdminParcelsComponent },
      { path: 'payments',  component: AdminPaymentsComponent },
    ],
  },

  // ── Fallback ────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
