import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme';

// Map of CSS properties to their [max, min] rem values for interpolation
const NAVBAR_SIZE_RANGES = {
  '--navbar-gap': [3.5, 0.25],
  '--navbar-font-size': [1.5, 0.75],
  '--navbar-toggle-padding': [1, 0.25],
  '--navbar-primary-icon-size': [1.75, 1],
  '--navbar-external-icon-size': [1.25, 0.625],
  '--navbar-social-gap': [0.75, 0.125],
} as const;

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements AfterViewInit, OnDestroy {
  @ViewChild('navbarShell', { static: true })
  private navbarShell!: ElementRef<HTMLElement>;

  @ViewChild('navbarContent', { static: true })
  private navbarContent!: ElementRef<HTMLElement>;

  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private resizeObserver?: ResizeObserver;
  private animationFrameId?: number;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const shell = this.navbarShell.nativeElement;
    const view = shell.ownerDocument.defaultView;

    if (!view) {
      return;
    }

    this.resizeObserver = new view.ResizeObserver(() => this.scheduleLayoutUpdate());
    this.resizeObserver.observe(shell);

    shell.ownerDocument.fonts?.ready.then(() => this.scheduleLayoutUpdate());
    this.scheduleLayoutUpdate();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();

    const view = this.navbarShell?.nativeElement.ownerDocument.defaultView;
    if (view && this.animationFrameId !== undefined) {
      view.cancelAnimationFrame(this.animationFrameId);
    }
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  private scheduleLayoutUpdate(): void {
    const view = this.navbarShell.nativeElement.ownerDocument.defaultView;

    if (!view || this.animationFrameId !== undefined) {
      return;
    }

    this.animationFrameId = view.requestAnimationFrame(() => {
      this.animationFrameId = undefined;
      this.updateLayout();
    });
  }

  // Adjusts navbar layout phase and sizing depending on available space
  private updateLayout(): void {
    const shell = this.navbarShell.nativeElement;
    const content = this.navbarContent.nativeElement;
    const view = shell.ownerDocument.defaultView;

    if (!view) {
      return;
    }

    const shellStyles = view.getComputedStyle(shell);
    const available =
      shell.clientWidth -
      Number.parseFloat(shellStyles.paddingLeft) -
      Number.parseFloat(shellStyles.paddingRight);

    const isSmallViewport = view.innerWidth < 640;

    // Use a temporary clone to calculate natural content dimensions
    const measurement = content.cloneNode(true) as HTMLElement;
    measurement.classList.add('navbar-measurement');
    measurement.setAttribute('aria-hidden', 'true');
    measurement.inert = true;
    shell.appendChild(measurement);

    this.applySizing(measurement, 0);
    const fullWidth = measurement.getBoundingClientRect().width;

    this.applySizing(measurement, 1);
    const minWidth = measurement.getBoundingClientRect().width;

    measurement.remove();

    if (!isSmallViewport && available >= fullWidth) {
      // Phase 1: Right-aligned, full size
      shell.dataset['centered'] = 'false';
      this.applySizing(content, 0);
    } else {
      // Phase 2 & 3: Centered, dynamic scaling
      shell.dataset['centered'] = 'true';

      if (available >= fullWidth) {
        this.applySizing(content, 0);
      } else {
        const range = fullWidth - minWidth;
        const compression = range > 0 ? Math.min(1, (fullWidth - available) / range) : 0;
        this.applySizing(content, compression);
      }
    }
  }

  private applySizing(element: HTMLElement, compression: number): void {
    for (const [property, [expanded, compact]] of Object.entries(NAVBAR_SIZE_RANGES)) {
      const value = expanded - (expanded - compact) * compression;
      element.style.setProperty(property, `${value.toFixed(4)}rem`);
    }
  }
}
