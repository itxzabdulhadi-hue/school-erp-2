/**
 * Core relational data model for the white-label School ERP.
 *
 * Conventions:
 * - Every entity has a string `id` primary key.
 * - Cross-entity references use `<entity>Id` foreign keys.
 * - Dates stored as ISO strings (`YYYY-MM-DD` for calendar dates).
 * - `createdAt` / `updatedAt` audit timestamps where the record is user-managed.
 * - Archival uses `status` / `archived` flags (soft-delete) instead of hard deletes.
 *
 * NOTE: A `User` / `Role` model is intentionally stubbed in `src/auth/roles.ts`
 * so authentication & RBAC can be layered on later without touching these tables.
 */

export type ID = string;

export interface SchoolSettings {
  id: ID;
  name: string;
  tagline: string;
  logo: string; // data URI or remote URL; empty => generated crest
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  currency: string; // ISO code e.g. USD
  currencySymbol: string;
  academicYear: string; // display label of the current year
  currentTerm: string;
  principalName: string;
  registrationNo: string;
  // behaviour toggles
  dateFormat: 'DD Mon YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  language: string;
  religionFieldEnabled: boolean;
  gpaEnabled: boolean;
  subjectWiseAttendance: boolean;
  enabledPaymentMethods: string[];
  defaultFine: number;
  updatedAt: string;
}

export interface AcademicYear {
  id: ID;
  name: string;
  startDate: string;
  endDate: string;
  terms: string[];
  isCurrent: boolean;
}

export interface SchoolClass {
  id: ID;
  name: string;
  code: string;
  academicYearId: ID;
  classTeacherId?: ID;
  room?: string;
  capacity?: number;
  order: number;
}

export interface Section {
  id: ID;
  classId: ID;
  name: string;
  classTeacherId?: ID;
  capacity?: number;
}

export type SubjectType = 'core' | 'elective' | 'practical' | 'activity';

export interface Subject {
  id: ID;
  name: string;
  code: string;
  type: SubjectType;
  creditHours?: number;
  description?: string;
}

/** Assigns a subject to a class (optionally a section) with a teacher. */
export interface ClassSubject {
  id: ID;
  classId: ID;
  sectionId?: ID;
  subjectId: ID;
  teacherId?: ID;
  weeklyPeriods?: number;
}

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'transferred' | 'withdrawn';
export type Gender = 'male' | 'female' | 'other';

export interface Student {
  id: ID;
  studentId: string; // human readable SID e.g. STU-0001
  admissionNo: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender: Gender;
  dob: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  photo?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  previousSchool?: string;
  admissionDate: string;
  admissionClassId: ID;
  classId: ID;
  sectionId?: ID;
  rollNo?: string;
  academicYearId: ID;
  status: StudentStatus;
  archived?: boolean;
  routeId?: ID;
  pickupPoint?: string;
  dropPoint?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: ID;
  studentId: ID;
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: string;
  occupation?: string;
  isEmergency: boolean;
  isPrimary: boolean;
}

export type EmploymentStatus = 'active' | 'on-leave' | 'resigned' | 'terminated' | 'retired';

export interface Department {
  id: ID;
  name: string;
  headId?: string;
  description?: string;
}

