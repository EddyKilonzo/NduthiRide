import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Redirects already-authenticated users away from login/register. */
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuth()) return true;

  const role = auth.role();
  if (!role) return router.createUrlTree(['/auth/login']);
  if (role === 'ADMIN')  return router.createUrlTree(['/admin']);
  if (role === 'RIDER')  return router.createUrlTree(['/rider']);
  return router.createUrlTree(['/user']);
};
