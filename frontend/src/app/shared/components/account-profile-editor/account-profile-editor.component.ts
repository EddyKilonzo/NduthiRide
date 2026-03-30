import { Component, OnInit, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { MediaService } from '../../../core/services/media.service';
import { ToastService } from '../../../core/services/toast.service';
import type { AccountProfile, UpdateProfileRequest } from '../../../core/api/users.api';
import { SpinnerComponent } from '../spinner/spinner.component';

const KE_PHONE = /^(\+254|0)(7|1)\d{8}$/;
const MAX_AVATAR_BYTES = Math.floor(2 * 1024 * 1024);
const AVATAR_MAX_DIM = 512;
const JPEG_QUALITY = 0.88;

function isSafeAvatarSrc(url: string): boolean {
  const u = url.trim().toLowerCase();
  return (
    u.startsWith('https://') ||
    u.startsWith('http://') ||
    u.startsWith('data:image/') ||
    u.startsWith('/')
  );
}

@Component({
  selector: 'app-account-profile-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="editor">
      @if (loading()) {
        <div class="editor-loading"><app-spinner /></div>
      } @else {
        <div class="profile-hero">
          <div class="avatar-wrap">
            @if (avatarPreview(); as src) {
              <img [src]="src" alt="" class="avatar-img" />
            } @else {
              <div class="avatar-lg">{{ initial() }}</div>
            }
          </div>
          <input
            #fileInput
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/webp,image/gif"
            [disabled]="processingImage()"
            (change)="onPhotoSelected($event)"
          />
          <div class="avatar-actions">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              [disabled]="processingImage()"
              (click)="fileInput.click()"
            >
              @if (processingImage()) {
                <app-spinner [size]="14" />
              } @else {
                <lucide-icon name="image-plus" [size]="14"></lucide-icon>
              }
              Change photo
            </button>
            @if (showRemovePhoto()) {
              <button type="button" class="btn btn--ghost btn--sm" (click)="removePhoto()">Remove</button>
            }
          </div>
          <p class="profile-name">{{ form.controls.fullName.value || auth.user()?.fullName }}</p>
          <span class="badge badge--info">{{ auth.user()?.role }}</span>
        </div>

        <form [formGroup]="form" (ngSubmit)="saveProfile()" novalidate class="editor-form">
          <div class="form-group">
            <label for="acc-pf-name">Full name</label>
            <input
              id="acc-pf-name"
              class="form-control"
              formControlName="fullName"
              autocomplete="name"
              [attr.aria-invalid]="form.controls.fullName.invalid && form.controls.fullName.touched"
            />
            @if (form.controls.fullName.invalid && form.controls.fullName.touched) {
              <span class="form-error">Enter your name (2–120 characters)</span>
            }
          </div>
          <div class="form-group">
            <label for="acc-pf-phone">Phone</label>
            <input
              id="acc-pf-phone"
              class="form-control"
              formControlName="phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              [attr.aria-invalid]="form.controls.phone.invalid && form.controls.phone.touched"
            />
            @if (form.controls.phone.invalid && form.controls.phone.touched) {
              <span class="form-error">Use a valid Kenyan number (07… or +254…)</span>
            }
          </div>
          <p class="form-footnote">
            Photos are resized for upload (max {{ AVATAR_MAX_DIM }}px). JPEG/PNG/WebP/GIF up to 2 MB.
          </p>
          <button type="submit" class="btn btn--primary" [disabled]="saving() || form.invalid">
            @if (saving()) {
              <app-spinner [size]="16" />
            } @else {
              Save changes
            }
          </button>
        </form>
      }
    </div>
  `,
  styles: [`
    .editor { display: flex; flex-direction: column; gap: 22px; }
    .editor-loading { display: flex; justify-content: center; padding: 32px; }
    .profile-hero {
      display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;
    }
    .avatar-wrap {
      width: 88px; height: 88px; border-radius: 50%; overflow: hidden;
      background: var(--clr-bg-elevated);
      border: 2px solid var(--clr-border);
    }
    .avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .avatar-lg {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; font-weight: 700; color: #fff;
      background: var(--clr-primary);
    }
    .avatar-actions {
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    }
    .profile-name { font-size: 18px; font-weight: 700; color: var(--clr-text); }
    .editor-form .form-group { margin-bottom: 16px; }
    .form-footnote {
      font-size: 12px; color: var(--clr-text-dim); margin: -4px 0 16px; line-height: 1.45;
    }
  `],
})
export class AccountProfileEditorComponent implements OnInit {
  protected readonly AVATAR_MAX_DIM = AVATAR_MAX_DIM;

  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly mediaService = inject(MediaService);

  readonly profileLoaded = output<AccountProfile>();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly processingImage = signal(false);

  /**
   * `undefined` = use server avatar only;
   * `null` = user chose remove (save sends avatarUrl: null);
   * `string` = new data URL preview to show.
   */
  protected readonly avatarDraft = signal<string | null | undefined>(undefined);
  private readonly newFile = signal<File | null>(null);

  protected readonly avatarPreview = computed(() => {
    const draft = this.avatarDraft();
    if (draft !== undefined && draft !== null) {
      return draft;
    }
    if (draft === null) {
      return null;
    }
    const url = this.auth.user()?.avatarUrl;
    if (!url || !isSafeAvatarSrc(url)) {
      return null;
    }
    return url;
  });

  protected readonly showRemovePhoto = computed(() => {
    const draft = this.avatarDraft();
    if (draft !== undefined && draft !== null) {
      return true;
    }
    if (draft === null) {
      return false;
    }
    const url = this.auth.user()?.avatarUrl;
    return !!(url && isSafeAvatarSrc(url));
  });

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    phone: ['', [Validators.required, Validators.pattern(KE_PHONE)]],
  });

  ngOnInit(): void {
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.loading.set(true);
    try {
      const p = await this.auth.fetchAccountProfile();
      this.auth.updateUser({
        id: p.id,
        phone: p.phone,
        email: p.email ?? undefined,
        fullName: p.fullName,
        avatarUrl: p.avatarUrl,
        role: p.role,
        isActive: p.isActive,
      });
      this.form.patchValue({ fullName: p.fullName, phone: p.phone });
      this.avatarDraft.set(undefined);
      this.newFile.set(null);
      this.profileLoaded.emit(p);
    } catch {
      const u = this.auth.user();
      if (u) this.form.patchValue({ fullName: u.fullName, phone: u.phone });
    } finally {
      this.loading.set(false);
    }
  }

  protected initial(): string {
    const name = this.form.controls.fullName.value || this.auth.user()?.fullName;
    return name?.charAt(0).toUpperCase() ?? '?';
  }

  protected async onPhotoSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.warning('Choose an image file');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.toast.warning('Photo must be 2 MB or smaller');
      return;
    }
    this.processingImage.set(true);
    try {
      const dataUrl = await this.imageToJpegDataUrl(file);
      this.avatarDraft.set(dataUrl);
      this.newFile.set(file);
    } catch {
      this.toast.error('Could not process that image — try another file');
    } finally {
      this.processingImage.set(false);
    }
  }

  /** Resize + JPEG so payload stays small and DB/API stay reliable. */
  private async imageToJpegDataUrl(file: File): Promise<string> {
    try {
      const bitmap = await createImageBitmap(file);
      let w = bitmap.width;
      let h = bitmap.height;
      if (w > AVATAR_MAX_DIM || h > AVATAR_MAX_DIM) {
        if (w >= h) {
          h = Math.round((h * AVATAR_MAX_DIM) / w);
          w = AVATAR_MAX_DIM;
        } else {
          w = Math.round((w * AVATAR_MAX_DIM) / h);
          h = AVATAR_MAX_DIM;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('no canvas');
      }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      const out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      if (!out.startsWith('data:image/jpeg')) {
        throw new Error('encode');
      }
      return out;
    } catch {
      return this.readFileAsDataUrl(file);
    }
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result;
        if (typeof r === 'string') {
          resolve(r);
        } else {
          reject(new Error('read'));
        }
      };
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
  }

  protected removePhoto(): void {
    this.avatarDraft.set(null);
    this.newFile.set(null);
  }

  protected async saveProfile(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: UpdateProfileRequest = {
      fullName: v.fullName.trim(),
      phone: v.phone,
    };
    
    const draft = this.avatarDraft();
    const fileToUpload = this.newFile();

    if (draft === null) {
      body.avatarUrl = null;
    } else if (draft !== undefined && fileToUpload) {
      try {
        this.toast.info('Uploading photo...');
        body.avatarUrl = await this.mediaService.uploadImage(fileToUpload);
      } catch (error) {
        this.toast.error('Cloudinary upload failed. Using compressed image instead.');
        body.avatarUrl = draft;
      }
    }

    try {
      const p = await this.auth.updateProfile(body);
      this.avatarDraft.set(undefined);
      this.newFile.set(null);
      this.toast.success('Profile updated');
      this.profileLoaded.emit(p);
    } finally {
      this.saving.set(false);
    }
  }
}
