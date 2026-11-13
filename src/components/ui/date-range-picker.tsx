import * as React from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover';
import { cn } from '@/src/lib/utils';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [monthCursor, setMonthCursor] = React.useState<Date>(value.to || new Date());
  const [draftStart, setDraftStart] = React.useState<Date | null>(null);

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const handleDayClick = (day: Date) => {
    if (!draftStart) {
      setDraftStart(day);
      return;
    }
    if (isBefore(day, draftStart)) {
      onChange({ from: day, to: draftStart });
    } else {
      onChange({ from: draftStart, to: day });
    }
    setDraftStart(null);
    setOpen(false);
  };

  const applyPreset = (daysBack: number) => {
    const end = new Date();
    const start = subDays(end, daysBack);
    onChange({ from: start, to: end });
    setDraftStart(null);
    setOpen(false);
  };

  const label = `${format(value.from, 'dd MMM yyyy', { locale: ptBR })} – ${format(
    value.to,
    'dd MMM yyyy',
    { locale: ptBR }
  )}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('justify-start text-left font-normal tabular-nums', className)}
        >
          <CalendarIcon className="h-4 w-4 text-[#1E3A8A]" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] sm:w-[340px]" align="end">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={() => applyPreset(6)}
              className="min-h-[34px] rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(13)}
              className="min-h-[34px] rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              14 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(29)}
              className="min-h-[34px] rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              30 dias
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange({ from: startOfMonth(now), to: endOfMonth(now) });
                setDraftStart(null);
                setOpen(false);
              }}
              className="min-h-[34px] rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Este mês
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMonthCursor((m) => subMonths(m, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-slate-900">
              {format(monthCursor, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setMonthCursor((m) => addMonths(m, 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = isSameMonth(day, monthCursor);
              const isSelectedEdge = draftStart
                ? isSameDay(day, draftStart)
                : isSameDay(day, value.from) || isSameDay(day, value.to);
              const isInRange =
                !draftStart && isAfter(day, value.from) && isBefore(day, value.to);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'h-9 w-full rounded-lg text-xs font-medium tabular-nums transition-colors cursor-pointer',
                    !inMonth && 'text-slate-300',
                    inMonth && !isSelectedEdge && !isInRange && 'text-slate-700 hover:bg-slate-100',
                    isInRange && 'bg-blue-50 text-[#1E3A8A]',
                    isSelectedEdge && 'bg-[#1E3A8A] text-white font-semibold'
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            {draftStart
              ? `Início selecionado: ${format(draftStart, 'dd/MM/yyyy')}. Selecione a data final.`
              : 'Clique em uma data inicial e final para filtrar o período.'}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
