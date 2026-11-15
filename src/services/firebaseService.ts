import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { computeFullQusAnalysis } from '../domain/qusClinicalEngine';
import { OperationType, db, handleFirestoreError } from '../firebase';
import {
  AccountRole,
  CrewSpecialty,
  TreatmentFeedback,
  TreatmentResult,
  UserProfile,
} from '../types/app';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'moaaz.amr.bakeer@gmail.com';

let interactiveSignInActive = false;
export function setInteractiveSignIn(active: boolean) {
  interactiveSignInActive = active;
}
export function isInteractiveSignIn(): boolean {
  return interactiveSignInActive;
}

const VALID_SPECIALTIES: CrewSpecialty[] = [
  'Mission Commander',
  'Flight Engineer',
  'Payload Specialist',
  'Flight Surgeon',
  'Orthopedic Specialist',
];

function sanitizeId(raw: string, fallback: string, maxLen = 128): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeBadgeId(raw: string | undefined, role: AccountRole): string {
  const fallback = role === 'doctor' ? 'MED-408' : 'CREW-07';
  if (!raw) return fallback;
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 40);
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeString(raw: string | undefined, fallback: string, minLen: number, maxLen: number): string {
  const trimmed = (raw ?? '').trim().slice(0, maxLen);
  if (trimmed.length < minLen) return fallback.slice(0, maxLen);
  return trimmed;
}

function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

export function isBootstrappedAdminUser(firebaseUser: User | null): boolean {
  return Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL,
  );
}

export function parseFriendlyFirebaseError(error: unknown): { message: string; code: string } {
  let code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  let rawMessage = error instanceof Error ? error.message : String(error ?? '');

  if (rawMessage.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawMessage) as { error?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.length > 0) {
        rawMessage = parsed.error;
      }
    } catch {
      // Keep original rawMessage if not JSON
    }
  }

  if (!code && rawMessage.includes('Missing or insufficient permissions')) {
    code = 'permission-denied';
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      code,
      message:
        'Email/Password sign-in is not enabled in Firebase Console yet. Enable it under Authentication → Sign-in method → Email/Password, or use Google Sign-In above.',
    };
  }
  if (code === 'auth/popup-blocked') {
    return {
      code,
      message:
        'Your browser blocked the Google Sign-In popup. Click "Continue with Google Redirect" below or allow popups for this site.',
    };
  }
  if (code === 'auth/popup-closed-by-user') {
    return {
      code,
      message: 'Google sign-in popup was closed before completing sign-in.',
    };
  }
  if (code === 'auth/cancelled-popup-request') {
    return {
      code,
      message: 'Sign-in request was interrupted by another popup. Please try again.',
    };
  }
  if (code === 'auth/unauthorized-domain') {
    return {
      code,
      message:
        'This preview domain is not yet authorized in Firebase Auth. Check Firebase Console → Authentication → Settings → Authorized domains.',
    };
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return {
      code,
      message:
        'An account with this email already exists using another sign-in method. Try signing in with that method.',
    };
  }
  if (code === 'auth/email-already-in-use') {
    return {
      code,
      message: 'An account with this email already exists. Switch to Sign In instead.',
    };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return { code, message: 'Invalid email or password.' };
  }
  if (code === 'auth/weak-password') {
    return { code, message: 'Password must be at least 8 characters.' };
  }
  if (code === 'auth/invalid-email') {
    return { code, message: 'Enter a valid email address.' };
  }
  if (code === 'auth/too-many-requests') {
    return { code, message: 'Too many attempts. Please wait a moment and try again.' };
  }
  if (code === 'auth/network-request-failed') {
    return {
      code,
      message: 'Network error while contacting Firebase Authentication. Please try again.',
    };
  }
  if (code === 'permission-denied' || rawMessage.includes('Missing or insufficient permissions')) {
    return {
      code: 'permission-denied',
      message:
        'Permission denied while accessing your mission profile. Ensure your email is verified and click Retry.',
    };
  }
  if (rawMessage.includes('Quota exceeded')) {
    return {
      code: 'resource-exhausted',
      message: 'Daily Firestore free-tier quota exceeded. Quota resets tomorrow.',
    };
  }

  return {
    code,
    message: rawMessage || 'Unable to complete authentication.',
  };
}

