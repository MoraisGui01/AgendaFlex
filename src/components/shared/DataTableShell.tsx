import * as React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';

export interface ColumnDef<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (item: T) => React.ReactNode;
}

interface DataTableShellProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  emptyTitle: string;
  emptyDescription: string;
  primaryAction?: React.ReactNode;
  pageSize?: number;
  getRowKey: (item: T) => string;
}

export function DataTableShell<T>({
  data,
  columns,
  loading,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  statusFilter,
  onStatusFilterChange,
  emptyTitle,
  emptyDescription,
  primaryAction,
  pageSize = 6,
  getRowKey,
}: DataTableShellProps<T>) {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [searchValue, statusFilter, data.length]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginated = data.slice(startIdx, startIdx + pageSize);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A8A] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/20"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger aria-label="Filtrar por status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativo">Somente ativos</SelectItem>
                <SelectItem value="inativo">Somente inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {primaryAction ? <div className="shrink-0">{primaryAction}</div> : null}
      </div>

      {loading ? (
        <div className="divide-y divide-slate-100 p-4 sm:p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-32 hidden sm:block" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">{emptyDescription}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((item) => (
              <TableRow key={getRowKey(item)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    }
                  >
                    {col.render(item)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-slate-500 tabular-nums">
          Mostrando {data.length === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + pageSize, data.length)} de{' '}
          {data.length} registros
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Anterior</span>
          </Button>
          <span className="px-2 text-xs font-medium text-slate-600 tabular-nums">
            Página {safePage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            <span>Próxima</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
