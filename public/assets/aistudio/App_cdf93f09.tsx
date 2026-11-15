/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LogIn,
  LogOut,
  Rocket,
  Stethoscope,
  UserPlus,
} from 'lucide-react';
import orbitBackdrop from './assets/images/orbit_space_backdrop_1794571481903.jpg';
import floatingAstronaut from './assets/images/floating_astronaut_osteoporosis_1794571483006.jpg';

// ============================================================================
// TYPES & BACKEND HANDOFF CONTRACTS
// ============================================================================

export type RouteId = 'orbit' | 'signin' | 'skeletons' | 'coach' | 'doctors';
export type AccountRole = 'astronaut' | 'doctor';

export type CrewSpecialty =
  | 'Mission Commander'
  | 'Flight Engineer'
  | 'Payload Specialist'
  | 'Flight Surgeon'
  | 'Orthopedic Specialist';

export interface UserProfile {
  id: string;
  accountRole: AccountRole;
  displayName: string;
  callsign: string;
  email: string;
  specialty: CrewSpecialty;
  missionName: string;
  createdAt: string;
  updatedAt: string;
}

interface NavModule {
  id: Exclude<RouteId, 'orbit'>;
  index: string;
  label: string;
  hash: string;
}

const NAV_MODULES: NavModule[] = [
  { id: 'signin', index: '00', label: 'Sign In', hash: '#sign-in' },
  { id: 'skeletons', index: '01', label: 'My Skeleton', hash: '#my-skeleton' },
  { id: 'coach', index: '02', label: 'Coach AI-Model', hash: '#coach-ai-model' },
  { id: 'doctors', index: '03', label: 'Doctors Review', hash: '#doctors-review' },
];

const ASTRONAUT_SPECIALTIES: CrewSpecialty[] = [
  'Mission Commander',
  'Flight Engineer',
  'Payload Specialist',
];

const DOCTOR_SPECIALTIES: CrewSpecialty[] = [
  'Flight Surgeon',
  'Orthopedic Specialist',
];

function getRouteFromHash(hash: string): RouteId {
  const matched = NAV_MODULES.find((mod) => mod.hash === hash);
  return matched ? matched.id : 'orbit';
}

/**
 * Strips only the pitch-black studio perimeter around the astronaut
 * (maxC <= 14) so dark boot soles/shadows stay completely intact.
 */
