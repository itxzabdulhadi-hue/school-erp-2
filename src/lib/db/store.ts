/**
 * Central data store (zustand + localStorage persistence).
 *
 * This module is the application's "database access layer": every page reads
 * through selectors (`selectors.ts`) and writes through these actions, so a
 * future backend (REST/GraphQL + relational DB) can replace the persistence
 * mechanism without touching UI code.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SCHOOL, getEnvOverrides } from '../../config/whitelabel';
import { nowISO, todayISO, uid } from '../utils';
import { buildSeedData } from './seed';
import type { SeedData } from './seed';
import type {
  AttendanceRecord,
  ExamMark,
  InventoryTxn,
  Invoice,
  InvoiceStatus,
  LibraryTransaction,
  Notification,
  Payment,
  PaymentMethod,
  SchoolSettings,
} from './types';

/** Bump to force a demo-data reseed for existing browsers. */
export const DB_VERSION = 1;

export type CollectionKey = keyof SeedData;
export type CollectionItem<K extends CollectionKey> = SeedData[K][number];
export type DB = SeedData & { school: SchoolSettings };

const COLLECTION_KEYS: CollectionKey[] = [
  'academicYears', 'classes', 'sections', 'subjects', 'classSubjects', 'departments',
  'teachers', 'staff', 'students', 'guardians', 'attendance', 'leaves', 'timetable',
  'exams', 'examSchedules', 'marks', 'gradeScales', 'feeTypes', 'feeStructures',
  'invoices', 'payments', 'assignments', 'materials', 'announcements', 'events',
  'threads', 'books', 'libraryTxns', 'vehicles', 'drivers', 'routes',
  'inventory', 'inventoryTxns', 'discipline', 'certificates', 'documents', 'notifications',
];

export const freshSchool = (): SchoolSettings => ({
  ...DEFAULT_SCHOOL,
  ...getEnvOverrides(),
  updatedAt: nowISO(),
});

export function computeInvoiceStatus(inv: Invoice, today = todayISO()): InvoiceStatus {
  if (inv.status === 'cancelled') return 'cancelled';
  if (inv.paid >= inv.total) return 'paid';
  if (inv.paid > 0) return inv.dueDate < today ? 'overdue' : 'partial';
  return inv.dueDate < today ? 'overdue' : 'unpaid';
}

