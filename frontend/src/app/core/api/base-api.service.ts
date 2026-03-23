import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { lastValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../services/toast.service';

/**
 * Common shape for all NduthiRide API responses (provided by NestJS ResponseInterceptor)
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

/**
 * Secure Base API class providing helper methods for HTTP requests
 * using try-catch blocks and async/await as requested.
 */
@Injectable({ providedIn: 'root' })
export class BaseApiService {
  protected readonly http  = inject(HttpClient);
  protected readonly toast = inject(ToastService);
  protected readonly apiUrl = environment.apiUrl;

  /**
   * Generic request wrapper to handle try-catch and ApiResponse extraction
   */
  protected async request<T>(obs: Observable<ApiResponse<T>>): Promise<T> {
    try {
      const res = await lastValueFrom(obs);
      if (!res.success) {
        throw new Error('API request reported failure');
      }
      return res.data;
    } catch (error: any) {
      // Errors are already intercepted by GlobalErrorInterceptor for UI toasts,
      // but we log them here for service-level security/audit.
      console.error('[API Error]:', error);

      // Re-throw so the calling component can handle local UI state (e.g. loading = false)
      throw error;
    }
  }

  protected get<T>(path: string, params?: HttpParams): Promise<T> {
    return this.request(this.http.get<ApiResponse<T>>(`${this.apiUrl}${path}`, { params }));
  }

  protected post<T>(path: string, body: any): Promise<T> {
    return this.request(this.http.post<ApiResponse<T>>(`${this.apiUrl}${path}`, body));
  }

  protected patch<T>(path: string, body: any): Promise<T> {
    return this.request(this.http.patch<ApiResponse<T>>(`${this.apiUrl}${path}`, body));
  }

  protected delete<T>(path: string): Promise<T> {
    return this.request(this.http.delete<ApiResponse<T>>(`${this.apiUrl}${path}`));
  }
}
