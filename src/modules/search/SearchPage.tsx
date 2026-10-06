import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDB } from '../../lib/db/store';
import { borrowerName, classLabel, staffName, studentName, teacherName } from '../../lib/db/selectors';
import { useMoney } from '../../lib/useSchool';
import { matchesQuery } from '../../lib/utils';
import { Card, CardHeader, PageHeader, SearchInput, StatusPill } from '../../components/ui/primitives';

export function SearchPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const money = useMoney();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const students = useMemo(
    () => (q.trim() ? snap.students.filter((s) => matchesQuery(q, studentName(s), s.studentId, s.admissionNo, s.phone)).slice(0, 8) : []),
    [snap, q],
  );
  const teachers = useMemo(
    () => (q.trim() ? snap.teachers.filter((t) => matchesQuery(q, teacherName(t), t.employeeId, t.phone)).slice(0, 5) : []),
    [snap, q],
  );
  const staff = useMemo(
    () => (q.trim() ? snap.staff.filter((t) => matchesQuery(q, staffName(t), t.employeeId)).slice(0, 5) : []),
    [snap, q],
  );
  const invoices = useMemo(
    () => (q.trim() ? snap.invoices.filter((i) => matchesQuery(q, i.invoiceNo, borrowerName(snap, 'student', i.studentId))).slice(0, 6) : []),
    [snap, q],
  );
  const books = useMemo(
    () => (q.trim() ? snap.books.filter((b) => matchesQuery(q, b.title, b.author, b.isbn)).slice(0, 5) : []),
    [snap, q],
  );
  const announcements = useMemo(
    () => (q.trim() ? snap.announcements.filter((a) => matchesQuery(q, a.title, a.body)).slice(0, 4) : []),
    [snap, q],
  );
  const total = students.length + teachers.length + staff.length + invoices.length + books.length + announcements.length;

  return (
    <div>
      <PageHeader title="Search" subtitle={q.trim() ? `${total} top results for "${q}"` : 'Search across the whole ERP'} />
      <SearchInput value={q} onChange={setQ} placeholder="Students, staff, invoices, books…" className="mb-4 max-w-xl" />
      {!q.trim() ? (
        <Card><p className="px-5 py-10 text-center text-sm text-slate-400">Start typing to search students, employees, invoices, books and announcements.</p></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Students" action={<Link to="/students" className="link text-xs">Advanced filters</Link>} />
            <ul className="divide-y divide-slate-50">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-2">
                  <div><Link to={`/students/${s.id}`} className="link text-sm">{studentName(s)}</Link><p className="text-xs text-slate-400">{s.studentId} · {classLabel(snap, s.classId, s.sectionId)}</p></div>
                  <StatusPill status={s.status} />
                </li>
              ))}
              {students.length === 0 ? <li className="px-5 py-4 text-sm text-slate-400">No matches.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Invoices" action={<Link to="/fees" className="link text-xs">Finance</Link>} />
            <ul className="divide-y divide-slate-50">
              {invoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between px-5 py-2">
                  <div><Link to={`/print/invoice/${i.id}`} className="link text-sm">{i.invoiceNo}</Link><p className="text-xs text-slate-400">{borrowerName(snap, 'student', i.studentId)}</p></div>
                  <span className="text-sm font-bold">{money(i.total - i.paid)} <StatusPill status={i.status} /></span>
                </li>
              ))}
              {invoices.length === 0 ? <li className="px-5 py-4 text-sm text-slate-400">No matches.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Teachers & staff" />
            <ul className="divide-y divide-slate-50">
              {teachers.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-2">
                  <div><Link to={`/teachers/${t.id}`} className="link text-sm">{teacherName(t)}</Link><p className="text-xs text-slate-400">{t.employeeId} · Teacher</p></div>
                  <StatusPill status={t.status} />
                </li>
              ))}
              {staff.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-2">
                  <div><Link to="/staff" className="link text-sm">{staffName(t)}</Link><p className="text-xs text-slate-400">{t.employeeId} · {t.designation}</p></div>
                  <StatusPill status={t.status} />
                </li>
              ))}
              {teachers.length + staff.length === 0 ? <li className="px-5 py-4 text-sm text-slate-400">No matches.</li> : null}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Library & announcements" />
            <ul className="divide-y divide-slate-50">
              {books.map((b) => (
                <li key={b.id} className="px-5 py-2"><Link to="/library" className="link text-sm">{b.title}</Link><p className="text-xs text-slate-400">{b.author} · {b.available}/{b.quantity} available</p></li>
              ))}
              {announcements.map((a) => (
                <li key={a.id} className="px-5 py-2"><Link to="/announcements" className="link text-sm">{a.title}</Link><p className="text-xs text-slate-400">Announcement · {a.category}</p></li>
              ))}
              {books.length + announcements.length === 0 ? <li className="px-5 py-4 text-sm text-slate-400">No matches.</li> : null}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