export interface Teacher {
  id: ID;
  employeeId: string;
  firstName: string;
  lastName: string;
  photo?: string;
  gender?: Gender;
  dob?: string;
  phone: string;
  email?: string;
  address?: string;
  qualification?: string;
  specialization?: string;
  joiningDate: string;
  departmentId?: ID;
  designation?: string;
  status: EmploymentStatus;
  subjectIds: ID[];
  salaryMonthly?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: ID;
  employeeId: string;
  firstName: string;
  lastName: string;
  photo?: string;
  gender?: Gender;
  dob?: string;
  phone: string;
  email?: string;
  address?: string;
  joiningDate: string;
  departmentId?: ID;
  designation?: string;
  status: EmploymentStatus;
  salaryMonthly?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'excused'
  | 'leave'
  | 'half-day';

export interface AttendanceRecord {
  id: ID;
  date: string; // YYYY-MM-DD
  personType: 'student' | 'employee';
  studentId?: ID;
  employeeKind?: 'teacher' | 'staff';
  employeeId?: ID;
  classId?: ID;
  sectionId?: ID;
  subjectId?: ID;
  status: AttendanceStatus;
  remarks?: string;
  /** Reserved for future biometric device integration. */
  biometricRef?: string;
  createdAt: string;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: ID;
  personType: 'student' | 'teacher' | 'staff';
  studentId?: ID;
  employeeId?: ID;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  notes?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface TimetableSlot {
  id: ID;
  classId: ID;
  sectionId?: ID;
  /** 0=Sun … 6=Sat (school days typically 1-5). */
  day: number;
  subjectId: ID;
  teacherId: ID;
  room?: string;
  startTime: string; // HH:MM
  endTime: string;
  academicYearId: ID;
}

export type ExamType = 'midterm' | 'final' | 'monthly' | 'quiz' | 'practical' | 'other';
export type ExamStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface Exam {
  id: ID;
  name: string;
  term: string;
  type: ExamType;
  academicYearId: ID;
  startDate: string;
  endDate: string;
  description?: string;
  status: ExamStatus;
  createdAt: string;
}

export interface ExamSchedule {
  id: ID;
  examId: ID;
  classId: ID;
  sectionId?: ID;
  subjectId: ID;
  date: string;
  startTime: string;
  endTime: string;
  room?: string;
  maxMarks: number;
  passingMarks: number;
}

export interface ExamMark {
  id: ID;
  examId: ID;
  scheduleId: ID;
  studentId: ID;
  subjectId: ID;
  obtainedMarks: number;
  maxMarks: number;
  isAbsent?: boolean;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GradeScale {
  id: ID;
  name: string;
  minPercent: number;
  maxPercent: number;
  grade: string;
  gpa?: number;
  remarks?: string;
}

export type FeeFrequency = 'one-time' | 'monthly' | 'term' | 'yearly' | 'custom';

export interface FeeType {
  id: ID;
  name: string;
  code: string;
  description?: string;
  defaultAmount: number;
  frequency: FeeFrequency;
}

export interface FeeStructureItem {
  feeTypeId: ID;
  amount: number;
}

export interface FeeStructure {
  id: ID;
  name: string;
  academicYearId: ID;
  /** If unset, applies to all classes. */
  classId?: ID;
  items: FeeStructureItem[];
  discountPercent?: number;
  finePerDay?: number;
}

export interface InvoiceItem {
  id: ID;
  feeTypeId: ID;
  label: string;
  amount: number;
}

export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: ID;
  invoiceNo: string;
  studentId: ID;
  academicYearId: ID;
  term?: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  discount: number;
  fine: number;
  total: number;
  paid: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
}

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'online' | 'other';

export interface Payment {
  id: ID;
  receiptNo: string;
  invoiceId: ID;
  studentId: ID;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export type AssignmentStatus = 'assigned' | 'closed';
export type SubmissionStatus = 'pending' | 'submitted' | 'late' | 'graded';

export interface AssignmentSubmission {
  studentId: ID;
  status: SubmissionStatus;
  submittedAt?: string;
  grade?: string;
  feedback?: string;
}

export interface Assignment {
  id: ID;
  title: string;
  description?: string;
  classId: ID;
  sectionId?: ID;
  subjectId: ID;
  teacherId: ID;
  assignedDate: string;
  dueDate: string;
  status: AssignmentStatus;
  attachments: string[];
  submissions: AssignmentSubmission[];
  createdAt: string;
}

export type MaterialKind = 'pdf' | 'document' | 'presentation' | 'video' | 'link' | 'notes';

export interface StudyMaterial {
  id: ID;
  title: string;
  description?: string;
  kind: MaterialKind;
  url?: string;
  fileName?: string;
  classId?: ID;
  sectionId?: ID;
  subjectId?: ID;
  academicYearId: ID;
  uploadedBy?: string;
  createdAt: string;
}

export type AnnouncementCategory =
  | 'general'
  | 'academic'
  | 'examination'
  | 'fees'
  | 'event'
  | 'emergency';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface Announcement {
  id: ID;
  title: string;
  body: string;
  category: AnnouncementCategory;
  priority: Priority;
  publishDate: string;
  expiryDate?: string;
  targetClassId?: ID;
  targetSectionId?: ID;
  attachment?: string;
  createdAt: string;
}

export interface SchoolEvent {
  id: ID;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  category: string;
  organizer?: string;
  audience?: string;
  createdAt: string;
}

/** Parent-teacher communication primitives (portal-ready, no auth in this version). */
export interface Message {
  id: ID;
  threadId: ID;
  senderRole: string;
  senderName: string;
  body: string;
  attachments?: string[];
  sentAt: string;
  read: boolean;
}

export interface MessageThread {
  id: ID;
  subject: string;
  relatedStudentId?: ID;
  participants: string[];
  messages: Message[];
  status: 'open' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface Book {
  id: ID;
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  category?: string;
  quantity: number;
  available: number;
  shelf?: string;
  publishedYear?: number;
  createdAt: string;
}

export type LibraryTxnStatus = 'issued' | 'returned' | 'overdue' | 'lost';

export interface LibraryTransaction {
  id: ID;
  bookId: ID;
  borrowerType: 'student' | 'teacher' | 'staff';
  borrowerId: ID;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  fine: number;
  status: LibraryTxnStatus;
  notes?: string;
}

export type VehicleStatus = 'active' | 'maintenance' | 'inactive';

export interface Vehicle {
  id: ID;
  vehicleNo: string;
  registrationNo: string;
  type: string;
  capacity: number;
  driverId?: ID;
  routeId?: ID;
  status: VehicleStatus;
  /** Reserved for future GPS provider integration. */
  gpsDeviceId?: string;
  notes?: string;
}

export interface Driver {
  id: ID;
  name: string;
  phone: string;
  licenseNo: string;
  licenseExpiry?: string;
  vehicleId?: ID;
  status: 'active' | 'inactive';
}

export interface RouteStop {
  id: ID;
  routeId: ID;
  name: string;
  pickupTime?: string;
  order: number;
}

export interface Route {
  id: ID;
  name: string;
  code: string;
  driverId?: ID;
  vehicleId?: ID;
  pickupTime?: string;
  dropTime?: string;
  fare: number;
  status: 'active' | 'inactive';
  stops: RouteStop[];
}

export type InventoryCategory =
  | 'computers'
  | 'furniture'
  | 'lab'
  | 'sports'
  | 'stationery'
  | 'books'
  | 'other';

export interface InventoryItem {
  id: ID;
  name: string;
  sku?: string;
  category: InventoryCategory;
  quantity: number;
  unit?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  supplier?: string;
  location?: string;
  condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged';
  department?: string;
  maintenanceStatus?: string;
  minStock: number;
  createdAt: string;
}

export type InventoryTxnType = 'purchase' | 'issue' | 'return' | 'transfer' | 'disposal';

export interface InventoryTxn {
  id: ID;
  itemId: ID;
  type: InventoryTxnType;
  quantity: number;
  date: string;
  party?: string;
  notes?: string;
}

export interface DisciplineRecord {
  id: ID;
  studentId: ID;
  date: string;
  incidentType: string;
  description: string;
  severity: 'minor' | 'moderate' | 'serious';
  actionTaken?: string;
  notes?: string;
  followUpDate?: string;
  reportedBy?: string;
  createdAt: string;
}

export type CertificateType =
  | 'character'
  | 'bonafide'
  | 'leaving'
  | 'transfer'
  | 'enrollment'
  | 'custom';

export interface Certificate {
  id: ID;
  certNo: string;
  type: CertificateType;
  customTitle?: string;
  customBody?: string;
  studentId: ID;
  issueDate: string;
  purpose?: string;
  remarks?: string;
  status: 'draft' | 'issued' | 'revoked';
  createdAt: string;
}

export type DocEntityType = 'student' | 'teacher' | 'staff' | 'school' | 'class';

export interface DocRecord {
  id: ID;
  name: string;
  kind: string;
  entityType: DocEntityType;
  entityId?: ID;
  fileName?: string;
  fileSize?: string;
  description?: string;
  uploadedAt: string;
}

export type NotificationType =
  | 'fee-due'
  | 'fee-overdue'
  | 'attendance'
  | 'exam'
  | 'assignment'
  | 'announcement'
  | 'event'
  | 'general';

export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  body: string;
  relatedId?: ID;
  audience?: string;
  isRead: boolean;
  /** Delivery channels are resolved later (sms/email/push providers). */
  channels?: string[];
  createdAt: string;
}
