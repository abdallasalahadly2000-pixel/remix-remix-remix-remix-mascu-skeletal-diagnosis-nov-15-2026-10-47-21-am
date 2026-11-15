import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';
import { ArrowRight, CheckCircle2, Lock, Menu, UserCheck, X } from 'lucide-react';
import {
  BoneDatasetEntry,
  DEFAULT_STATUS_COLORS,
  StatusColorPalette,
} from './domain/osteosense';
import { AiHelpAssistant } from './components/AiHelpAssistant';
import { AstronautFloat } from './components/AstronautFloat';
import { ContactView } from './components/ContactView';
import { DoctorApprovalView } from './components/DoctorApprovalView';
import { DoctorApprovedPage } from './components/DoctorApprovedPage';
import { DoctorsReviewView } from './components/DoctorsReviewView';
import { MySkeletonView } from './components/MySkeletonView';
import { PhysicalTreatmentView } from './components/PhysicalTreatmentView';
import { SignInView } from './components/SignInView';
import { SpaceBackdrop } from './components/SpaceBackdrop';
import { WriteReviewPage } from './components/WriteReviewPage';
import { auth } from './firebase';
import {
  createTreatmentPlanInFirestore,
  fetchExistingUserProfile,
  isInteractiveSignIn,
  parseFriendlyFirebaseError,
  submitDoctorDecisionBatch,
  subscribeTreatmentFeedback,
  subscribeTreatmentPlans,
  switchAuthorizedUserRole,
} from './services/firebaseService';
import {
  AccountRole,
  RouteId,
  TreatmentFeedback,
  TreatmentResult,
  UserProfile,
  formatUserTitle,
} from './types/app';

const ROUTE_HASHES: Record<RouteId, string> = {
  orbit: '#orbit',
  signin: '#sign-in',
  skeletons: '#my-skeleton',
  coach: '#physical-treatment',
  approval: '#doctor-approval',
  approved: '#doctor-approved',
  writeReview: '#write-review',
  doctors: '#doctors-review',
  contact: '#contact-us',
};

const TOP_NAV_ITEMS: Array<{
  route: RouteId;
  label: string;
  matchRoutes?: RouteId[];
  doctorGated?: boolean;
}> = [
  { route: 'skeletons', label: 'My Skeleton' },
  { route: 'coach', label: 'Physical Treatment' },
  {
    route: 'approval',
    label: 'Doctor Approval',
    matchRoutes: ['approval', 'approved', 'writeReview'],
    doctorGated: true,
  },
  { route: 'doctors', label: 'Doctors Review' },
  { route: 'contact', label: 'Contact Us' },
];

const ORBIT_QUICK_ROUTES: Array<{ route: RouteId; label: string; hint: string }> = [
  { route: 'skeletons', label: 'My Skeleton', hint: '3D suit twin · bone damage & 30 sensors' },
  { route: 'coach', label: 'Physical Treatment', hint: 'Exercises, timing, 3D simulator & treatment plans' },
  { route: 'approval', label: 'Doctor Approval', hint: 'Doctor-only sign-off & clearance' },
  { route: 'doctors', label: 'Doctors Review', hint: 'Recorded clinical decisions & revisions' },
  { route: 'signin', label: 'Account', hint: 'Active session & role settings' },
  { route: 'contact', label: 'Contact Us', hint: 'Direct orbital medical telemetry desk' },
];

