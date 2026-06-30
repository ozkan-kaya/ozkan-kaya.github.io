import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
} from '@angular/core';

/**
 * Character-by-character text scramble effect inspired by Soulwire's TextScramble.
 * Original concept and demo: https://codepen.io/soulwire/pen/mEMPrK
 */

const DUD_CHARS = '!<>-_\\/[]{}—=+*^?#________';

interface CharQueue {
  from: string;
  to: string;
  start: number;
  end: number;
  char?: string;
}

@Directive({
  selector: '[appTextScramble]',
  standalone: true,
})
export class TextScrambleDirective implements OnInit, OnChanges, OnDestroy {
  /** The text to scramble to */
  @Input('appTextScramble') text = '';

  /** Delay in ms before the scramble starts */
  @Input() scrambleDelay = 0;

  /** Emits after the current text has fully resolved. */
  @Output() scrambleComplete = new EventEmitter<void>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);

  private queue: CharQueue[] = [];
  private frame = 0;
  private rafId?: number;
  private timeoutId?: ReturnType<typeof setTimeout>;
  private resolve?: () => void;
  private isInitialized = false;

  ngOnInit(): void {
    this.isInitialized = true;
    if (isPlatformBrowser(this.platformId)) {
      this.triggerScramble(true);
    } else {
      // Keep the initial SSR output empty so the text appears through the animation.
      this.el.nativeElement.textContent = '';
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isInitialized && changes['text']) {
      this.clearTimers();
      this.scrambleTo(this.text);
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }

  private triggerScramble(isInitial = false): void {
    this.clearTimers();

    if (isInitial) {
      this.el.nativeElement.textContent = '';
    }

    this.timeoutId = setTimeout(() => {
      this.scrambleTo(this.text);
    }, this.scrambleDelay);
  }

  private scrambleTo(newText: string): Promise<void> {
    const oldText = this.el.nativeElement.textContent || '';
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise<void>((r) => (this.resolve = r));
    this.queue = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      const start = Math.floor(Math.random() * 40);
      const end = start + Math.floor(Math.random() * 40);
      this.queue.push({ from, to, start, end });
    }

    this.frame = 0;
    this.tick();
    return promise;
  }

  private tick = (): void => {
    let output = '';
    let complete = 0;

    for (const item of this.queue) {
      const { from, to, start, end } = item;

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!item.char || Math.random() < 0.28) {
          item.char = this.randomDud();
        }
        output += item.char;
      } else {
        output += from;
      }
    }

    this.el.nativeElement.textContent = output;

    if (complete === this.queue.length) {
      this.resolve?.();
      this.scrambleComplete.emit();
    } else {
      this.rafId = requestAnimationFrame(this.tick);
      this.frame++;
    }
  };

  private randomDud(): string {
    return DUD_CHARS[Math.floor(Math.random() * DUD_CHARS.length)];
  }
}
