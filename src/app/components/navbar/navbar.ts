import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly themeService: ThemeService;

  constructor(themeService: ThemeService) {
    this.themeService = themeService;
  }

  protected toggleTheme(): void {
    this.themeService.toggle();
  }
}
