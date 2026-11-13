import * as React from 'react';
import { cn } from '@/src/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-slate-200/75', className)} {...props} />;
}
