import { Link2, Users, Megaphone, FileText, MessageCircle, CalendarClock, History, Activity, LayoutDashboard } from 'lucide-react';

export interface NavItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export const mainNav: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Páginas', href: '/pages', icon: Link2 },
  { title: 'Campañas', href: '/campaigns', icon: Megaphone },
  { title: 'Posts', href: '/posts', icon: FileText },
  { title: 'Comentarios', href: '/comments', icon: MessageCircle },
  { title: 'Calendario', href: '/calendar', icon: CalendarClock },
  { title: 'Historial', href: '/history', icon: History },
  { title: 'Logs', href: '/logs', icon: Activity },
];

export const bottomNav: NavItem[] = [
  { title: 'Control de Acceso', href: '/users', icon: Users },
];

export function groupLabel(nav: NavItem[]): { primary: NavItem[]; users: NavItem[] } {
  return {
    primary: nav.filter((n) => n.href !== '/users'),
    users: nav.filter((n) => n.href === '/users'),
  };
}