function nextNumbered(prefix: string, existing: string[]): string {
  let max = 0;
  existing.forEach((v) => {
    const m = /(\d+)\s*$/.exec(v);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface GenerateInvoicesInput {
  feeStructureId: string;
  term: string;
  issueDate: string;
  dueDate: string;
  classId?: string;
}

interface DBActions {
  create<K extends CollectionKey>(
    key: K,
    input: Omit<CollectionItem<K>, 'id'> & { id?: string },
  ): string;
  update<K extends CollectionKey>(
    key: K,
    id: string,
    patch: Partial<CollectionItem<K>>,
  ): void;
  remove<K extends CollectionKey>(key: K, id: string): void;
  setSchool(patch: Partial<SchoolSettings>): void;
  upsertAttendance(records: Array<Omit<AttendanceRecord, 'id' | 'createdAt'>>): void;
  recordPayment(input: RecordPaymentInput): string;
  saveMarks(list: Array<Omit<ExamMark, 'id' | 'createdAt' | 'updatedAt'>>): void;
  issueBook(input: Omit<LibraryTransaction, 'id' | 'status' | 'fine'>): string | null;
  returnBook(txnId: string, returnDate: string, fine?: number): void;
  addInventoryTxn(input: Omit<InventoryTxn, 'id'>): void;
  generateInvoices(input: GenerateInvoicesInput): { created: number; skipped: number };
  moveStudents(studentIds: string[], classId: string, sectionId?: string): void;
  sendMessage(threadId: string, senderRole: string, senderName: string, body: string): void;
  pushNotification(n: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): void;
  markAllNotificationsRead(): void;
  refreshDerivedStatuses(): void;
  resetDemo(): void;
  replaceAll(data: DB): void;
}

type DBState = DB & DBActions;

export const useDB = create<DBState>()(
  persist(
    (set, get) => ({
      ...buildSeedData(),
      school: freshSchool(),

      create: (key, input) => {
        const id = input.id ?? uid(String(key));
        set((s) => ({ ...s, [key]: [...(s[key] as unknown[]), { ...input, id }] }));
        return id;
      },

      update: (key, id, patch) => {
        set((s) => ({
          ...s,
          [key]: (s[key] as Array<{ id: string }>).map((row) =>
            row.id === id ? { ...row, ...patch } : row,
          ),
        }));
      },

      remove: (key, id) => {
        set((s) => ({
          ...s,
          [key]: (s[key] as Array<{ id: string }>).filter((row) => row.id !== id),
        }));
      },

      setSchool: (patch) => {
        set((s) => ({ school: { ...s.school, ...patch, updatedAt: nowISO() } }));
      },

      upsertAttendance: (records) => {
        set((s) => {
          let next = [...s.attendance];
          records.forEach((rec) => {
            next = next.filter((a) => {
              if (a.date !== rec.date) return true;
              if (rec.personType === 'student') {
                return !(a.personType === 'student' && a.studentId === rec.studentId && (a.subjectId ?? '') === (rec.subjectId ?? ''));
              }
              return !(a.personType === 'employee' && a.employeeId === rec.employeeId);
            });
            next.push({ ...rec, id: uid('att'), createdAt: nowISO() });
          });
          return { ...s, attendance: next };
        });
      },

      recordPayment: (input) => {
        const s = get();
        const inv = s.invoices.find((i) => i.id === input.invoiceId);
        if (!inv) throw new Error('Invoice not found');
        const receiptNo = nextNumbered('RCPT', s.payments.map((p) => p.receiptNo));
        const payment: Payment = {
          id: uid('pay'),
          receiptNo,
          invoiceId: inv.id,
          studentId: inv.studentId,
          amount: input.amount,
          paymentDate: input.paymentDate,
          method: input.method,
          reference: input.reference,
          notes: input.notes,
          createdAt: nowISO(),
        };
        const paid = inv.paid + input.amount;
        const status = computeInvoiceStatus({ ...inv, paid });
        set((st) => ({
          ...st,
          payments: [payment, ...st.payments],
          invoices: st.invoices.map((i) => (i.id === inv.id ? { ...i, paid, status } : i)),
        }));
        return payment.id;
      },

      saveMarks: (list) => {
        set((s) => {
          let next = [...s.marks];
          list.forEach((m) => {
            const idx = next.findIndex(
              (x) => x.examId === m.examId && x.scheduleId === m.scheduleId && x.studentId === m.studentId,
            );
            if (idx >= 0) {
              next[idx] = { ...next[idx], ...m, updatedAt: nowISO() };
            } else {
              next.push({ ...m, id: uid('mk'), createdAt: nowISO(), updatedAt: nowISO() });
            }
          });
          return { ...s, marks: next };
        });
      },

      issueBook: (input) => {
        const s = get();
        const book = s.books.find((b) => b.id === input.bookId);
        if (!book || book.available <= 0) return null;
        const id = uid('lib');
        const txn: LibraryTransaction = { ...input, id, status: 'issued', fine: 0 };
        set((st) => ({
          ...st,
          libraryTxns: [txn, ...st.libraryTxns],
          books: st.books.map((b) => (b.id === book.id ? { ...b, available: b.available - 1 } : b)),
        }));
        return id;
      },

      returnBook: (txnId, returnDate, fine = 0) => {
        const s = get();
        const txn = s.libraryTxns.find((t) => t.id === txnId);
        if (!txn || txn.status === 'returned') return;
        set((st) => ({
          ...st,
          libraryTxns: st.libraryTxns.map((t) =>
            t.id === txnId ? { ...t, status: 'returned', returnDate, fine } : t,
          ),
          books: st.books.map((b) =>
            b.id === txn.bookId ? { ...b, available: Math.min(b.quantity, b.available + 1) } : b,
          ),
        }));
      },

      addInventoryTxn: (input) => {
        const delta = input.type === 'purchase' || input.type === 'return' ? input.quantity
          : input.type === 'transfer' ? 0 : -input.quantity;
        set((s) => ({
          ...s,
          inventoryTxns: [{ ...input, id: uid('itx') }, ...s.inventoryTxns],
          inventory: s.inventory.map((item) =>
            item.id === input.itemId
              ? { ...item, quantity: Math.max(0, item.quantity + delta) }
              : item,
          ),
        }));
      },

      generateInvoices: (input) => {
        const s = get();
        const structure = s.feeStructures.find((f) => f.id === input.feeStructureId);
        if (!structure) return { created: 0, skipped: 0 };
        const pupils = s.students.filter(
          (st) =>
            st.status === 'active' &&
            !st.archived &&
            (!input.classId || st.classId === input.classId) &&
            (!structure.classId || st.classId === structure.classId),
        );
        let created = 0;
        let skipped = 0;
        const invoices: Invoice[] = [];
        pupils.forEach((st, i) => {
          const dup = s.invoices.some(
            (v) => v.studentId === st.id && v.term === input.term && v.status !== 'cancelled',
          );
          if (dup) {
            skipped++;
            return;
          }
          const items = structure.items.map((it, idx) => {
            const ft = s.feeTypes.find((f) => f.id === it.feeTypeId);
            return { id: uid(`ii${i}${idx}`), feeTypeId: it.feeTypeId, label: ft?.name ?? 'Fee', amount: it.amount };
          });
          if (st.routeId) {
            const tr = s.feeTypes.find((f) => f.id === 'ft_trn');
            if (tr) items.push({ id: uid(`iitr${i}`), feeTypeId: tr.id, label: tr.name, amount: tr.defaultAmount });
          }
          const total = items.reduce((a, b) => a + b.amount, 0);
          const invoiceNo = nextNumbered('INV', [...s.invoices.map((v) => v.invoiceNo), ...invoices.map((v) => v.invoiceNo)]);
          const draft: Invoice = {
            id: uid('inv'),
            invoiceNo,
            studentId: st.id,
            academicYearId: st.academicYearId,
            term: input.term,
            issueDate: input.issueDate,
            dueDate: input.dueDate,
            items,
            discount: 0,
            fine: 0,
            total,
            paid: 0,
            status: 'unpaid',
            createdAt: nowISO(),
          };
          invoices.push({ ...draft, status: computeInvoiceStatus(draft) });
          created++;
        });
        if (invoices.length) {
          set((st) => ({ ...st, invoices: [...invoices, ...st.invoices] }));
        }
        return { created, skipped };
      },

      moveStudents: (studentIds, classId, sectionId) => {
        set((s) => ({
          ...s,
          students: s.students.map((st) =>
            studentIds.includes(st.id)
              ? { ...st, classId, sectionId: sectionId ?? st.sectionId, updatedAt: nowISO() }
              : st,
          ),
        }));
      },

      sendMessage: (threadId, senderRole, senderName, body) => {
        set((s) => ({
          ...s,
          threads: s.threads.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  messages: [...t.messages, { id: uid('m'), threadId, senderRole, senderName, body, sentAt: nowISO(), read: true }],
                  updatedAt: nowISO(),
                }
              : t,
          ),
        }));
      },

      pushNotification: (n) => {
        set((s) => ({
          ...s,
          notifications: [{ ...n, id: uid('ntf'), createdAt: nowISO(), isRead: false }, ...s.notifications].slice(0, 200),
        }));
      },

      markAllNotificationsRead: () => {
        set((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, isRead: true })) }));
      },

      refreshDerivedStatuses: () => {
        const t = todayISO();
        set((s) => ({
          ...s,
          invoices: s.invoices.map((inv) =>
            inv.status === 'paid' || inv.status === 'cancelled' ? inv : { ...inv, status: computeInvoiceStatus(inv, t) },
          ),
          libraryTxns: s.libraryTxns.map((tx) =>
            tx.status === 'issued' && tx.dueDate < t ? { ...tx, status: 'overdue' as const } : tx,
          ),
        }));
      },

      resetDemo: () => {
        set((s) => ({ ...s, ...buildSeedData(), school: freshSchool() }));
      },

      replaceAll: (data) => {
        const next: Record<string, unknown> = {};
        COLLECTION_KEYS.forEach((k) => {
          const v = (data as unknown as Record<string, unknown>)[k];
          if (Array.isArray(v)) next[k] = v;
        });
        if (data.school && typeof data.school === 'object') next.school = { ...freshSchool(), ...data.school };
        set((s) => ({ ...s, ...next }));
      },
    }),
    {
      name: 'school-erp-db',
      version: DB_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const out: Record<string, unknown> = { school: s.school };
        COLLECTION_KEYS.forEach((k) => {
          out[k] = s[k];
        });
        return out as unknown as DBState;
      },
      migrate: () => ({ ...buildSeedData(), school: freshSchool() }) as unknown as DBState,
    },
  ),
);

/** Convenience: snapshot of data collections (for selectors outside React). */
export function getDB(): DB {
  const s = useDB.getState();
  const db = {} as DB;
  COLLECTION_KEYS.forEach((k) => {
    (db as unknown as Record<string, unknown>)[k] = s[k];
  });
  db.school = s.school;
  return db;
}
