import { inject } from '@angular/core';
import { Routes } from '@angular/router';

import { authGuard }         from './core/guards/auth.guard';
import { guestGuard }        from './core/guards/guest.guard';
import { roleGuard }         from './core/guards/role.guard';
import { riderProfileGuard } from './core/guards/rider-profile.guard';
import { AuthService } from './core/services/auth.service';

import { ShellComponent }           from './features/shell/shell.component';
import { LandingPageComponent }     from './features/landing/landing-page.component';
import { PublicLayoutComponent }    from './shared/components/layouts/public-layout.component';

// Auth
import { LoginComponent }             from './features/auth/login/login.component';
import { RegisterComponent }          from './features/auth/register/register.component';
import { RegisterRiderComponent }     from './features/auth/register-rider/register-rider.component';
import { VerifyEmailComponent }       from './features/auth/verify-email/verify-email.component';
import { ForgotPasswordComponent }    from './features/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent }     from './features/auth/reset-password/reset-password.component';

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
import { RiderDashboardComponent }      from './features/rider/dashboard/rider-dashboard.component';
import { RiderActiveComponent }         from './features/rider/active/rider-active.component';
import { RiderHistoryComponent }        from './features/rider/history/rider-history.component';
import { RiderEarningsComponent }       from './features/rider/earnings/rider-earnings.component';
import { RiderProfileComponent }        from './features/rider/profile/rider-profile.component';
import { RiderVerifyDetailsComponent }  from './features/rider/verify-details/rider-verify-details.component';

// Chat
import { ChatComponent } from './features/chat/chat.component';

// Notifications
import { NotificationsComponent } from './features/notifications/notifications.component';

// Support
import { SupportComponent } from './features/support/support.component';

// Admin
import { AdminDashboardComponent }  from './features/admin/dashboard/admin-dashboard.component';
import { AdminAccountsComponent }   from './features/admin/accounts/admin-accounts.component';
import { AdminRidesComponent }      from './features/admin/rides/admin-rides.component';
import { AdminParcelsComponent }    from './features/admin/parcels/admin-parcels.component';
import { AdminPaymentsComponent }   from './features/admin/payments/admin-payments.component';
import { AdminPayoutsComponent }    from './features/admin/payouts/admin-payouts.component';
import { AdminSettingsComponent }   from './features/admin/settings/admin-settings.component';
import { AdminAuditLogsComponent }  from './features/admin/audit-logs/admin-audit-logs.component';
import { AdminProfileComponent }    from './features/admin/profile/admin-profile.component';
import { AdminSupportComponent }    from './features/admin/support/admin-support.component';


export const routes: Routes = [

  // ── Public pages (landing + auth) — shared nav/footer layout ────────────
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        component: LandingPageComponent,
        pathMatch: 'full',
        canActivate: [guestGuard],
      },
      {
        path: 'auth',
        children: [
          { path: '',                redirectTo: 'login', pathMatch: 'full' },
          { path: 'login',           component: LoginComponent,           canActivate: [guestGuard] },
          { path: 'register',        component: RegisterComponent,        canActivate: [guestGuard] },
          { path: 'register-rider',  component: RegisterRiderComponent,   canActivate: [guestGuard] },
          { path: 'verify-email',    component: VerifyEmailComponent },
          { path: 'forgot-password', component: ForgotPasswordComponent,  canActivate: [guestGuard] },
          { path: 'reset-password',  component: ResetPasswordComponent,   canActivate: [guestGuard] },
        ],
      },
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
      { path: 'notifications', component: NotificationsComponent },
      { path: 'support',       component: SupportComponent },
      { path: 'chat',          component: ChatComponent },
      { path: 'chat/ride/:rideId',   component: ChatComponent },
      { path: 'chat/parcel/:parcelId', component: ChatComponent },
    ],
  },

  // ── Rider: profile completion (standalone, no shell) ────────────────────
  {
    path: 'rider/verify-details',
    component: RiderVerifyDetailsComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['RIDER'] },
  },

  // ── Rider shell ─────────────────────────────────────────────────────────
  {
    path: 'rider',
    component: ShellComponent,
    canActivate: [authGuard, roleGuard, riderProfileGuard],
    data: { roles: ['RIDER'] },
    children: [
      { path: '',         component: RiderDashboardComponent },
      { path: 'active',   component: RiderActiveComponent },
      { path: 'history',  component: RiderHistoryComponent },
      { path: 'earnings', component: RiderEarningsComponent },
      { path: 'profile',  component: RiderProfileComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'support',       component: SupportComponent },
      { path: 'chat',          component: ChatComponent },
      { path: 'chat/ride/:rideId',   component: ChatComponent },
      { path: 'chat/parcel/:parcelId', component: ChatComponent },
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
      { path: 'payouts',   component: AdminPayoutsComponent },
      { path: 'settings',  component: AdminSettingsComponent },
      { path: 'audit-logs', component: AdminAuditLogsComponent },
      { path: 'profile',   component: AdminProfileComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'support',       component: AdminSupportComponent },
    ],
  },

  // ── Fallback ────────────────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
