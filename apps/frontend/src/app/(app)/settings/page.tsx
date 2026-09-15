'use client';

import { Server, Shield } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';

export default function SettingsPage() {
  const { user } = useAuthAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Información de tu sesión y del sistema" />

      {/* Session info */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Shield className="size-4 text-[#1877F2]" />
          <CardTitle className="text-base">Sesión actual</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Nombre" value={user?.displayName ?? '—'} />
          <Info label="Email" value={user?.email ?? '—'} />
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground/60">Roles</span>
            <div className="flex gap-1.5">
              {user?.roles.map((r) => <StatusBadge key={r} value={r} />) ?? <span className="text-xs">—</span>}
            </div>
          </div>
          <Info label="ID de usuario" value={user?.id ?? '—'} />
        </CardContent>
      </Card>

      {/* API status */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Server className="size-4 text-[#1877F2]" />
          <CardTitle className="text-base">Estado de la API</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-foreground/70">
            Conectada correctamente
          </span>
        </CardContent>
      </Card>
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