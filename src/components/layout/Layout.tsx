import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell min-h-screen">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="app-content lg:pl-[270px]">
        <Header onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] p-3 sm:p-5 lg:p-6">
          <Outlet />
        </main>
        <footer className="no-print px-5 pb-6 text-center text-[11px] text-slate-400">
          Built for white-label deployment — configure branding in Settings.
        </footer>
      </div>
    </div>
  );
}
