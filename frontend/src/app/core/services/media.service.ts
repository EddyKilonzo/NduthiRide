import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly http = inject(HttpClient);

  /**
   * Uploads an image to Cloudinary using Unsigned Uploads.
   * Secure async/await pattern with try-catch.
   */
  async uploadImage(file: File): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', environment.cloudinaryPreset);

      const res = await lastValueFrom(
        this.http.post<any>(
          `https://api.cloudinary.com/v1_1/${environment.cloudinaryCloudName}/image/upload`,
          formData
        )
      );

      return res.secure_url;
    } catch (error) {
      console.error('Cloudinary upload failed:', error);
      throw new Error('Failed to upload image. Please try again.');
    }
  }
}
