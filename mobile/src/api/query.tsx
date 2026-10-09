import NetInfo from '@react-native-community/netinfo';
import {
  QueryClient, focusManager, onlineManager, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useApi } from '../auth/session';
import { ApiError } from './client';
import type { ListQuery } from './endpoints';

/** Wire React Query's focus/online managers to React Native primitives. Call once in App. */
export function useReactQueryRN(): void {
  useEffect(() => {
    const unsubFocus = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    }).remove;
    const unsubNet = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(state.isConnected ?? true);
    });
    return () => {
      unsubFocus();
      unsubNet();
    };
  }, []);
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  return error instanceof ApiError && (error.kind === 'network' || error.kind === 'server');
}

/**
 * Memory-only cache (never persisted): sensitive student/finance data must not
 * sit in insecure device storage. See docs/SECURITY.md.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 30_000, gcTime: 5 * 60_000 },
      mutations: { retry: false }, // never auto-retry writes (money, marks, attendance)
    },
  });
}

interface HookOpts {
  enabled?: boolean;
}

/* --------------------------------- reads ---------------------------------- */

export function usePublicBrand(slug: string) {
  const api = useApi();
  return useQuery({ queryKey: ['brand', slug], queryFn: () => api.school.publicBrand(slug), staleTime: 10 * 60_000 });
}

export function useSchool(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['school'], queryFn: () => api.school.full(), ...opts });
}

export function useStudents(q?: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['students', q], queryFn: () => api.students.list(q), ...opts });
}

export function useStudent(id: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['student', id], queryFn: () => api.students.get(id), enabled: !!id, ...opts });
}

export function useTeachers(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['teachers'], queryFn: () => api.teachers.list(), ...opts });
}

export function useStaffList(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['staff'], queryFn: () => api.staff.list(), ...opts });
}

export function useUsers(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['users'], queryFn: () => api.users.list(), ...opts });
}

export function useClasses(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['classes'], queryFn: () => api.classes.list(), staleTime: 5 * 60_000, ...opts });
}

export function useSubjects(classId?: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['subjects', classId], queryFn: () => api.subjects.list(classId), ...opts });
}

export function useTimetable(q: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['timetable', q], queryFn: () => api.timetable.list(q), ...opts });
}

export function useExams(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['exams'], queryFn: () => api.exams.list(), ...opts });
}

export function useExam(id: string, classId?: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['exam', id, classId], queryFn: () => api.exams.get(id, classId), enabled: !!id, ...opts });
}

export function useResults(examId: string, classId?: string, studentId?: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({
    queryKey: ['results', examId, classId, studentId],
    queryFn: () => api.results.get(examId, classId, studentId),
    enabled: !!examId, ...opts,
  });
}

export function useAttendanceSheet(q: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['attendance-sheet', q], queryFn: () => api.attendance.sheet(q), ...opts });
}

export function useMyAttendance(range?: { from?: string; to?: string }, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['attendance-me', range], queryFn: () => api.attendance.me(range), ...opts });
}

export function useAttendanceSummary(studentId: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({
    queryKey: ['attendance-summary', studentId],
    queryFn: () => api.attendance.summary({ studentId }),
    enabled: !!studentId, ...opts,
  });
}

export function useInvoices(q?: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['invoices', q], queryFn: () => api.invoices.list(q), ...opts });
}

export function useInvoice(id: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['invoice', id], queryFn: () => api.invoices.get(id), enabled: !!id, ...opts });
}

export function usePayments(q?: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['payments', q], queryFn: () => api.payments.list(q), ...opts });
}

export function useReceipt(paymentId: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['receipt', paymentId], queryFn: () => api.receipts.get(paymentId), enabled: !!paymentId, ...opts });
}

export function useHomework(q?: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['homework', q], queryFn: () => api.homework.list(q), ...opts });
}

export function useHomeworkDetail(id: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['homework', id], queryFn: () => api.homework.get(id), enabled: !!id, ...opts });
}

export function useSubmissions(homeworkId: string, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['submissions', homeworkId], queryFn: () => api.homework.submissions(homeworkId), enabled: !!homeworkId, ...opts });
}

