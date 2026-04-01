import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError, catchError, retry, timer } from 'rxjs';
import { ToastService } from '../services/toast.service';

/**
 * Global error interceptor to handle HTTP errors across all API calls.
 * Displays user-friendly error messages using ToastService.
 * Automatically retries 504 Gateway Timeout errors (Render cold start) up to 2 times.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    retry({
      count: 2,
      delay: (error, retryCount) => {
        if (error instanceof HttpErrorResponse && error.status === 504) {
          toast.info(`Server is starting up, please wait... (attempt ${retryCount + 1}/3)`);
          return timer(6000);
        }
        return throwError(() => error);
      },
    }),
    catchError((error: unknown) => {
      let errorMessage = 'An unexpected error occurred';

      if (error instanceof HttpErrorResponse) {
        if (error.status === 504) {
          errorMessage = 'Server is unavailable. Please try again in a moment.';
        } else if (error.error && typeof error.error.message === 'string') {
          errorMessage = error.error.message;
        } else if (error.error && Array.isArray(error.error.message)) {
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

      console.error('[API Error]:', error);
      return throwError(() => error);
    }),
  );
};
