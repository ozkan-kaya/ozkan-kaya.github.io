import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';

const GALAXY_WIDTH = 58;
const GALAXY_HEIGHT = 28;
const GALAXY_CHARS = ' .·:+*oO@';

@Component({
  selector: 'app-ascii-art',
  templateUrl: './ascii-art.html',
  styleUrl: './ascii-art.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsciiArt implements OnInit, OnDestroy {
  protected readonly galaxyFrame = signal(this.createGalaxyFrame(0));

  private readonly platformId = inject(PLATFORM_ID);
  private animationIntervalId?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let rotation = 0;
    this.animationIntervalId = setInterval(() => {
      rotation += 0.035;
      this.galaxyFrame.set(this.createGalaxyFrame(rotation));
    }, 80);
  }

  ngOnDestroy(): void {
    if (this.animationIntervalId !== undefined) {
      clearInterval(this.animationIntervalId);
    }
  }

  private createGalaxyFrame(rotation: number): string {
    const rows: string[] = [];

    for (let y = 0; y < GALAXY_HEIGHT; y += 1) {
      let row = '';

      for (let x = 0; x < GALAXY_WIDTH; x += 1) {
        const normalizedX = ((x - GALAXY_WIDTH / 2) / (GALAXY_WIDTH / 2)) * 1.55;
        const normalizedY = (y - GALAXY_HEIGHT / 2) / (GALAXY_HEIGHT / 2);
        const radius = Math.hypot(normalizedX, normalizedY);

        if (radius > 1.08) {
          row += ' ';
          continue;
        }

        const angle = Math.atan2(normalizedY, normalizedX);
        const spiralWave = Math.cos(3 * (angle - rotation - radius * 2.65));
        const radialFade = Math.pow(Math.max(0, 1 - radius), 0.55);
        const arm = Math.pow(Math.max(0, spiralWave), 7) * radialFade;
        const core = Math.exp(-radius * 11) * 1.15;
        const halo = Math.exp(-radius * 2.8) * 0.13;
        const noise = this.coordinateNoise(x, y);
        const twinkle = 0.78 + 0.22 * Math.sin(rotation * 9 + noise * 12);
        const brightness = (arm * (0.62 + noise * 0.48) + core + halo) * twinkle;
        const sparseEdge = radius > 0.45 && noise < 0.32;

        if (!Number.isFinite(brightness) || (sparseEdge && brightness < 0.34)) {
          row += ' ';
          continue;
        }

        const charIndex = Math.max(
          0,
          Math.min(GALAXY_CHARS.length - 1, Math.floor(brightness * GALAXY_CHARS.length)),
        );
        row += GALAXY_CHARS[charIndex];
      }

      rows.push(row);
    }

    return rows.join('\n');
  }

  private coordinateNoise(x: number, y: number): number {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }
}
