import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LiquidGlassDirective } from '../../directives/liquid-glass';
import { ThemeService } from '../../services/theme';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, LiquidGlassDirective],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly navbar = viewChild.required<ElementRef<HTMLElement>>('navbar');
  private resizeObserver?: ResizeObserver;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    afterNextRender(() => this.observeNavbarWidth());
    this.destroyRef.onDestroy(() => this.resizeObserver?.disconnect());
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  private observeNavbarWidth(): void {
    const navbar = this.navbar().nativeElement;
    const content = navbar.querySelector<HTMLElement>('.navbar-content');

    if (!content) {
      return;
    }

    const updateCondensedState = (): void => {
      navbar.classList.remove('navbar-condensed', 'navbar-fluid');
      navbar.style.removeProperty('--navbar-content-scale');

      const styles = getComputedStyle(navbar);
      const horizontalChrome =
        Number.parseFloat(styles.paddingLeft) +
        Number.parseFloat(styles.paddingRight) +
        Number.parseFloat(styles.borderLeftWidth) +
        Number.parseFloat(styles.borderRightWidth);
      const expandedWidth = content.scrollWidth + horizontalChrome;
      const maximumWidth = window.innerWidth * 0.9;

      if (expandedWidth < maximumWidth) {
        return;
      }

      navbar.classList.add('navbar-condensed');

      const condensedContentWidth = content.scrollWidth;
      const condensedWidth = condensedContentWidth + horizontalChrome;

      if (condensedWidth < maximumWidth) {
        return;
      }

      const availableContentWidth = maximumWidth - horizontalChrome;
      const contentScale = Math.min(1, availableContentWidth / condensedContentWidth);

      navbar.classList.add('navbar-fluid');
      navbar.style.setProperty('--navbar-content-scale', contentScale.toString());
    };

    updateCondensedState();
    this.resizeObserver = new ResizeObserver(updateCondensedState);
    this.resizeObserver.observe(document.documentElement);
    this.resizeObserver.observe(content);
  }
}
