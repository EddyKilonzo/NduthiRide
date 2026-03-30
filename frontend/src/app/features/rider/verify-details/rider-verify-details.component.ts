import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RidersApi } from '../../../core/api/riders.api';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { MediaService } from '../../../core/services/media.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

type ImageField = 'licenseImageUrl' | 'idFrontImageUrl' | 'idBackImageUrl' | 'logbookImageUrl';

@Component({
  selector: 'app-rider-verify-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="verify-page">
      <div class="verify-card">
        <div class="verify-header">
          <div class="verify-icon">
            <lucide-icon name="bike" [size]="32"></lucide-icon>
          </div>
          <h1>Complete Your Rider Profile</h1>
          <p>Fill in your details and upload your documents, then review before submitting.</p>
        </div>

        @if (loadingProfile()) {
          <div class="loader-wrap"><app-spinner /></div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="verify-form">

            <!-- Licence -->
            <div class="form-section">
              <h3 class="section-label">
                <lucide-icon name="file-text" [size]="15"></lucide-icon>
                Licence Information
              </h3>
              <div class="field">
                <label for="licenseNumber">Driving Licence Number</label>
                <input
                  id="licenseNumber"
                  formControlName="licenseNumber"
                  type="text"
                  placeholder="e.g. DL123456"
                  [class.has-error]="f['licenseNumber'].invalid && f['licenseNumber'].touched"
                />
                @if (f['licenseNumber'].invalid && f['licenseNumber'].touched) {
                  <span class="field-error">Licence number is required</span>
                }
              </div>
              <div class="field">
                <label>Licence Document Photo</label>
                <div class="upload-box" [class.uploaded]="previews()['licenseImageUrl']"
                     (click)="!previews()['licenseImageUrl'] && licenseInput.click()">
                  <input #licenseInput type="file" hidden (change)="upload($event, 'licenseImageUrl')" accept="image/*">
                  @if (uploading()['licenseImageUrl']) {
                    <app-spinner />
                  } @else if (previews()['licenseImageUrl']) {
                    <img [src]="previews()['licenseImageUrl']" class="thumb" alt="Licence" />
                    <div class="upload-done-row">
                      <span class="upload-ok"><lucide-icon name="check-circle" [size]="13"></lucide-icon>Uploaded</span>
                      <div class="upload-actions">
                        <button type="button" class="btn-view" (click)="openLightbox(previews()['licenseImageUrl']); $event.stopPropagation()">
                          <lucide-icon name="eye" [size]="12"></lucide-icon>View
                        </button>
                        <button type="button" class="btn-retake" (click)="licenseInput.click(); $event.stopPropagation()">
                          <lucide-icon name="refresh-cw" [size]="12"></lucide-icon>Retake
                        </button>
                      </div>
                    </div>
                  } @else {
                    <lucide-icon name="camera"></lucide-icon>
                    <span>Click to upload photo</span>
                  }
                </div>
                @if (f['licenseImageUrl'].invalid && f['licenseImageUrl'].touched) {
                  <span class="field-error">Licence photo is required</span>
                }
              </div>
            </div>

            <!-- ID Card -->
            <div class="form-section">
              <h3 class="section-label">
                <lucide-icon name="user" [size]="15"></lucide-icon>
                National Identity Card
              </h3>
              <div class="upload-grid">
                <div class="field">
                  <label>ID Front</label>
                  <div class="upload-box upload-box--sm" [class.uploaded]="previews()['idFrontImageUrl']"
                       (click)="!previews()['idFrontImageUrl'] && idFrontInput.click()">
                    <input #idFrontInput type="file" hidden (change)="upload($event, 'idFrontImageUrl')" accept="image/*">
                    @if (uploading()['idFrontImageUrl']) {
                      <app-spinner />
                    } @else if (previews()['idFrontImageUrl']) {
                      <img [src]="previews()['idFrontImageUrl']" class="thumb thumb--sm" alt="ID Front" />
                      <div class="upload-actions upload-actions--sm">
                        <button type="button" class="btn-view btn-view--sm" (click)="openLightbox(previews()['idFrontImageUrl']); $event.stopPropagation()">
                          <lucide-icon name="eye" [size]="11"></lucide-icon>View
                        </button>
                        <button type="button" class="btn-retake btn-retake--sm" (click)="idFrontInput.click(); $event.stopPropagation()">
                          <lucide-icon name="refresh-cw" [size]="11"></lucide-icon>Retake
                        </button>
                      </div>
                    } @else {
                      <lucide-icon name="plus"></lucide-icon>
                    }
                  </div>
                  @if (f['idFrontImageUrl'].invalid && f['idFrontImageUrl'].touched) {
                    <span class="field-error">Required</span>
                  }
                </div>
                <div class="field">
                  <label>ID Back</label>
                  <div class="upload-box upload-box--sm" [class.uploaded]="previews()['idBackImageUrl']"
                       (click)="!previews()['idBackImageUrl'] && idBackInput.click()">
                    <input #idBackInput type="file" hidden (change)="upload($event, 'idBackImageUrl')" accept="image/*">
                    @if (uploading()['idBackImageUrl']) {
                      <app-spinner />
                    } @else if (previews()['idBackImageUrl']) {
                      <img [src]="previews()['idBackImageUrl']" class="thumb thumb--sm" alt="ID Back" />
                      <div class="upload-actions upload-actions--sm">
                        <button type="button" class="btn-view btn-view--sm" (click)="openLightbox(previews()['idBackImageUrl']); $event.stopPropagation()">
                          <lucide-icon name="eye" [size]="11"></lucide-icon>View
                        </button>
                        <button type="button" class="btn-retake btn-retake--sm" (click)="idBackInput.click(); $event.stopPropagation()">
                          <lucide-icon name="refresh-cw" [size]="11"></lucide-icon>Retake
                        </button>
                      </div>
                    } @else {
                      <lucide-icon name="plus"></lucide-icon>
                    }
                  </div>
                  @if (f['idBackImageUrl'].invalid && f['idBackImageUrl'].touched) {
                    <span class="field-error">Required</span>
                  }
                </div>
              </div>
            </div>

            <!-- Bike Details -->
            <div class="form-section">
              <h3 class="section-label">
                <lucide-icon name="bike" [size]="15"></lucide-icon>
                Bike Details
              </h3>
              <div class="field">
                <label for="bikeRegistration">Number Plate</label>
                <input
                  id="bikeRegistration"
                  formControlName="bikeRegistration"
                  type="text"
                  placeholder="e.g. KBX 123A"
                  [class.has-error]="f['bikeRegistration'].invalid && f['bikeRegistration'].touched"
                />
                @if (f['bikeRegistration'].invalid && f['bikeRegistration'].touched) {
                  <span class="field-error">Number plate is required</span>
                }
              </div>
              <div class="field">
                <label for="bikeModel">Bike Model</label>
                <input
                  id="bikeModel"
                  formControlName="bikeModel"
                  type="text"
                  placeholder="e.g. Honda CB125F"
                  [class.has-error]="f['bikeModel'].invalid && f['bikeModel'].touched"
                />
                @if (f['bikeModel'].invalid && f['bikeModel'].touched) {
                  <span class="field-error">Bike model is required</span>
                }
              </div>
              <div class="field">
                <label>Logbook / Ownership Document</label>
                <div class="upload-box" [class.uploaded]="previews()['logbookImageUrl']"
                     (click)="!previews()['logbookImageUrl'] && logbookInput.click()">
                  <input #logbookInput type="file" hidden (change)="upload($event, 'logbookImageUrl')" accept="image/*">
                  @if (uploading()['logbookImageUrl']) {
                    <app-spinner />
                  } @else if (previews()['logbookImageUrl']) {
                    <img [src]="previews()['logbookImageUrl']" class="thumb" alt="Logbook" />
                    <div class="upload-done-row">
                      <span class="upload-ok"><lucide-icon name="check-circle" [size]="13"></lucide-icon>Uploaded</span>
                      <div class="upload-actions">
                        <button type="button" class="btn-view" (click)="openLightbox(previews()['logbookImageUrl']); $event.stopPropagation()">
                          <lucide-icon name="eye" [size]="12"></lucide-icon>View
                        </button>
                        <button type="button" class="btn-retake" (click)="logbookInput.click(); $event.stopPropagation()">
                          <lucide-icon name="refresh-cw" [size]="12"></lucide-icon>Retake
                        </button>
                      </div>
                    </div>
                  } @else {
                    <lucide-icon name="camera"></lucide-icon>
                    <span>Click to upload logbook photo</span>
                  }
                </div>
                @if (f['logbookImageUrl'].invalid && f['logbookImageUrl'].touched) {
                  <span class="field-error">Logbook photo is required</span>
                }
              </div>
            </div>

            <div class="upload-progress">
              <div class="upload-progress-bar" [style.width.%]="uploadedCount() / 4 * 100"></div>
            </div>
            <p class="upload-progress-label">
              @if (uploadedCount() === 4) {
                <lucide-icon name="check-circle" [size]="13"></lucide-icon>
                All 4 documents uploaded — ready to submit
              } @else {
                {{ uploadedCount() }} of 4 documents uploaded
              }
            </p>

            <div class="verify-actions">
              <button type="button" class="btn-primary" [disabled]="isUploading() || saving()" (click)="submit()">
                @if (saving()) {
                  <app-spinner />
                  <span>Submitting...</span>
                } @else {
                  <lucide-icon name="check-circle" [size]="18"></lucide-icon>
                  <span>Submit Documents</span>
                }
              </button>
              <button type="button" class="btn-ghost" (click)="logout()">Sign out</button>
            </div>
          </form>
        }
      </div>
    </div>

    <!-- Lightbox -->
    @if (lightboxUrl()) {
      <div class="lightbox-backdrop" (click)="closeLightbox()">
        <div class="lightbox" (click)="$event.stopPropagation()">
          <button class="lightbox-close" (click)="closeLightbox()">
            <lucide-icon name="x" [size]="22"></lucide-icon>
          </button>
          <img [src]="lightboxUrl()!" class="lightbox-img" alt="Document preview" />
        </div>
      </div>
    }
  `,
  styles: [`
    .verify-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--clr-bg);
      padding: 24px;
    }
    .verify-card {
      width: 100%;
      max-width: 520px;
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-xl, 16px);
      padding: 40px;
      box-shadow: var(--shadow-card);
      animation: fadeUp 0.4s ease-out;
    }
    .verify-header {
      text-align: center;
      margin-bottom: 32px;
    }
    .verify-icon {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: rgba(64,138,113,.12);
      color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .verify-header h1 { font-size: 22px; font-weight: 800; color: var(--clr-text); margin-bottom: 8px; }
    .verify-header p  { font-size: 14px; color: var(--clr-text-muted); line-height: 1.6; }
    .verify-form { display: flex; flex-direction: column; gap: 24px; }
    .form-section {
      display: flex; flex-direction: column; gap: 16px;
      padding: 20px;
      background: var(--clr-bg-elevated);
      border-radius: var(--radius-md);
      border: 1px solid var(--clr-border);
    }
    .section-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em;
      color: var(--clr-text-muted); margin: 0;
    }
    .upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .upload-box {
      border: 2px dashed var(--clr-border);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; cursor: pointer;
      color: var(--clr-text-muted); transition: all 0.2s;
      min-height: 80px; overflow: hidden;
    }
    .upload-box:hover { border-color: var(--clr-primary); color: var(--clr-text); background: rgba(64,138,113,.05); }
    .upload-box.uploaded { border-color: var(--clr-success); border-style: solid; background: rgba(34,197,94,.05); padding: 8px; }
    .upload-box span { font-size: 12px; font-weight: 500; }
    .upload-box--sm { padding: 8px; height: 100px; }
    .thumb { width: 100%; max-height: 120px; object-fit: cover; border-radius: 6px; }
    .thumb--sm { width: 100%; height: 60px; object-fit: cover; border-radius: 4px; }
    /* Uploaded state row */
    .upload-done-row {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; margin-top: 6px;
    }
    .upload-ok {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; color: var(--clr-success);
    }
    .upload-actions { display: flex; align-items: center; gap: 4px; }
    .upload-actions--sm { margin-top: 4px; justify-content: center; gap: 4px; }
    .btn-view {
      display: flex; align-items: center; gap: 3px;
      font-size: 11px; font-weight: 600; color: var(--clr-primary);
      background: rgba(64,138,113,.1); border: none; cursor: pointer;
      padding: 3px 8px; border-radius: 4px; transition: background 0.15s;
    }
    .btn-view:hover { background: rgba(64,138,113,.2); }
    .btn-view--sm { font-size: 10px; padding: 2px 6px; }
    .btn-retake {
      display: flex; align-items: center; gap: 3px;
      font-size: 11px; font-weight: 600; color: var(--clr-text-muted);
      background: none; border: none; cursor: pointer; padding: 3px 8px;
      border-radius: 4px; transition: background 0.15s, color 0.15s;
    }
    .btn-retake:hover { background: var(--clr-border); color: var(--clr-text); }
    .btn-retake--sm { font-size: 10px; padding: 2px 6px; }
    /* Upload progress */
    .upload-progress {
      width: 100%; height: 4px;
      background: var(--clr-border);
      border-radius: 99px; overflow: hidden;
    }
    .upload-progress-bar {
      height: 100%; background: var(--clr-primary);
      border-radius: 99px; transition: width 0.4s ease;
    }
    .upload-progress-label {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--clr-text-muted); margin: 4px 0 0;
    }
    .upload-progress-label lucide-icon { color: var(--clr-success); }
    /* Lightbox */
    .lightbox-backdrop {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000; padding: 16px;
      animation: fadeIn 0.15s ease;
    }
    .lightbox {
      position: relative; max-width: 90vw; max-height: 90vh;
      animation: slideUp 0.2s ease;
    }
    .lightbox-close {
      position: absolute; top: -44px; right: 0;
      background: rgba(255,255,255,0.12); border: none; border-radius: 8px;
      color: #fff; cursor: pointer; padding: 6px 10px;
      display: flex; align-items: center; transition: background 0.15s;
    }
    .lightbox-close:hover { background: rgba(255,255,255,0.25); }
    .lightbox-img {
      display: block; max-width: 100%; max-height: 85vh;
      border-radius: 10px; object-fit: contain;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field-error { font-size: 11px; color: var(--clr-error); }
    label { font-size: 13px; font-weight: 600; color: var(--clr-text); }
    input {
      width: 100%; padding: 10px 14px;
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-md);
      background: var(--clr-bg-card); color: var(--clr-text);
      font-size: 14px; transition: border-color 0.2s; box-sizing: border-box;
    }
    input:focus { outline: none; border-color: var(--clr-primary); }
    input.has-error { border-color: var(--clr-error); }
    .verify-actions { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
    .btn-primary {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 13px;
      background: var(--clr-primary); color: #fff;
      border: none; border-radius: var(--radius-md);
      font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { opacity: 0.9; }
    .btn-ghost {
      width: 100%; padding: 10px; background: none; border: none;
      color: var(--clr-text-muted); font-size: 13px; cursor: pointer; text-decoration: underline;
    }
    .btn-ghost:hover { color: var(--clr-text); }
    .loader-wrap { display: flex; justify-content: center; padding: 40px; }


    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 540px) {
      .verify-card { padding: 28px 20px; }
      .modal-footer { flex-direction: column; }
    }
  `],
})
export class RiderVerifyDetailsComponent implements OnInit {
  private readonly ridersApi   = inject(RidersApi);
  private readonly mediaService = inject(MediaService);
  private readonly toast        = inject(ToastService);
  private readonly auth         = inject(AuthService);
  private readonly router       = inject(Router);

  protected readonly loadingProfile = signal(true);
  protected readonly saving         = signal(false);
  protected readonly uploading      = signal<Record<string, boolean>>({});
  protected readonly previews       = signal<Record<string, string>>({});
  protected readonly lightboxUrl    = signal<string | null>(null);

  protected readonly uploadedCount = computed(() => {
    const p = this.previews();
    return (['licenseImageUrl', 'idFrontImageUrl', 'idBackImageUrl', 'logbookImageUrl'] as const)
      .filter(k => !!p[k]).length;
  });

  protected readonly form = inject(FormBuilder).nonNullable.group({
    licenseNumber:    ['', Validators.required],
    bikeRegistration: ['', Validators.required],
    bikeModel:        ['', Validators.required],
    licenseImageUrl:  ['', Validators.required],
    idFrontImageUrl:  ['', Validators.required],
    idBackImageUrl:   ['', Validators.required],
    logbookImageUrl:  ['', Validators.required],
  });

  protected get f() { return this.form.controls; }

  private isSet(v: string | null | undefined): boolean {
    return !!v && v !== 'To be provided';
  }

  protected isUploading(): boolean {
    return Object.values(this.uploading()).some(v => v);
  }

  protected openLightbox(url: string): void {
    this.lightboxUrl.set(url);
  }

  protected closeLightbox(): void {
    this.lightboxUrl.set(null);
  }

  async ngOnInit() {
    try {
      const profile = await this.ridersApi.getMyProfile();
      if (this.isSet(profile.licenseNumber))    this.f['licenseNumber'].setValue(profile.licenseNumber!);
      if (this.isSet(profile.bikeRegistration)) this.f['bikeRegistration'].setValue(profile.bikeRegistration!);
      if (this.isSet(profile.bikeModel))        this.f['bikeModel'].setValue(profile.bikeModel!);

      const p: Record<string, string> = {};
      if (profile.licenseImageUrl) { this.f['licenseImageUrl'].setValue(profile.licenseImageUrl); p['licenseImageUrl'] = profile.licenseImageUrl; }
      if (profile.idFrontImageUrl) { this.f['idFrontImageUrl'].setValue(profile.idFrontImageUrl); p['idFrontImageUrl'] = profile.idFrontImageUrl; }
      if (profile.idBackImageUrl)  { this.f['idBackImageUrl'].setValue(profile.idBackImageUrl);   p['idBackImageUrl']  = profile.idBackImageUrl; }
      if (profile.logbookImageUrl) { this.f['logbookImageUrl'].setValue(profile.logbookImageUrl); p['logbookImageUrl'] = profile.logbookImageUrl; }
      this.previews.set(p);

      if (profile.isVerified) await this.router.navigateByUrl('/rider');
    } catch {
      // Profile fetch failed — show empty form
    } finally {
      this.loadingProfile.set(false);
    }
  }

  protected async upload(event: Event, field: ImageField) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Show local preview immediately
    this.previews.update(p => ({ ...p, [field]: URL.createObjectURL(file) }));
    this.uploading.update(u => ({ ...u, [field]: true }));

    try {
      const url = await this.mediaService.uploadImage(file);
      this.form.get(field)?.setValue(url);
      this.previews.update(p => ({ ...p, [field]: url }));
      // Best-effort persist — the URL is already set in the form and will be
      // saved on final submit regardless, so don't fail the whole upload if this errors.
      try {
        await this.ridersApi.updateMyProfile({ [field]: url });
      } catch {
        // Silently ignored: the URL is saved in the form and submitted at the end.
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      const { [field]: _, ...rest } = this.previews();
      this.previews.set(rest);
      this.form.get(field)?.setValue('');
      this.toast.error('Upload failed. Please try again.');
    } finally {
      this.uploading.update(u => ({ ...u, [field]: false }));
    }
  }

  protected async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const missing: string[] = [];
      if (this.f['licenseNumber'].invalid)    missing.push('Licence number');
      if (this.f['licenseImageUrl'].invalid)  missing.push('Licence photo');
      if (this.f['idFrontImageUrl'].invalid)  missing.push('ID front photo');
      if (this.f['idBackImageUrl'].invalid)   missing.push('ID back photo');
      if (this.f['bikeRegistration'].invalid) missing.push('Number plate');
      if (this.f['bikeModel'].invalid)        missing.push('Bike model');
      if (this.f['logbookImageUrl'].invalid)  missing.push('Logbook photo');
      this.toast.error(`Missing: ${missing.join(', ')}`);
      return;
    }
    this.saving.set(true);
    try {
      await this.ridersApi.updateMyProfile(this.form.getRawValue());
      this.toast.success('Documents submitted for review! We will notify you once verified.');
      await this.router.navigateByUrl('/rider');
    } catch {
      // Error toast from interceptor
    } finally {
      this.saving.set(false);
    }
  }

  protected async logout() {
    await this.auth.logout();
  }
}
