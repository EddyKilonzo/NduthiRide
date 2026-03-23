import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Global error interceptor to handle HTTP errors across all API calls.
 * Displays user-friendly error messages using ToastService.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      let errorMessage = 'An unexpected error occurred';

      if (error instanceof HttpErrorResponse) {
        // Handle server-side errors
        if (error.error && typeof error.error.message === 'string') {
          errorMessage = error.error.message;
        } else if (error.error && Array.isArray(error.error.message)) {
          // Handle NestJS validation errors which are often arrays
          errorMessage = error.error.message.join(', ');
        } else if (error.status === 0) {
          errorMessage = 'Could not connect to the server. Please check your internet connection.';
        } else {
          errorMessage = error.statusText || errorMessage;
        }

        // We skip 401 as it is handled by the authInterceptor (token refresh)
        if (error.status !== 401) {
          toast.error(errorMessage);
        }
      }

      console.error('API Error:', error);
      return throwError(() => error);
    }),
  );
};
