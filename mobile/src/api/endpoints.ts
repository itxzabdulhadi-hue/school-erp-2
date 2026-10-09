import type { ApiClient } from './client';
import type {
  Announcement, AttendanceRecord, AttendanceSummary, ClassItem, DocumentItem, EventItem,
  Exam, ExamSchedule, FullSchool, Homework, Invoice, Material, NotificationItem,
  Payment, PublicBrand, ReceiptPayload, ResultsPayload, SessionPayload, Staff,
  Student, Submission, Subject, Teacher, TimetableSlot, User,
} from './types';

export interface ListQuery {
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  status?: string;
  search?: string;
  studentId?: string;
  invoiceId?: string;
  examId?: string;
  date?: string;
  from?: string;
  to?: string;
  kind?: string;
  ownerType?: string;
  ownerId?: string;
  mine?: string;
  teacherId?: string;
  [key: string]: string | undefined;
}

/** Typed wrapper over every v1 endpoint the mobile app uses. */
export function createApi(client: ApiClient) {
  return {
    auth: {
      login: (b: { email: string; password: string; schoolSlug?: string; deviceLabel?: string }): Promise<SessionPayload> =>
        client.post('/api/v1/auth/login', b, { anonymous: true }),
      refresh: (refreshToken: string): Promise<SessionPayload> =>
        client.post('/api/v1/auth/refresh', { refreshToken }, { anonymous: true }),
      logout: (refreshToken: string): Promise<{ ok: boolean }> =>
        client.post('/api/v1/auth/logout', { refreshToken }, { anonymous: true }),
      me: (): Promise<{ user: User; permissions: string[] }> => client.get('/api/v1/auth/me'),
    },
    school: {
      publicBrand: (slug: string): Promise<PublicBrand> =>
        client.get('/api/v1/school/public', { slug }, { anonymous: true }),
      full: (): Promise<FullSchool> => client.get('/api/v1/school'),
    },
    students: {
      list: (q?: ListQuery): Promise<Student[]> => client.get('/api/v1/students', q),
      get: (id: string): Promise<Student> => client.get(`/api/v1/students/${id}`),
      create: (b: Record<string, unknown>): Promise<Student> => client.post('/api/v1/students', b),
      update: (id: string, b: Record<string, unknown>): Promise<Student> => client.patch(`/api/v1/students/${id}`, b),
    },
    teachers: {
      list: (): Promise<Teacher[]> => client.get('/api/v1/teachers'),
      get: (id: string): Promise<Teacher> => client.get(`/api/v1/teachers/${id}`),
    },
    staff: {
      list: (): Promise<Staff[]> => client.get('/api/v1/staff'),
      get: (id: string): Promise<Staff> => client.get(`/api/v1/staff/${id}`),
    },
    users: {
      list: (): Promise<User[]> => client.get('/api/v1/users'),
      create: (b: Record<string, unknown>): Promise<User> => client.post('/api/v1/users', b),
      update: (id: string, b: Record<string, unknown>): Promise<User> => client.patch(`/api/v1/users/${id}`, b),
    },
    classes: { list: (): Promise<ClassItem[]> => client.get('/api/v1/classes') },
    subjects: { list: (classId?: string): Promise<Subject[]> => client.get('/api/v1/subjects', { classId }) },
    timetable: { list: (q?: ListQuery): Promise<TimetableSlot[]> => client.get('/api/v1/timetable', q) },
    exams: {
      list: (): Promise<Exam[]> => client.get('/api/v1/exams'),
      get: (id: string, classId?: string): Promise<Exam & { schedules: ExamSchedule[] }> =>
        client.get(`/api/v1/exams/${id}`, { classId }),
    },
    results: {
      get: (examId: string, classId?: string, studentId?: string): Promise<ResultsPayload> =>
        client.get('/api/v1/results', { examId, classId, studentId }),
    },
    marks: {
      save: (b: { scheduleId: string; studentId: string; obtainedMarks: number; isAbsent?: boolean; remarks?: string }): Promise<{ ok: boolean }> =>
        client.post('/api/v1/marks', b),
      bulk: (b: { scheduleId: string; rows: { studentId: string; obtainedMarks: number; isAbsent?: boolean }[] }): Promise<{ saved: number }> =>
        client.post('/api/v1/marks/bulk', b),
    },
    attendance: {
      sheet: (q: ListQuery): Promise<AttendanceRecord[]> => client.get('/api/v1/attendance', q),
      me: (q?: { from?: string; to?: string }): Promise<{ records: AttendanceRecord[]; summary: AttendanceSummary }> =>
        client.get('/api/v1/attendance/me', q),
      summary: (q: { studentId: string; from?: string; to?: string }): Promise<AttendanceSummary & { studentId: string }> =>
        client.get('/api/v1/attendance/summary', q),
      bulk: (b: { date: string; classId: string; sectionId?: string | null; subjectId?: string | null; records: { studentId: string; status: string; remarks?: string }[] }): Promise<{ saved: number }> =>
        client.post('/api/v1/attendance/bulk', b),
    },
    invoices: {
      list: (q?: ListQuery): Promise<Invoice[]> => client.get('/api/v1/invoices', q),
      get: (id: string): Promise<Invoice> => client.get(`/api/v1/invoices/${id}`),
      create: (b: Record<string, unknown>): Promise<{ id: string }> => client.post('/api/v1/invoices', b),
    },
    payments: {
      list: (q?: ListQuery): Promise<Payment[]> => client.get('/api/v1/payments', q),
      create: (b: { invoiceId: string; amount: number; method?: string; reference?: string; paymentDate?: string; notes?: string }): Promise<{ id: string; receiptNo: string; status: string }> =>
        client.post('/api/v1/payments', b),
    },
    receipts: { get: (paymentId: string): Promise<ReceiptPayload> => client.get(`/api/v1/receipts/${paymentId}`) },
    feeTypes: { list: (): Promise<{ id: string; name: string; frequency: string; amount: number }[]> => client.get('/api/v1/fee-types') },
    homework: {
      list: (q?: ListQuery): Promise<Homework[]> => client.get('/api/v1/homework', q),
      get: (id: string): Promise<Homework> => client.get(`/api/v1/homework/${id}`),
      create: (b: Record<string, unknown>): Promise<{ id: string }> => client.post('/api/v1/homework', b),
      submissions: (id: string): Promise<Submission[]> => client.get(`/api/v1/homework/${id}/submissions`),
      submit: (id: string, form: FormData): Promise<{ ok: boolean }> => client.post(`/api/v1/homework/${id}/submissions`, form),
      review: (subId: string, b: { feedback?: string; score?: number | null; status?: string }): Promise<{ ok: boolean }> =>
        client.patch(`/api/v1/submissions/${subId}`, b),
    },
    materials: {
      list: (q?: ListQuery): Promise<Material[]> => client.get('/api/v1/materials', q),
      create: (form: FormData): Promise<{ id: string }> => client.post('/api/v1/materials', form),
    },
    announcements: {
      list: (): Promise<Announcement[]> => client.get('/api/v1/announcements'),
      create: (b: Record<string, unknown>): Promise<{ id: string }> => client.post('/api/v1/announcements', b),
      remove: (id: string): Promise<{ ok: boolean }> => client.delete(`/api/v1/announcements/${id}`),
    },
    events: {
      list: (q?: { from?: string; to?: string }): Promise<EventItem[]> => client.get('/api/v1/events', q),
      create: (b: Record<string, unknown>): Promise<{ id: string }> => client.post('/api/v1/events', b),
    },
    notifications: {
      list: (): Promise<{ items: NotificationItem[]; unreadCount: number }> => client.get('/api/v1/notifications'),
      read: (id: string): Promise<{ ok: boolean }> => client.post(`/api/v1/notifications/${id}/read`),
      readAll: (): Promise<{ ok: boolean }> => client.post('/api/v1/notifications/read-all'),
      broadcast: (b: { title: string; body?: string; audience?: string }): Promise<{ delivered: number }> =>
        client.post('/api/v1/notifications/broadcast', b),
    },
    devices: {
      register: (b: { pushToken: string; platform: string }): Promise<{ ok: boolean }> => client.post('/api/v1/devices', b),
    },
    documents: {
      list: (q?: ListQuery): Promise<DocumentItem[]> => client.get('/api/v1/documents', q),
      upload: (form: FormData): Promise<{ id: string }> => client.post('/api/v1/documents', form),
      remove: (id: string): Promise<{ ok: boolean }> => client.delete(`/api/v1/documents/${id}`),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
