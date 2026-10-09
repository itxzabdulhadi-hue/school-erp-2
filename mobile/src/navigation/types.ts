/** Root stack routes (Module screens are shared across roles; each enforces scope server-side). */
export type RootStackParamList = {
  Main: undefined;
  Students: undefined;
  StudentDetail: { id: string };
  Finance: undefined;
  Fees: undefined;
  Invoice: { id: string };
  Receipt: { paymentId: string };
  Attendance: undefined;
  Timetable: undefined;
  Exams: undefined;
  ExamDetail: { id: string };
  Results: { examId?: string; classId?: string };
  EnterMarks: { scheduleId: string; examId: string; classId: string; subjectId: string };
  Homework: undefined;
  HomeworkDetail: { id: string };
  Materials: undefined;
  Announcements: undefined;
  Events: undefined;
  Notifications: undefined;
  Documents: undefined;
  Users: undefined;
  Directory: undefined;
  Profile: undefined;
};

/** Bottom-tab routes (a role-specific subset is mounted). */
export type MainTabParamList = {
  HomeTab: undefined;
  StudentsTab: undefined;
  FinanceTab: undefined;
  AttendanceTab: undefined;
  HomeworkTab: undefined;
  FeesTab: undefined;
  DirectoryTab: undefined;
  MoreTab: undefined;
};
