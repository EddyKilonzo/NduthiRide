import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Shape of every successful API response.
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Global response interceptor.
 * Wraps every successful controller return value in:
 * { success: true, data: <original payload> }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    // Provider webhooks and binary receipts must not be wrapped in { success, data }.
    if (
      path.includes('payments/lipana/webhook') ||
      /\/payments\/[^/]+\/receipt\/?$/i.test(path)
    ) {
      return next.handle() as Observable<ApiResponse<T>>;
    }
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
