import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError, switchMap, from } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Skip auth for Cloudinary uploads (unsigned uploads don't need auth)
  if (req.url.includes('cloudinary.com')) {
    return next(req);
  }

  const token = auth.getAccessToken();
  const retryHeader = req.headers.get('x-auth-retried');
  const authed = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
          ...(retryHeader ? { 'x-auth-retried': retryHeader } : {}),
        },
      })
    : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // Skip retry for auth endpoints to prevent infinite loops
        if (
          req.url.includes('/auth/login') ||
          req.url.includes('/auth/logout') ||
          req.url.includes('/auth/refresh') ||
          req.url.includes('/auth/password/change')
        ) {
          return throwError(() => err);
        }

        // Avoid infinite refresh/retry loops. Retry each request at most once.
        if (authed.headers.get('x-auth-retried') === '1') {
          auth.logout();
          void router.navigate(['/auth/login']);
          return throwError(() => err);
        }

        // Attempt a token refresh once
        return from(auth.refresh()).pipe(
          switchMap(() => {
            const newToken = auth.getAccessToken();
            const retried = newToken
              ? req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${newToken}`,
                    'x-auth-retried': '1',
                  },
                })
              : req;
            return next(retried);
          }),
          catchError(() => {
            auth.logout();
            void router.navigate(['/auth/login']);
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
