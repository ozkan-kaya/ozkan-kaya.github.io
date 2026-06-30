import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
  signal,
  ElementRef,
  viewChild,
  NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AsciiArt } from '../../components/ascii-art/ascii-art';
import { TextScrambleDirective } from '../../directives/text-scramble.directive';

interface BioPart {
  text: string;
  underline?: boolean;
}

interface BioLine {
  prefix: string;
  text: string;
  parts?: BioPart[];
}

// Terminal bio lines (plain text for scramble directive)
const BIO_LINES: BioLine[] = [
  {
    prefix: '>',
    text: 'My name is Özkan.',
    parts: [
      { text: 'My name is ' },
      { text: 'Özkan', underline: true },
      { text: '.' },
    ],
  },
  { prefix: '>', text: 'Recent Computer Engineering graduate, ranked 2nd in my faculty.' },
  {
    prefix: '>',
    text: 'I build full-stack web apps, automate workflows.',
  },
  {
    prefix: '>',
    text: 'I aim to build secure, searchable, and scalable digital products.',
  },
  { prefix: '>', text: 'Based in Istanbul, Türkiye.' },
];

const GREETINGS = [
  'Merhaba', // Turkish
  'Hello', // English
  'Hola', // Spanish
  'Bonjour', // French
  'Hallo', // German
  'Ciao', // Italian
  'Olá', // Portuguese
  'Konnichiwa', // Japanese
  'Annyeong', // Korean
  'Nǐ hǎo', // Chinese
  'Namaste', // Hindi
];

@Component({
  selector: 'app-about',
  imports: [AsciiArt, TextScrambleDirective],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About implements OnInit, OnDestroy {
  protected readonly bioLines = BIO_LINES;

  protected readonly currentGreeting = signal(GREETINGS[0]);
  protected readonly showBioLines = signal(false);
  protected readonly bioSequenceComplete = signal(false);

  /** Art fades out slower — progress from 0→1 over the full scroll range */
  protected readonly artProgress = signal(0);
  /** Text fades out faster — reaches 1 at ~60% of the scroll range */
  protected readonly textProgress = signal(0);

  private readonly scrollWrapper = viewChild<ElementRef<HTMLElement>>('scrollWrapper');

  private greetingIndex = 0;
  private completedBioLineCount = 0;
  private intervalId?: ReturnType<typeof setInterval>;
  private bioStartTimeoutId?: ReturnType<typeof setTimeout>;
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private targetProgress = 0;
  private currentProgress = 0;
  private isLoopRunning = false;
  private rafId?: number;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.intervalId = setInterval(() => {
        this.greetingIndex = (this.greetingIndex + 1) % GREETINGS.length;
        this.currentGreeting.set(GREETINGS[this.greetingIndex]);
      }, 3500);

      // Run scroll listener outside Angular zone for performance
      this.ngZone.runOutsideAngular(() => {
        window.addEventListener('scroll', this.onScroll, { passive: true });
      });
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
    }
    if (this.bioStartTimeoutId !== undefined) {
      clearTimeout(this.bioStartTimeoutId);
    }
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('scroll', this.onScroll);
      if (this.rafId !== undefined) {
        cancelAnimationFrame(this.rafId);
      }
    }
  }

  protected startBioSequence(): void {
    if (!this.showBioLines() && this.bioStartTimeoutId === undefined) {
      this.bioStartTimeoutId = setTimeout(() => {
        this.showBioLines.set(true);
        this.bioStartTimeoutId = undefined;
      }, 350);
    }
  }

  protected markBioLineComplete(): void {
    this.completedBioLineCount += 1;
    if (this.completedBioLineCount >= this.bioLines.length) {
      this.bioSequenceComplete.set(true);
    }
  }

  protected markPartComplete(isLast: boolean): void {
    if (isLast) {
      this.markBioLineComplete();
    }
  }

  private readonly updateLoop = (): void => {
    const diff = this.targetProgress - this.currentProgress;

    if (Math.abs(diff) < 0.0005) {
      this.currentProgress = this.targetProgress;
      this.artProgress.set(this.currentProgress);
      this.textProgress.set(this.currentProgress);
      this.isLoopRunning = false;
      this.rafId = undefined;
      return;
    }

    // lerp: current = current + diff * ease
    this.currentProgress += diff * 0.18;
    this.artProgress.set(this.currentProgress);
    this.textProgress.set(this.currentProgress);

    this.rafId = requestAnimationFrame(this.updateLoop);
  };

  private readonly onScroll = (): void => {
    const wrapper = this.scrollWrapper()?.nativeElement;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const wrapperHeight = wrapper.offsetHeight;
    const viewportHeight = window.innerHeight;

    const scrolled = window.scrollY;
    const scrollableDistance = wrapperHeight - viewportHeight;

    if (scrollableDistance <= 0) {
      this.targetProgress = 0;
    } else {
      const rawProgress = scrolled / scrollableDistance;
      this.targetProgress = Math.min(Math.max(rawProgress, 0), 1);
    }

    if (!this.isLoopRunning) {
      this.isLoopRunning = true;
      this.rafId = requestAnimationFrame(this.updateLoop);
    }
  };
}
