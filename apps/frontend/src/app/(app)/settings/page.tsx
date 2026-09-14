'use client';

import { Server, Cpu, Database, FileCode2 } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';

const UNAVAILABLE: { title: string; icon: typeof Server; note: string }[] = [
  { title: 'Configuración de IA', icon: Cpu, note: 'Se gestiona vía variables de entorno del backend (key cifrada en AIConfig).' },
  { title: 'Variablas de entorno', icon: FileCode2, note: 'Revisa el .env del backend (DATABASE_URL, JWT_SECRET, TOKEN_ENCRYPTION_KEY, FACEBOOK_APP_*, OPENAI_API_KEY).' },
  { title: 'Base de datos', icon: Database, note: 'MySQL + Prisma. Las migraciones se aplican con npx prisma migrate deploy.' },
];

export default function SettingsPage() {
  const { user } = useAuthAdmin();
  return (
    <div className="space-y-4">
      <PageHeader title="Configuración" subtitle="Información del sistema y de la sesión actual" />

      <Card>
        <CardHeader><CardTitle className="text-base">Sesión actual</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Info label="Usuario" value={user?.displayName ?? '—'} />
          <Info label="Email" value={user?.email ?? '—'} />
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground/60">Roles</span>
            <div className="flex gap-1.5">
              {user?.roles.map((r) => <StatusBadge key={r} value={r} />) ?? <span className="text-xs">—</span>}
            </div>
          </div>
          <Info label="ID" value={user?.id ?? '—'} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {UNAVAILABLE.map((u) => (
          <Card key={u.title}>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <u.icon className="size-4 text-foreground/60" />
              <CardTitle className="text-base">{u.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/60">{u.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Server className="size-4 text-foreground/60" />
          <CardTitle className="text-base">Estado de la API</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>
            Conectada a <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}</code>
          </span>
        </CardContent>
      </Card>

      <p className="text-xs text-foreground/50">
        Para más ajustes, consulta la documentación del proyecto y los <code className="rounded bg-muted px-1.5 py-0.5 font-mono">.env</code> del backend.
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-foreground/60">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}