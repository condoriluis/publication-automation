import { Link2, Users, Megaphone, FileText, MessageCircle, CalendarClock, History, Activity, Bot, Settings, LayoutDashboard } from 'lucide-react';

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
  { title: 'Inteligencia', href: '/ai', icon: Bot },
];

export const bottomNav: NavItem[] = [
  { title: 'Control de Acceso', href: '/settings/users', icon: Users },
  { title: 'Configuración', href: '/settings', icon: Settings },
];

export function groupLabel(nav: NavItem[]): { primary: NavItem[]; users: NavItem[] } {
  return {
    primary: nav.filter((n) => n.href !== '/settings/users' && n.href !== '/settings'),
    users: nav.filter((n) => n.href === '/settings/users' || n.href === '/settings'),
  };
}
