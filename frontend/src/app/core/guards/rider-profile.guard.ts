import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RidersApi } from '../api/riders.api';

/**
 * Blocks rider shell routes until the rider has filled in their bike details.
 * Redirects to /rider/verify-details if bikeModel, bikeRegistration, or licenseNumber is missing.
 */
export const riderProfileGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ridersApi = inject(RidersApi);

  if (auth.role() !== 'RIDER') return true;

  try {
    const profile = await ridersApi.getMyProfile();
    const isSet = (v: string | null | undefined) => !!v && v !== 'To be provided';
    const isComplete = isSet(profile.bikeModel) && isSet(profile.bikeRegistration) && isSet(profile.licenseNumber);
    if (isComplete) return true;
    return router.createUrlTree(['/rider/verify-details']);
  } catch {
    return router.createUrlTree(['/rider/verify-details']);
  }
};
