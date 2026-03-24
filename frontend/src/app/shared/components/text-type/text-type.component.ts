import {
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { NgIf } from '@angular/common';

/**
 * Typewriter / multi-string typing effect (Angular counterpart to common React snippets).
 */
@Component({
  selector: 'app-text-type',
  standalone: true,
  imports: [NgIf],
  templateUrl: './text-type.component.html',
  styleUrl: './text-type.component.scss',
})
export class TextTypeComponent implements AfterViewInit, OnDestroy {
  /** Lines to cycle through */
  @Input() texts: string[] = [];

  /** Kept for API parity with React examples; merged into {@link texts} if provided. */
  @Input() set text(lines: string[] | undefined) {
    if (lines?.length) {
      this._mergedFromText = lines;
    }
  }

  @Input() typingSpeed = 75;
  @Input() pauseDuration = 1500;
  @Input() showCursor = true;
  @Input() cursorCharacter = '|';
  @Input() deletingSpeed = 50;
  @Input() variableSpeedEnabled = false;
  @Input() variableSpeedMin = 60;
  @Input() variableSpeedMax = 120;
  @Input() cursorBlinkDuration = 0.5;

  @HostBinding('class')
  protected hostClass = 'text-type text-type--gradient';

  protected visibleText = '';

  private _mergedFromText: string[] | null = null;
  private textIndex = 0;
  private charIndex = 0;
  private deleting = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startRaf = 0;
  private stopped = false;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    const lines = this.effectiveLines();
    if (!lines.length) return;
    // Defer one frame: inputs + layout stable; avoids empty first paint with parent CD timing.
    this.startRaf = requestAnimationFrame(() => {
      this.startRaf = 0;
      if (!this.stopped) this.step();
    });
  }

  ngOnDestroy(): void {
    this.stopped = true;
    if (this.startRaf) cancelAnimationFrame(this.startRaf);
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private effectiveLines(): string[] {
    if (this._mergedFromText?.length) {
      return this._mergedFromText;
    }
    return this.texts ?? [];
  }

  private typingDelay(): number {
    if (!this.variableSpeedEnabled) return this.typingSpeed;
    const min = Math.min(this.variableSpeedMin, this.variableSpeedMax);
    const max = Math.max(this.variableSpeedMin, this.variableSpeedMax);
    return min + Math.random() * (max - min);
  }

  private schedule(fn: () => void, ms: number): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.stopped) fn();
    }, ms);
  }

  private step(): void {
    if (this.stopped) return;
    const lines = this.effectiveLines();
    if (!lines.length) return;

    const full = lines[this.textIndex % lines.length];

    if (!this.deleting) {
      if (this.charIndex < full.length) {
        this.charIndex++;
        this.visibleText = full.slice(0, this.charIndex);
        this.cdr.detectChanges();
        this.schedule(() => this.step(), this.typingDelay());
      } else {
        this.schedule(() => {
          if (this.stopped) return;
          if (lines.length > 1) {
            this.deleting = true;
            this.step();
          } else {
            this.charIndex = 0;
            this.visibleText = '';
            this.step();
          }
        }, this.pauseDuration);
      }
    } else {
      if (this.charIndex > 0) {
        this.charIndex--;
        this.visibleText = full.slice(0, this.charIndex);
        this.cdr.detectChanges();
        this.schedule(() => this.step(), this.deletingSpeed);
      } else {
        this.deleting = false;
        this.textIndex++;
        this.schedule(() => this.step(), 220);
      }
    }
  }
}
