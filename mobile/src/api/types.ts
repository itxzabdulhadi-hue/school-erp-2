/**
 * API DTOs. Field names intentionally mirror the web ERP types
 * (`src/lib/db/types.ts`) and the server's camelCase envelope (`server/openapi.yaml`).
 */

export type Role = 'admin' | 'teacher' | 'student' | 'staff';

export interface User {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  role: Role;
  linkedStudentId: string | null;
  linkedTeacherId: string | null;
  linkedStaffId: string | null;
  /** Present on /users responses. */
  isActive?: boolean;
}

export interface SessionPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
  permissions: string[];
}

export interface PublicBrand {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  timezone: string;
  language: string;
}

export interface FullSchool extends PublicBrand {
  gradingScale: { grade: string; minPercent: number; maxPercent: number; gpa?: number | null }[];
  settings: Record<string, unknown>;
}

export interface Student {
  id: string;
  studentIdCode: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dob: string | null;
  classId: string | null;
  sectionId: string | null;
  rollNo: string;
  phone: string;
  email: string;
  address: string;
  guardian: Record<string, unknown>;
  status: string;
  admissionDate: string | null;
  archived: boolean;
  className: string | null;
  sectionName: string | null;
}

export interface Teacher {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  subjectIds: string[];
  qualification: string;
  joiningDate: string | null;
  status: string;
}

export interface Staff {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  joiningDate: string | null;
  status: string;
}

export interface Section {
  id: string;
  classId: string;
  name: string;
  room: string;
  capacity: number;
  classTeacherId: string | null;
}

export interface ClassItem {
  id: string;
  name: string;
  numericOrder: number;
  room: string;
  classTeacherId: string | null;
  sections: Section[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  type?: string;
  creditHours?: number;
  teacherId?: string | null;
  teacherName?: string;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  className: string;
  sectionName: string | null;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
}

export interface Exam {
  id: string;
  name: string;
  term: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface ExamSchedule {
  id: string;
  examId: string;
  classId: string;
  subjectId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  maxMarks: number;
  passingMarks: number;
  className: string;
  subjectName: string;
  subjectCode: string;
}

export interface ResultSubjectRow {
  subjectId: string;
  subjectName: string;
  obtained: number;
  max: number;
  absent: boolean;
}

export interface ResultRow {
  studentId: string;
  studentName: string;
  rollNo: string;
  subjects: ResultSubjectRow[];
  total: number;
  maxTotal: number;
  percent: number;
  grade: string;
  gpa: number | null;
  passed: boolean;
  rank: number;
}

export interface ResultsPayload {
  exam: { id: string; name: string; status: string };
  classId: string;
  rows: ResultRow[];
  stats: { students: number; average: number; highest: number; passPct: number };
}

export interface AttendanceRecord {
  studentId?: string;
  studentName?: string;
  rollNo?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'leave' | 'half-day';
  remarks: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  leave: number;
  halfDay: number;
  pct: number;
}

export interface InvoiceLine {
  id: string;
  feeTypeId: string | null;
  label: string;
  qty: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  studentId: string;
  title: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  status: string;
  notes: string;
  studentName: string;
  admissionNo: string;
  lines?: InvoiceLine[];
  payments?: Payment[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  studentId: string;
  receiptNo: string;
  amount: number;
  method: string;
  reference: string;
  paymentDate: string;
  receivedBy: string;
  notes?: string;
  invoiceNo?: string;
  studentName?: string;
}

export interface ReceiptPayload {
  payment: Payment;
  invoice: Omit<Invoice, 'lines' | 'payments'>;
  student: Pick<Student, 'id' | 'studentIdCode' | 'admissionNo' | 'firstName' | 'lastName'> & { className: string | null };
  school: Pick<PublicBrand, 'name' | 'tagline' | 'logoUrl' | 'primaryColor' | 'currency' | 'currencySymbol'>;
}

export interface Homework {
  id: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  status: string;
  attachmentPath: string;
  className: string;
  sectionName: string | null;
  subjectName: string;
  submissionCount?: number;
  mySubmission?: Submission | null;
}

export interface Submission {
  id: string;
  studentId?: string;
  studentName?: string;
  rollNo?: string;
  submittedAt: string;
  text: string;
  status: string;
  feedback: string;
  score: number | null;
  hasFile: boolean;
}

export interface Material {
  id: string;
  classId: string | null;
  subjectId: string | null;
  title: string;
  kind: string;
  description: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  hasFile: boolean;
  createdAt: string;
  className: string | null;
  subjectName: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishDate: string;
  expiryDate: string | null;
  priority: string;
  createdAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string;
  audience: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  ownerType: string;
  ownerId: string;
  title: string;
  kind: string;
  description: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByName: string | null;
  createdAt: string;
  hasFile: boolean;
}
