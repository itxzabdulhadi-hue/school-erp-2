import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { EmptyState } from './primitives';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyOf: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
}

export function DataTable<T>(props: Props<T>): React.JSX.Element {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const pageSize = props.pageSize ?? 10;

  useEffect(() => {
    setPage(1);
  }, [props.data.length]);

  const sorted = useMemo(() => {
    if (!sortKey) return props.data;
    const col = props.columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return props.data;
    const fn = col.sortValue;
    return [...props.data].sort((a, b) => {
      const va = fn(a);
      const vb = fn(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });
  }, [props.data, props.columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const from = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(sorted.length, safePage * pageSize);

  const toggleSort = (col: Column<T>): void => {
    if (!col.sortValue) return;
    if (sortKey === col.key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(col.key);
      setSortDir(1);
    }
  };

  if (props.data.length === 0) {
    return <EmptyState title={props.emptyTitle ?? 'No records found'} hint={props.emptyHint} action={props.emptyAction} />;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="table-head">
              {props.columns.map((c) => (
                <th key={c.key} className={cn('px-4 py-2.5', c.className)}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c)} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
                      {c.header}
                      {sortKey === c.key ? (
                        sortDir === 1 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={props.keyOf(row)}
                onClick={props.onRowClick ? () => props.onRowClick?.(row) : undefined}
                className={cn('transition hover:bg-slate-50', props.onRowClick && 'cursor-pointer')}
              >
                {props.columns.map((c) => (
                  <td key={c.key} className={cn('table-cell', c.className)}>
                    {c.render ? c.render(row) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-500">
          Showing {from}–{to} of {sorted.length}
        </p>
        <div className="flex items-center gap-1">
          {props.footer}
          <button type="button" className="btn-ghost !px-2 !py-1" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-medium text-slate-600">Page {safePage} of {totalPages}</span>
          <button type="button" className="btn-ghost !px-2 !py-1" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