export function useMaterials(q?: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['materials', q], queryFn: () => api.materials.list(q), ...opts });
}

export function useAnnouncements(opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['announcements'], queryFn: () => api.announcements.list(), ...opts });
}

export function useEvents(range?: { from?: string; to?: string }, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['events', range], queryFn: () => api.events.list(range), ...opts });
}

export function useNotifications(opts?: HookOpts) {
  const api = useApi();
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list(),
    refetchInterval: 60_000, // badge stays fresh while the app is open
    ...opts,
  });
}

export function useDocuments(q?: ListQuery, opts?: HookOpts) {
  const api = useApi();
  return useQuery({ queryKey: ['documents', q], queryFn: () => api.documents.list(q), ...opts });
}

/* -------------------------------- mutations ---------------------------------
   Every mutation resolves ONLY after the server confirms. Screens show success
   UI in onSuccess — never before. No optimistic updates anywhere. */

interface MutationOpts<T> {
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
}

function invalidate(qc: ReturnType<typeof useQueryClient>, keys: string[]): void {
  for (const k of keys) void qc.invalidateQueries({ queryKey: [k] });
}

export function useSaveAttendance(opts?: MutationOpts<{ saved: number }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.attendance.bulk>[0]) => api.attendance.bulk(b),
    onSuccess: (d) => { invalidate(qc, ['attendance-sheet', 'attendance-me', 'attendance-summary']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useSaveMarksBulk(opts?: MutationOpts<{ saved: number }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.marks.bulk>[0]) => api.marks.bulk(b),
    onSuccess: (d) => { invalidate(qc, ['results']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useCollectPayment(opts?: MutationOpts<{ id: string; receiptNo: string; status: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.payments.create>[0]) => api.payments.create(b),
    onSuccess: (d) => { invalidate(qc, ['invoices', 'invoice', 'payments']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useCreateInvoice(opts?: MutationOpts<{ id: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.invoices.create>[0]) => api.invoices.create(b),
    onSuccess: (d) => { invalidate(qc, ['invoices']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useCreateHomework(opts?: MutationOpts<{ id: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.homework.create>[0]) => api.homework.create(b),
    onSuccess: (d) => { invalidate(qc, ['homework']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useSubmitHomework(homeworkId: string, opts?: MutationOpts<{ ok: boolean }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.homework.submit(homeworkId, form),
    onSuccess: (d) => { invalidate(qc, ['homework', 'submissions']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useReviewSubmission(opts?: MutationOpts<{ ok: boolean }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { feedback?: string; score?: number | null; status?: string } }) =>
      api.homework.review(id, body),
    onSuccess: (d) => { invalidate(qc, ['submissions', 'homework']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useUploadMaterial(opts?: MutationOpts<{ id: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.materials.create(form),
    onSuccess: (d) => { invalidate(qc, ['materials']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useUploadDocument(opts?: MutationOpts<{ id: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => api.documents.upload(form),
    onSuccess: (d) => { invalidate(qc, ['documents']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useDeleteDocument(opts?: MutationOpts<{ ok: boolean }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.documents.remove(id),
    onSuccess: (d) => { invalidate(qc, ['documents']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useCreateAnnouncement(opts?: MutationOpts<{ id: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.announcements.create>[0]) => api.announcements.create(b),
    onSuccess: (d) => { invalidate(qc, ['announcements']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useCreateEvent(opts?: MutationOpts<{ id: string }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.events.create>[0]) => api.events.create(b),
    onSuccess: (d) => { invalidate(qc, ['events']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useBroadcast(opts?: MutationOpts<{ delivered: number }>) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Parameters<typeof api.notifications.broadcast>[0]) => api.notifications.broadcast(b),
    onSuccess: (d) => { invalidate(qc, ['notifications']); opts?.onSuccess?.(d); },
    onError: opts?.onError,
  });
}

export function useReadNotification() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.read(id),
    onSuccess: () => { invalidate(qc, ['notifications']); },
  });
}

export function useReadAllNotifications() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.notifications.readAll(),
    onSuccess: () => { invalidate(qc, ['notifications']); },
  });
}
