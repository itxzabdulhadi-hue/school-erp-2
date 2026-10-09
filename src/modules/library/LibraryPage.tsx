import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Download, Library as LibraryIcon, Plus, Trash2 } from 'lucide-react';
import { useDB } from '../../lib/db/store';
import { borrowerName, classLabel, staffName, studentName, teacherName } from '../../lib/db/selectors';
import type { Book, LibraryTransaction, LibraryTxnStatus } from '../../lib/db/types';
import { useFmt, useMoney } from '../../lib/useSchool';
import { hasErrors, required } from '../../lib/validation';
import type { Errors } from '../../lib/validation';
import { exportCSV, matchesQuery, nowISO, todayISO } from '../../lib/utils';
import { Card, ConfirmDialog, Field, Modal, PageHeader, SearchInput, StatCard, StatusPill, Tabs } from '../../components/ui/primitives';
import { DataTable } from '../../components/ui/DataTable';
import { toast } from '../../components/ui/toast';

type TabId = 'books' | 'circulation' | 'overdue';

export function LibraryPage(): React.JSX.Element {
  const snap = useDB((s) => s);
  const money = useMoney();
  const [tab, setTab] = useState<TabId>('books');
  const [bookModal, setBookModal] = useState<{ mode: 'add' | 'edit'; row?: Book } | null>(null);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const total = snap.books.reduce((a, b) => a + b.quantity, 0);
  const available = snap.books.reduce((a, b) => a + b.available, 0);
  const out = snap.libraryTxns.filter((t) => t.status === 'issued').length;
  const overdue = snap.libraryTxns.filter((t) => t.status === 'overdue').length;

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Catalogue, circulation and overdue tracking"
        actions={
          tab === 'books'
            ? <button type="button" className="btn-primary" onClick={() => setBookModal({ mode: 'add' })}><Plus className="h-4 w-4" /> Add book</button>
            : <button type="button" className="btn-primary" onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4" /> Issue book</button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={LibraryIcon} label="Total copies" value={String(total)} sub={`${snap.books.length} titles`} tone="bg-blue-100 text-blue-700" />
        <StatCard icon={BookOpen} label="Available" value={String(available)} tone="bg-emerald-100 text-emerald-700" />
        <StatCard icon={BookOpen} label="Borrowed" value={String(out)} tone="bg-amber-100 text-amber-700" />
        <StatCard icon={BookOpen} label="Overdue" value={String(overdue)} sub={`${money(snap.libraryTxns.filter((t) => t.status === 'overdue').reduce((a, t) => a + t.fine, 0))} fines`} tone="bg-red-100 text-red-700" />
      </div>
      <Card>
        <div className="p-3">
          <Tabs<TabId>
            active={tab} onChange={setTab}
            tabs={[
              { id: 'books', label: 'Catalogue', count: snap.books.length },
              { id: 'circulation', label: 'Circulation', count: snap.libraryTxns.length },
              { id: 'overdue', label: 'Overdue', count: overdue },
            ]}
          />
        </div>
        {tab === 'books' ? <BooksTab onEdit={(row) => setBookModal({ mode: 'edit', row })} onDelete={setDeleting} /> : null}
        {tab === 'circulation' ? <CirculationTab /> : null}
        {tab === 'overdue' ? <CirculationTab overdueOnly /> : null}
      </Card>
      <BookModal key={bookModal ? `${bookModal.mode}-${bookModal.row?.id ?? "new"}` : "closed"} modal={bookModal} onClose={() => setBookModal(null)} />
      <IssueModal key={issueOpen ? 'open' : 'closed'} open={issueOpen} onClose={() => setIssueOpen(false)} />
      <ConfirmDialog
        open={!!deleting} title={`Delete "${deleting?.title}"?`} message="Borrowing history for this title is kept." confirmLabel="Delete"
        onConfirm={() => { if (deleting) useDB.getState().remove('books', deleting.id); toast.success('Deleted'); setDeleting(null); }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function BooksTab(props: { onEdit: (b: Book) => void; onDelete: (b: Book) => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const cats = useMemo(() => [...new Set(snap.books.map((b) => b.category ?? 'Uncategorised'))], [snap]);
  const filtered = useMemo(
    () => snap.books.filter((b) => (!cat || (b.category ?? 'Uncategorised') === cat) && matchesQuery(q, b.title, b.author, b.isbn, b.shelf)),
    [snap, q, cat],
  );
  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-2">
        <SearchInput value={q} onChange={setQ} placeholder="Title, author, ISBN…" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="input">
          <option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <DataTable
        columns={[
          { key: 'title', header: 'Title', render: (b: Book) => <span className="font-semibold">{b.title}<span className="block text-xs font-normal text-slate-400">{b.isbn ?? 'No ISBN'}</span></span>, sortValue: (b) => b.title },
          { key: 'author', header: 'Author', render: (b: Book) => b.author, sortValue: (b) => b.author },
          { key: 'cat', header: 'Category', render: (b: Book) => b.category ?? '—' },
          { key: 'shelf', header: 'Shelf', render: (b: Book) => b.shelf ?? '—' },
          { key: 'qty', header: 'Qty', render: (b: Book) => b.quantity, sortValue: (b) => b.quantity },
          { key: 'avail', header: 'Available', render: (b: Book) => <span className={b.available === 0 ? 'font-bold text-red-600' : 'font-bold text-emerald-700'}>{b.available}</span>, sortValue: (b) => b.available },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (b: Book) => (
              <div className="flex justify-end gap-1">
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => props.onEdit(b)}>Edit</button>
                <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => props.onDelete(b)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        data={filtered}
        keyOf={(b) => b.id}
        emptyTitle="No books found"
      />
    </div>
  );
}

function BookModal(props: { modal: { mode: 'add' | 'edit'; row?: Book } | null; onClose: () => void }): React.JSX.Element {
  const create = useDB((s) => s.create);
  const update = useDB((s) => s.update);
  const row = props.modal?.row;
  const [f, setF] = useState({
    title: row?.title ?? '', author: row?.author ?? '', isbn: row?.isbn ?? '', publisher: row?.publisher ?? '',
    category: row?.category ?? '', quantity: String(row?.quantity ?? 1), shelf: row?.shelf ?? '', publishedYear: row?.publishedYear ? String(row.publishedYear) : '',
  });
  const [errors, setErrors] = useState<Errors>({});
  if (!props.modal) return <></>;
  const set = (p: Partial<typeof f>): void => setF((x) => ({ ...x, ...p }));
  const save = (): void => {
    const e: Errors = {};
    if (required(f.title)) e.title = 'Required';
    if (required(f.author)) e.author = 'Required';
    setErrors(e);
    if (hasErrors(e)) return;
    const quantity = Math.max(1, Number(f.quantity) || 1);
    if (row) {
      const diff = quantity - row.quantity;
      update('books', row.id, {
        title: f.title.trim(), author: f.author.trim(), isbn: f.isbn.trim() || undefined,
        publisher: f.publisher.trim() || undefined, category: f.category.trim() || undefined,
        quantity, available: Math.max(0, row.available + diff), shelf: f.shelf.trim() || undefined,
        publishedYear: f.publishedYear ? Number(f.publishedYear) : undefined,
      });
      toast.success('Book updated');
    } else {
      create('books', {
        title: f.title.trim(), author: f.author.trim(), isbn: f.isbn.trim() || undefined,
        publisher: f.publisher.trim() || undefined, category: f.category.trim() || undefined,
        quantity, available: quantity, shelf: f.shelf.trim() || undefined,
        publishedYear: f.publishedYear ? Number(f.publishedYear) : undefined, createdAt: nowISO(),
      });
      toast.success('Book added to catalogue');
    }
    props.onClose();
  };
  return (
    <Modal open onClose={props.onClose} title={row ? 'Edit book' : 'Add book'}
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2"><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Author" error={errors.author}><input className="input" value={f.author} onChange={(e) => set({ author: e.target.value })} /></Field>
        <Field label="ISBN" optional><input className="input" value={f.isbn} onChange={(e) => set({ isbn: e.target.value })} /></Field>
        <Field label="Publisher" optional><input className="input" value={f.publisher} onChange={(e) => set({ publisher: e.target.value })} /></Field>
        <Field label="Category" optional><input className="input" value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder="Fiction / Textbook / …" /></Field>
        <Field label="Quantity"><input type="number" min={1} className="input" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></Field>
        <Field label="Shelf" optional><input className="input" value={f.shelf} onChange={(e) => set({ shelf: e.target.value })} placeholder="A-3" /></Field>
        <Field label="Published year" optional><input type="number" className="input" value={f.publishedYear} onChange={(e) => set({ publishedYear: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CirculationTab(props: { overdueOnly?: boolean }): React.JSX.Element {
  const snap = useDB((s) => s);
  const returnBook = useDB((s) => s.returnBook);
  const fmt = useFmt();
  const money = useMoney();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [returning, setReturning] = useState<LibraryTransaction | null>(null);
  const [fine, setFine] = useState('0');

  const filtered = useMemo(
    () => [...snap.libraryTxns].sort((a, b) => b.issueDate.localeCompare(a.issueDate))
      .filter((t) =>
        (props.overdueOnly ? t.status === 'overdue' : (!status || t.status === status)) &&
        matchesQuery(q, snap.books.find((b) => b.id === t.bookId)?.title, borrowerName(snap, t.borrowerType, t.borrowerId)),
      ),
    [snap, q, status, props.overdueOnly],
  );

  return (
    <div>
      <div className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
        <SearchInput value={q} onChange={setQ} placeholder="Book or borrower…" />
        {props.overdueOnly ? <div /> : (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input capitalize">
            <option value="">All statuses</option>
            {(['issued', 'returned', 'overdue', 'lost'] as LibraryTxnStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button
          type="button" className="btn-secondary"
          onClick={() => {
            exportCSV('library-circulation', ['Book', 'Borrower', 'Type', 'Issued', 'Due', 'Returned', 'Fine', 'Status'],
              filtered.map((t) => [snap.books.find((b) => b.id === t.bookId)?.title ?? '', borrowerName(snap, t.borrowerType, t.borrowerId), t.borrowerType, fmt.date(t.issueDate), fmt.date(t.dueDate), t.returnDate ? fmt.date(t.returnDate) : '', t.fine, t.status]));
            toast.success('Circulation exported');
          }}
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>
      <DataTable
        columns={[
          { key: 'book', header: 'Book', render: (t: LibraryTransaction) => <span className="font-medium">{snap.books.find((b) => b.id === t.bookId)?.title ?? '—'}</span> },
          {
            key: 'who', header: 'Borrower',
            render: (t: LibraryTransaction) => t.borrowerType === 'student'
              ? <Link to={`/students/${t.borrowerId}`} className="link">{borrowerName(snap, t.borrowerType, t.borrowerId)}</Link>
              : <span>{borrowerName(snap, t.borrowerType, t.borrowerId)} <span className="text-xs text-slate-400">({t.borrowerType})</span></span>,
          },
          { key: 'issued', header: 'Issued', render: (t: LibraryTransaction) => fmt.date(t.issueDate), sortValue: (t) => t.issueDate },
          { key: 'due', header: 'Due', render: (t: LibraryTransaction) => <span className={t.status === 'overdue' ? 'font-bold text-red-600' : ''}>{fmt.date(t.dueDate)}</span>, sortValue: (t) => t.dueDate },
          { key: 'fine', header: 'Fine', render: (t: LibraryTransaction) => (t.fine ? money(t.fine) : '—') },
          { key: 'status', header: 'Status', render: (t: LibraryTransaction) => <StatusPill status={t.status} /> },
          {
            key: 'actions', header: 'Actions', className: 'text-right',
            render: (t: LibraryTransaction) => (t.status === 'issued' || t.status === 'overdue')
              ? <button type="button" className="btn-secondary !py-1 text-xs" onClick={() => { setReturning(t); setFine(String(t.fine ?? 0)); }}>Return</button>
              : <span className="text-xs text-slate-400">{t.returnDate ? fmt.date(t.returnDate) : '—'}</span>,
          },
        ]}
        data={filtered}
        keyOf={(t) => t.id}
        emptyTitle={props.overdueOnly ? 'Nothing overdue — lovely' : 'No transactions'}
      />
      <Modal open={!!returning} onClose={() => setReturning(null)} title="Return book" size="sm"
        footer={<><button type="button" className="btn-secondary" onClick={() => setReturning(null)}>Cancel</button><button
          type="button" className="btn-primary"
          onClick={() => { if (returning) returnBook(returning.id, todayISO(), Number(fine) || 0); toast.success('Book returned'); setReturning(null); }}
        >Confirm return</button></>}>
        <Field label="Fine (if any)"><input type="number" min={0} className="input" value={fine} onChange={(e) => setFine(e.target.value)} /></Field>
      </Modal>
    </div>
  );
}

function IssueModal(props: { open: boolean; onClose: () => void }): React.JSX.Element {
  const snap = useDB((s) => s);
  const issue = useDB((s) => s.issueBook);
  const [f, setF] = useState({ bookId: '', borrowerType: 'student' as 'student' | 'teacher' | 'staff', borrowerId: '', issueDate: todayISO(), dueDate: '', notes: '' });
  if (!props.open) return <></>;
  const people = f.borrowerType === 'student'
    ? snap.students.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${studentName(s)} — ${classLabel(snap, s.classId, s.sectionId)}` }))
    : f.borrowerType === 'teacher'
      ? snap.teachers.map((t) => ({ id: t.id, label: teacherName(t) }))
      : snap.staff.map((t) => ({ id: t.id, label: staffName(t) }));
  const book = snap.books.find((b) => b.id === f.bookId);

  return (
    <Modal open onClose={props.onClose} title="Issue book"
      footer={<><button type="button" className="btn-secondary" onClick={props.onClose}>Cancel</button><button
        type="button" className="btn-primary"
        disabled={!f.bookId || !f.borrowerId || !f.dueDate}
        onClick={() => {
          const id = issue({ bookId: f.bookId, borrowerType: f.borrowerType, borrowerId: f.borrowerId, issueDate: f.issueDate, dueDate: f.dueDate, notes: f.notes.trim() || undefined });
          if (!id) {
            toast.error('No copies available');
            return;
          }
          toast.success('Book issued');
          props.onClose();
        }}
      >Issue</button></>}>
      <div className="grid gap-3">
        <Field label="Book">
          <select className="input" value={f.bookId} onChange={(e) => setF({ ...f, bookId: e.target.value })}>
            <option value="">Select…</option>
            {snap.books.map((b) => <option key={b.id} value={b.id} disabled={b.available <= 0}>{b.title} — {b.available}/{b.quantity} available</option>)}
          </select>
        </Field>
        {book && book.available <= 0 ? <p className="text-xs text-red-600">All copies are currently on loan.</p> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Borrower type">
            <select className="input capitalize" value={f.borrowerType} onChange={(e) => setF({ ...f, borrowerType: e.target.value as typeof f.borrowerType, borrowerId: '' })}>
              <option value="student">Student</option><option value="teacher">Teacher</option><option value="staff">Staff</option>
            </select>
          </Field>
          <Field label="Borrower">
            <select className="input" value={f.borrowerId} onChange={(e) => setF({ ...f, borrowerId: e.target.value })}>
              <option value="">Select…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issue date"><input type="date" className="input" value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} /></Field>
          <Field label="Due date"><input type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        </div>
        <Field label="Notes" optional><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
