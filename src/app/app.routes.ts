import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/about/about').then((m) => m.About),
    pathMatch: 'full',
  },
  { path: '**', redirectTo: '' },
];
