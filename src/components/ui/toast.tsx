import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

type Kind = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  kind: Kind;
  text: string;
}

let push: (t: Omit<ToastMsg, 'id'>) => void = () => undefined;

export const toast = {
  success: (text: string): void => push({ kind: 'success', text }),
  error: (text: string): void => push({ kind: 'error', text }),
  info: (text: string): void => push({ kind: 'info', text }),
};

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-slate-200 bg-white text-slate-800',
};

export function Toaster(): React.JSX.Element {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random();
      setItems((p) => [...p.slice(-3), { ...t, id }]);
      window.setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3800);
    };
  }, []);
  return (
    <div className="no-print fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {items.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-pop', TONES[t.kind])}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