function useTransparentAstronaut(src: string) {
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';

    img.onload = () => {
      if (cancelled) return;
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setCutoutUrl(src);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const total = width * height;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;

        const isOuterBlack = (idx: number) => {
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
          return maxC <= 14 && r + g + b <= 32;
        };

        const enqueue = (idx: number) => {
          if (visited[idx] || !isOuterBlack(idx)) return;
          visited[idx] = 1;
          queue[tail++] = idx;
        };

        for (let x = 0; x < width; x++) {
          enqueue(x);
          enqueue((height - 1) * width + x);
        }
        for (let y = 1; y < height - 1; y++) {
          enqueue(y * width);
          enqueue(y * width + (width - 1));
        }

        while (head < tail) {
          const curr = queue[head++];
          data[curr * 4 + 3] = 0;
          const x = curr % width;
          const y = (curr - x) / width;

          if (x > 0) enqueue(curr - 1);
          if (x < width - 1) enqueue(curr + 1);
          if (y > 0) enqueue(curr - width);
          if (y < height - 1) enqueue(curr + width);
        }

        const featherMask = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
          if (visited[i]) continue;
          const x = i % width;
          const y = (i - x) / width;
          const touchesBg =
            (x > 0 && visited[i - 1]) ||
            (x < width - 1 && visited[i + 1]) ||
            (y > 0 && visited[i - width]) ||
            (y < height - 1 && visited[i + width]);
          if (touchesBg) featherMask[i] = 1;
        }

        for (let i = 0; i < total; i++) {
          if (!featherMask[i]) continue;
          const p = i * 4;
          const maxC = Math.max(data[p], data[p + 1], data[p + 2]);
          if (maxC < 24) {
            data[p + 3] = Math.round(Math.max(0, (maxC - 10) / 14) * 255);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        if (!cancelled) setCutoutUrl(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setCutoutUrl(src);
      }
    };

    img.onerror = () => {
      if (!cancelled) setFailed(true);
    };

    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return { cutoutUrl, failed };
}

// ============================================================================
// 00. SIGN IN FLOW (Astronaut / Doctor Gate -> Sign-In Pop-Out -> Profile)
// ============================================================================

function SignInSection({
  onBackToOrbit,
  onNavigateModule,
}: {
  onBackToOrbit: () => void;
  onNavigateModule: (module: 'skeletons' | 'coach' | 'doctors') => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  const [selectedRole, setSelectedRole] = useState<AccountRole | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [specialty, setSpecialty] = useState<CrewSpecialty>('Flight Engineer');
  const [missionName, setMissionName] = useState('Expedition 74');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableSpecialties =
    selectedRole === 'doctor' ? DOCTOR_SPECIALTIES : ASTRONAUT_SPECIALTIES;

  const handleChooseRole = (role: AccountRole) => {
    setSelectedRole(role);
    setSpecialty(role === 'doctor' ? 'Flight Surgeon' : 'Flight Engineer');
    setErrorMessage(null);
  };

  const handleAuthSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setErrorMessage(null);
    setSavedNotice(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || password.length < 6) {
      setErrorMessage(
        'Enter a valid email address and a password of at least 6 characters.'
      );
      return;
    }

    if (
      authMode === 'register' &&
      (displayName.trim().length < 2 || callsign.trim().length < 2)
    ) {
      setErrorMessage(
        selectedRole === 'doctor'
          ? 'Enter your full name and medical ID to register.'
          : 'Enter your full name and mission callsign to register.'
      );
      return;
    }

    setIsSubmitting(true);

    const defaultTitle = selectedRole === 'doctor' ? 'Dr. ' : '';
    const derivedName =
      authMode === 'register'
        ? displayName.trim()
        : `${defaultTitle}${cleanEmail.split('@')[0] || 'User'}`;
    const derivedCallsign =
      authMode === 'register'
        ? callsign.trim()
        : selectedRole === 'doctor'
          ? 'MED-01'
          : derivedName.slice(0, 14) || 'Crew-01';

    const now = new Date().toISOString();
    setSessionUser({
      id: 'frontend-preview-user',
      accountRole: selectedRole,
      displayName: derivedName,
      callsign: derivedCallsign,
      email: cleanEmail,
      specialty,
      missionName: missionName.trim() || 'Expedition 74',
      createdAt: now,
      updatedAt: now,
    });
    setDisplayName(derivedName);
    setCallsign(derivedCallsign);
    setIsSubmitting(false);
  };

  const handleGoogleSSO = () => {
    if (!selectedRole) return;
    setErrorMessage(null);

    const now = new Date().toISOString();
    const isDoctor = selectedRole === 'doctor';
    const presetName = isDoctor ? 'Dr. Aris Thorne' : 'Commander Vance';
    const presetCallsign = isDoctor ? 'SURGEON-01' : 'Vance-01';
    const presetEmail = isDoctor
      ? 'thorne.md@orbital-med.org'
      : 'vance@orbital-med.org';
    const presetSpecialty: CrewSpecialty = isDoctor
      ? 'Flight Surgeon'
      : 'Mission Commander';

    setSessionUser({
      id: 'frontend-sso-preview',
      accountRole: selectedRole,
      displayName: presetName,
      callsign: presetCallsign,
      email: presetEmail,
      specialty: presetSpecialty,
      missionName: 'Expedition 74',
      createdAt: now,
      updatedAt: now,
    });
    setDisplayName(presetName);
    setCallsign(presetCallsign);
    setSpecialty(presetSpecialty);
    setMissionName('Expedition 74');
  };

  const handleProfileSave = (e: FormEvent) => {
    e.preventDefault();
    if (!sessionUser) return;

    const cleanName = displayName.trim();
    const cleanCallsign = callsign.trim();
    const cleanMission = missionName.trim();

    if (cleanName.length < 1 || cleanCallsign.length < 2 || cleanMission.length < 1) {
      setErrorMessage(
        'Name, callsign / ID (2+ characters), and mission assignment are required.'
      );
      return;
    }

    setErrorMessage(null);
    setSessionUser({
      ...sessionUser,
      displayName: cleanName,
      callsign: cleanCallsign,
      specialty,
      missionName: cleanMission,
      updatedAt: new Date().toISOString(),
    });
    setSavedNotice(true);
  };

  const handleSignOut = () => {
    setSessionUser(null);
    setSelectedRole(null);
    setPassword('');
    setSavedNotice(false);
    setErrorMessage(null);
  };

  return (
    <div className="mx-auto my-auto flex w-full max-w-2xl flex-col py-8">
      <AnimatePresence mode="wait">
        {!sessionUser && !selectedRole ? (
          <motion.div
            key="role-gate"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-2xl border border-white/12 bg-[#0B0E17]/85 p-7 backdrop-blur-md sm:p-10"
          >
            <span
              className="text-sm font-semibold tracking-wider text-red-500 tabular-nums"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              00
            </span>

            <h1
              className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              Sign in as Astronaut or Doctor
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-300 sm:text-base">
              Choose your role before proceeding to sign in.
            </p>

            <div className="mt-7 grid grid-cols-1 gap-4 border-t border-white/10 pt-6 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleChooseRole('astronaut')}
                className="group flex min-h-[156px] cursor-pointer flex-col justify-between rounded-xl border border-white/12 bg-[#07090E]/85 p-6 text-left transition-all duration-200 hover:border-red-500/60 hover:bg-[#111726] hover:shadow-[0_0_24px_rgba(239,68,68,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <div className="flex w-full items-center justify-between">
                  <Rocket
                    aria-hidden="true"
                    className="h-6 w-6 text-red-400 transition-transform duration-200 group-hover:scale-105"
                  />
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-slate-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-red-400"
                  />
                </div>
                <div className="mt-6">
                  <h2
                    className="text-xl font-semibold text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Astronaut
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
                    Access personal skeletal scans and AI countermeasure coaching.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChooseRole('doctor')}
                className="group flex min-h-[156px] cursor-pointer flex-col justify-between rounded-xl border border-white/12 bg-[#07090E]/85 p-6 text-left transition-all duration-200 hover:border-cyan-400/60 hover:bg-[#111726] hover:shadow-[0_0_24px_rgba(6,182,212,0.16)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
              >
                <div className="flex w-full items-center justify-between">
                  <Stethoscope
                    aria-hidden="true"
                    className="h-6 w-6 text-cyan-400 transition-transform duration-200 group-hover:scale-105"
                  />
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 text-slate-500 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-cyan-400"
                  />
                </div>
                <div className="mt-6">
                  <h2
                    className="text-xl font-semibold text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Doctor
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
                    Review crew bone density data and approve orbital medical clearance.
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-6 flex items-center border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={onBackToOrbit}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 whitespace-nowrap transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Back to orbit
              </button>
            </div>
          </motion.div>
        ) : !sessionUser && selectedRole ? (
          <motion.div
            key={`signin-popout-${selectedRole}`}
            initial={
              prefersReducedMotion ? false : { opacity: 0, scale: 0.97, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? undefined
                : { opacity: 0, scale: 0.97, y: -10 }
            }
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-xl rounded-2xl border border-white/15 bg-[#0B0E17]/90 p-7 shadow-2xl backdrop-blur-md sm:p-10"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-sm">
                <span
                  className="font-semibold tracking-wider text-red-500 tabular-nums"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  00
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="font-medium text-slate-200">
                  {selectedRole === 'doctor' ? 'Doctor Portal' : 'Astronaut Portal'}
                </span>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#07090E]/80 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                  }}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    authMode === 'signin'
                      ? 'bg-red-500/20 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage(null);
                  }}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    authMode === 'register'
                      ? 'bg-red-500/20 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>
            </div>

            <h1
              className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              {authMode === 'signin'
                ? `Sign In as ${selectedRole === 'doctor' ? 'Doctor' : 'Astronaut'}`
                : `Register ${selectedRole === 'doctor' ? 'Doctor' : 'Astronaut'}`}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
              {selectedRole === 'doctor'
                ? 'Enter your medical credentials to review crew skeletal records.'
                : 'Enter your crew credentials to view bone scans and AI coaching.'}
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {errorMessage}
              </div>
            )}

            <form
              onSubmit={handleAuthSubmit}
              className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6"
            >
              {authMode === 'register' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Full Name
                    </span>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={
                        selectedRole === 'doctor' ? 'Dr. Aris Thorne' : 'Elena Vance'
                      }
                      className="min-h-[44px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-500/60 focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      {selectedRole === 'doctor' ? 'Medical ID' : 'Callsign'}
                    </span>
                    <input
                      type="text"
                      required
                      value={callsign}
                      onChange={(e) => setCallsign(e.target.value)}
                      placeholder={
                        selectedRole === 'doctor' ? 'MED-402' : 'Vance-01'
                      }
                      className="min-h-[44px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-500/60 focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-300">
                  Email Address
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={
                    selectedRole === 'doctor'
                      ? 'doctor@orbital-med.org'
                      : 'astronaut@mission.org'
                  }
                  className="min-h-[44px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-500/60 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-slate-300">
                  Password
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="min-h-[44px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-500/60 focus:outline-none"
                />
              </label>

              {authMode === 'register' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      {selectedRole === 'doctor' ? 'Medical Role' : 'Crew Specialty'}
                    </span>
                    <select
                      value={specialty}
                      onChange={(e) =>
                        setSpecialty(e.target.value as CrewSpecialty)
                      }
                      className="min-h-[44px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white focus:border-red-500/60 focus:outline-none"
                    >
                      {availableSpecialties.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Mission Assignment
                    </span>
                    <input
                      type="text"
                      required
                      value={missionName}
                      onChange={(e) => setMissionName(e.target.value)}
                      placeholder="Expedition 74"
                      className="min-h-[44px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:border-red-500/60 focus:outline-none"
                    />
                  </label>
                </div>
              )}

              <div className="mt-2 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-red-500/60 bg-red-500/15 px-5 py-3 text-sm font-semibold text-white whitespace-nowrap transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 sm:text-base"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {authMode === 'signin' ? (
                    <LogIn aria-hidden="true" className="h-4 w-4 text-red-400" />
                  ) : (
                    <UserPlus aria-hidden="true" className="h-4 w-4 text-red-400" />
                  )}
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSSO}
                  className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-100 whitespace-nowrap transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  Continue with Google
                </button>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole(null);
                      setErrorMessage(null);
                    }}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 whitespace-nowrap transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                    Change role
                  </button>

                  <button
                    type="button"
                    onClick={onBackToOrbit}
                    className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 whitespace-nowrap transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    Back to orbit
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="signed-in-profile"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto w-full max-w-xl rounded-2xl border border-white/12 bg-[#0B0E17]/85 p-7 backdrop-blur-md sm:p-10"
          >
            <span
              className="text-sm font-semibold tracking-wider text-red-500 tabular-nums"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              00
            </span>

            <h1
              className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
            >
              {sessionUser?.accountRole === 'doctor'
                ? 'Doctor Profile'
                : 'Astronaut Profile'}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-300 sm:text-base">
              Update your profile details or open one of the mission modules.
            </p>

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {errorMessage}
              </div>
            )}

            {sessionUser && (
              <form
                onSubmit={handleProfileSave}
                className="mt-6 flex flex-col gap-5 border-t border-white/10 pt-6"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>
                    {sessionUser.accountRole === 'doctor' ? 'Doctor' : 'Astronaut'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{sessionUser.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>{sessionUser.specialty}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Full Name
                    </span>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        setSavedNotice(false);
                      }}
                      className="min-h-[42px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white focus:border-red-500/60 focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      {sessionUser.accountRole === 'doctor'
                        ? 'Medical ID'
                        : 'Callsign'}
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={callsign}
                      onChange={(e) => {
                        setCallsign(e.target.value);
                        setSavedNotice(false);
                      }}
                      className="min-h-[42px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white focus:border-red-500/60 focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      {sessionUser.accountRole === 'doctor'
                        ? 'Medical Role'
                        : 'Crew Specialty'}
                    </span>
                    <select
                      value={specialty}
                      onChange={(e) => {
                        setSpecialty(e.target.value as CrewSpecialty);
                        setSavedNotice(false);
                      }}
                      className="min-h-[42px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white focus:border-red-500/60 focus:outline-none"
                    >
                      {(sessionUser.accountRole === 'doctor'
                        ? DOCTOR_SPECIALTIES
                        : ASTRONAUT_SPECIALTIES
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-300">
                      Mission Assignment
                    </span>
                    <input
                      type="text"
                      required
                      value={missionName}
                      onChange={(e) => {
                        setMissionName(e.target.value);
                        setSavedNotice(false);
                      }}
                      className="min-h-[42px] rounded-lg border border-white/12 bg-[#07090E]/90 px-3.5 py-2 text-sm text-white focus:border-red-500/60 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/15 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition-colors hover:bg-red-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      {savedNotice ? (
                        <>
                          <Check aria-hidden="true" className="h-4 w-4 text-cyan-400" />
                          Saved
                        </>
                      ) : (
                        'Save profile'
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onNavigateModule(
                          sessionUser.accountRole === 'doctor'
                            ? 'doctors'
                            : 'skeletons'
                        )
                      }
                      className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 whitespace-nowrap transition-colors hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                    >
                      {sessionUser.accountRole === 'doctor'
                        ? 'Doctors Review'
                        : 'My Skeleton'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 whitespace-nowrap transition-colors hover:border-red-500/40 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN APPLICATION SHELL (Orbit Interface + 4 Dynamic Routes)
// ============================================================================

export default function App() {
  const [activeRoute, setActiveRoute] = useState<RouteId>(() =>
    typeof window !== 'undefined' ? getRouteFromHash(window.location.hash) : 'orbit'
  );
  const [backdropFailed, setBackdropFailed] = useState(false);
  const { cutoutUrl: astronautCutout, failed: astronautFailed } =
    useTransparentAstronaut(floatingAstronaut);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleHashChange = () => {
      setActiveRoute(getRouteFromHash(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (route: RouteId) => {
    setActiveRoute(route);
    if (route === 'orbit') {
      window.history.pushState(null, '', '#orbit');
    } else {
      const target = NAV_MODULES.find((m) => m.id === route);
      if (target) {
        window.history.pushState(null, '', target.hash);
      }
    }
  };

  const activeModule = NAV_MODULES.find((m) => m.id === activeRoute) ?? null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#07090E] text-slate-100">
      {/* Stationary Orbital Space Background (Earth, Stars, Milky Way stay completely still) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden bg-[#07090E]"
      >
        {!backdropFailed ? (
          <img
            src={orbitBackdrop}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBackdropFailed(true)}
            className="h-full w-full object-cover object-center"
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_bottom,#0f294a_0%,#07090e_62%)]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-[#07090E]/70 via-[#07090E]/15 to-transparent" />
        {activeRoute !== 'orbit' && (
          <div className="absolute inset-0 bg-[#07090E]/75 backdrop-blur-sm transition-opacity duration-300" />
        )}
      </div>

      {/* Main Content Stage */}
      <AnimatePresence mode="wait">
        {activeRoute === 'orbit' ? (
          <motion.main
            key="orbit-home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex min-h-screen w-full flex-col justify-between px-6 py-8 sm:px-12 sm:py-10 lg:px-16 lg:py-12"
          >
            {/* Independently Floating Astronaut */}
            <div className="pointer-events-none absolute right-[2%] top-[4%] z-0 w-[210px] opacity-85 select-none sm:right-[6%] sm:top-[5%] sm:w-[285px] sm:opacity-100 md:right-[8%] md:w-[335px] lg:right-[9%] lg:top-[4%] lg:w-[385px]">
              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        y: [0, -14, 0],
                        rotate: [-0.6, 0.7, -0.6],
                      }
                }
                transition={{
                  duration: 7.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="relative will-change-transform"
              >
                {!astronautFailed ? (
                  astronautCutout && (
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.35 }}
                      src={astronautCutout}
                      alt="Astronaut floating above Earth holding his leg with glowing red osteoporotic bone loss"
                      referrerPolicy="no-referrer"
                      className="relative h-auto w-full object-contain drop-shadow-[0_0_24px_rgba(239,68,68,0.18)]"
                    />
                  )
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl border border-red-500/20 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
                    Astronaut EVA Visualization
                  </div>
                )}
              </motion.div>
            </div>

            {/* Top-Left Brand Name + Giant White Welcome */}
            <header className="relative z-10 flex max-w-3xl flex-1 flex-col justify-start">
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <p
                  className="text-lg font-semibold tracking-wide text-slate-200 sm:text-xl lg:text-2xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Mascu-Skeletal Diagnosis
                </p>
              </motion.div>

              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="my-auto py-8 sm:py-10"
              >
                <h1
                  className="text-[4.25rem] leading-[0.95] font-bold tracking-tight text-white sm:text-[6.25rem] md:text-[7.75rem] lg:text-[9.5rem] xl:text-[11rem]"
                  style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
                >
                  Welcome
                </h1>
              </motion.div>
            </header>

            {/* Bottom-Left 4 Mission-Style Navigation Buttons */}
            <nav
              aria-label="Mission Navigation"
              className="relative z-10 flex w-full max-w-sm flex-col gap-3 pt-4"
            >
              {NAV_MODULES.map((mod, idx) => (
                <motion.button
                  key={mod.id}
                  type="button"
                  onClick={() => navigateTo(mod.id)}
                  initial={prefersReducedMotion ? false : { opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.32,
                    delay: 0.08 + idx * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  whileHover={prefersReducedMotion ? undefined : { x: 6 }}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                  className="group flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/12 bg-[#0B0E17]/75 px-5 py-3.5 text-left backdrop-blur-md transition-colors duration-200 hover:border-red-500/60 hover:bg-[#111726]/90 hover:shadow-[0_0_24px_rgba(239,68,68,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                >
                  <span className="flex min-w-0 items-center gap-4">
                    <span
                      className="shrink-0 text-xs font-semibold tracking-wider text-red-500 tabular-nums transition-colors duration-200 group-hover:text-red-400"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {mod.index}
                    </span>
                    <span
                      className="truncate text-sm font-semibold tracking-wide text-slate-100 whitespace-nowrap sm:text-base"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {mod.label}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-red-400"
                  />
                </motion.button>
              ))}
            </nav>
          </motion.main>
        ) : (
          <motion.section
            key={`page-${activeRoute}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex min-h-screen w-full flex-col justify-between px-6 py-8 sm:px-12 sm:py-10 lg:px-16 lg:py-12"
          >
            {/* Dynamic Page Top Header */}
            <header className="flex items-center justify-between gap-8 border-b border-white/10 pb-5">
              <button
                type="button"
                onClick={() => navigateTo('orbit')}
                className="cursor-pointer text-left text-base font-semibold tracking-wide text-slate-100 whitespace-nowrap shrink-0 transition-colors hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 sm:text-lg"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Mascu-Skeletal Diagnosis
              </button>

              <nav
                aria-label="Quick module switch"
                className="hidden items-center gap-6 md:flex"
              >
                {NAV_MODULES.map((mod) => {
                  const isCurrent = mod.id === activeRoute;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => navigateTo(mod.id)}
                      className={`cursor-pointer text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                        isCurrent
                          ? 'text-red-400 underline decoration-red-500/70 underline-offset-8'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {mod.label}
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={() => navigateTo('orbit')}
                className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-white/12 bg-[#0B0E17]/80 px-4 py-2 text-xs font-medium text-slate-100 whitespace-nowrap shrink-0 transition-colors hover:border-red-500/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 sm:text-sm"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4 text-red-400" />
                Back to orbit
              </button>
            </header>

            {/* Dynamic Page Body */}
            {activeRoute === 'signin' ? (
              <SignInSection
                onBackToOrbit={() => navigateTo('orbit')}
                onNavigateModule={(mod) => navigateTo(mod)}
              />
            ) : (
              <div className="mx-auto my-auto flex w-full max-w-2xl flex-col items-start py-16">
                {activeModule && (
                  <div className="w-full rounded-2xl border border-white/12 bg-[#0B0E17]/80 p-8 backdrop-blur-md sm:p-10">
                    <p
                      className="text-sm font-semibold tracking-wider text-red-500 tabular-nums"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {activeModule.index}
                    </p>
                    <h1
                      className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
                      style={{ fontFamily: 'var(--font-display)', textWrap: 'balance' }}
                    >
                      {activeModule.label}
                    </h1>

                    <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/10 pt-6">
                      <button
                        type="button"
                        onClick={() => navigateTo('orbit')}
                        className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-red-500/50 bg-red-500/15 px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0 transition-colors hover:bg-red-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                      >
                        <ArrowLeft aria-hidden="true" className="h-4 w-4 text-red-400" />
                        Back to orbit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quiet Bottom Navigation on Mobile */}
            <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-slate-400 md:hidden">
              {NAV_MODULES.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => navigateTo(mod.id)}
                  className={`cursor-pointer whitespace-nowrap transition-colors ${
                    mod.id === activeRoute
                      ? 'font-semibold text-red-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mod.index} · {mod.label}
                </button>
              ))}
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
