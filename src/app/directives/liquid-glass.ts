import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  PLATFORM_ID,
} from '@angular/core';

type SvgElementName = keyof SVGElementTagNameMap;

/*
 * Adapted from https://github.com/shuding/liquid-glass
 *
 * MIT License
 * Copyright (c) 2025 Shu Ding
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
@Directive({
  selector: '[appLiquidGlass]',
})
export class LiquidGlassDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private readonly filterId = `liquid-glass-${Math.random().toString(36).slice(2, 11)}`;
  private svg?: SVGSVGElement;
  private filter?: SVGFilterElement;
  private image?: SVGFEImageElement;
  private displacementMap?: SVGFEDisplacementMapElement;
  private canvas?: HTMLCanvasElement;
  private context?: CanvasRenderingContext2D;
  private resizeObserver?: ResizeObserver;
  private animationFrame?: number;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    afterNextRender(() => this.initialize());
    this.destroyRef.onDestroy(() => this.destroy());
  }

  private initialize(): void {
    this.svg = this.createSvgElement('svg');
    this.svg.setAttribute('width', '0');
    this.svg.setAttribute('height', '0');
    this.svg.setAttribute('aria-hidden', 'true');
    this.svg.classList.add('liquid-glass-filter');

    const definitions = this.createSvgElement('defs');
    this.filter = this.createSvgElement('filter');
    this.filter.id = `${this.filterId}-filter`;
    this.filter.setAttribute('filterUnits', 'userSpaceOnUse');
    this.filter.setAttribute('color-interpolation-filters', 'sRGB');

    this.image = this.createSvgElement('feImage');
    this.image.id = `${this.filterId}-map`;
    this.image.setAttribute('result', `${this.filterId}-map`);

    this.displacementMap = this.createSvgElement('feDisplacementMap');
    this.displacementMap.setAttribute('in', 'SourceGraphic');
    this.displacementMap.setAttribute('in2', `${this.filterId}-map`);
    this.displacementMap.setAttribute('xChannelSelector', 'R');
    this.displacementMap.setAttribute('yChannelSelector', 'G');

    this.filter.append(this.image, this.displacementMap);
    definitions.append(this.filter);
    this.svg.append(definitions);
    this.document.body.append(this.svg);

    this.canvas = this.document.createElement('canvas');
    this.context = this.canvas.getContext('2d') ?? undefined;
    this.element.style.setProperty(
      '--liquid-glass-filter',
      `url(#${this.filterId}-filter) blur(1px) contrast(1.2) brightness(1.05) saturate(1.1)`,
    );

    this.updateShader();
    this.resizeObserver = new ResizeObserver(() => this.scheduleShaderUpdate());
    this.resizeObserver.observe(this.element);
  }

  private scheduleShaderUpdate(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = undefined;
      this.updateShader();
    });
  }

  private updateShader(): void {
    if (!this.filter || !this.image || !this.displacementMap || !this.canvas || !this.context) {
      return;
    }

    const bounds = this.element.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    this.filter.setAttribute('x', '0');
    this.filter.setAttribute('y', '0');
    this.filter.setAttribute('width', width.toString());
    this.filter.setAttribute('height', height.toString());
    this.image.setAttribute('width', width.toString());
    this.image.setAttribute('height', height.toString());
    this.canvas.width = width;
    this.canvas.height = height;

    const pixels = new Uint8ClampedArray(width * height * 4);
    const offsets = new Float32Array(width * height * 2);
    let maxScale = 0;
    let offsetIndex = 0;

    for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex++) {
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const ix = x / width - 0.5;
      const iy = y / height - 0.5;
      const distanceToEdge = this.roundedRectSdf(ix, iy, 0.3, 0.2, 0.6);
      const displacement = this.smoothStep(0.8, 0, distanceToEdge - 0.15);
      const scale = this.smoothStep(0, 1, displacement);
      const displacedX = (ix * scale + 0.5) * width - x;
      const displacedY = (iy * scale + 0.5) * height - y;

      offsets[offsetIndex++] = displacedX;
      offsets[offsetIndex++] = displacedY;
      maxScale = Math.max(maxScale, Math.abs(displacedX), Math.abs(displacedY));
    }

    maxScale = Math.max(maxScale * 0.5, 0.001);
    offsetIndex = 0;

    for (let pixelIndex = 0; pixelIndex < pixels.length; pixelIndex += 4) {
      pixels[pixelIndex] = (offsets[offsetIndex++] / maxScale + 0.5) * 255;
      pixels[pixelIndex + 1] = (offsets[offsetIndex++] / maxScale + 0.5) * 255;
      pixels[pixelIndex + 2] = 0;
      pixels[pixelIndex + 3] = 255;
    }

    this.context.putImageData(new ImageData(pixels, width, height), 0, 0);
    this.image.setAttribute('href', this.canvas.toDataURL());
    this.displacementMap.setAttribute('scale', (maxScale * 0.34).toString());
  }

  private smoothStep(start: number, end: number, value: number): number {
    const progress = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return progress * progress * (3 - 2 * progress);
  }

  private roundedRectSdf(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): number {
    const qx = Math.abs(x) - width + radius;
    const qy = Math.abs(y) - height + radius;

    return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }

  private createSvgElement<Name extends SvgElementName>(name: Name): SVGElementTagNameMap[Name] {
    return this.document.createElementNS('http://www.w3.org/2000/svg', name);
  }

  private destroy(): void {
    this.resizeObserver?.disconnect();

    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.element.style.removeProperty('--liquid-glass-filter');
    this.svg?.remove();
    this.canvas?.remove();
  }
}