export async function checkDoctorAuthorization(firebaseUser: User): Promise<{
  isAdmin: boolean;
  isAuthorizedDoctor: boolean;
}> {
  const isAdmin = isBootstrappedAdminUser(firebaseUser);
  if (isAdmin) {
    return { isAdmin: true, isAuthorizedDoctor: true };
  }

  const doctorPath = `doctors/${firebaseUser.uid}`;
  try {
    const snap = await getDoc(doc(db, 'doctors', firebaseUser.uid));
    return {
      isAdmin: false,
      isAuthorizedDoctor: firebaseUser.emailVerified && snap.exists(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, doctorPath);
  }
}

export interface ProfileSyncOverrides {
  requestedRole?: AccountRole;
  fullName?: string;
  badgeId?: string;
  specialty?: CrewSpecialty;
}

async function ensureVerifiedIdToken(
  firebaseUser: User,
  forceRefresh = false,
): Promise<void> {
  if (forceRefresh) {
    try {
      await firebaseUser.reload();
    } catch {
      // Proceed with existing user state if reload fails transiently
    }
  }
  if (firebaseUser.emailVerified) {
    const tokenResult = await firebaseUser.getIdTokenResult();
    if (forceRefresh || !tokenResult.claims.email_verified) {
      await firebaseUser.getIdToken(true);
    }
  }
}

export async function fetchExistingUserProfile(
  firebaseUser: User,
  forceTokenRefresh = false,
): Promise<UserProfile | null> {
  await ensureVerifiedIdToken(firebaseUser, forceTokenRefresh);

  const uid = sanitizeId(firebaseUser.uid, firebaseUser.uid);
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;

  let existingPublic: Record<string, unknown> | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      return null;
    }
    existingPublic = snap.data() as Record<string, unknown>;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const { isAdmin, isAuthorizedDoctor } = await checkDoctorAuthorization(firebaseUser);

  let existingPrivate: Record<string, unknown> | null = null;
  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (privSnap.exists()) {
      existingPrivate = privSnap.data() as Record<string, unknown>;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  const savedRole: AccountRole = existingPublic.role === 'doctor' ? 'doctor' : 'astronaut';
  const email = sanitizeString(firebaseUser.email || undefined, 'crew@mission.org', 3, 254);

  if (!existingPrivate && firebaseUser.emailVerified) {
    try {
      await setDoc(doc(db, 'users', uid, 'private', 'info'), {
        uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }
  }

  const fullName = sanitizeString(
    typeof existingPublic.fullName === 'string' ? existingPublic.fullName : undefined,
    firebaseUser.displayName || 'Crew Member',
    1,
    100,
  );
  const badgeId = sanitizeBadgeId(
    typeof existingPublic.badgeId === 'string' ? existingPublic.badgeId : undefined,
    savedRole,
  );
  const rawSpec =
    typeof existingPublic.specialty === 'string'
      ? (existingPublic.specialty as CrewSpecialty)
      : undefined;
  const specialty: CrewSpecialty =
    rawSpec && VALID_SPECIALTIES.includes(rawSpec)
      ? rawSpec
      : savedRole === 'doctor'
        ? 'Flight Surgeon'
        : 'Mission Commander';
  const missionName = sanitizeString(
    typeof existingPublic.missionName === 'string' ? existingPublic.missionName : undefined,
    'Expedition 74',
    1,
    80,
  );

  return {
    id: uid,
    role: savedRole,
    fullName,
    badgeId,
    email,
    specialty,
    missionName,
    canSwitchToDoctor: isAuthorizedDoctor,
    isAdmin,
    createdAt: timestampToIso(existingPublic.createdAt),
    updatedAt: timestampToIso(existingPublic.updatedAt),
  };
}

export async function loadOrCreateUserProfile(
  firebaseUser: User,
  overrides?: ProfileSyncOverrides,
): Promise<{ profile: UserProfile; doctorRoleDenied: boolean }> {
  await ensureVerifiedIdToken(firebaseUser, false);

  const uid = sanitizeId(firebaseUser.uid, firebaseUser.uid);
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;

  const { isAdmin, isAuthorizedDoctor } = await checkDoctorAuthorization(firebaseUser);

  let existingPublic: Record<string, unknown> | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      existingPublic = snap.data() as Record<string, unknown>;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let existingPrivate: Record<string, unknown> | null = null;
  try {
    const privSnap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (privSnap.exists()) {
      existingPrivate = privSnap.data() as Record<string, unknown>;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privatePath);
  }

  const existingRole: AccountRole | null =
    existingPublic?.role === 'doctor'
      ? 'doctor'
      : existingPublic?.role === 'astronaut'
        ? 'astronaut'
        : null;

  const requestedRole: AccountRole =
    overrides?.requestedRole ?? existingRole ?? 'astronaut';

  const canChangeRole = !existingRole || isAuthorizedDoctor || requestedRole === existingRole;
  const doctorRoleDenied = Boolean(existingRole && requestedRole === 'doctor' && !canChangeRole);
  const effectiveRole: AccountRole = canChangeRole ? requestedRole : existingRole!;

  const defaultName =
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0]?.replace(/[._-]+/g, ' ') ||
    (effectiveRole === 'doctor' ? 'Flight Surgeon' : 'Crew Member');

  const fullName = sanitizeString(
    overrides?.fullName ?? (typeof existingPublic?.fullName === 'string' ? existingPublic.fullName : undefined),
    defaultName,
    1,
    100,
  );

  const rawSpecialty =
    overrides?.specialty ??
    (typeof existingPublic?.specialty === 'string' ? (existingPublic.specialty as CrewSpecialty) : undefined);
  const defaultSpecialty: CrewSpecialty =
    effectiveRole === 'doctor' ? 'Flight Surgeon' : 'Mission Commander';
  const specialty: CrewSpecialty =
    rawSpecialty && VALID_SPECIALTIES.includes(rawSpecialty)
      ? effectiveRole === 'astronaut' &&
        (rawSpecialty === 'Flight Surgeon' || rawSpecialty === 'Orthopedic Specialist')
        ? 'Mission Commander'
        : rawSpecialty
      : defaultSpecialty;

  const badgeId = sanitizeBadgeId(
    overrides?.badgeId ?? (typeof existingPublic?.badgeId === 'string' ? existingPublic.badgeId : undefined),
    effectiveRole,
  );

  const missionName = sanitizeString(
    typeof existingPublic?.missionName === 'string' ? existingPublic.missionName : undefined,
    'Expedition 74',
    1,
    80,
  );

  const email = sanitizeString(firebaseUser.email || undefined, 'crew@mission.org', 3, 254);

  if (!existingPublic) {
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        role: effectiveRole,
        fullName,
        badgeId,
        specialty,
        missionName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  } else if (overrides) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role: effectiveRole,
        fullName,
        badgeId,
        specialty,
        missionName,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  if (!existingPrivate) {
    try {
      await setDoc(doc(db, 'users', uid, 'private', 'info'), {
        uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privatePath);
    }
  } else if (existingPrivate.email !== email) {
    try {
      await updateDoc(doc(db, 'users', uid, 'private', 'info'), {
        email,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, privatePath);
    }
  }

  const nowIso = new Date().toISOString();
  return {
    doctorRoleDenied,
    profile: {
      id: uid,
      role: effectiveRole,
      fullName,
      badgeId,
      email,
      specialty,
      missionName,
      canSwitchToDoctor: isAuthorizedDoctor,
      isAdmin,
      createdAt: timestampToIso(existingPublic?.createdAt) || nowIso,
      updatedAt: nowIso,
    },
  };
}

export async function updateUserProfileDetails(
  user: UserProfile,
  updates: {
    fullName: string;
    badgeId: string;
    specialty: CrewSpecialty;
  },
): Promise<UserProfile> {
  const userPath = `users/${user.id}`;
  const fullName = sanitizeString(updates.fullName, user.fullName, 1, 100);
  const badgeId = sanitizeBadgeId(updates.badgeId, user.role);
  const specialty = VALID_SPECIALTIES.includes(updates.specialty)
    ? updates.specialty
    : user.specialty;

  try {
    await updateDoc(doc(db, 'users', user.id), {
      fullName,
      badgeId,
      specialty,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  return {
    ...user,
    fullName,
    badgeId,
    specialty,
    updatedAt: new Date().toISOString(),
  };
}

export async function switchAuthorizedUserRole(
  user: UserProfile,
  nextRole: AccountRole,
): Promise<UserProfile> {
  const userPath = `users/${user.id}`;
  const nextSpecialty: CrewSpecialty =
    nextRole === 'doctor' ? 'Flight Surgeon' : 'Mission Commander';
  try {
    await updateDoc(doc(db, 'users', user.id), {
      role: nextRole,
      specialty: nextSpecialty,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
  return {
    ...user,
    role: nextRole,
    specialty: nextSpecialty,
    updatedAt: new Date().toISOString(),
  };
}

export async function authorizeDoctorAccount(
  adminUid: string,
  targetUidRaw: string,
  fullNameRaw: string,
  specialty: 'Flight Surgeon' | 'Orthopedic Specialist',
): Promise<void> {
  const targetUid = sanitizeId(targetUidRaw.trim(), '');
  if (!targetUid) {
    throw new Error('Enter a valid Firebase user UID.');
  }
  const fullName = sanitizeString(fullNameRaw, 'Flight Surgeon', 1, 100);
  const path = `doctors/${targetUid}`;
  try {
    await setDoc(doc(db, 'doctors', targetUid), {
      uid: targetUid,
      fullName,
      specialty,
      grantedBy: adminUid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createTreatmentPlanInFirestore(
  result: TreatmentResult,
  ownerUid: string,
): Promise<TreatmentResult> {
  const docId = sanitizeId(`plan-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`, `plan-${Date.now()}`);
  const planCode = sanitizeId(String(result.id || `QUS-${Math.floor(1000 + Math.random() * 8999)}`), 'QUS-1000', 32);
  const path = `treatmentPlans/${docId}`;

  const analysis = result.analysis;
  const selectedBoneIds =
    result.selectedBoneIds && result.selectedBoneIds.length > 0
      ? result.selectedBoneIds.slice(0, 15).map((id) => String(id).slice(0, 64))
      : ['femoral-neck', 'calcaneus', 'lumbar-spine'];

  const payload = {
    planCode,
    ownerId: ownerUid,
    assignedDoctorUid: 'unassigned',
    astronautName: sanitizeString(result.astronautName, 'Crew Member', 1, 100),
    astronautBadge: sanitizeBadgeId(result.astronautBadge, 'astronaut'),
    mode: analysis?.mode === 'full' ? 'full' : 'dual',
    sos: clampNumber(result.sos, 1200, 2600),
    bua: clampNumber(result.bua, 10, 140),
    unloadingMonths: clampNumber(analysis?.unloadingMonths ?? 6, 0, 120),
    prediction: result.prediction,
    confidence: clampNumber(result.confidence, 0, 100),
    tScore: clampNumber(result.tScore, -10, 10),
    bhi: clampNumber(analysis?.bhi ?? 75, 0, 100),
    bdsPercent: clampNumber(analysis?.bdsPercent ?? 12, 0, 100),
    ebmd: clampNumber(analysis?.ebmd ?? 0.5, 0, 5),
    clinicalTier: sanitizeString(analysis?.clinicalTier, 'Normal Bone Integrity', 3, 100),
    recommendation: sanitizeString(result.recommendation, 'Maintain orbital countermeasures.', 1, 2000),
    selectedBoneIds,
    severityLevel: result.severityLevel || 'L1',
    approvalStatus: 'pending' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'treatmentPlans', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  const nowIso = new Date().toISOString();
  return {
    ...result,
    id: docId,
    planCode,
    ownerId: ownerUid,
    createdAt: nowIso,
    sentToDoctorAt: nowIso,
    approvalStatus: 'pending',
  };
}

function hydrateTreatmentPlanDoc(docId: string, data: Record<string, unknown>): TreatmentResult {
  const mode = data.mode === 'full' ? 'full' : 'dual';
  const sos = typeof data.sos === 'number' ? data.sos : 1505;
  const bua = typeof data.bua === 'number' ? data.bua : 74;
  const unloadingMonths = typeof data.unloadingMonths === 'number' ? data.unloadingMonths : 6;

  const computedAnalysis = computeFullQusAnalysis({
    mode,
    sos,
    bua,
    unloadingMonths,
  });

  return {
    id: docId,
    planCode: typeof data.planCode === 'string' ? data.planCode : docId,
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : undefined,
    sos,
    bua,
    prediction: (data.prediction as TreatmentResult['prediction']) || computedAnalysis.prediction,
    confidence: typeof data.confidence === 'number' ? data.confidence : computedAnalysis.confidence,
    tScore: typeof data.tScore === 'number' ? data.tScore : computedAnalysis.zMaster,
    recommendation:
      typeof data.recommendation === 'string'
        ? data.recommendation
        : computedAnalysis.recommendedAction,
    createdAt: timestampToIso(data.createdAt),
    sentToDoctorAt: timestampToIso(data.createdAt),
    astronautName: typeof data.astronautName === 'string' ? data.astronautName : 'Crew Member',
    astronautBadge: typeof data.astronautBadge === 'string' ? data.astronautBadge : 'CREW-01',
    analysis: {
      ...computedAnalysis,
      bhi: typeof data.bhi === 'number' ? data.bhi : computedAnalysis.bhi,
      bdsPercent: typeof data.bdsPercent === 'number' ? data.bdsPercent : computedAnalysis.bdsPercent,
      ebmd: typeof data.ebmd === 'number' ? data.ebmd : computedAnalysis.ebmd,
    },
    selectedBoneIds: Array.isArray(data.selectedBoneIds)
      ? (data.selectedBoneIds as string[])
      : ['femoral-neck', 'calcaneus', 'lumbar-spine'],
    severityLevel:
      (data.severityLevel as TreatmentResult['severityLevel']) || 'L1',
    approvalStatus:
      (data.approvalStatus as TreatmentResult['approvalStatus']) || 'pending',
    reviewedByUid: typeof data.reviewedByUid === 'string' ? data.reviewedByUid : undefined,
    reviewedByName: typeof data.reviewedByName === 'string' ? data.reviewedByName : undefined,
  };
}

export function subscribeTreatmentPlans(
  uid: string,
  role: AccountRole,
  isAdmin: boolean,
  onData: (plans: TreatmentResult[]) => void,
): () => void {
  const baseCol = collection(db, 'treatmentPlans');
  const q =
    role === 'doctor' && isAdmin
      ? baseCol
      : role === 'doctor'
        ? query(baseCol, where('assignedDoctorUid', 'in', [uid, 'unassigned']))
        : query(baseCol, where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => hydrateTreatmentPlanDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'treatmentPlans');
    },
  );
}

export function subscribeTreatmentFeedback(
  uid: string,
  role: AccountRole,
  isAdmin: boolean,
  onData: (feedback: TreatmentFeedback[]) => void,
): () => void {
  const baseCol = collection(db, 'treatmentFeedback');
  const q =
    role === 'doctor' && isAdmin
      ? baseCol
      : role === 'doctor'
        ? query(baseCol, where('doctorUid', '==', uid))
        : query(baseCol, where('patientUid', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TreatmentFeedback[] = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          const decision: TreatmentFeedback['decision'] =
            data.decision === 'not_approved' ? 'not_approved' : 'approved';
          return {
            id: d.id,
            decision,
            negativePoints: typeof data.negativePoints === 'string' ? data.negativePoints : '',
            improvements: typeof data.improvements === 'string' ? data.improvements : '',
            treatmentId:
              typeof data.planCode === 'string'
                ? data.planCode
                : typeof data.planId === 'string'
                  ? data.planId
                  : null,
            planCode: typeof data.planCode === 'string' ? data.planCode : undefined,
            patientUid: typeof data.patientUid === 'string' ? data.patientUid : undefined,
            patientName: typeof data.patientName === 'string' ? data.patientName : undefined,
            doctorUid: typeof data.doctorUid === 'string' ? data.doctorUid : undefined,
            doctorName: typeof data.doctorName === 'string' ? data.doctorName : undefined,
            createdAt: timestampToIso(data.createdAt),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'treatmentFeedback');
    },
  );
}

export async function submitDoctorDecisionBatch(params: {
  plan: TreatmentResult;
  doctorUser: UserProfile;
  decision: 'approved' | 'not_approved';
  negativePoints: string;
  improvements: string;
}): Promise<void> {
  const { plan, doctorUser, decision, negativePoints, improvements } = params;
  const planId = sanitizeId(String(plan.id || ''), '');
  if (!planId || !plan.ownerId) {
    throw new Error('Select a valid treatment plan before submitting a physician decision.');
  }

  const feedbackId = sanitizeId(`fb-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`, `fb-${Date.now()}`);
  const planCode = sanitizeId(plan.planCode || planId, 'QUS-1000', 32);
  const path = `treatmentPlans/${planId}`;

  const batch = writeBatch(db);
  batch.update(doc(db, 'treatmentPlans', planId), {
    approvalStatus: decision,
    reviewedByUid: doctorUser.id,
    reviewedByName: sanitizeString(doctorUser.fullName, 'Flight Surgeon', 1, 100),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'treatmentFeedback', feedbackId), {
    planId,
    planCode,
    patientUid: plan.ownerId,
    patientName: sanitizeString(plan.astronautName, 'Crew Member', 1, 100),
    doctorUid: doctorUser.id,
    doctorName: sanitizeString(doctorUser.fullName, 'Flight Surgeon', 1, 100),
    decision,
    negativePoints: negativePoints.trim().slice(0, 2000),
    improvements: improvements.trim().slice(0, 2000),
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
