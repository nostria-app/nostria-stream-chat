import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: ':naddr',
    loadComponent: () => import('./chat/chat.component').then((m) => m.ChatComponent),
  },
  {
    path: '',
    redirectTo: '/',
    pathMatch: 'full',
  },
];
