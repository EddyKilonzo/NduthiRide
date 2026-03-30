import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { Role } from '../models/auth.models';

/** Allows only specific roles. Expects route data: { roles: Role[] }. */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  const allowed = route.data['roles'] as Role[];
  const userRole = auth.role();

  if (userRole && allowed.includes(userRole)) return true;
  return router.createUrlTree(['/auth/login']);
};
