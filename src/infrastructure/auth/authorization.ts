/**
 * Authorization layer — independent of Auth.js.
 * All business-level permission checks live here.
 * If we swap Auth.js for another session provider,
 * this file stays unchanged.
 */

export type SessionUser = {
  id: string;
  nameAr: string;
  role: string;
  sessionType: "hr_user" | "candidate";
  organizationId: string;
  applicationId?: string;
};

// ── Role hierarchy ──────────────────────────────────────────
const HR_ROLES = ["hr_officer", "hr_manager", "admin"] as const;
type HRRole = (typeof HR_ROLES)[number];

export function isCandidate(user: SessionUser): boolean {
  return user.sessionType === "candidate";
}

export function isHRUser(user: SessionUser): boolean {
  return user.sessionType === "hr_user";
}

export function isHRManager(user: SessionUser): boolean {
  return user.sessionType === "hr_user" &&
    ["hr_manager", "admin"].includes(user.role);
}

export function isAdmin(user: SessionUser): boolean {
  return user.sessionType === "hr_user" && user.role === "admin";
}

// ── Resource-level checks ───────────────────────────────────

export function canReviewDocuments(user: SessionUser): boolean {
  return isHRUser(user);
}

export function canApproveDocuments(user: SessionUser): boolean {
  return isHRUser(user); // both officer and manager can approve
}

export function canApproveApplication(user: SessionUser): boolean {
  return isHRManager(user);
}

export function canManageWorkflows(user: SessionUser): boolean {
  return isHRManager(user);
}

export function canViewReports(user: SessionUser): boolean {
  return isHRUser(user);
}

export function canAccessApplication(
  user: SessionUser,
  applicationId: string
): boolean {
  // Candidate can only access their own application
  if (isCandidate(user)) {
    return user.applicationId === applicationId;
  }
  // HR users can access all applications in their org
  return isHRUser(user);
}

export function canAccessCandidateData(
  user: SessionUser,
  candidateOrganizationId: string
): boolean {
  if (isHRUser(user)) {
    return user.organizationId === candidateOrganizationId;
  }
  return false;
}

// ── Guard helper ────────────────────────────────────────────
export class UnauthorizedError extends Error {
  constructor(message = "غير مصرح بهذا الإجراء") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export function requireRole(
  user: SessionUser | null | undefined,
  check: (u: SessionUser) => boolean
): SessionUser {
  if (!user) throw new UnauthorizedError("جلسة غير موجودة");
  if (!check(user)) throw new UnauthorizedError();
  return user;
}
