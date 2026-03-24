import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Must equal sibling control `passwordKey` (re-validate confirm when password changes). */
export function matchPassword(passwordKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) return null;
    const password = parent.get(passwordKey)?.value as string | undefined;
    const confirm = control.value as string | undefined;
    if (confirm === '' || confirm === undefined) return null;
    return password === confirm ? null : { mismatch: true };
  };
}
