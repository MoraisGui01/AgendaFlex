import * as React from 'react';
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { DataTableShell, type ColumnDef } from '@/src/components/shared/DataTableShell';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { apiFetch } from '@/src/lib/api';
import { formatBRL, formatDateBR, maskCPF } from '@/src/lib/utils';
import type { Cliente, LocalClinica, Procedimento, Profissional } from '@/src/types/clinic';

function StatusText({ status }: { status: 'ativo' | 'inativo' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        status === 'ativo' ? 'text-green-700' : 'text-slate-500'
      }`}
    >
      {status === 'ativo' ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
      ) : (
        <Ban className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      )}
      {status === 'ativo' ? 'Ativo' : 'Inativo'}
    </span>
  );
}

// ============================================================
// 1. LOCAIS
// ============================================================
export function LocaisPage() {
  const [items, setItems] = React.useState<LocalClinica[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('todos');
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LocalClinica | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [nome, setNome] = React.useState('');
  const [endereco, setEndereco] = React.useState('');
  const [abertura, setAbertura] = React.useState('08:00');
  const [fechamento, setFechamento] = React.useState('18:00');

  const fetchLocais = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, status: statusFilter });
      const data = await apiFetch<LocalClinica[]>(`/api/locais?${q.toString()}`);
      setItems(data);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    fetchLocais();
  }, [fetchLocais]);

  const openCreate = () => {
    setEditing(null);
    setNome('');
    setEndereco('');
    setAbertura('08:00');
    setFechamento('18:00');
    setDialogOpen(true);
  };

  const openEdit = (item: LocalClinica) => {
    setEditing(item);
    setNome(item.nome);
    setEndereco(item.endereco);
    setAbertura(item.horario_func.abertura);
    setFechamento(item.horario_func.fechamento);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome,
        endereco,
        horario_func: {
          abertura,
          fechamento,
          intervalo_inicio: '12:00',
          intervalo_fim: '13:00',
          dias: [1, 2, 3, 4, 5],
        },
      };
      if (editing) {
        await apiFetch(`/api/locais/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Local atualizado com sucesso!');
      } else {
        await apiFetch('/api/locais', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Local cadastrado com sucesso!');
      }
      setDialogOpen(false);
      fetchLocais();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: LocalClinica) => {
    const next = item.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await apiFetch(`/api/locais/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      toast.success(`✅ Local marcado como ${next}.`);
      fetchLocais();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const softDelete = async (item: LocalClinica) => {
    try {
      await apiFetch(`/api/locais/${item.id}`, { method: 'DELETE' });
      toast.success('✅ Local arquivado com soft delete (LGPD).');
      fetchLocais();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const columns: ColumnDef<LocalClinica>[] = [
    {
      key: 'nome',
      header: 'Local / Sala',
      render: (item) => <span className="font-medium text-slate-900">{item.nome}</span>,
    },
    {
      key: 'endereco',
      header: 'Endereço',
      render: (item) => <span className="text-slate-600">{item.endereco}</span>,
    },
    {
      key: 'horario',
      header: 'Funcionamento',
      render: (item) => (
        <span className="font-mono text-xs tabular-nums text-slate-600">
          {item.horario_func.abertura} – {item.horario_func.fechamento}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusText status={item.status} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações para ${item.nome}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleStatus(item)}>
              {item.status === 'ativo' ? (
                <>
                  <Ban className="h-4 w-4 text-amber-600" />
                  <span>Inativar</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  <span>Reativar</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => softDelete(item)}>
              <Trash2 className="h-4 w-4" />
              <span>Arquivar (Soft Delete)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Locais e Consultórios</h1>
        <p className="mt-1 text-sm text-slate-500">
          Unidades e salas físicas monitoradas para impedir reservas simultâneas na agenda.
        </p>
      </div>

      <DataTableShell
        data={items}
        columns={columns}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por unidade ou endereço..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        emptyTitle="Nenhum local encontrado"
        emptyDescription="Ajuste os filtros ou cadastre um novo consultório para liberar agendamentos."
        getRowKey={(i) => i.id}
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span>Novo Local</span>
          </Button>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Local' : 'Cadastrar Novo Local'}</DialogTitle>
            <DialogDescription>
              Defina o endereço e a janela operacional da sala para cálculo de disponibilidade.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nome da Unidade / Sala</label>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Unidade Paulista · Consultório 03"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Endereço Completo</label>
              <input
                required
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Av. Paulista, 1420 - Conj. 406"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Abertura</label>
                <input
                  type="time"
                  required
                  value={abertura}
                  onChange={(e) => setAbertura(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Fechamento</label>
                <input
                  type="time"
                  required
                  value={fechamento}
                  onChange={(e) => setFechamento(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Local'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 2. PROFISSIONAIS
// ============================================================
export function ProfissionaisPage() {
  const [items, setItems] = React.useState<Profissional[]>([]);
  const [procedimentos, setProcedimentos] = React.useState<Procedimento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('todos');
  const [showFullCpf, setShowFullCpf] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Profissional | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [nome, setNome] = React.useState('');
  const [cpf, setCpf] = React.useState('');
  const [registro, setRegistro] = React.useState('');
  const [especialidade, setEspecialidade] = React.useState('');
  const [vinculados, setVinculados] = React.useState<string[]>([]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, status: statusFilter });
      const [profs, procs] = await Promise.all([
        apiFetch<Profissional[]>(`/api/profissionais?${q.toString()}`),
        apiFetch<Procedimento[]>('/api/procedimentos?status=ativo'),
      ]);
      setItems(profs);
      setProcedimentos(procs);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setNome('');
    setCpf('');
    setRegistro('');
    setEspecialidade('');
    setVinculados([]);
    setDialogOpen(true);
  };

  const openEdit = (item: Profissional) => {
    setEditing(item);
    setNome(item.nome);
    setCpf(item.cpf);
    setRegistro(item.registro_conselho);
    setEspecialidade(item.especialidade);
    setVinculados(item.procedimentos_vinculados || []);
    setDialogOpen(true);
  };

  const toggleProc = (procId: string) => {
    setVinculados((prev) =>
      prev.includes(procId) ? prev.filter((id) => id !== procId) : [...prev, procId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome,
        cpf,
        registro_conselho: registro,
        especialidade,
        procedimentos_vinculados: vinculados,
      };
      if (editing) {
        await apiFetch(`/api/profissionais/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Profissional atualizado com sucesso!');
      } else {
        await apiFetch('/api/profissionais', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Profissional cadastrado com sucesso!');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: Profissional) => {
    const next = item.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await apiFetch(`/api/profissionais/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      toast.success(`✅ Profissional marcado como ${next}.`);
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const softDelete = async (item: Profissional) => {
    try {
      await apiFetch(`/api/profissionais/${item.id}`, { method: 'DELETE' });
      toast.success('✅ Profissional arquivado com soft delete (LGPD).');
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const procMap = React.useMemo(
    () => new Map(procedimentos.map((p) => [p.id, p.nome])),
    [procedimentos]
  );

  const columns: ColumnDef<Profissional>[] = [
    {
      key: 'nome',
      header: 'Profissional',
      render: (item) => (
        <div>
          <p className="font-medium text-slate-900">{item.nome}</p>
          <p className="text-xs text-slate-500">
            {item.especialidade}
            {item.registro_conselho ? ` · ${item.registro_conselho}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'cpf',
      header: 'CPF (LGPD)',
      render: (item) => (
        <span className="font-mono text-xs tabular-nums text-slate-600">
          {showFullCpf ? item.cpf : maskCPF(item.cpf)}
        </span>
      ),
    },
    {
      key: 'procedimentos',
      header: 'Procedimentos Vinculados',
      render: (item) => {
        const names = item.procedimentos_vinculados
          .map((id) => procMap.get(id))
          .filter(Boolean);
        return (
          <span className="text-xs text-slate-600">
            {names.length > 0 ? names.join(' · ') : 'Nenhum vínculo'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusText status={item.status} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações para ${item.nome}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleStatus(item)}>
              {item.status === 'ativo' ? (
                <>
                  <Ban className="h-4 w-4 text-amber-600" />
                  <span>Inativar</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  <span>Reativar</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => softDelete(item)}>
              <Trash2 className="h-4 w-4" />
              <span>Arquivar (Soft Delete)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profissionais</h1>
          <p className="mt-1 text-sm text-slate-500">
            Corpo clínico, vínculo de procedimentos habilitados e proteção de CPF conforme LGPD.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFullCpf((v) => !v)}>
          {showFullCpf ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span>{showFullCpf ? 'Mascarar CPFs' : 'Revelar CPFs'}</span>
        </Button>
      </div>

      <DataTableShell
        data={items}
        columns={columns}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, especialidade ou CPF..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        emptyTitle="Nenhum profissional encontrado"
        emptyDescription="Cadastre um profissional e vincule os procedimentos que ele está habilitado a realizar."
        getRowKey={(i) => i.id}
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span>Novo Profissional</span>
          </Button>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Profissional' : 'Cadastrar Profissional'}</DialogTitle>
            <DialogDescription>
              Selecione os procedimentos que este profissional pode atender na agenda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nome Completo</label>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Dra. Helena Vasconcelos"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">CPF</label>
                <input
                  required
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm font-mono focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Registro Conselho</label>
                <input
                  value={registro}
                  onChange={(e) => setRegistro(e.target.value)}
                  placeholder="CRM-SP 148.920"
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Especialidade</label>
              <input
                required
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value)}
                placeholder="Dermatologia"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Procedimentos Vinculados</label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-3 space-y-2.5">
                {procedimentos.map((proc) => (
                  <label key={proc.id} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                    <Checkbox
                      checked={vinculados.includes(proc.id)}
                      onCheckedChange={() => toggleProc(proc.id)}
                    />
                    <span>{proc.nome}</span>
                    <span className="ml-auto text-xs text-slate-400 tabular-nums">{proc.duracao_min} min</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Profissional'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 3. CLIENTES
// ============================================================
export function ClientesPage() {
  const [items, setItems] = React.useState<Cliente[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('todos');

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Cliente | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [nome, setNome] = React.useState('');
  const [whatsapp, setWhatsapp] = React.useState('');
  const [nascimento, setNascimento] = React.useState('');
  const [consentimento, setConsentimento] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, status: statusFilter });
      const data = await apiFetch<Cliente[]>(`/api/clientes?${q.toString()}`);
      setItems(data);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setNome('');
    setWhatsapp('');
    setNascimento('1990-01-01');
    setConsentimento(true);
    setDialogOpen(true);
  };

  const openEdit = (item: Cliente) => {
    setEditing(item);
    setNome(item.nome);
    setWhatsapp(item.whatsapp);
    setNascimento(item.nascimento);
    setConsentimento(item.lgpd_consentimento);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { nome, whatsapp, nascimento, lgpd_consentimento: consentimento };
      if (editing) {
        await apiFetch(`/api/clientes/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Cliente atualizado com sucesso!');
      } else {
        await apiFetch('/api/clientes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Cliente cadastrado com consentimento LGPD!');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: Cliente) => {
    const next = item.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await apiFetch(`/api/clientes/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      toast.success(`✅ Cliente marcado como ${next}.`);
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const softDelete = async (item: Cliente) => {
    try {
      await apiFetch(`/api/clientes/${item.id}`, { method: 'DELETE' });
      toast.success('✅ Cliente arquivado com soft delete (LGPD).');
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const columns: ColumnDef<Cliente>[] = [
    {
      key: 'nome',
      header: 'Paciente',
      render: (item) => <span className="font-medium text-slate-900">{item.nome}</span>,
    },
    {
      key: 'whatsapp',
      header: 'WhatsApp',
      render: (item) => <span className="font-mono text-xs tabular-nums text-slate-700">{item.whatsapp}</span>,
    },
    {
      key: 'nascimento',
      header: 'Nascimento',
      render: (item) => <span className="tabular-nums text-slate-600">{formatDateBR(item.nascimento)}</span>,
    },
    {
      key: 'lgpd',
      header: 'Termo LGPD',
      render: (item) => (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
          <ShieldCheck className={`h-3.5 w-3.5 ${item.lgpd_consentimento ? 'text-green-600' : 'text-amber-600'}`} />
          {item.lgpd_consentimento ? 'Consentido' : 'Pendente'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusText status={item.status} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações para ${item.nome}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleStatus(item)}>
              {item.status === 'ativo' ? (
                <>
                  <Ban className="h-4 w-4 text-amber-600" />
                  <span>Inativar</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  <span>Reativar</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => softDelete(item)}>
              <Trash2 className="h-4 w-4" />
              <span>Arquivar (Soft Delete)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Clientes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Base de pacientes com registro de consentimento LGPD, WhatsApp para confirmações e exclusão lógica.
        </p>
      </div>

      <DataTableShell
        data={items}
        columns={columns}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome ou WhatsApp..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        emptyTitle="Nenhum cliente encontrado"
        emptyDescription="Cadastre um cliente com telefone WhatsApp para iniciar agendamentos."
        getRowKey={(i) => i.id}
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span>Novo Cliente</span>
          </Button>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Cliente' : 'Cadastrar Cliente'}</DialogTitle>
            <DialogDescription>
              Dados protegidos por RLS por clínica e auditados em logs de rastreabilidade.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nome Completo</label>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Beatriz Almeida Prado"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">WhatsApp</label>
                <input
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 99999-0000"
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm font-mono focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Data de Nascimento</label>
                <input
                  type="date"
                  required
                  value={nascimento}
                  onChange={(e) => setNascimento(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 cursor-pointer">
              <Checkbox
                checked={consentimento}
                onCheckedChange={(checked) => setConsentimento(Boolean(checked))}
                className="mt-0.5"
              />
              <span>
                Paciente forneceu consentimento expresso (LGPD) para tratamento de dados clínicos e envio de
                lembretes via WhatsApp.
              </span>
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// 4. PROCEDIMENTOS
// ============================================================
export function ProcedimentosPage() {
  const [items, setItems] = React.useState<Procedimento[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('todos');

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Procedimento | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [nome, setNome] = React.useState('');
  const [duracao, setDuracao] = React.useState('30');
  const [valor, setValor] = React.useState('250');
  const [orientacoes, setOrientacoes] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search, status: statusFilter });
      const data = await apiFetch<Procedimento[]>(`/api/procedimentos?${q.toString()}`);
      setItems(data);
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setNome('');
    setDuracao('30');
    setValor('250');
    setOrientacoes('');
    setDialogOpen(true);
  };

  const openEdit = (item: Procedimento) => {
    setEditing(item);
    setNome(item.nome);
    setDuracao(String(item.duracao_min));
    setValor(String(item.valor));
    setOrientacoes(item.orientacoes);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        nome,
        duracao_min: Number(duracao),
        valor: Number(valor),
        orientacoes,
      };
      if (editing) {
        await apiFetch(`/api/procedimentos/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Procedimento atualizado com sucesso!');
      } else {
        await apiFetch('/api/procedimentos', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast.success('✅ Procedimento cadastrado com sucesso!');
      }
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: Procedimento) => {
    const next = item.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await apiFetch(`/api/procedimentos/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      toast.success(`✅ Procedimento marcado como ${next}.`);
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const softDelete = async (item: Procedimento) => {
    try {
      await apiFetch(`/api/procedimentos/${item.id}`, { method: 'DELETE' });
      toast.success('✅ Procedimento arquivado com soft delete (LGPD).');
      loadData();
    } catch (err: any) {
      toast.error(`❌ ${err.message}`);
    }
  };

  const columns: ColumnDef<Procedimento>[] = [
    {
      key: 'nome',
      header: 'Procedimento',
      render: (item) => (
        <div>
          <p className="font-medium text-slate-900">{item.nome}</p>
          {item.orientacoes ? (
            <p className="text-xs text-slate-500 max-w-md truncate">{item.orientacoes}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'duracao',
      header: 'Duração',
      align: 'right',
      render: (item) => (
        <span className="font-mono text-xs tabular-nums text-slate-700">{item.duracao_min} min</span>
      ),
    },
    {
      key: 'valor',
      header: 'Valor',
      align: 'right',
      render: (item) => (
        <span className="font-mono text-xs font-semibold tabular-nums text-slate-900">
          {formatBRL(item.valor)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusText status={item.status} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações para ${item.nome}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(item)}>
              <Pencil className="h-4 w-4" />
              <span>Editar</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleStatus(item)}>
              {item.status === 'ativo' ? (
                <>
                  <Ban className="h-4 w-4 text-amber-600" />
                  <span>Inativar</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Reativar</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => softDelete(item)}>
              <Trash2 className="h-4 w-4" />
              <span>Arquivar (Soft Delete)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Procedimentos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Catálogo clínico com duração padrão para cálculo de slots, valores e orientações pré-consulta.
        </p>
      </div>

      <DataTableShell
        data={items}
        columns={columns}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar procedimento ou orientação..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        emptyTitle="Nenhum procedimento encontrado"
        emptyDescription="Cadastre serviços clínicos com tempo e valor para habilitar agendamentos."
        getRowKey={(i) => i.id}
        primaryAction={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            <span>Novo Procedimento</span>
          </Button>
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Procedimento' : 'Cadastrar Procedimento'}</DialogTitle>
            <DialogDescription>
              A duração em minutos determina os bloqueios automáticos de profissional e consultório.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nome do Procedimento</label>
              <input
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Consulta Dermatológica Clínica"
                className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Duração (min)</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  required
                  value={duracao}
                  onChange={(e) => setDuracao(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Valor (R$)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 px-3 text-sm tabular-nums focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Orientações ao Paciente</label>
              <textarea
                rows={3}
                value={orientacoes}
                onChange={(e) => setOrientacoes(e.target.value)}
                placeholder="Ex: Trazer exames recentes e evitar uso de ácidos nas últimas 24h."
                className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editing ? 'Salvar Alterações' : 'Cadastrar Procedimento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
