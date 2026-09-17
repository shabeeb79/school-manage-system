export type ApiLeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ApiLeave = {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: ApiLeaveStatus;
  createdAt: string;
  requesterId: string;
  requester?: {
    id: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'STAFF' | 'STUDENT';
    email?: string;
    studentProfile?: {
      studentId?: string;
      schoolClass?: { id: string; name: string; section?: string | null } | null;
    } | null;
    staffProfile?: {
      employeeId?: string;
      assignedClass?: { id: string; name: string } | null;
    } | null;
  } | null;
  reviewedBy?: { id: string; firstName: string; lastName: string } | null;
};

export function leaveFullName(leave: ApiLeave) {
  const requester = leave.requester;
  if (!requester) return 'Unknown';
  return `${requester.firstName} ${requester.lastName}`.trim();
}

export function leaveRoll(leave: ApiLeave) {
  return leave.requester?.studentProfile?.studentId || '—';
}

export function leaveClassName(leave: ApiLeave) {
  const schoolClass = leave.requester?.studentProfile?.schoolClass;
  if (!schoolClass?.name) return '—';
  const section = schoolClass.section?.trim();
  return section ? `${schoolClass.name} - ${section}` : schoolClass.name;
}

export function formatLeaveDates(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${String(startDate).slice(0, 10)} → ${String(endDate).slice(0, 10)}`;
  }
  const startText = start.toLocaleDateString(undefined, opts);
  const endText = end.toLocaleDateString(undefined, opts);
  return startText === endText ? startText : `${startText} – ${endText}`;
}

export function formatLeaveApplied(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return String(createdAt).slice(0, 10);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function leaveStatusLabel(status: ApiLeaveStatus) {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REJECTED') return 'Rejected';
  return 'Pending';
}

export function apiErrorMessage(err: unknown, fallback: string) {
  const ax = err as {
    message?: string;
    code?: string;
    response?: { status?: number; data?: { message?: string | string[] } };
  };

  const message = ax?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;

  const status = ax?.response?.status;
  if (status === 401) return 'Session expired. Please sign in again.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'Not found.';
  if (status && status >= 500) return 'Server error. Please try again.';

  // Browser network / CORS failures usually have no response.
  if (!ax?.response) {
    if (ax?.code === 'ERR_NETWORK' || ax?.message === 'Network Error') {
      return 'Cannot reach API (network or CORS). Check backend is running and CORS allows this site.';
    }
  }

  return fallback;
}
