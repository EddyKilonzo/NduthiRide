import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../api/base-api.service';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly http = inject(HttpClient);

  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await lastValueFrom(
      this.http.post<ApiResponse<{ url: string }>>(`${environment.apiUrl}/media/upload`, formData)
    );

    return res.data.url;
  }
}
