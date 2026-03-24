import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/** Kept for old links: `/auth/register-rider` → combined register with rider pre-selected */
@Component({
  selector: 'app-register-rider',
  standalone: true,
  template: '',
})
export class RegisterRiderComponent implements OnInit {
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.router.navigate(['/auth/register'], { queryParams: { type: 'rider' }, replaceUrl: true });
  }
}
