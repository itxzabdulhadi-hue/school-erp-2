/**
 * Deterministic demo-data generator. All dates anchor to "today" so the
 * dashboard, attendance, fees and reports look alive on first launch.
 * All people are fictional.
 */
import { DEFAULT_SCHOOL } from '../../config/whitelabel';
import { DEFAULT_GRADE_SCALES } from '../grading';
import { addDaysISO, todayISO } from '../utils';
import type {
  AcademicYear,
  Announcement,
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  Book,
  Certificate,
  Department,
  DisciplineRecord,
  DocRecord,
  Driver,
  Exam,
  ExamMark,
  ExamSchedule,
  FeeStructure,
  FeeType,
  GradeScale,
  Guardian,
  InventoryItem,
  InventoryTxn,
  Invoice,
  InvoiceItem,
  LeaveRequest,
  LibraryTransaction,
  MessageThread,
  Notification,
  Payment,
  Route,
  SchoolClass,
  SchoolEvent,
  Section,
  StaffMember,
  Student,
  StudyMaterial,
  Subject,
  ClassSubject,
  Teacher,
  TimetableSlot,
  Vehicle,
} from './types';

/* ---------------------------------- RNG ---------------------------------- */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedData {
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  sections: Section[];
  subjects: Subject[];
  classSubjects: ClassSubject[];
  departments: Department[];
  teachers: Teacher[];
  staff: StaffMember[];
  students: Student[];
  guardians: Guardian[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  timetable: TimetableSlot[];
  exams: Exam[];
  examSchedules: ExamSchedule[];
  marks: ExamMark[];
  gradeScales: GradeScale[];
  feeTypes: FeeType[];
  feeStructures: FeeStructure[];
  invoices: Invoice[];
  payments: Payment[];
  assignments: Assignment[];
  materials: StudyMaterial[];
  announcements: Announcement[];
  events: SchoolEvent[];
  threads: MessageThread[];
  books: Book[];
  libraryTxns: LibraryTransaction[];
  vehicles: Vehicle[];
  drivers: Driver[];
  routes: Route[];
  inventory: InventoryItem[];
  inventoryTxns: InventoryTxn[];
  discipline: DisciplineRecord[];
  certificates: Certificate[];
  documents: DocRecord[];
  notifications: Notification[];
}

/* --------------------------------- pools --------------------------------- */

const FIRST = [
  'Aarav', 'Sara', 'John', 'Fatima', 'Liam', 'Priya', 'Omar', 'Emily',
  'Rahul', 'Sofia', 'Ahmed', 'Yuki', 'David', 'Layla', 'Michael', 'Zara',
  'James', 'Maria', 'Chen', 'Anna', 'Bilal', 'Nina', 'Peter', 'Hana',
  'Kwame', 'Lucia', 'Tom', 'Aisha', 'Leo', 'Maya', 'Noah', 'Ivy',
  'Ethan', 'Ruby', 'Kabir', 'Elena', 'Sam', 'Tara', 'Victor', 'Nadia',
];
const LAST = [
  'Khan', 'Smith', 'Garcia', 'Patel', 'Nguyen', 'Hassan', 'Johnson', 'Kim',
  'Ali', 'Brown', 'Rossi', 'Silva', 'Ahmed', 'Conti', 'Weber', 'Dubois',
  'Tanaka', 'Okafor', 'Rahman', 'Kaur', 'Lopez', 'Haddad', 'Costa', 'Nagy',
  'Farah', 'Iqbal', 'Mehta', 'Osman', 'Ricci', 'Sato',
];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const NATIONALITIES = ['American', 'British', 'Canadian', 'Indian', 'Pakistani', 'Nigerian', 'Filipino', 'Egyptian'];
const RELIGIONS = ['Christianity', 'Islam', 'Hinduism', 'Buddhism', 'Sikhism', 'Judaism'];
const STREETS = ['Maple Street', 'Oak Avenue', 'Cedar Lane', 'Park Road', 'Elm Drive', 'Lakeview Blvd'];
const QUALS = ['B.Ed', 'M.Ed', 'M.Sc Mathematics', 'M.A English', 'B.Sc + B.Ed', 'M.Sc Physics', 'M.C.A', 'B.P.Ed', 'M.A History', 'M.Sc Chemistry'];
const DESIGNATIONS = ['Head of Department', 'Senior Teacher', 'Teacher', 'Teacher', 'Assistant Teacher'];

const BOOKS: [string, string, string][] = [
  ['Mathematics for Young Minds', 'E. Carpenter', 'Textbook'],
  ['English Grammar & Composition', 'L. Hart', 'Textbook'],
  ['The Science Explorer', 'R. Venn', 'Textbook'],
  ['World History Illustrated', 'M. Osei', 'Textbook'],
  ['Adventures of Tom Sawyer', 'Mark Twain', 'Fiction'],
  ['Charlotte’s Web', 'E. B. White', 'Fiction'],
  ['Matilda', 'Roald Dahl', 'Fiction'],
  ['Harry Potter and the Philosopher’s Stone', 'J. K. Rowling', 'Fiction'],
  ['A Brief History of Time', 'Stephen Hawking', 'Science'],
  ['The Diary of a Young Girl', 'Anne Frank', 'Biography'],
  ['Long Walk to Freedom', 'Nelson Mandela', 'Biography'],
  ['Introduction to Computing', 'D. Rao', 'Technology'],
  ['Python for Beginners', 'S. Iyer', 'Technology'],
  ['Atlas of the World', 'Geo Press', 'Reference'],
  ['Oxford Picture Dictionary', 'Oxford Press', 'Reference'],
  ['Poems for Children', 'Various', 'Poetry'],
  ['Chemistry in Action', 'P. Nair', 'Textbook'],
  ['Physics Fundamentals', 'K. Bose', 'Textbook'],
  ['Art Through the Ages', 'L. Moretti', 'Arts'],
  ['Football Skills Manual', 'Coach D. Reed', 'Sports'],
  ['The Little Prince', 'Antoine de Saint-Exupéry', 'Fiction'],
  ['Animal Farm', 'George Orwell', 'Fiction'],
  ['Environmental Science', 'G. Anand', 'Textbook'],
  ['Economics Basics', 'F. Doyle', 'Textbook'],
];

const pad = (n: number, w = 3): string => String(n).padStart(w, '0');

export function buildSeedData(): SeedData {
  const rnd = mulberry32(20260214);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
  const int = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
  const chance = (p: number): boolean => rnd() < p;
  const today = todayISO();
  const stamp = (daysAgo = 0): string =>
    new Date(`${addDaysISO(today, -daysAgo)}T08:15:00`).toISOString();

  /* ------------------------------ academic core ----------------------------- */
  const year = new Date().getFullYear();
  const academicYears: AcademicYear[] = [
    { id: 'ay_prev', name: `${year - 1}–${String(year).slice(2)}`, startDate: `${year - 1}-04-01`, endDate: `${year}-03-31`, terms: ['Term 1', 'Term 2'], isCurrent: false },
    { id: 'ay_cur', name: DEFAULT_SCHOOL.academicYear || `${year}–${String(year + 1).slice(2)}`, startDate: `${year}-04-01`, endDate: `${year + 1}-03-31`, terms: ['Term 1', 'Term 2'], isCurrent: true },
  ];

  const gradeNames = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];
  const classes: SchoolClass[] = gradeNames.map((name, i) => ({
    id: `cls_${i + 1}`,
    name,
    code: `G${i + 1}`,
    academicYearId: 'ay_cur',
    room: `R-${101 + i}`,
    capacity: 80,
    order: i + 1,
  }));
  const sections: Section[] = [];
  classes.forEach((c) => {
    (['A', 'B'] as const).forEach((s) => {
      sections.push({ id: `sec_${c.code}${s}`, classId: c.id, name: `Section ${s}`, capacity: 40 });
    });
  });

  const subjects: Subject[] = [
    { id: 'sub_math', name: 'Mathematics', code: 'MATH', type: 'core', creditHours: 5 },
    { id: 'sub_eng', name: 'English', code: 'ENG', type: 'core', creditHours: 5 },
    { id: 'sub_sci', name: 'Science', code: 'SCI', type: 'core', creditHours: 4 },
    { id: 'sub_sst', name: 'Social Studies', code: 'SST', type: 'core', creditHours: 3 },
    { id: 'sub_cs', name: 'Computer Science', code: 'CS', type: 'practical', creditHours: 3 },
    { id: 'sub_art', name: 'Art & Design', code: 'ART', type: 'activity', creditHours: 2 },
    { id: 'sub_pe', name: 'Physical Education', code: 'PE', type: 'activity', creditHours: 2 },
    { id: 'sub_lan', name: 'Second Language', code: 'LAN', type: 'elective', creditHours: 3 },
  ];
  const lowerSubs = ['sub_math', 'sub_eng', 'sub_sci', 'sub_sst', 'sub_art', 'sub_pe'];
  const upperSubs = ['sub_math', 'sub_eng', 'sub_sci', 'sub_sst', 'sub_cs', 'sub_lan'];

  const departments: Department[] = [
    'Academic', 'Administration', 'Finance', 'Information Technology',
    'Library', 'Transport', 'Sports', 'Maintenance',
  ].map((name, i) => ({ id: `dep_${i + 1}`, name }));

  /* --------------------------------- people --------------------------------- */
  const teacherSpecs: [string, string, string][] = [
    ['Rachel', 'Carter', 'sub_math'], ['Imran', 'Sheikh', 'sub_math'],
    ['Olivia', 'Bennett', 'sub_eng'], ['Daniel', 'Osei', 'sub_eng'],
    ['Meera', 'Nair', 'sub_sci'], ['George', 'Mathews', 'sub_sci'],
    ['Hannah', 'Cole', 'sub_sst'], ['Yusuf', 'Rahman', 'sub_sst'],
    ['Kevin', 'D’Souza', 'sub_cs'], ['Anita', 'Desai', 'sub_cs'],
    ['Grace', 'Mbeki', 'sub_art'], ['Laura', 'Frost', 'sub_lan'],
    ['Marcus', 'Reed', 'sub_pe'], ['Sana', 'Qureshi', 'sub_math'],
  ];
  const teachers: Teacher[] = teacherSpecs.map(([fn, ln, sub], i) => ({
    id: `tch_${pad(i + 1, 2)}`,
    employeeId: `EMP-T-${pad(i + 1, 3)}`,
    firstName: fn,
    lastName: ln,
    gender: (i % 2 === 0 ? 'female' : 'male') as Teacher['gender'],
    phone: `+1 (555) 200-00${pad(i + 10, 2)}`.slice(0, 17),
    email: `${fn.toLowerCase()}.${ln.toLowerCase().replace(/[^a-z]/g, '')}@school.edu`,
    address: `${int(10, 900)} ${pick(STREETS)}`,
    qualification: QUALS[i % QUALS.length],
    specialization: subjects.find((s) => s.id === sub)?.name,
    joiningDate: addDaysISO(today, -int(200, 1800)),
    departmentId: sub === 'sub_pe' ? 'dep_7' : 'dep_1',
    designation: DESIGNATIONS[i % DESIGNATIONS.length],
    status: 'active',
    subjectIds: [sub, chance(0.4) ? pick(subjects).id : sub].filter((v, idx, a) => a.indexOf(v) === idx),
    salaryMonthly: int(2800, 5200),
    createdAt: stamp(300),
    updatedAt: stamp(10),
  }));
  classes.forEach((c, i) => {
    c.classTeacherId = teachers[i % teachers.length].id;
  });
  sections.forEach((s, i) => {
    s.classTeacherId = teachers[(i * 3 + 1) % teachers.length].id;
  });

  const staffSpecs: [string, string, string, string][] = [
    ['Victor', 'Adeyemi', 'Accountant', 'dep_3'],
    ['Emma', 'Wilson', 'Receptionist', 'dep_2'],
    ['Farhan', 'Malik', 'Librarian', 'dep_5'],
    ['Jason', 'Lee', 'IT Support Officer', 'dep_4'],
    ['Robert', 'Kato', 'Security Supervisor', 'dep_2'],
    ['Amina', 'Diallo', 'Cleaner', 'dep_8'],
    ['Claire', 'Dubois', 'Administrator', 'dep_2'],
    ['Nikhil', 'Rao', 'Lab Assistant', 'dep_1'],
  ];
  const staff: StaffMember[] = staffSpecs.map(([fn, ln, des, dep], i) => ({
    id: `stf_${pad(i + 1, 2)}`,
    employeeId: `EMP-S-${pad(i + 1, 3)}`,
    firstName: fn,
    lastName: ln,
    phone: `+1 (555) 210-00${pad(i + 20, 2)}`.slice(0, 17),
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@school.edu`,
    address: `${int(10, 900)} ${pick(STREETS)}`,
    joiningDate: addDaysISO(today, -int(150, 1500)),
    departmentId: dep,
    designation: des,
    status: i === 5 ? 'on-leave' : 'active',
    salaryMonthly: int(1500, 4200),
    createdAt: stamp(300),
    updatedAt: stamp(12),
  }));

  /* -------------------------------- students -------------------------------- */
  const students: Student[] = [];
  const guardians: Guardian[] = [];
  const TOTAL_STUDENTS = 64;
  const specialStatus: Record<number, Student['status']> = { 60: 'inactive', 61: 'graduated', 62: 'transferred', 63: 'withdrawn' };
  for (let i = 0; i < TOTAL_STUDENTS; i++) {
    const sec = sections[i % sections.length];
    const cls = classes.find((c) => c.id === sec.classId)!;
    const gradeIdx = cls.order;
    const fn = FIRST[(i * 7 + 3) % FIRST.length];
    const ln = LAST[(i * 5 + 1) % LAST.length];
    const age = 5 + gradeIdx;
    const dob = `${year - age}-${String(int(1, 12)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
    const status = specialStatus[i] ?? 'active';
    const s: Student = {
      id: `stu_${pad(i + 1, 3)}`,
      studentId: `STU-${pad(i + 1, 4)}`,
      admissionNo: `ADM-${year - 1}-${pad(i + 1, 3)}`,
      firstName: fn,
      middleName: chance(0.25) ? pick(FIRST) : undefined,
      lastName: ln,
      gender: i % 2 === 0 ? 'female' : 'male',
      dob,
      bloodGroup: pick(BLOOD),
      nationality: pick(NATIONALITIES),
      religion: chance(0.7) ? pick(RELIGIONS) : undefined,
      phone: chance(0.5) ? `+1 (555) 300-${pad(int(1000, 9999), 4)}` : undefined,
      address: `${int(10, 999)} ${pick(STREETS)}`,
      city: DEFAULT_SCHOOL.city,
      previousSchool: chance(0.4) ? `${pick(['Bright Future', 'Little Stars', 'City Model', 'Greenfield'])} School` : undefined,
      admissionDate: addDaysISO(today, -int(100, 900)),
      admissionClassId: cls.id,
      classId: cls.id,
      sectionId: sec.id,
      rollNo: String((Math.floor(i / sections.length) % 8) + 1),
      academicYearId: 'ay_cur',
      status,
      createdAt: stamp(int(100, 900)),
      updatedAt: stamp(int(0, 20)),
    };
    students.push(s);
    const gCount = chance(0.6) ? 2 : 1;
    for (let g = 0; g < gCount; g++) {
      guardians.push({
        id: `grd_${pad(i + 1, 3)}_${g + 1}`,
        studentId: s.id,
        name: g === 0 ? `${pick(FIRST)} ${ln}` : `${pick(FIRST)} ${pick(LAST)}`,
        relationship: g === 0 ? pick(['Father', 'Mother']) : pick(['Father', 'Mother', 'Uncle', 'Aunt', 'Guardian']),
        phone: `+1 (555) 400-${pad(int(1000, 9999), 4)}`,
        email: chance(0.6) ? `parent${i}${g}@example.com` : undefined,
        occupation: pick(['Engineer', 'Doctor', 'Teacher', 'Business Owner', 'Accountant', 'Designer', 'Nurse']),
        isEmergency: g === 0,
        isPrimary: g === 0,
      });
    }
  }
  const activeStudents = students.filter((s) => s.status === 'active');

  const classSubjects: ClassSubject[] = [];
  classes.forEach((c) => {
    const subs = c.order <= 5 ? lowerSubs : upperSubs;
    subs.forEach((subjectId) => {
      const qualified = teachers.filter((t) => t.subjectIds.includes(subjectId));
      const teacher = qualified.length ? qualified[c.order % qualified.length] : pick(teachers);
      classSubjects.push({
        id: `cs_${c.code}_${subjectId.replace('sub_', '')}`,
        classId: c.id,
        subjectId,
        teacherId: teacher.id,
        weeklyPeriods: subjectId === 'sub_math' || subjectId === 'sub_eng' ? 5 : 3,
      });
    });
  });

  /* -------------------------------- attendance ------------------------------- */
  const schoolDays: string[] = [];
  for (let d = 30; d >= 0; d--) {
    const day = addDaysISO(today, -d);
    const dow = new Date(`${day}T12:00:00`).getDay();
    if (dow === 0 || dow === 6) {
      if (d !== 0) continue; // always include today so the dashboard is alive
    }
    schoolDays.push(day);
  }
  const attendance: AttendanceRecord[] = [];
  let attN = 0;
  const rollStudent = (): AttendanceRecord['status'] => {
    const r = rnd();
    if (r < 0.87) return 'present';
    if (r < 0.92) return 'absent';
    if (r < 0.97) return 'late';
    return 'excused';
  };
  schoolDays.forEach((date) => {
    activeStudents.forEach((s) => {
      // one chronically low-attendance student for alerts demo
      const status = s.id === 'stu_007' && chance(0.45) ? 'absent' : rollStudent();
      attendance.push({
        id: `att_${++attN}`,
        date,
        personType: 'student',
        studentId: s.id,
        classId: s.classId,
        sectionId: s.sectionId,
        status,
        createdAt: stamp(0),
      });
    });
    teachers.forEach((t) => {
      const r = rnd();
      attendance.push({
        id: `att_${++attN}`,
        date,
        personType: 'employee',
        employeeKind: 'teacher',
        employeeId: t.id,
        status: r < 0.9 ? 'present' : r < 0.93 ? 'leave' : r < 0.96 ? 'late' : r < 0.98 ? 'half-day' : 'absent',
        createdAt: stamp(0),
      });
    });
    staff.forEach((e) => {
      const r = rnd();
      attendance.push({
        id: `att_${++attN}`,
        date,
        personType: 'employee',
        employeeKind: 'staff',
        employeeId: e.id,
        status: r < 0.9 ? 'present' : r < 0.94 ? 'leave' : r < 0.97 ? 'late' : 'absent',
        createdAt: stamp(0),
      });
    });
  });

  const leaves: LeaveRequest[] = [
    { id: 'lev_01', personType: 'student', studentId: 'stu_003', leaveType: 'Sick Leave', startDate: addDaysISO(today, -6), endDate: addDaysISO(today, -4), reason: 'Viral fever, advised rest by doctor.', status: 'approved', createdAt: stamp(8), decidedAt: stamp(7) },
    { id: 'lev_02', personType: 'student', studentId: 'stu_011', leaveType: 'Family Function', startDate: addDaysISO(today, 4), endDate: addDaysISO(today, 5), reason: 'Family wedding out of town.', status: 'pending', createdAt: stamp(1) },
    { id: 'lev_03', personType: 'teacher', employeeId: 'tch_04', leaveType: 'Casual Leave', startDate: addDaysISO(today, 2), endDate: addDaysISO(today, 2), reason: 'Personal appointment.', status: 'pending', createdAt: stamp(0) },
    { id: 'lev_04', personType: 'teacher', employeeId: 'tch_09', leaveType: 'Sick Leave', startDate: addDaysISO(today, -12), endDate: addDaysISO(today, -11), reason: 'Migraine.', status: 'approved', createdAt: stamp(13), decidedAt: stamp(12) },
    { id: 'lev_05', personType: 'staff', employeeId: 'stf_06', leaveType: 'Medical Leave', startDate: addDaysISO(today, -9), endDate: addDaysISO(today, 6), reason: 'Post-surgery recovery.', status: 'approved', createdAt: stamp(10), decidedAt: stamp(9) },
    { id: 'lev_06', personType: 'student', studentId: 'stu_027', leaveType: 'Sports Event', startDate: addDaysISO(today, -3), endDate: addDaysISO(today, -2), reason: 'Inter-school athletics meet.', status: 'approved', createdAt: stamp(5), decidedAt: stamp(4) },
    { id: 'lev_07', personType: 'staff', employeeId: 'stf_02', leaveType: 'Casual Leave', startDate: addDaysISO(today, -15), endDate: addDaysISO(today, -15), reason: 'Family matter.', status: 'rejected', notes: 'Front desk coverage unavailable that day.', createdAt: stamp(16), decidedAt: stamp(15) },
    { id: 'lev_08', personType: 'teacher', employeeId: 'tch_12', leaveType: 'Study Leave', startDate: addDaysISO(today, 10), endDate: addDaysISO(today, 12), reason: 'Professional certification exam.', status: 'pending', createdAt: stamp(0) },
  ];

  /* -------------------------------- timetable -------------------------------- */
  const PERIODS: [string, string][] = [
    ['08:00', '08:45'], ['08:45', '09:30'], ['09:45', '10:30'],
    ['10:30', '11:15'], ['11:30', '12:15'], ['12:15', '13:00'],
  ];
  const timetable: TimetableSlot[] = [];
  let ttN = 0;
  const usedTeachers = new Map<string, Set<string>>();
  // Seed conflict-free timetables for Grades 1–4 (UI supports adding the rest with validation).
  classes.slice(0, 4).forEach((c, ci) => {
    const subs = classSubjects.filter((cs) => cs.classId === c.id);
    const secs = sections.filter((s) => s.classId === c.id);
    secs.forEach((sec, si) => {
      for (let day = 1; day <= 5; day++) {
        PERIODS.forEach(([startTime, endTime], pi) => {
          const cs = subs[(pi + day * 2 + si * 3 + ci) % subs.length];
          const key = `${day}-${startTime}`;
          const used = usedTeachers.get(key) ?? new Set<string>();
          let teacherId = cs.teacherId ?? teachers[0].id;
          if (used.has(teacherId)) {
            const alt = teachers.find((t) => t.subjectIds.includes(cs.subjectId) && !used.has(t.id))
              ?? teachers.find((t) => !used.has(t.id));
            if (alt) teacherId = alt.id;
          }
          used.add(teacherId);
          usedTeachers.set(key, used);
          timetable.push({
            id: `tt_${++ttN}`,
            classId: c.id,
            sectionId: sec.id,
            day,
            subjectId: cs.subjectId,
            teacherId,
            room: c.room,
            startTime,
            endTime,
            academicYearId: 'ay_cur',
          });
        });
      }
    });
  });

  /* ------------------------------- exams/marks ------------------------------- */
  const exams: Exam[] = [
    { id: 'ex_mid', name: 'Midterm Examination', term: 'Term 1', type: 'midterm', academicYearId: 'ay_cur', startDate: addDaysISO(today, -45), endDate: addDaysISO(today, -35), status: 'completed', createdAt: stamp(60) },
    { id: 'ex_month', name: 'Monthly Assessment — Unit 3', term: 'Term 1', type: 'monthly', academicYearId: 'ay_cur', startDate: addDaysISO(today, -6), endDate: addDaysISO(today, -4), status: 'completed', createdAt: stamp(14) },
    { id: 'ex_quiz', name: 'Science & Math Quiz Week', term: 'Term 1', type: 'quiz', academicYearId: 'ay_cur', startDate: addDaysISO(today, 6), endDate: addDaysISO(today, 8), status: 'scheduled', createdAt: stamp(2) },
    { id: 'ex_final', name: 'Final Examination', term: 'Term 1', type: 'final', academicYearId: 'ay_cur', startDate: addDaysISO(today, 32), endDate: addDaysISO(today, 45), status: 'scheduled', createdAt: stamp(5) },
  ];
  const examSchedules: ExamSchedule[] = [];
  let esN = 0;
  const addSchedules = (examId: string, classIds: string[], baseOffset: number): void => {
    classIds.forEach((classId) => {
      const subs = classSubjects.filter((cs) => cs.classId === classId);
      subs.forEach((cs, i) => {
        examSchedules.push({
          id: `es_${++esN}`,
          examId,
          classId,
          subjectId: cs.subjectId,
          date: addDaysISO(today, baseOffset + i),
          startTime: '09:00',
          endTime: '12:00',
          room: classes.find((c) => c.id === classId)?.room,
          maxMarks: 100,
          passingMarks: 40,
        });
      });
    });
  };
  addSchedules('ex_mid', classes.map((c) => c.id), -45);
  addSchedules('ex_month', ['cls_5', 'cls_8'], -6);
  addSchedules('ex_quiz', classes.map((c) => c.id), 6);
  addSchedules('ex_final', classes.map((c) => c.id), 32);

  const marks: ExamMark[] = [];
  let mkN = 0;
  const addMarks = (examId: string): void => {
    examSchedules.filter((e) => e.examId === examId).forEach((sch) => {
      const pupils = activeStudents.filter((s) => s.classId === sch.classId);
      pupils.forEach((s) => {
        const r = rnd();
        const absent = r > 0.985;
        const score = absent ? 0 : r < 0.06 ? int(28, 44) : r < 0.2 ? int(45, 59) : r < 0.55 ? int(60, 79) : int(80, 98);
        marks.push({
          id: `mk_${++mkN}`,
          examId,
          scheduleId: sch.id,
          studentId: s.id,
          subjectId: sch.subjectId,
          obtainedMarks: score,
          maxMarks: sch.maxMarks,
          isAbsent: absent || undefined,
          createdAt: stamp(30),
          updatedAt: stamp(30),
        });
      });
    });
  };
  addMarks('ex_mid');
  addMarks('ex_month');

  const gradeScales: GradeScale[] = DEFAULT_GRADE_SCALES.map((g, i) => ({ ...g, id: `gs_${i + 1}` }));

  /* ------------------------------- fees/finance ------------------------------ */
  const feeTypes: FeeType[] = [
    { id: 'ft_adm', name: 'Admission Fee', code: 'ADM', defaultAmount: 500, frequency: 'one-time' },
    { id: 'ft_tui', name: 'Tuition Fee', code: 'TUI', defaultAmount: 180, frequency: 'monthly' },
    { id: 'ft_exm', name: 'Examination Fee', code: 'EXM', defaultAmount: 120, frequency: 'term' },
    { id: 'ft_trn', name: 'Transport Fee', code: 'TRN', defaultAmount: 80, frequency: 'monthly' },
    { id: 'ft_lib', name: 'Library Fee', code: 'LIB', defaultAmount: 40, frequency: 'yearly' },
    { id: 'ft_lab', name: 'Computer / Lab Fee', code: 'LAB', defaultAmount: 60, frequency: 'term' },
    { id: 'ft_act', name: 'Activity Fee', code: 'ACT', defaultAmount: 50, frequency: 'term' },
    { id: 'ft_stn', name: 'Stationery Pack', code: 'STN', defaultAmount: 30, frequency: 'custom' },
  ];
  const feeStructures: FeeStructure[] = classes.map((c) => ({
    id: `fs_${c.code}`,
    name: `${c.name} — Term 1 Structure`,
    academicYearId: 'ay_cur',
    classId: c.id,
    items: [
      { feeTypeId: 'ft_tui', amount: 120 + c.order * 12 },
      { feeTypeId: 'ft_exm', amount: 120 },
      { feeTypeId: 'ft_lab', amount: c.order >= 6 ? 80 : 60 },
      { feeTypeId: 'ft_act', amount: 50 },
      { feeTypeId: 'ft_lib', amount: 40 },
    ],
    finePerDay: 2,
  }));

  // Transport first (invoices reference it)
  const drivers: Driver[] = [
    { id: 'drv_1', name: 'Samuel Carter', phone: '+1 (555) 500-1001', licenseNo: 'DL-88231-A', licenseExpiry: addDaysISO(today, 400), status: 'active' },
    { id: 'drv_2', name: 'Peter Novak', phone: '+1 (555) 500-1002', licenseNo: 'DL-88231-B', licenseExpiry: addDaysISO(today, 200), status: 'active' },
    { id: 'drv_3', name: 'Rashid Ali', phone: '+1 (555) 500-1003', licenseNo: 'DL-88231-C', licenseExpiry: addDaysISO(today, 90), status: 'active' },
    { id: 'drv_4', name: 'Tom Becker', phone: '+1 (555) 500-1004', licenseNo: 'DL-88231-D', status: 'inactive' },
  ];
  const vehicles: Vehicle[] = [
    { id: 'veh_1', vehicleNo: 'BUS-01', registrationNo: 'SB-1001', type: 'Bus', capacity: 45, driverId: 'drv_1', status: 'active', gpsDeviceId: 'GPS-1001' },
    { id: 'veh_2', vehicleNo: 'BUS-02', registrationNo: 'SB-1002', type: 'Bus', capacity: 45, driverId: 'drv_2', status: 'active', gpsDeviceId: 'GPS-1002' },
    { id: 'veh_3', vehicleNo: 'VAN-01', registrationNo: 'SV-2001', type: 'Van', capacity: 14, driverId: 'drv_3', status: 'active' },
    { id: 'veh_4', vehicleNo: 'VAN-02', registrationNo: 'SV-2002', type: 'Van', capacity: 14, status: 'maintenance' },
  ];
  const routeDefs: [string, string, string[]][] = [
    ['North Loop', 'RT-01', ['Maple & 5th', 'Oak Park Gate', 'Hillcrest Stop', 'School Gate']],
    ['South Loop', 'RT-02', ['Lakeview Stop', 'Elm & 9th', 'Riverside Stop', 'School Gate']],
    ['East Express', 'RT-03', ['Cedar Junction', 'Market Square', 'School Gate']],
    ['West Town', 'RT-04', ['Sunset Stop', 'Old Mill Stop', 'Library Stop', 'School Gate']],
  ];
  const routes: Route[] = routeDefs.map(([name, code, stops], i) => ({
    id: `rte_${i + 1}`,
    name,
    code,
    driverId: drivers[i]?.id,
    vehicleId: vehicles[i]?.id,
    pickupTime: '07:15',
    dropTime: '15:45',
    fare: 80,
    status: 'active',
    stops: stops.map((s, si) => ({ id: `stp_${i + 1}_${si + 1}`, routeId: `rte_${i + 1}`, name: s, pickupTime: `07:${String(15 + si * 7).padStart(2, '0')}`, order: si + 1 })),
  }));
  // Assign ~20 students to routes
  activeStudents.slice(0, 20).forEach((s, i) => {
    const route = routes[i % routes.length];
    s.routeId = route.id;
    s.pickupPoint = route.stops[0].name;
    s.dropPoint = route.stops[route.stops.length - 1].name;
  });

  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  let invN = 0;
  let payN = 0;
  activeStudents.forEach((s, i) => {
    const structure = feeStructures.find((f) => f.classId === s.classId)!;
    const items: InvoiceItem[] = structure.items.map((it, idx) => {
      const ft = feeTypes.find((f) => f.id === it.feeTypeId)!;
      const months = ft.frequency === 'monthly' && ft.id === 'ft_tui' ? 3 : ft.id === 'ft_trn' ? 3 : 1;
      return {
        id: `ii_${i}_${idx}`,
        feeTypeId: ft.id,
        label: months > 1 ? `${ft.name} × ${months} months` : ft.name,
        amount: it.amount * months,
      };
    });
    if (s.routeId) {
      items.push({ id: `ii_${i}_tr`, feeTypeId: 'ft_trn', label: 'Transport Fee × 3 months', amount: 240 });
    }
    const subtotal = items.reduce((a, b) => a + b.amount, 0);
    const discount = i % 7 === 3 ? Math.round(subtotal * 0.1) : 0; // sibling/scholarship
    const r = rnd();
    const bucket = r < 0.55 ? 'paid' : r < 0.75 ? 'partial' : r < 0.88 ? 'unpaid' : 'overdue';
    const issueDate = addDaysISO(today, -int(20, 45));
    const dueDate = bucket === 'overdue' ? addDaysISO(today, -int(3, 18)) : bucket === 'unpaid' ? addDaysISO(today, int(2, 20)) : addDaysISO(today, -int(1, 10));
    const fine = bucket === 'overdue' ? 25 : 0;
    const total = subtotal - discount + fine;
    const invNo = `INV-${pad(++invN, 4)}`;
    const inv: Invoice = {
      id: `inv_${pad(invN, 4)}`,
      invoiceNo: invNo,
      studentId: s.id,
      academicYearId: 'ay_cur',
      term: 'Term 1',
      issueDate,
      dueDate,
      items,
      discount,
      fine,
      total,
      paid: 0,
      status: 'unpaid',
      createdAt: stamp(30),
    };
    const mkPay = (amount: number, date: string): void => {
      payN++;
      payments.push({
        id: `pay_${pad(payN, 4)}`,
        receiptNo: `RCPT-${pad(payN, 4)}`,
        invoiceId: inv.id,
        studentId: s.id,
        amount,
        paymentDate: date,
        method: pick(['cash', 'cash', 'bank', 'card', 'online'] as Payment['method'][]),
        reference: chance(0.5) ? `REF-${int(10000, 99999)}` : undefined,
        createdAt: stamp(1),
      });
      inv.paid += amount;
    };
    if (bucket === 'paid') {
      if (chance(0.25)) {
        const first = Math.round(total * 0.5);
        mkPay(first, addDaysISO(dueDate, -int(5, 15)));
        mkPay(total - first, addDaysISO(dueDate, -int(0, 4)));
      } else {
        mkPay(total, addDaysISO(dueDate, -int(0, 12)));
      }
      inv.status = 'paid';
    } else if (bucket === 'partial') {
      mkPay(Math.round(total * (0.4 + rnd() * 0.3)), addDaysISO(today, -int(2, 20)));
      inv.status = inv.paid > 0 ? 'partial' : 'unpaid';
    } else {
      inv.status = bucket;
    }
    invoices.push(inv);
  });
  // Ensure a few payments land "today" for the finance dashboard.
  const recentPaid = invoices.filter((v) => v.status === 'paid').slice(0, 4);
  recentPaid.forEach((inv) => {
    const p = payments.find((x) => x.invoiceId === inv.id);
    if (p) p.paymentDate = today;
  });
  const partial = invoices.find((v) => v.status === 'partial');
  if (partial) {
    payN++;
    const amt = Math.min(120, partial.total - partial.paid);
    payments.push({
      id: `pay_${pad(payN, 4)}`, receiptNo: `RCPT-${pad(payN, 4)}`, invoiceId: partial.id,
      studentId: partial.studentId, amount: amt, paymentDate: today, method: 'cash', createdAt: stamp(0),
    });
    partial.paid += amt;
    if (partial.paid >= partial.total) partial.status = 'paid';
  }

  /* --------------------------- homework & materials --------------------------- */
  const assignments: Assignment[] = [];
  const assignSpecs: [string, string, number][] = [
    ['Fractions Worksheet — Ch.4', 'sub_math', 3], ['Book Report: Charlotte’s Web', 'sub_eng', 6],
    ['Plant Cell Diagram', 'sub_sci', -2], ['Map Skills Exercise', 'sub_sst', 5],
    ['Algebra Problem Set 7', 'sub_math', -4], ['Essay: My Summer Holiday', 'sub_eng', 2],
    ['Volcano Model Project', 'sub_sci', 12], ['Scratch Animation Task', 'sub_cs', 7],
    ['Tenses Practice Sheet', 'sub_eng', -1], ['Geometry: Angles Quiz Prep', 'sub_math', 4],
    ['History Timeline Poster', 'sub_sst', 9], ['Water Cycle Chart', 'sub_sci', -6],
  ];
  assignSpecs.forEach(([title, subjectId], ai) => {
    const cls = classes[(ai * 3 + 1) % classes.length];
    const subs = classSubjects.filter((cs) => cs.classId === cls.id);
    const cs = subs.find((x) => x.subjectId === subjectId) ?? subs[0];
    const teacherId = cs?.teacherId ?? teachers[0].id;
    const due = addDaysISO(today, assignSpecs[ai][2] as number);
    const pupils = activeStudents.filter((s) => s.classId === cls.id);
    const closed = (assignSpecs[ai][2] as number) < 0 && ai % 2 === 0;
    const submissions: AssignmentSubmission[] = pupils.map((p) => {
      const r = rnd();
      const st: AssignmentSubmission['status'] = closed
        ? r < 0.8 ? 'graded' : r < 0.9 ? 'submitted' : 'pending'
        : r < 0.55 ? 'submitted' : r < 0.65 ? 'late' : r < 0.7 ? 'graded' : 'pending';
      return {
        studentId: p.id,
        status: st,
        submittedAt: st === 'pending' ? undefined : addDaysISO(due, st === 'late' ? 1 : -1),
        grade: st === 'graded' ? pick(['A', 'A', 'B', 'B', 'C']) : undefined,
      };
    });
    assignments.push({
      id: `asg_${pad(ai + 1, 2)}`,
      title,
      description: 'Complete all questions neatly. Show your working where applicable.',
      classId: cls.id,
      subjectId: cs?.subjectId ?? 'sub_math',
      teacherId,
      assignedDate: addDaysISO(due, -7),
      dueDate: due,
      status: closed ? 'closed' : 'assigned',
      attachments: ai % 3 === 0 ? [`${title.split(':')[0].trim()}.pdf`] : [],
      submissions,
      createdAt: stamp(10),
    });
  });

  const materials: StudyMaterial[] = [
    { id: 'mat_01', title: 'Fractions — Illustrated Notes', kind: 'pdf', fileName: 'fractions-notes.pdf', classId: 'cls_4', subjectId: 'sub_math', academicYearId: 'ay_cur', uploadedBy: 'Rachel Carter', createdAt: stamp(9) },
    { id: 'mat_02', title: 'Photosynthesis Explained (Video)', kind: 'video', url: 'https://example.com/videos/photosynthesis', classId: 'cls_6', subjectId: 'sub_sci', academicYearId: 'ay_cur', uploadedBy: 'Meera Nair', createdAt: stamp(6) },
    { id: 'mat_03', title: 'Essay Writing Framework', kind: 'document', fileName: 'essay-framework.docx', classId: 'cls_7', subjectId: 'sub_eng', academicYearId: 'ay_cur', uploadedBy: 'Olivia Bennett', createdAt: stamp(12) },
    { id: 'mat_04', title: 'World War I — Slide Deck', kind: 'presentation', fileName: 'ww1-slides.pptx', classId: 'cls_9', subjectId: 'sub_sst', academicYearId: 'ay_cur', uploadedBy: 'Hannah Cole', createdAt: stamp(4) },
    { id: 'mat_05', title: 'Khan Academy: Algebra Basics', kind: 'link', url: 'https://example.com/algebra', classId: 'cls_8', subjectId: 'sub_math', academicYearId: 'ay_cur', uploadedBy: 'Sana Qureshi', createdAt: stamp(3) },
    { id: 'mat_06', title: 'Lab Safety Rules', kind: 'notes', description: 'Safety rules for the science laboratory…', classId: 'cls_6', subjectId: 'sub_sci', academicYearId: 'ay_cur', uploadedBy: 'George Mathews', createdAt: stamp(20) },
    { id: 'mat_07', title: 'Scratch Starter Project', kind: 'link', url: 'https://example.com/scratch', classId: 'cls_5', subjectId: 'sub_cs', academicYearId: 'ay_cur', uploadedBy: 'Kevin D’Souza', createdAt: stamp(2) },
    { id: 'mat_08', title: 'Past Paper: Midterm 2023 (Math)', kind: 'pdf', fileName: 'midterm-2023-math.pdf', classId: 'cls_10', subjectId: 'sub_math', academicYearId: 'ay_cur', uploadedBy: 'Imran Sheikh', createdAt: stamp(15) },
    { id: 'mat_09', title: 'Colour Theory Basics', kind: 'presentation', fileName: 'colour-theory.pptx', classId: 'cls_3', subjectId: 'sub_art', academicYearId: 'ay_cur', uploadedBy: 'Grace Mbeki', createdAt: stamp(7) },
    { id: 'mat_10', title: 'Warm-up Routines for Athletics', kind: 'video', url: 'https://example.com/videos/warmup', classId: 'cls_5', subjectId: 'sub_pe', academicYearId: 'ay_cur', uploadedBy: 'Marcus Reed', createdAt: stamp(1) },
  ];

  /* --------------------------- announcements/events --------------------------- */
  const announcements: Announcement[] = [
    { id: 'ann_01', title: 'Term 1 Fee Deadline Reminder', body: 'This is a friendly reminder that Term 1 fee balances are due soon. Please visit the accounts office or pay online to avoid late fines.', category: 'fees', priority: 'high', publishDate: addDaysISO(today, -2), targetClassId: undefined, createdAt: stamp(2) },
    { id: 'ann_02', title: 'Final Examination Date Sheet Published', body: 'The Final Examination date sheet is now available. Students should collect a copy from their class teacher and plan revision accordingly.', category: 'examination', priority: 'urgent', publishDate: addDaysISO(today, -1), createdAt: stamp(1) },
    { id: 'ann_03', title: 'School Closed for Public Holiday', body: 'The school will remain closed next Monday on account of a public holiday. Classes resume on Tuesday.', category: 'general', priority: 'normal', publishDate: addDaysISO(today, -3), expiryDate: addDaysISO(today, 8), createdAt: stamp(3) },
    { id: 'ann_04', title: 'New Arrivals in the Library', body: 'Over 120 new titles have been added to the school library, including reference books for Grades 9–10.', category: 'academic', priority: 'low', publishDate: addDaysISO(today, -5), createdAt: stamp(5) },
    { id: 'ann_05', title: 'Inter-House Sports Trials', body: 'Trials for football, cricket and athletics teams begin this Friday. Interested students should register with the sports department.', category: 'event', priority: 'normal', publishDate: addDaysISO(today, -4), createdAt: stamp(4) },
    { id: 'ann_06', title: 'Route RT-04 Timing Update', body: 'West Town route pickup is moving 10 minutes earlier starting next week due to road works.', category: 'general', priority: 'normal', publishDate: addDaysISO(today, -6), createdAt: stamp(6) },
    { id: 'ann_07', title: 'Parent-Teacher Meeting This Saturday', body: 'All parents are requested to attend the PTM to discuss midterm progress with class teachers.', category: 'event', priority: 'high', publishDate: addDaysISO(today, 0), createdAt: stamp(0) },
    { id: 'ann_08', title: 'Fire Safety Drill', body: 'A supervised fire safety drill will be conducted on Thursday. Students must follow teacher instructions calmly.', category: 'emergency', priority: 'normal', publishDate: addDaysISO(today, -1), createdAt: stamp(1) },
  ];

  const events: SchoolEvent[] = [
    { id: 'evt_01', title: 'Parent-Teacher Meeting', description: 'Discussion of midterm results and student progress.', date: addDaysISO(today, 4), startTime: '09:00', endTime: '12:00', location: 'Main Hall', category: 'Meeting', organizer: 'Administration', audience: 'Parents', createdAt: stamp(6) },
    { id: 'evt_02', title: 'Annual Sports Day', description: 'Track and field events, march past and prize distribution.', date: addDaysISO(today, 11), startTime: '08:30', endTime: '14:00', location: 'Sports Ground', category: 'Sports', organizer: 'Sports Department', audience: 'Whole School', createdAt: stamp(9) },
    { id: 'evt_03', title: 'Science & Innovation Fair', description: 'Student projects and working models exhibition.', date: addDaysISO(today, 18), startTime: '10:00', endTime: '13:00', location: 'Science Block', category: 'Academic', organizer: 'Science Department', audience: 'Grades 5–10', createdAt: stamp(7) },
    { id: 'evt_04', title: 'Quiz Week — Science & Math', description: 'Inter-section quiz competition.', date: addDaysISO(today, 6), startTime: '11:00', endTime: '12:30', location: 'Auditorium', category: 'Competition', organizer: 'Academic Office', audience: 'Grades 6–10', createdAt: stamp(3) },
    { id: 'evt_05', title: 'Winter Break Begins', description: 'School closes for winter break.', date: addDaysISO(today, 52), location: '—', category: 'Holiday', organizer: 'Administration', audience: 'Whole School', createdAt: stamp(2) },
    { id: 'evt_06', title: 'Teacher Training Workshop', description: 'Workshop on formative assessment techniques.', date: addDaysISO(today, 9), startTime: '14:00', endTime: '16:00', location: 'Conference Room', category: 'Workshop', organizer: 'Academic Office', audience: 'Teachers', createdAt: stamp(4) },
    { id: 'evt_07', title: 'Art Exhibition', description: 'Display of student artwork from Grades 1–8.', date: addDaysISO(today, 15), startTime: '09:00', endTime: '12:00', location: 'Art Room', category: 'Cultural', organizer: 'Art Department', audience: 'Parents', createdAt: stamp(5) },
    { id: 'evt_08', title: 'Inter-School Debate', description: 'Senior debate team fixture (away).', date: addDaysISO(today, -8), startTime: '10:00', endTime: '13:00', location: 'City Hall', category: 'Competition', organizer: 'Literary Club', audience: 'Debate Team', createdAt: stamp(20) },
    { id: 'evt_09', title: 'Health & Hygiene Week', description: 'Awareness sessions and medical checkup camp.', date: addDaysISO(today, -14), location: 'Medical Room', category: 'Health', organizer: 'Administration', audience: 'Whole School', createdAt: stamp(25) },
    { id: 'evt_10', title: 'Annual Function & Prize Night', description: 'Cultural performances and academic awards.', date: addDaysISO(today, 40), startTime: '17:00', endTime: '21:00', location: 'Main Ground', category: 'Cultural', organizer: 'Administration', audience: 'Whole School', createdAt: stamp(1) },
  ];

  /* --------------------------------- messages --------------------------------- */
  const threads: MessageThread[] = [
    {
      id: 'msg_01', subject: 'Concern about math homework load', relatedStudentId: 'stu_005',
      participants: ['Parent of Sara Khan', 'Rachel Carter (Teacher)'], status: 'open',
      createdAt: stamp(3), updatedAt: stamp(1),
      messages: [
        { id: 'm_01_1', threadId: 'msg_01', senderRole: 'parent', senderName: 'Parent of Sara Khan', body: 'Hello, Sara is spending over two hours on math homework each evening. Could you please advise if this is expected?', sentAt: stamp(3), read: true },
        { id: 'm_01_2', threadId: 'msg_01', senderRole: 'teacher', senderName: 'Rachel Carter', body: 'Thank you for raising this. The current unit is intensive; I will share differentiated practice sheets so she can work at a steadier pace.', sentAt: stamp(1), read: true },
      ],
    },
    {
      id: 'msg_02', subject: 'Request for leave approval — athletics meet', relatedStudentId: 'stu_027',
      participants: ['Parent of Leo Costa', 'Class Teacher'], status: 'open',
      createdAt: stamp(5), updatedAt: stamp(4),
      messages: [
        { id: 'm_02_1', threadId: 'msg_01', senderRole: 'parent', senderName: 'Parent of Leo Costa', body: 'Leo has been selected for the inter-school athletics meet. Kindly approve two days of leave.', sentAt: stamp(5), read: true },
        { id: 'm_02_2', threadId: 'msg_01', senderRole: 'teacher', senderName: 'Class Teacher', body: 'Congratulations to Leo! Leave approved — please ensure he collects missed classwork on return.', sentAt: stamp(4), read: false },
      ],
    },
    {
      id: 'msg_03', subject: 'Bus RT-02 arriving late', relatedStudentId: undefined,
      participants: ['Transport Office', 'Parent of Maya Haddad'], status: 'closed',
      createdAt: stamp(12), updatedAt: stamp(10),
      messages: [
        { id: 'm_03_1', threadId: 'msg_03', senderRole: 'parent', senderName: 'Parent of Maya Haddad', body: 'The South Loop bus has been 15 minutes late all week. Please look into this.', sentAt: stamp(12), read: true },
        { id: 'm_03_2', threadId: 'msg_03', senderRole: 'staff', senderName: 'Transport Office', body: 'We apologise — a diversion is in place due to road works. Timings will normalise next week.', sentAt: stamp(10), read: true },
      ],
    },
  ];

  /* --------------------------------- library ---------------------------------- */
  const books: Book[] = BOOKS.map(([title, author, category], i) => ({
    id: `bok_${pad(i + 1, 2)}`,
    isbn: `978-0-${int(10000, 99999)}-${int(10, 99)}-${int(0, 9)}`,
    title,
    author,
    publisher: pick(['Scholastic', 'Pearson', 'Oxford Press', 'Harper Kids', 'Geo Press']),
    category,
    quantity: int(3, 12),
    available: 0, // fixed below after transactions
    shelf: `${pick(['A', 'B', 'C'])}-${int(1, 6)}`,
    publishedYear: int(1995, 2024),
    createdAt: stamp(200),
  }));
  const libraryTxns: LibraryTransaction[] = [];
  const bookBorrow = (n: number, status: LibraryTransaction['status'], issueAgo: number, dueIn: number): void => {
    const book = books[n % books.length];
    const borrower = activeStudents[(n * 3 + 1) % activeStudents.length];
    libraryTxns.push({
      id: `lib_${pad(libraryTxns.length + 1, 3)}`,
      bookId: book.id,
      borrowerType: 'student',
      borrowerId: borrower.id,
      issueDate: addDaysISO(today, -issueAgo),
      dueDate: addDaysISO(today, dueIn),
      returnDate: status === 'returned' ? addDaysISO(today, -int(0, 5)) : undefined,
      fine: status === 'overdue' ? 15 : 0,
      status,
      notes: status === 'overdue' ? 'Reminder sent to guardian.' : undefined,
    });
  };
  for (let i = 0; i < 8; i++) bookBorrow(i, 'issued', int(1, 10), int(4, 14));
  for (let i = 8; i < 15; i++) bookBorrow(i, 'returned', int(15, 40), -int(1, 20));
  for (let i = 15; i < 18; i++) bookBorrow(i, 'overdue', int(20, 30), -int(2, 10));
  libraryTxns.push({
    id: 'lib_019', bookId: books[1].id, borrowerType: 'teacher', borrowerId: 'tch_03',
    issueDate: addDaysISO(today, -5), dueDate: addDaysISO(today, 9), fine: 0, status: 'issued',
  });
  books.forEach((b) => {
    const out = libraryTxns.filter((t) => t.bookId === b.id && (t.status === 'issued' || t.status === 'overdue')).length;
    b.available = Math.max(0, b.quantity - out);
  });

  /* -------------------------------- inventory --------------------------------- */
  const inventory: InventoryItem[] = [
    { id: 'inv_it_01', name: 'Desktop Computer (Lab)', sku: 'PC-LAB-01', category: 'computers', quantity: 32, unit: 'pcs', purchaseDate: addDaysISO(today, -500), purchaseCost: 450, supplier: 'TechSupply Co.', location: 'Computer Lab', condition: 'good', department: 'Information Technology', minStock: 5, createdAt: stamp(500) },
    { id: 'inv_it_02', name: 'Laptop — Staff', sku: 'LT-STF-02', category: 'computers', quantity: 12, unit: 'pcs', purchaseCost: 800, supplier: 'TechSupply Co.', location: 'Staff Room', condition: 'good', minStock: 2, createdAt: stamp(400) },
    { id: 'inv_it_03', name: 'Projector', sku: 'PJ-01', category: 'computers', quantity: 6, unit: 'pcs', purchaseCost: 600, supplier: 'AV World', location: 'AV Store', condition: 'fair', maintenanceStatus: 'Bulb replacement due (2 units)', minStock: 1, createdAt: stamp(600) },
    { id: 'inv_it_04', name: 'Student Desk', sku: 'FR-DSK-01', category: 'furniture', quantity: 220, unit: 'pcs', purchaseCost: 45, supplier: 'EduFurn', location: 'Classrooms', condition: 'good', minStock: 10, createdAt: stamp(700) },
    { id: 'inv_it_05', name: 'Student Chair', sku: 'FR-CHR-01', category: 'furniture', quantity: 240, unit: 'pcs', purchaseCost: 25, supplier: 'EduFurn', location: 'Classrooms', condition: 'good', minStock: 10, createdAt: stamp(700) },
    { id: 'inv_it_06', name: 'Whiteboard 4×6', sku: 'FR-WB-01', category: 'furniture', quantity: 24, unit: 'pcs', purchaseCost: 90, supplier: 'EduFurn', location: 'Classrooms', condition: 'new', minStock: 2, createdAt: stamp(60) },
    { id: 'inv_it_07', name: 'Microscope', sku: 'LB-MIC-01', category: 'lab', quantity: 15, unit: 'pcs', purchaseCost: 180, supplier: 'LabLine', location: 'Science Lab', condition: 'good', minStock: 2, createdAt: stamp(300) },
    { id: 'inv_it_08', name: 'Chemistry Glassware Set', sku: 'LB-GLS-01', category: 'lab', quantity: 10, unit: 'sets', purchaseCost: 120, supplier: 'LabLine', location: 'Science Lab', condition: 'fair', minStock: 2, createdAt: stamp(300) },
    { id: 'inv_it_09', name: 'Football', sku: 'SP-FB-01', category: 'sports', quantity: 20, unit: 'pcs', purchaseCost: 22, supplier: 'SportZone', location: 'Sports Store', condition: 'good', department: 'Sports', minStock: 5, createdAt: stamp(120) },
    { id: 'inv_it_10', name: 'Cricket Kit', sku: 'SP-CK-01', category: 'sports', quantity: 4, unit: 'sets', purchaseCost: 150, supplier: 'SportZone', location: 'Sports Store', condition: 'good', department: 'Sports', minStock: 1, createdAt: stamp(120) },
    { id: 'inv_it_11', name: 'A4 Paper Ream', sku: 'ST-A4-01', category: 'stationery', quantity: 85, unit: 'reams', purchaseCost: 4, supplier: 'PaperMart', location: 'Stationery Store', condition: 'new', minStock: 20, createdAt: stamp(30) },
    { id: 'inv_it_12', name: 'Whiteboard Marker (Box)', sku: 'ST-MRK-01', category: 'stationery', quantity: 40, unit: 'boxes', purchaseCost: 8, supplier: 'PaperMart', location: 'Stationery Store', condition: 'new', minStock: 10, createdAt: stamp(30) },
    { id: 'inv_it_13', name: 'Library Reference Set', sku: 'BK-REF-01', category: 'books', quantity: 30, unit: 'sets', purchaseCost: 60, supplier: 'BookHouse', location: 'Library', condition: 'new', department: 'Library', minStock: 5, createdAt: stamp(45) },
    { id: 'inv_it_14', name: 'Fire Extinguisher', sku: 'OT-FEX-01', category: 'other', quantity: 12, unit: 'pcs', purchaseCost: 55, supplier: 'SafeGuard', location: 'Corridors', condition: 'good', maintenanceStatus: 'Annual service due next month', minStock: 2, createdAt: stamp(200) },
    { id: 'inv_it_15', name: 'Water Dispenser', sku: 'OT-WD-01', category: 'other', quantity: 8, unit: 'pcs', purchaseCost: 140, supplier: 'AquaPure', location: 'Floors', condition: 'fair', minStock: 1, createdAt: stamp(350) },
    { id: 'inv_it_16', name: 'Printer — Office', sku: 'PC-PRN-01', category: 'computers', quantity: 4, unit: 'pcs', purchaseCost: 220, supplier: 'TechSupply Co.', location: 'Admin Office', condition: 'good', minStock: 1, createdAt: stamp(180) },
  ];
  const inventoryTxns: InventoryTxn[] = [
    { id: 'itx_01', itemId: 'inv_it_11', type: 'purchase', quantity: 100, date: addDaysISO(today, -30), party: 'PaperMart', notes: 'Quarterly stationery order' },
    { id: 'itx_02', itemId: 'inv_it_11', type: 'issue', quantity: 15, date: addDaysISO(today, -12), party: 'Admin Office', notes: 'Monthly allocation' },
    { id: 'itx_03', itemId: 'inv_it_12', type: 'purchase', quantity: 50, date: addDaysISO(today, -30), party: 'PaperMart' },
    { id: 'itx_04', itemId: 'inv_it_12', type: 'issue', quantity: 10, date: addDaysISO(today, -9), party: 'Academic Block' },
    { id: 'itx_05', itemId: 'inv_it_09', type: 'issue', quantity: 4, date: addDaysISO(today, -6), party: 'Sports Department', notes: 'Practice balls' },
    { id: 'itx_06', itemId: 'inv_it_01', type: 'transfer', quantity: 2, date: addDaysISO(today, -20), party: 'Library → Computer Lab' },
    { id: 'itx_07', itemId: 'inv_it_15', type: 'purchase', quantity: 2, date: addDaysISO(today, -45), party: 'AquaPure' },
    { id: 'itx_08', itemId: 'inv_it_04', type: 'disposal', quantity: 3, date: addDaysISO(today, -60), party: 'Scrap', notes: 'Broken beyond repair' },
  ];

  /* ---------------------------- discipline/certs ------------------------------ */
  const discipline: DisciplineRecord[] = [
    { id: 'dsc_01', studentId: 'stu_014', date: addDaysISO(today, -9), incidentType: 'Late Arrival', description: 'Arrived 25 minutes late for the third time this month. Spoke with student about time management.', severity: 'minor', actionTaken: 'Verbal counselling', reportedBy: 'Class Teacher', createdAt: stamp(9) },
    { id: 'dsc_02', studentId: 'stu_029', date: addDaysISO(today, -16), incidentType: 'Uniform Violation', description: 'Not wearing proper school shoes.', severity: 'minor', actionTaken: 'Reminder note sent to guardian', createdAt: stamp(16) },
    { id: 'dsc_03', studentId: 'stu_041', date: addDaysISO(today, -21), incidentType: 'Classroom Disruption', description: 'Repeatedly distracting classmates during lessons. Meeting held with guardian to agree a support plan.', severity: 'moderate', actionTaken: 'Guardian meeting + behaviour support plan', followUpDate: addDaysISO(today, 7), reportedBy: 'Subject Teacher', createdAt: stamp(21) },
    { id: 'dsc_04', studentId: 'stu_007', date: addDaysISO(today, -5), incidentType: 'Unexplained Absence', description: 'Absent without leave application. Guardian contacted; student was unwell at home.', severity: 'minor', actionTaken: 'Recorded, guardian advised to submit leave requests in advance', createdAt: stamp(5) },
    { id: 'dsc_05', studentId: 'stu_052', date: addDaysISO(today, -30), incidentType: 'Library Book Damage', description: 'Returned a library book with torn pages. Student agreed to replacement cost with guardian consent.', severity: 'moderate', actionTaken: 'Replacement cost added to account', reportedBy: 'Librarian', createdAt: stamp(30) },
  ];

  const certificates: Certificate[] = [
    { id: 'crt_01', certNo: 'CERT-0001', type: 'bonafide', studentId: 'stu_002', issueDate: addDaysISO(today, -12), purpose: 'Bank account opening', status: 'issued', createdAt: stamp(12) },
    { id: 'crt_02', certNo: 'CERT-0002', type: 'character', studentId: 'stu_061', issueDate: addDaysISO(today, -40), purpose: 'College admission', status: 'issued', createdAt: stamp(40) },
    { id: 'crt_03', certNo: 'CERT-0003', type: 'bonafide', studentId: 'stu_019', issueDate: addDaysISO(today, -3), purpose: 'Passport application', status: 'issued', createdAt: stamp(3) },
    { id: 'crt_04', certNo: 'CERT-0004', type: 'transfer', studentId: 'stu_062', issueDate: today, purpose: 'Relocation to another city', status: 'draft', createdAt: stamp(0) },
  ];

  const documents: DocRecord[] = [
    { id: 'doc_01', name: 'Birth Certificate — Sara Khan', kind: 'Identity', entityType: 'student', entityId: 'stu_001', fileName: 'birth-cert-stu001.pdf', fileSize: '1.2 MB', uploadedAt: stamp(300) },
    { id: 'doc_02', name: 'Previous Report Card — John Smith', kind: 'Academic', entityType: 'student', entityId: 'stu_003', fileName: 'report-prev-stu003.pdf', fileSize: '0.8 MB', uploadedAt: stamp(280) },
    { id: 'doc_03', name: 'Guardian ID Copy', kind: 'Identity', entityType: 'student', entityId: 'stu_003', fileName: 'guardian-id-stu003.pdf', fileSize: '0.6 MB', uploadedAt: stamp(280) },
    { id: 'doc_04', name: 'B.Ed Degree — Olivia Bennett', kind: 'Qualification', entityType: 'teacher', entityId: 'tch_03', fileName: 'bed-olivia.pdf', fileSize: '2.1 MB', uploadedAt: stamp(500) },
    { id: 'doc_05', name: 'Experience Letter — Daniel Osei', kind: 'Employment', entityType: 'teacher', entityId: 'tch_04', fileName: 'exp-daniel.pdf', fileSize: '0.4 MB', uploadedAt: stamp(400) },
    { id: 'doc_06', name: 'Appointment Letter — Victor Adeyemi', kind: 'Employment', entityType: 'staff', entityId: 'stf_01', fileName: 'appt-victor.pdf', fileSize: '0.3 MB', uploadedAt: stamp(350) },
    { id: 'doc_07', name: 'School Registration Certificate', kind: 'Legal', entityType: 'school', fileName: 'school-registration.pdf', fileSize: '1.5 MB', uploadedAt: stamp(900) },
    { id: 'doc_08', name: 'Fire Safety Clearance', kind: 'Compliance', entityType: 'school', fileName: 'fire-clearance.pdf', fileSize: '0.9 MB', uploadedAt: stamp(200) },
    { id: 'doc_09', name: 'Fee Policy 2025–26', kind: 'Policy', entityType: 'school', fileName: 'fee-policy.pdf', fileSize: '0.5 MB', uploadedAt: stamp(150) },
    { id: 'doc_10', name: 'Grade 10 Syllabus Outline', kind: 'Academic', entityType: 'class', entityId: 'cls_10', fileName: 'g10-syllabus.pdf', fileSize: '1.1 MB', uploadedAt: stamp(100) },
  ];

  const notifications: Notification[] = [
    { id: 'ntf_01', type: 'fee-overdue', title: '8 invoices overdue', body: 'Follow up on overdue Term 1 balances.', createdAt: stamp(0), isRead: false },
    { id: 'ntf_02', type: 'exam', title: 'Quiz Week starts in 6 days', body: 'Date sheets published for all grades.', createdAt: stamp(0), isRead: false },
    { id: 'ntf_03', type: 'attendance', title: 'Low attendance alert', body: '3 students are below 75% attendance this month.', createdAt: stamp(1), isRead: false },
    { id: 'ntf_04', type: 'assignment', title: '4 assignments due this week', body: '2 assignments are past due with pending submissions.', createdAt: stamp(1), isRead: false },
    { id: 'ntf_05', type: 'announcement', title: 'New urgent announcement', body: 'Final Examination date sheet published.', createdAt: stamp(1), isRead: true },
    { id: 'ntf_06', type: 'event', title: 'PTM this Saturday', body: 'Parent-Teacher Meeting 09:00–12:00, Main Hall.', createdAt: stamp(1), isRead: true },
    { id: 'ntf_07', type: 'fee-due', title: 'Fee deadline approaching', body: 'Unpaid Term 1 invoices due within 7 days.', createdAt: stamp(2), isRead: true },
    { id: 'ntf_08', type: 'general', title: 'Library stock updated', body: '120 new titles added to the catalogue.', createdAt: stamp(3), isRead: true },
  ];

  return {
    academicYears, classes, sections, subjects, classSubjects, departments,
    teachers, staff, students, guardians, attendance, leaves, timetable,
    exams, examSchedules, marks, gradeScales, feeTypes, feeStructures,
    invoices, payments, assignments, materials, announcements, events,
    threads, books, libraryTxns, vehicles, drivers, routes,
    inventory, inventoryTxns, discipline, certificates, documents, notifications,
  };
}
