import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { BrandingProvider } from './components/branding/BrandingProvider';
import { Layout } from './components/layout/Layout';
import { Toaster } from './components/ui/toast';
import { useDB } from './lib/db/store';

const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import('./modules/students/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const StudentProfilePage = lazy(() => import('./modules/students/StudentProfilePage').then((m) => ({ default: m.StudentProfilePage })));
const TeachersPage = lazy(() => import('./modules/teachers/TeachersPage').then((m) => ({ default: m.TeachersPage })));
const TeacherProfilePage = lazy(() => import('./modules/teachers/TeacherProfilePage').then((m) => ({ default: m.TeacherProfilePage })));
const StaffPage = lazy(() => import('./modules/staff/StaffPage').then((m) => ({ default: m.StaffPage })));
const AttendancePage = lazy(() => import('./modules/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const LeavesPage = lazy(() => import('./modules/leaves/LeavesPage').then((m) => ({ default: m.LeavesPage })));
const ClassesPage = lazy(() => import('./modules/classes/ClassesPage').then((m) => ({ default: m.ClassesPage })));
const SubjectsPage = lazy(() => import('./modules/subjects/SubjectsPage').then((m) => ({ default: m.SubjectsPage })));
const TimetablePage = lazy(() => import('./modules/timetable/TimetablePage').then((m) => ({ default: m.TimetablePage })));
const ExamsPage = lazy(() => import('./modules/exams/ExamsPage').then((m) => ({ default: m.ExamsPage })));
const ResultsPage = lazy(() => import('./modules/results/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const HomeworkPage = lazy(() => import('./modules/homework/HomeworkPage').then((m) => ({ default: m.HomeworkPage })));
const StudyMaterialsPage = lazy(() => import('./modules/materials/StudyMaterialsPage').then((m) => ({ default: m.StudyMaterialsPage })));
const FeesPage = lazy(() => import('./modules/fees/FeesPage').then((m) => ({ default: m.FeesPage })));
const LibraryPage = lazy(() => import('./modules/library/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const TransportPage = lazy(() => import('./modules/transport/TransportPage').then((m) => ({ default: m.TransportPage })));
const InventoryPage = lazy(() => import('./modules/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const DisciplinePage = lazy(() => import('./modules/discipline/DisciplinePage').then((m) => ({ default: m.DisciplinePage })));
const AnnouncementsPage = lazy(() => import('./modules/announcements/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage })));
const EventsPage = lazy(() => import('./modules/events/EventsPage').then((m) => ({ default: m.EventsPage })));
const MessagesPage = lazy(() => import('./modules/messages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const NotificationsPage = lazy(() => import('./modules/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const CertificatesPage = lazy(() => import('./modules/certificates/CertificatesPage').then((m) => ({ default: m.CertificatesPage })));
const DocumentsPage = lazy(() => import('./modules/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const ReportsPage = lazy(() => import('./modules/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SearchPage = lazy(() => import('./modules/search/SearchPage').then((m) => ({ default: m.SearchPage })));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const StudentPrint = lazy(() => import('./modules/print/PrintDocs').then((m) => ({ default: m.StudentPrint })));
const InvoicePrint = lazy(() => import('./modules/print/PrintDocs').then((m) => ({ default: m.InvoicePrint })));
const ReceiptPrint = lazy(() => import('./modules/print/PrintDocs').then((m) => ({ default: m.ReceiptPrint })));
const ReportCardPrint = lazy(() => import('./modules/print/PrintDocs').then((m) => ({ default: m.ReportCardPrint })));
const CertificatePrint = lazy(() => import('./modules/print/PrintDocs').then((m) => ({ default: m.CertificatePrint })));
const TimetablePrint = lazy(() => import('./modules/print/PrintDocs').then((m) => ({ default: m.TimetablePrint })));

function Loading(): React.JSX.Element {
  return (
    <div className="space-y-3 p-2">
      <div className="skeleton h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}

function NotFound(): React.JSX.Element {
  return (
    <div className="card mx-auto mt-16 max-w-md p-10 text-center">
      <p className="text-4xl font-extrabold text-slate-200">404</p>
      <h1 className="mt-2 text-lg font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-slate-500">The page you are looking for does not exist.</p>
      <Link to="/" className="btn-primary mt-4">Back to dashboard</Link>
    </div>
  );
}

export default function App(): React.JSX.Element {
  const refresh = useDB((s) => s.refreshDerivedStatuses);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <BrandingProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="mx-auto max-w-[1400px] p-6"><Loading /></div>}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="students/:id" element={<StudentProfilePage />} />
              <Route path="teachers" element={<TeachersPage />} />
              <Route path="teachers/:id" element={<TeacherProfilePage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="leaves" element={<LeavesPage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="subjects" element={<SubjectsPage />} />
              <Route path="timetable" element={<TimetablePage />} />
              <Route path="exams" element={<ExamsPage />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="homework" element={<HomeworkPage />} />
              <Route path="materials" element={<StudyMaterialsPage />} />
              <Route path="fees" element={<FeesPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="transport" element={<TransportPage />} />
              <Route path="inventory" element={<InventoryPage />} />
              <Route path="discipline" element={<DisciplinePage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="certificates" element={<CertificatesPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            {/* Chrome-free printable documents */}
            <Route path="/print/student/:id" element={<StudentPrint />} />
            <Route path="/print/invoice/:id" element={<InvoicePrint />} />
            <Route path="/print/receipt/:id" element={<ReceiptPrint />} />
            <Route path="/print/report-card/:studentId/:examId" element={<ReportCardPrint />} />
            <Route path="/print/certificate/:id" element={<CertificatePrint />} />
            <Route path="/print/timetable" element={<TimetablePrint />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </BrandingProvider>
  );
}
