import React, { useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import {
  ProfileSyncOverrides,
  authorizeDoctorAccount,
  fetchExistingUserProfile,
  loadOrCreateUserProfile,
  parseFriendlyFirebaseError,
  setInteractiveSignIn,
  switchAuthorizedUserRole,
  updateUserProfileDetails,
} from '../services/firebaseService';
import {
  AccountRole,
  CrewSpecialty,
  RouteId,
  UserProfile,
  formatUserTitle,
} from '../types/app';

interface SignInViewProps {
  initialRole?: AccountRole;
  sessionUser: UserProfile | null;
  pendingVerificationUser?: User | null;
  pendingOnboardingUser?: User | null;
  authError?: string | null;
  signedInUnloadedUser?: User | null;
  onRetryHydration?: () => void | Promise<void>;
  onNeedOnboarding?: (user: User, role: AccountRole) => void;
  onSignIn: (user: UserProfile, notice?: string) => void;
  onSignOut: () => void;
  onNavigate: (route: RouteId) => void;
  landing?: boolean;
}

const ASTRONAUT_SPECIALTIES: CrewSpecialty[] = [
  'Mission Commander',
  'Flight Engineer',
  'Payload Specialist',
];

const DOCTOR_SPECIALTIES: CrewSpecialty[] = [
  'Flight Surgeon',
  'Orthopedic Specialist',
];

const PENDING_PREFS_PREFIX = 'msd_pending_profile_';

function savePendingPrefs(uid: string, prefs: ProfileSyncOverrides) {
  try {
    window.sessionStorage.setItem(`${PENDING_PREFS_PREFIX}${uid}`, JSON.stringify(prefs));
  } catch {}
}

function peekPendingPrefs(uid: string): ProfileSyncOverrides | undefined {
  try {
    const raw = window.sessionStorage.getItem(`${PENDING_PREFS_PREFIX}${uid}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as ProfileSyncOverrides;
  } catch {
    return undefined;
  }
}

function clearPendingPrefs(uid: string) {
  try {
    window.sessionStorage.removeItem(`${PENDING_PREFS_PREFIX}${uid}`);
  } catch {}
}

export const SignInView: React.FC<SignInViewProps> = ({
  initialRole = 'astronaut',
  sessionUser,
  pendingVerificationUser = null,
  pendingOnboardingUser = null,
  authError = null,
  signedInUnloadedUser = null,
  onRetryHydration,
  onNeedOnboarding,
  onSignIn,
  onSignOut,
  onNavigate,
  landing = false,
}) => {
  const [selectedRole, setSelectedRole] = useState<AccountRole>(initialRole);
  const [emailMode, setEmailMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [badgeId, setBadgeId] = useState('');
  const [specialty, setSpecialty] = useState<CrewSpecialty>(
    initialRole === 'doctor' ? 'Flight Surgeon' : 'Mission Commander',
  );
  const [loading, setLoading] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [offerGoogleRedirect, setOfferGoogleRedirect] = useState(false);
  const [emailProviderDisabled, setEmailProviderDisabled] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Account editing state for signed-in users
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editSpecialty, setEditSpecialty] = useState<CrewSpecialty>('Mission Commander');
  const [savingEdit, setSavingEdit] = useState(false);

  // Admin doctor grant state
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [grantUid, setGrantUid] = useState('');
  const [grantName, setGrantName] = useState('');
  const [grantSpecialty, setGrantSpecialty] = useState<'Flight Surgeon' | 'Orthopedic Specialist'>(
    'Flight Surgeon',
  );
  const [grantStatus, setGrantStatus] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRole(initialRole);
    setSpecialty(initialRole === 'doctor' ? 'Flight Surgeon' : 'Mission Commander');
  }, [initialRole]);

  useEffect(() => {
    if (pendingOnboardingUser) {
      setFullName((prev) => prev || pendingOnboardingUser.displayName || '');
    }
  }, [pendingOnboardingUser]);

  useEffect(() => {
    if (sessionUser) {
      setEditName(sessionUser.fullName);
      setEditBadge(sessionUser.badgeId);
      setEditSpecialty(sessionUser.specialty);
    }
  }, [sessionUser]);

  const handleChooseRole = (role: AccountRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
    setSpecialty(role === 'doctor' ? 'Flight Surgeon' : 'Mission Commander');
    try {
      window.sessionStorage.setItem('msd_redirect_role', role);
    } catch {}
  };

  const buildOverrides = (): ProfileSyncOverrides => ({
    requestedRole: selectedRole,
    fullName: fullName.trim() || undefined,
    badgeId: badgeId.trim() || undefined,
    specialty,
  });

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setOfferGoogleRedirect(false);
    setEmailProviderDisabled(false);
    setLoading(true);
    setInteractiveSignIn(true);
    try {
      try {
        window.sessionStorage.setItem('msd_redirect_role', selectedRole);
      } catch {}

      const credential = await signInWithPopup(auth, googleProvider);
      if (!credential.user.emailVerified) {
        savePendingPrefs(credential.user.uid, buildOverrides());
        await sendEmailVerification(credential.user);
        setInfoMsg(
          `Your Google account email (${credential.user.email}) needs verification before accessing mission data. Check your inbox, then click I've Verified — Continue.`,
        );
        return;
      }

      const existing = await fetchExistingUserProfile(credential.user, true);
      if (existing) {
        onSignIn(existing, `Welcome back, ${formatUserTitle(existing)}.`);
        return;
      }

      if (emailMode === 'register' && fullName.trim() && badgeId.trim()) {
        const { profile } = await loadOrCreateUserProfile(credential.user, buildOverrides());
        onSignIn(profile, `Account created. Welcome, ${formatUserTitle(profile)}.`);
        return;
      }

      if (onNeedOnboarding) {
        onNeedOnboarding(credential.user, selectedRole);
        return;
      }

      const { profile } = await loadOrCreateUserProfile(credential.user, buildOverrides());
      onSignIn(profile, `Signed in as ${formatUserTitle(profile)}.`);
    } catch (error) {
      const parsed = parseFriendlyFirebaseError(error);
      if (
        parsed.code === 'auth/popup-blocked' ||
        parsed.code === 'auth/popup-closed-by-user' ||
        parsed.code === 'auth/cancelled-popup-request'
      ) {
        setOfferGoogleRedirect(true);
      }
      setErrorMsg(parsed.message);
    } finally {
      setInteractiveSignIn(false);
      setLoading(false);
    }
  };

  const handleGoogleRedirectSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      try {
        window.sessionStorage.setItem('msd_redirect_role', selectedRole);
      } catch {}
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      const parsed = parseFriendlyFirebaseError(error);
      setErrorMsg(parsed.message);
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOnboardingUser) return;
    setErrorMsg(null);
    setInfoMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Enter your full name to save your mission profile.');
      return;
    }
    if (!badgeId.trim()) {
      setErrorMsg(
        selectedRole === 'doctor'
          ? 'Enter your Medical License ID to continue.'
          : 'Enter your Astronaut License / Badge ID to continue.',
      );
      return;
    }

    setLoading(true);
    setInteractiveSignIn(true);
    try {
      const { profile } = await loadOrCreateUserProfile(pendingOnboardingUser, buildOverrides());
      onSignIn(profile, `Profile saved. Welcome, ${formatUserTitle(profile)}.`);
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setInteractiveSignIn(false);
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setEmailProviderDisabled(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Enter a valid mission email address.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (emailMode === 'register') {
      if (!fullName.trim()) {
        setErrorMsg('Full name is required to create an account.');
        return;
      }
      if (!badgeId.trim()) {
        setErrorMsg(
          selectedRole === 'doctor'
            ? 'Medical License ID is required.'
            : 'Astronaut License / Badge ID is required.',
        );
        return;
      }
    }

    setLoading(true);
    setInteractiveSignIn(true);
    try {
      const overrides = buildOverrides();
      if (emailMode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        if (fullName.trim()) {
          await updateProfile(credential.user, { displayName: fullName.trim() });
        }
        savePendingPrefs(credential.user.uid, overrides);
        await sendEmailVerification(credential.user);
        setInfoMsg(
          `Verification link sent to ${cleanEmail}. Verify your email, then click I've Verified — Continue.`,
        );
      } else {
        const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        if (!credential.user.emailVerified) {
          savePendingPrefs(credential.user.uid, overrides);
          setInfoMsg(
            `Your email (${cleanEmail}) is not verified yet. Check your inbox or resend the verification email.`,
          );
          return;
        }
        const existing = await fetchExistingUserProfile(credential.user, true);
        if (existing) {
          onSignIn(existing, `Welcome back, ${formatUserTitle(existing)}.`);
          return;
        }
        if (onNeedOnboarding) {
          onNeedOnboarding(credential.user, selectedRole);
          return;
        }
        const { profile } = await loadOrCreateUserProfile(credential.user, overrides);
        onSignIn(profile, `Signed in as ${formatUserTitle(profile)}.`);
      }
    } catch (error) {
      const parsed = parseFriendlyFirebaseError(error);
      if (parsed.code === 'auth/operation-not-allowed') {
        setEmailProviderDisabled(true);
      }
      setErrorMsg(parsed.message);
    } finally {
      setInteractiveSignIn(false);
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    setInteractiveSignIn(true);
    try {
      await current.reload();
      const refreshed = auth.currentUser;
      if (!refreshed || !refreshed.emailVerified) {
        setErrorMsg('Email is still unverified. Click the link in your inbox, then try again.');
        return;
      }
      await refreshed.getIdToken(true);
      const savedPrefs = peekPendingPrefs(refreshed.uid) || buildOverrides();
      const { profile } = await loadOrCreateUserProfile(refreshed, savedPrefs);
      clearPendingPrefs(refreshed.uid);
      onSignIn(profile, `Email verified. Welcome, ${formatUserTitle(profile)}.`);
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setInteractiveSignIn(false);
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const current = auth.currentUser;
    if (!current) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await sendEmailVerification(current);
      setInfoMsg(`Verification email resent to ${current.email}.`);
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Enter your email address above first to reset your password.');
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoMsg(`Password reset email sent to ${cleanEmail}.`);
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAuthFlow = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setOfferGoogleRedirect(false);
    setEmailProviderDisabled(false);
    await signOut(auth);
  };

  const handleSwitchActiveRole = async () => {
    if (!sessionUser || !sessionUser.canSwitchToDoctor) return;
    setSwitchingRole(true);
    setErrorMsg(null);
    try {
      const nextRole: AccountRole = sessionUser.role === 'doctor' ? 'astronaut' : 'doctor';
      const updated = await switchAuthorizedUserRole(sessionUser, nextRole);
      onSignIn(updated, `Active mission profile switched to ${formatUserTitle(updated)}.`);
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) return;
    if (!editName.trim() || !editBadge.trim()) {
      setErrorMsg('Full name and License / Badge ID are required.');
      return;
    }
    setSavingEdit(true);
    setErrorMsg(null);
    try {
      const updated = await updateUserProfileDetails(sessionUser, {
        fullName: editName.trim(),
        badgeId: editBadge.trim(),
        specialty: editSpecialty,
      });
      setEditingProfile(false);
      onSignIn(updated, `Saved license and profile for ${formatUserTitle(updated)}.`);
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAuthorizeDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser?.isAdmin) return;
    setGrantStatus(null);
    setErrorMsg(null);
    try {
      await authorizeDoctorAccount(sessionUser.id, grantUid, grantName, grantSpecialty);
      setGrantStatus(`Doctor authorization saved for UID ${grantUid.trim()}.`);
      setGrantUid('');
      setGrantName('');
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    }
  };

  // Signed-in Account Profile View
  if (sessionUser) {
    const isDoctor = sessionUser.role === 'doctor';
    const availableSpecialties = isDoctor ? DOCTOR_SPECIALTIES : ASTRONAUT_SPECIALTIES;

    return (
      <div className="w-full max-w-2xl mx-auto rounded-xl border border-slate-800 bg-[#0b101b]/95 p-6 md:p-9 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <p className="text-xs font-medium text-cyan-300">
              {isDoctor ? 'Flight Surgeon Session' : 'Crew Member Session'}
            </p>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white mt-1">
              {formatUserTitle(sessionUser)}
            </h1>
            <p className="font-mono-tech text-xs text-slate-400 mt-1">
              License {sessionUser.badgeId} · {sessionUser.specialty} · {sessionUser.missionName}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono-tech text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Firebase Verified</span>
          </span>
        </div>

        <dl className="pb-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-800">
          <div>
            <dt className="text-xs text-slate-400">Account Role</dt>
            <dd className="text-sm font-semibold text-white mt-1">
              {isDoctor ? 'Doctor (Medical Oversight)' : 'Astronaut (Crew Member)'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">
              {isDoctor ? 'Medical License ID' : 'Astronaut License / Badge ID'}
            </dt>
            <dd className="font-mono-tech text-sm font-semibold text-cyan-300 mt-1">
              {sessionUser.badgeId}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Mission Email</dt>
            <dd className="font-mono-tech text-sm text-slate-200 mt-1">{sessionUser.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">User UID</dt>
            <dd className="font-mono-tech text-xs text-slate-400 mt-1 break-all">{sessionUser.id}</dd>
          </div>
        </dl>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/12 px-3.5 py-2 text-xs text-red-200"
          >
            {errorMsg}
          </div>
        )}

        {/* Edit License / Name / Role Controls */}
        <div className="pb-6 border-b border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setEditingProfile((v) => !v)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-cyan-300 cursor-pointer ui-transition"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{editingProfile ? 'Cancel Profile Edit' : 'Update License ID or Name'}</span>
            </button>

            {sessionUser.canSwitchToDoctor && (
              <button
                type="button"
                disabled={switchingRole}
                onClick={handleSwitchActiveRole}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 cursor-pointer ui-transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${switchingRole ? 'animate-spin' : ''}`} />
                <span>{isDoctor ? 'Switch View to Astronaut' : 'Switch View to Doctor'}</span>
              </button>
            )}
          </div>

          {editingProfile && (
            <form onSubmit={handleSaveProfileEdit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Name</span>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">
                  {isDoctor ? 'Medical License ID' : 'License / Badge ID'}
                </span>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={editBadge}
                  onChange={(e) => setEditBadge(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] font-mono-tech text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Specialty</span>
                <select
                  value={editSpecialty}
                  onChange={(e) => setEditSpecialty(e.target.value as CrewSpecialty)}
                  className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {availableSpecialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold cursor-pointer ui-transition disabled:opacity-60"
                >
                  {savingEdit ? 'Saving...' : 'Save License & Profile'}
                </button>
              </div>
            </form>
          )}
        </div>

        {sessionUser.isAdmin && (
          <div className="pb-6 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setShowAdminPanel((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span>Authorize Additional Doctor Account</span>
              </span>
              <span className="text-slate-500">{showAdminPanel ? 'Hide' : 'Open'}</span>
            </button>

            {showAdminPanel && (
              <form onSubmit={handleAuthorizeDoctor} className="mt-4 space-y-3">
                {grantStatus && <p className="text-xs text-emerald-300 font-medium">{grantStatus}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={grantUid}
                    onChange={(e) => setGrantUid(e.target.value)}
                    placeholder="Firebase User UID"
                    className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] font-mono-tech text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="text"
                    required
                    value={grantName}
                    onChange={(e) => setGrantName(e.target.value)}
                    placeholder="Dr. Full Name"
                    className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <select
                    value={grantSpecialty}
                    onChange={(e) =>
                      setGrantSpecialty(e.target.value as 'Flight Surgeon' | 'Orthopedic Specialist')
                    }
                    className="h-9 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Flight Surgeon">Flight Surgeon</option>
                    <option value="Orthopedic Specialist">Orthopedic Specialist</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold cursor-pointer ui-transition"
                >
                  Grant Doctor Clearance
                </button>
              </form>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate(isDoctor ? 'approval' : 'skeletons')}
              className="px-4 py-2.5 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-xs font-bold whitespace-nowrap shrink-0 ui-transition cursor-pointer"
            >
              {isDoctor ? 'Open Doctor Approval' : 'Open My Skeleton'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate(isDoctor ? 'doctors' : 'coach')}
              className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-slate-500 text-slate-100 text-xs font-medium whitespace-nowrap shrink-0 ui-transition cursor-pointer"
            >
              {isDoctor ? 'Doctors Review' : 'Physical Treatment'}
            </button>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-800 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 text-xs font-medium whitespace-nowrap shrink-0 ui-transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // First-time Google Onboarding Step: Ask Role + License + Name & Save to Account
  if (pendingOnboardingUser) {
    const isDoctorRole = selectedRole === 'doctor';
    const specialties = isDoctorRole ? DOCTOR_SPECIALTIES : ASTRONAUT_SPECIALTIES;

    return (
      <div
        className={`w-full rounded-xl border border-white/15 bg-[#090d16]/90 p-6 md:p-7 space-y-4 ${
          landing ? 'max-w-[480px]' : 'max-w-xl mx-auto md:p-9'
        }`}
      >
        <div className="pb-4 border-b border-slate-800">
          <h2 className="font-display text-xl font-bold text-white">Complete Mission Registration</h2>
          <p className="text-xs text-slate-300 mt-1">
            Signed in with Google as{' '}
            <span className="font-mono-tech text-cyan-300">{pendingOnboardingUser.email}</span>.
            Choose your role and license ID to save to your account.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Mission Role">
          <button
            type="button"
            role="radio"
            aria-checked={selectedRole === 'astronaut'}
            onClick={() => handleChooseRole('astronaut')}
            className={`flex items-start gap-2.5 p-3 rounded-lg border text-left ui-transition cursor-pointer ${
              selectedRole === 'astronaut'
                ? 'border-cyan-400/70 bg-cyan-500/12 text-white'
                : 'border-slate-800 bg-[#070a12] text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Rocket
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                selectedRole === 'astronaut' ? 'text-cyan-400' : 'text-slate-500'
              }`}
            />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold">Astronaut</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Scans &amp; treatment
              </div>
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={selectedRole === 'doctor'}
            onClick={() => handleChooseRole('doctor')}
            className={`flex items-start gap-2.5 p-3 rounded-lg border text-left ui-transition cursor-pointer ${
              selectedRole === 'doctor'
                ? 'border-cyan-400/70 bg-cyan-500/12 text-white'
                : 'border-slate-800 bg-[#070a12] text-slate-400 hover:border-slate-700 hover:text-slate-200'
            }`}
          >
            <Stethoscope
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                selectedRole === 'doctor' ? 'text-cyan-400' : 'text-slate-500'
              }`}
            />
            <div className="min-w-0">
              <div className="font-display text-sm font-bold">Doctor</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Approvals &amp; review
              </div>
            </div>
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/12 px-3.5 py-2 text-xs text-red-200"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCompleteOnboarding} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-300">Full Name</span>
              <input
                type="text"
                required
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isDoctorRole ? 'Aris Thorne' : 'Elena Vance'}
                className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-300">
                {isDoctorRole ? 'Medical License ID' : 'Astronaut License / Badge ID'}
              </span>
              <input
                type="text"
                required
                maxLength={40}
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                placeholder={isDoctorRole ? 'MED-402' : 'AST-104'}
                className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] font-mono-tech text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-300">Specialty</span>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value as CrewSpecialty)}
              className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-sm text-white focus:outline-none focus:border-cyan-400"
            >
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="pt-1 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-2 ui-transition cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Saving Profile...' : 'Save License & Enter Portal'}</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleCancelAuthFlow}
              className="h-9 rounded-lg border border-slate-800 bg-[#070a12] hover:border-slate-600 text-xs text-slate-400 hover:text-slate-200 ui-transition cursor-pointer"
            >
              Use Different Account
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Email Verification Wait Step
  if (pendingVerificationUser) {
    return (
      <div
        className={`w-full rounded-xl border border-white/15 bg-[#090d16]/90 p-6 md:p-7 space-y-4 ${
          landing ? 'max-w-[480px]' : 'max-w-xl mx-auto md:p-9'
        }`}
      >
        <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
          <Mail className="w-5 h-5 text-cyan-400 shrink-0 mt-1" />
          <div>
            <h2 className="font-display text-xl font-bold text-white">Verify Your Email</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Click the verification link sent to{' '}
              <span className="font-mono-tech text-cyan-300">{pendingVerificationUser.email}</span> to
              activate your Firebase session.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/12 px-3.5 py-2 text-xs text-red-200"
          >
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div
            role="status"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs text-cyan-200"
          >
            {infoMsg}
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={handleCheckVerification}
            className="w-full h-11 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-2 ui-transition cursor-pointer disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Checking...' : "I've Verified — Continue"}</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={loading}
              onClick={handleResendVerification}
              className="h-10 rounded-lg border border-slate-700 bg-[#070a12] hover:border-slate-500 text-xs font-medium text-slate-200 ui-transition cursor-pointer disabled:opacity-60"
            >
              Resend Email
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleCancelAuthFlow}
              className="h-10 rounded-lg border border-slate-800 bg-[#070a12] hover:border-rose-500/50 text-xs font-medium text-slate-400 hover:text-rose-300 ui-transition cursor-pointer disabled:opacity-60"
            >
              Use Different Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleRetrySessionSetup = async () => {
    if (!onRetryHydration) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await onRetryHydration();
    } catch (error) {
      setErrorMsg(parseFriendlyFirebaseError(error).message);
    } finally {
      setLoading(false);
    }
  };

  // Session Hydration Recovery Step (prevents silent hang if Firebase user is signed in but profile hydration fails)
  if (signedInUnloadedUser && (authError || errorMsg)) {
    const recoveryError = errorMsg || authError;
    return (
      <div
        className={`w-full rounded-xl border border-white/15 bg-[#090d16]/95 p-6 md:p-7 space-y-4 ${
          landing ? 'max-w-[480px]' : 'max-w-xl mx-auto md:p-9'
        }`}
      >
        <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display text-xl font-bold text-white">Complete Session Setup</h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Signed in as{' '}
              <span className="font-mono-tech text-cyan-300">{signedInUnloadedUser.email}</span>,
              but your mission profile could not be loaded.
            </p>
          </div>
        </div>

        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/12 px-3.5 py-2.5 text-xs text-red-200 leading-relaxed"
        >
          {recoveryError}
        </div>

        <div className="space-y-2.5">
          {onRetryHydration && (
            <button
              type="button"
              disabled={loading}
              onClick={handleRetrySessionSetup}
              className="w-full h-11 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-2 ui-transition cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Retrying...' : 'Retry Loading Profile'}</span>
            </button>
          )}
          {onNeedOnboarding && (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setErrorMsg(null);
                onNeedOnboarding(signedInUnloadedUser, selectedRole);
              }}
              className="w-full h-10 rounded-lg border border-slate-700 bg-[#070a12] hover:border-cyan-400/60 text-xs font-semibold text-slate-100 ui-transition cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              Finish Profile Registration
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={handleCancelAuthFlow}
            className="w-full h-10 rounded-lg border border-slate-800 bg-[#070a12] hover:border-rose-500/50 text-xs font-medium text-slate-400 hover:text-rose-300 ui-transition cursor-pointer whitespace-nowrap disabled:opacity-60"
          >
            Sign Out &amp; Use Different Account
          </button>
        </div>
      </div>
    );
  }

  const isDoctorRole = selectedRole === 'doctor';
  const specialties = isDoctorRole ? DOCTOR_SPECIALTIES : ASTRONAUT_SPECIALTIES;
  const activeError = errorMsg || authError;

  return (
    <div
      className={`w-full rounded-xl border border-white/15 bg-[#090d16]/92 p-6 md:p-7 ${
        landing ? 'max-w-[480px]' : 'max-w-xl mx-auto md:p-9'
      }`}
    >
      {/* Header + Top-Level Sign In / Create Account Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-bold text-white">
            {emailMode === 'register' ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {emailMode === 'register'
              ? 'Register as an Astronaut or Doctor with Google or email.'
              : 'Sign in with Google or your mission email and password.'}
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-800 bg-[#070a12] p-1 gap-1 shrink-0"
          role="tablist"
          aria-label="Authentication Mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={emailMode === 'signin'}
            onClick={() => {
              setEmailMode('signin');
              setErrorMsg(null);
              setInfoMsg(null);
              setEmailProviderDisabled(false);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 ui-transition cursor-pointer ${
              emailMode === 'signin'
                ? 'bg-[#0891b2] text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={emailMode === 'register'}
            onClick={() => {
              setEmailMode('register');
              setErrorMsg(null);
              setInfoMsg(null);
              setEmailProviderDisabled(false);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 ui-transition cursor-pointer ${
              emailMode === 'register'
                ? 'bg-[#0891b2] text-slate-950'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Create Account
          </button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="mt-4 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Mission Role">
        <button
          type="button"
          role="radio"
          aria-checked={selectedRole === 'astronaut'}
          onClick={() => handleChooseRole('astronaut')}
          className={`flex items-start gap-2.5 p-3 rounded-lg border text-left ui-transition cursor-pointer ${
            selectedRole === 'astronaut'
              ? 'border-cyan-400/70 bg-cyan-500/12 text-white'
              : 'border-slate-800 bg-[#070a12] text-slate-400 hover:border-slate-700 hover:text-slate-200'
          }`}
        >
          <Rocket
            className={`w-4 h-4 mt-0.5 shrink-0 ${
              selectedRole === 'astronaut' ? 'text-cyan-400' : 'text-slate-500'
            }`}
          />
          <div className="min-w-0">
            <div className="font-display text-sm font-bold">Astronaut</div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Scans &amp; treatment
            </div>
          </div>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selectedRole === 'doctor'}
          onClick={() => handleChooseRole('doctor')}
          className={`flex items-start gap-2.5 p-3 rounded-lg border text-left ui-transition cursor-pointer ${
            selectedRole === 'doctor'
              ? 'border-cyan-400/70 bg-cyan-500/12 text-white'
              : 'border-slate-800 bg-[#070a12] text-slate-400 hover:border-slate-700 hover:text-slate-200'
          }`}
        >
          <Stethoscope
            className={`w-4 h-4 mt-0.5 shrink-0 ${
              selectedRole === 'doctor' ? 'text-cyan-400' : 'text-slate-500'
            }`}
          />
          <div className="min-w-0">
            <div className="font-display text-sm font-bold">Doctor</div>
            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Approvals &amp; review
            </div>
          </div>
        </button>
      </div>

      {/* Google Login Primary Action */}
      <div className="mt-4 space-y-2">
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full h-11 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 text-sm font-bold inline-flex items-center justify-center gap-2.5 ui-transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
            />
          </svg>
          <span>
            {emailMode === 'register'
              ? `Create Account with Google (${isDoctorRole ? 'Doctor' : 'Astronaut'})`
              : `Continue with Google as ${isDoctorRole ? 'Doctor' : 'Astronaut'}`}
          </span>
        </button>

        {offerGoogleRedirect && (
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleRedirectSignIn}
            className="w-full h-10 rounded-lg border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-200 inline-flex items-center justify-center gap-2 ui-transition cursor-pointer whitespace-nowrap"
          >
            <span>Continue with Google Redirect Instead</span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="my-4 flex items-center gap-3 text-[11px] text-slate-500">
        <span className="h-px flex-1 bg-slate-800" />
        <span>or use email &amp; password</span>
        <span className="h-px flex-1 bg-slate-800" />
      </div>

      {activeError && (
        <div
          role="alert"
          className="mb-3.5 rounded-lg border border-red-500/40 bg-red-500/12 px-3.5 py-2.5 text-xs text-red-200 space-y-1.5"
        >
          <p>{activeError}</p>
          {emailProviderDisabled && (
            <a
              href="https://console.firebase.google.com/project/gen-lang-client-0746044227/authentication/providers"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:text-cyan-200 underline"
            >
              <span>Open Firebase Sign-In Providers</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
        </div>
      )}

      {infoMsg && (
        <div
          role="status"
          className="mb-3.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs text-cyan-200"
        >
          {infoMsg}
        </div>
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        {emailMode === 'register' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-300">Full Name</span>
              <input
                type="text"
                required
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isDoctorRole ? 'Aris Thorne' : 'Elena Vance'}
                className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-slate-300">
                {isDoctorRole ? 'Medical License ID' : 'Astronaut License / Badge ID'}
              </span>
              <input
                type="text"
                required
                maxLength={40}
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                placeholder={isDoctorRole ? 'MED-402' : 'AST-104'}
                className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] font-mono-tech text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-300">Email Address</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isDoctorRole ? 'doctor@orbital-med.org' : 'astronaut@mission.org'}
              className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-300">Password</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete={emailMode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full h-10 pl-3 pr-9 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </label>
        </div>

        {emailMode === 'register' && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-slate-300">Specialty</span>
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value as CrewSpecialty)}
              className="h-10 px-3 rounded-lg border border-slate-700 bg-[#070a12] text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              {specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          {emailMode === 'signin' ? (
            <button
              type="button"
              onClick={handlePasswordReset}
              className="text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap"
            >
              Forgot password?
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">Email verification required</span>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 hover:border-cyan-400/60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 ui-transition cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              {loading
                ? 'Please wait...'
                : emailMode === 'register'
                  ? 'Create Email Account'
                  : 'Sign In with Email'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