function getRouteFromHash(hash: string): RouteId {
  for (const [key, val] of Object.entries(ROUTE_HASHES)) {
    if (val === hash) return key as RouteId;
  }
  return 'orbit';
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
  const [pendingOnboardingUser, setPendingOnboardingUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [route, setRoute] = useState<RouteId>('signin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [preferredSignInRole, setPreferredSignInRole] = useState<AccountRole>(() => {
    try {
      const saved = window.sessionStorage.getItem('msd_redirect_role');
      return saved === 'doctor' ? 'doctor' : 'astronaut';
    } catch {
      return 'astronaut';
    }
  });
  const [postSignInRoute, setPostSignInRoute] = useState<RouteId>('orbit');

  const [datasetEntries, setDatasetEntries] = useState<BoneDatasetEntry[]>([]);
  const [focusedBoneId, setFocusedBoneId] = useState<string>('femur-right');
  const [statusColors, setStatusColors] = useState<StatusColorPalette>(DEFAULT_STATUS_COLORS);

  const [treatmentHistory, setTreatmentHistory] = useState<TreatmentResult[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [treatmentFeedback, setTreatmentFeedback] = useState<TreatmentFeedback[]>([]);
  const [submittingDecision, setSubmittingDecision] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3800);
  }, []);

  const hydrateUserSession = useCallback(async (user: User, forceRefresh = false) => {
    setAuthError(null);
    try {
      if (forceRefresh) {
        try {
          await user.reload();
        } catch {
          // Proceed with current user state if reload fails transiently
        }
      }
      if (!user.emailVerified) {
        setSessionUser(null);
        setPendingOnboardingUser(null);
        setRoute('signin');
        return;
      }
      const existing = await fetchExistingUserProfile(user, forceRefresh);
      if (!existing) {
        try {
          const savedRole = window.sessionStorage.getItem('msd_redirect_role');
          if (savedRole === 'doctor' || savedRole === 'astronaut') {
            setPreferredSignInRole(savedRole);
          }
          window.sessionStorage.removeItem('msd_redirect_role');
        } catch {}
        setSessionUser(null);
        setPendingOnboardingUser(user);
        setRoute('signin');
      } else {
        try {
          window.sessionStorage.removeItem('msd_redirect_role');
        } catch {}
        setPendingOnboardingUser(null);
        setSessionUser(existing);
        setRoute((prev) => (prev === 'signin' ? getRouteFromHash(window.location.hash) : prev));
      }
    } catch (error) {
      console.error('Failed to hydrate Firebase session profile:', error);
      setAuthError(parseFriendlyFirebaseError(error).message);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    void getRedirectResult(auth).catch((error) => {
      setAuthError(parseFriendlyFirebaseError(error).message);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || !user.emailVerified) {
        setSessionUser(null);
        setPendingOnboardingUser(null);
        setTreatmentHistory([]);
        setTreatmentFeedback([]);
        setSelectedPlanId(null);
        setRoute('signin');
        setAuthReady(true);
        return;
      }

      if (isInteractiveSignIn()) {
        setAuthReady(true);
        return;
      }

      await hydrateUserSession(user);
    });

    return () => unsubscribe();
  }, [hydrateUserSession]);

  useEffect(() => {
    if (!authReady || !firebaseUser || !firebaseUser.emailVerified || !sessionUser) return;

    const unsubPlans = subscribeTreatmentPlans(
      sessionUser.id,
      sessionUser.role,
      Boolean(sessionUser.isAdmin),
      (plans) => {
        setTreatmentHistory(plans);
      },
    );

    const unsubFeedback = subscribeTreatmentFeedback(
      sessionUser.id,
      sessionUser.role,
      Boolean(sessionUser.isAdmin),
      (feedback) => {
        setTreatmentFeedback(feedback);
      },
    );

    return () => {
      unsubPlans();
      unsubFeedback();
    };
  }, [authReady, firebaseUser, sessionUser]);

  useEffect(() => {
    const onHashChange = () => {
      if (!sessionUser) {
        setRoute('signin');
        return;
      }
      setRoute(getRouteFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [sessionUser]);

  const treatmentResult = useMemo(() => {
    if (treatmentHistory.length === 0) return null;
    if (selectedPlanId) {
      const matched = treatmentHistory.find((p) => String(p.id) === selectedPlanId);
      if (matched) return matched;
    }
    return (
      treatmentHistory.find((p) => p.approvalStatus === 'pending') ||
      treatmentHistory[0] ||
      null
    );
  }, [selectedPlanId, treatmentHistory]);

  const navigate = useCallback(
    (nextRoute: RouteId) => {
      const resolvedRoute = !sessionUser ? 'signin' : nextRoute;
      setRoute(resolvedRoute);
      setMobileMenuOpen(false);
      const targetHash = ROUTE_HASHES[resolvedRoute];
      if (window.location.hash !== targetHash) {
        try {
          window.history.pushState(null, '', targetHash);
        } catch {
          window.location.hash = targetHash;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [sessionUser],
  );

  const handleOpenBoneInTreatment = useCallback(
    (boneId: string) => {
      setFocusedBoneId(boneId);
      navigate('coach');
    },
    [navigate],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(auth);
      setAuthError(null);
      setPendingOnboardingUser(null);
      setSessionUser(null);
      setTreatmentHistory([]);
      setTreatmentFeedback([]);
      setSelectedPlanId(null);
      setPostSignInRoute('orbit');
      setRoute('signin');
      try {
        window.history.pushState(null, '', ROUTE_HASHES.signin);
      } catch {
        window.location.hash = ROUTE_HASHES.signin;
      }
      showToast('Signed out.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  }, [showToast]);

  const handleOpenDoctorSignIn = useCallback(async () => {
    if (sessionUser?.canSwitchToDoctor) {
      try {
        const updated = await switchAuthorizedUserRole(sessionUser, 'doctor');
        setSessionUser(updated);
        setRoute('approval');
        showToast('Switched to Doctor View.');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Unable to switch to Doctor view.');
      }
      return;
    }

    if (sessionUser) {
      await signOut(auth);
      setSessionUser(null);
    }
    setPreferredSignInRole('doctor');
    setPostSignInRoute('approval');
    setRoute('signin');
    setMobileMenuOpen(false);
  }, [sessionUser, showToast]);

  const handleRecordAssessment = useCallback(
    async (result: TreatmentResult) => {
      if (!sessionUser) return;
      try {
        const saved = await createTreatmentPlanInFirestore(result, sessionUser.id);
        if (saved.id) {
          setSelectedPlanId(String(saved.id));
        }
        showToast('Treatment plan saved and automatically sent to Doctor Approval.');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to save treatment plan.');
      }
    },
    [sessionUser, showToast],
  );

  const handleApproveTreatment = useCallback(async () => {
    if (sessionUser?.role !== 'doctor' || !treatmentResult) return;
    setSubmittingDecision(true);
    try {
      await submitDoctorDecisionBatch({
        plan: treatmentResult,
        doctorUser: sessionUser,
        decision: 'approved',
        negativePoints: '',
        improvements: '',
      });
      navigate('approved');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to record approval.');
    } finally {
      setSubmittingDecision(false);
    }
  }, [navigate, sessionUser, showToast, treatmentResult]);

  const handleNotApproveTreatment = useCallback(() => {
    if (sessionUser?.role !== 'doctor' || !treatmentResult) return;
    navigate('writeReview');
  }, [navigate, sessionUser, treatmentResult]);

  const handleSubmitNegativeReview = useCallback(
    async (negativePoints: string, improvements: string) => {
      if (sessionUser?.role !== 'doctor' || !treatmentResult) return;
      setSubmittingDecision(true);
      try {
        await submitDoctorDecisionBatch({
          plan: treatmentResult,
          doctorUser: sessionUser,
          decision: 'not_approved',
          negativePoints,
          improvements,
        });
        showToast('Revision review recorded to Firestore.');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to submit review.');
      } finally {
        setSubmittingDecision(false);
      }
    },
    [sessionUser, showToast, treatmentResult],
  );

  if (!authReady) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden text-slate-100">
        <SpaceBackdrop dimmed={false} />
        <main className="relative z-10 min-h-screen flex items-center justify-center px-6">
          <div className="text-center space-y-2">
            <p className="font-display text-lg font-bold text-white">Mascu-Skeletal Diagnosis</p>
            <p className="text-xs text-slate-400">Initializing mission session...</p>
          </div>
        </main>
      </div>
    );
  }

  // Landing Page IS the Sign-In Menu on the Orbital Space Scene
  if (!sessionUser) {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden text-slate-100">
        <SpaceBackdrop dimmed={false} />

        <main className="relative z-10 min-h-screen flex flex-col justify-between px-6 py-7 md:px-12 md:py-10 lg:px-14 lg:py-12">
          <AstronautFloat variant="orbit" />

          <header className="relative z-10 flex items-center justify-between">
            <span className="font-display text-lg md:text-xl font-bold tracking-tight text-white whitespace-nowrap">
              Mascu-Skeletal Diagnosis
            </span>
          </header>

          <div className="relative z-10 my-auto py-6 max-w-xl space-y-5">
            <div>
              <h1 className="font-display text-[clamp(2.4rem,5vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.025em] text-white">
                Welcome
              </h1>
              <p className="mt-2.5 text-sm md:text-base text-slate-300 leading-relaxed max-w-md">
                Sign in with your Astronaut or Doctor mission account to access 3D skeletal diagnostics and treatment plans.
              </p>
            </div>

            <SignInView
              landing
              initialRole={preferredSignInRole}
              sessionUser={null}
              pendingVerificationUser={
                firebaseUser && !firebaseUser.emailVerified ? firebaseUser : null
              }
              pendingOnboardingUser={pendingOnboardingUser}
              authError={authError}
              signedInUnloadedUser={
                firebaseUser &&
                firebaseUser.emailVerified &&
                !sessionUser &&
                !pendingOnboardingUser
                  ? firebaseUser
                  : null
              }
              onRetryHydration={async () => {
                if (firebaseUser) {
                  await hydrateUserSession(firebaseUser, true);
                }
              }}
              onNeedOnboarding={(user, role) => {
                setAuthError(null);
                setPreferredSignInRole(role);
                setPendingOnboardingUser(user);
              }}
              onSignIn={(user, notice) => {
                setAuthError(null);
                setPendingOnboardingUser(null);
                setSessionUser(user);
                const destination =
                  postSignInRoute === 'approval' && user.role !== 'doctor' ? 'orbit' : postSignInRoute;
                setPostSignInRoute('orbit');
                setRoute(destination);
                const targetHash = ROUTE_HASHES[destination];
                try {
                  window.history.pushState(null, '', targetHash);
                } catch {
                  window.location.hash = targetHash;
                }
                showToast(notice || `Signed in as ${formatUserTitle(user)}.`);
              }}
              onSignOut={handleSignOut}
              onNavigate={() => {}}
            />
          </div>

          <div aria-hidden="true" className="h-2" />
        </main>

        <AiHelpAssistant
          route="signin"
          sessionUser={null}
          datasetEntries={datasetEntries}
          focusedBoneId={focusedBoneId}
          treatmentResult={null}
        />

        {toastMsg && (
          <div
            role="status"
            className="fixed top-20 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/45 bg-[#080d18] text-xs font-medium text-cyan-200 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}
      </div>
    );
  }

  const isOrbit = route === 'orbit';
  const isContact = route === 'contact';
  const isDoctorSignedIn = sessionUser.role === 'doctor';
  const isApprovalRoute = route === 'approval' || route === 'approved' || route === 'writeReview';

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden text-slate-100">
      <SpaceBackdrop dimmed={!isOrbit && !isContact} />

      {/* Authenticated Orbit Home Launchpad */}
      {isOrbit && (
        <main className="relative z-10 min-h-screen flex flex-col justify-between px-6 py-7 md:px-12 md:py-10 lg:px-14 lg:py-12">
          <AstronautFloat variant="orbit" />

          <header className="relative z-10 flex items-center justify-between gap-8">
            <span className="font-display text-lg md:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              Mascu-Skeletal Diagnosis
            </span>
            <button
              type="button"
              onClick={() => navigate('signin')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 bg-[#080c16]/80 hover:border-cyan-400/60 hover:text-white text-xs font-semibold text-slate-100 whitespace-nowrap shrink-0 ui-transition cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{formatUserTitle(sessionUser)}</span>
            </button>
          </header>

          <div className="relative z-10 my-auto py-8 max-w-xl">
            <p className="font-mono-tech text-xs font-semibold text-cyan-300 mb-2">
              {formatUserTitle(sessionUser)} · License {sessionUser.badgeId}
            </p>
            <h1 className="font-display text-[clamp(2.75rem,6vw,5rem)] font-bold leading-[0.98] tracking-[-0.025em] text-white">
              Orbital Bone &amp; Muscle Diagnostics
            </h1>
            <p className="mt-4 text-sm md:text-base text-slate-300 leading-relaxed max-w-md">
              Inspect 3D skeletal health, generate physical treatment plans sent straight to flight surgeons, and track clinical approvals.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('skeletons')}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-[#0891b2] hover:bg-[#06b6d4] text-slate-950 font-display text-sm font-bold whitespace-nowrap shrink-0 ui-transition cursor-pointer"
              >
                <span>Open 3D Skeleton</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => navigate('coach')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/20 bg-[#090e1a]/80 hover:border-white/40 text-slate-100 text-sm font-medium whitespace-nowrap shrink-0 ui-transition cursor-pointer"
              >
                <span>Physical Treatment</span>
              </button>
            </div>
          </div>

          <nav
            aria-label="Mission Navigation"
            className="relative z-10 w-[min(640px,100%)] border-t border-white/12 pt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3"
          >
            {ORBIT_QUICK_ROUTES.map((item) => (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                className="group flex items-start justify-between gap-2 text-left py-1.5 border-b border-transparent hover:border-cyan-400/50 ui-transition cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="font-display text-sm font-semibold text-slate-100 group-hover:text-cyan-300 ui-transition whitespace-nowrap">
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.hint}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 ui-transition shrink-0 mt-1" />
              </button>
            ))}
          </nav>
        </main>
      )}

      {/* Inner Pages with Persistent 3-Zone Top Bar */}
      {!isOrbit && (
        <div className="relative z-10 min-h-screen flex flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#07090e]/92 backdrop-blur-sm">
            <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-8">
              <button
                type="button"
                onClick={() => navigate('orbit')}
                className="font-display text-base md:text-lg font-bold tracking-tight text-white hover:text-cyan-300 ui-transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                Mascu-Skeletal Diagnosis
              </button>

              <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-6">
                {TOP_NAV_ITEMS.map((item) => {
                  const isActive =
                    route === item.route || (item.matchRoutes?.includes(route) ?? false);
                  return (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => navigate(item.route)}
                      className={`py-1 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 inline-flex items-center gap-1.5 ui-transition cursor-pointer ${
                        isActive
                          ? 'text-white border-cyan-400'
                          : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-600'
                      }`}
                    >
                      {item.doctorGated && !isDoctorSignedIn && (
                        <Lock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('signin')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ui-transition cursor-pointer ${
                    route === 'signin'
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-slate-700 bg-[#0e1422] hover:border-cyan-400/60 text-slate-100'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[200px] truncate">{formatUserTitle(sessionUser)}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={mobileMenuOpen}
                  className="lg:hidden p-2 rounded-lg border border-slate-700 bg-[#0e1422] text-slate-200 hover:text-white cursor-pointer"
                >
                  {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mobileMenuOpen && (
              <nav
                aria-label="Mobile Navigation"
                className="lg:hidden border-t border-slate-800 bg-[#080c15] px-4 py-3 flex flex-wrap gap-2"
              >
                {TOP_NAV_ITEMS.map((item) => {
                  const isActive =
                    route === item.route || (item.matchRoutes?.includes(route) ?? false);
                  return (
                    <button
                      key={item.route}
                      type="button"
                      onClick={() => navigate(item.route)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                          : 'text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {item.doctorGated && !isDoctorSignedIn && (
                        <Lock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                      )}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </header>

          <main
            className={`relative z-20 flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8 flex ${
              isContact
                ? 'flex-col md:flex-row items-center justify-between gap-10 lg:gap-16'
                : 'items-start justify-center'
            }`}
          >
            {route === 'signin' && (
              <SignInView
                initialRole={preferredSignInRole}
                sessionUser={sessionUser}
                onSignIn={(user, notice) => {
                  setSessionUser(user);
                  showToast(notice || `Updated session for ${user.fullName}.`);
                }}
                onSignOut={handleSignOut}
                onNavigate={navigate}
              />
            )}

            {route === 'skeletons' && (
              <MySkeletonView
                datasetEntries={datasetEntries}
                onChangeDatasetEntries={setDatasetEntries}
                selectedBoneId={focusedBoneId}
                onSelectBoneId={setFocusedBoneId}
                statusColors={statusColors}
                onChangeStatusColor={(tier, hex) =>
                  setStatusColors((prev) => ({ ...prev, [tier]: hex.toUpperCase() }))
                }
                onResetStatusColors={() => setStatusColors(DEFAULT_STATUS_COLORS)}
                onOpenTreatmentForBone={handleOpenBoneInTreatment}
                onNavigate={navigate}
              />
            )}

            {route === 'coach' && (
              <PhysicalTreatmentView
                sessionUser={sessionUser}
                datasetEntries={datasetEntries}
                statusColors={statusColors}
                focusedBoneId={focusedBoneId}
                onSelectFocusedBoneId={setFocusedBoneId}
                treatmentResult={treatmentResult}
                treatmentHistory={treatmentHistory}
                onRecordAssessment={handleRecordAssessment}
                onNavigate={navigate}
              />
            )}

            {isApprovalRoute && !isDoctorSignedIn && (
              <DoctorApprovalView
                sessionUser={sessionUser}
                treatmentReport={treatmentResult}
                treatmentPlans={treatmentHistory}
                onSelectPlan={setSelectedPlanId}
                submitting={submittingDecision}
                onApprove={handleApproveTreatment}
                onNotApprove={handleNotApproveTreatment}
                onOpenDoctorSignIn={handleOpenDoctorSignIn}
                onNavigate={navigate}
              />
            )}

            {route === 'approval' && isDoctorSignedIn && (
              <DoctorApprovalView
                sessionUser={sessionUser}
                treatmentReport={treatmentResult}
                treatmentPlans={treatmentHistory}
                onSelectPlan={setSelectedPlanId}
                submitting={submittingDecision}
                onApprove={handleApproveTreatment}
                onNotApprove={handleNotApproveTreatment}
                onOpenDoctorSignIn={handleOpenDoctorSignIn}
                onNavigate={navigate}
              />
            )}

            {route === 'approved' && isDoctorSignedIn && (
              <DoctorApprovedPage onNavigate={navigate} />
            )}

            {route === 'writeReview' && isDoctorSignedIn && (
              <WriteReviewPage
                onSubmitReview={handleSubmitNegativeReview}
                latestFeedback={
                  treatmentFeedback.find((f) => f.decision === 'not_approved') || null
                }
                onNavigate={navigate}
              />
            )}

            {route === 'doctors' && (
              <DoctorsReviewView
                feedbackList={treatmentFeedback}
                onNavigate={navigate}
              />
            )}

            {route === 'contact' && (
              <>
                <ContactView onNavigate={navigate} />
                <AstronautFloat variant="contact" />
              </>
            )}
          </main>
        </div>
      )}

      <AiHelpAssistant
        route={route}
        sessionUser={sessionUser}
        datasetEntries={datasetEntries}
        focusedBoneId={focusedBoneId}
        treatmentResult={treatmentResult}
      />

      {toastMsg && (
        <div
          role="status"
          className="fixed top-20 right-5 z-50 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/45 bg-[#080d18] text-xs font-medium text-cyan-200 shadow-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
