import type { SeverityLevelId } from '../domain/boneExerciseMatrix';
import type { FullQusAnalysis } from '../domain/qusClinicalEngine';

export type RouteId =
  | 'orbit'
  | 'signin'
  | 'skeletons'
  | 'coach'
  | 'approval'
  | 'approved'
  | 'writeReview'
  | 'doctors'
  | 'contact';

export type AccountRole = 'astronaut' | 'doctor';

export type CrewSpecialty =
  | 'Mission Commander'
  | 'Flight Engineer'
  | 'Payload Specialist'
  | 'Flight Surgeon'
  | 'Orthopedic Specialist';

export interface UserProfile {
  id: string;
  role: AccountRole;
  fullName: string;
  badgeId: string;
  email: string;
  specialty: CrewSpecialty;
  missionName: string;
  canSwitchToDoctor?: boolean;
  isAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function formatUserTitle(user: Pick<UserProfile, 'role' | 'fullName'>): string {
  const cleanName = user.fullName
    .trim()
    .replace(/^(dr\.?|doctor|astronaut)\s+/i, '')
    .trim();
  const displayName = cleanName || user.fullName.trim();
  return user.role === 'doctor' ? `Doctor ${displayName}` : `Astronaut ${displayName}`;
}

export interface TreatmentResult {
  id?: string | number | null;
  planCode?: string;
  ownerId?: string;
  scanId?: string | number | null;
  sos: number;
  bua: number;
  prediction: 'Normal' | 'Osteopenia' | 'Osteoporosis';
  confidence: number;
  tScore: number;
  recommendation: string;
  createdAt: string;
  astronautName?: string;
  astronautBadge?: string;
  analysis?: FullQusAnalysis;
  selectedBoneIds?: string[];
  severityLevel?: SeverityLevelId;
  sentToDoctorAt?: string;
  approvalStatus?: 'pending' | 'approved' | 'not_approved';
  reviewedByUid?: string;
  reviewedByName?: string;
}

export interface TreatmentFeedback {
  id: string;
  decision: 'approved' | 'not_approved';
  negativePoints: string;
  improvements: string;
  treatmentId?: string | number | null;
  planCode?: string;
  patientUid?: string;
  patientName?: string;
  doctorUid?: string;
  doctorName?: string;
  createdAt: string;
}

export type ClearanceStatus = 'pending' | 'intervention_required' | 'cleared_for_eva';

export interface CrewReviewCase {
  id: string;
  astronautName: string;
  callsign: string;
  specialty: string;
  missionDays: number;
  sos: number;
  bua: number;
  tScore: number;
  prediction: 'Normal' | 'Osteopenia' | 'Osteoporosis';
  confidence: number;
  clearanceStatus: ClearanceStatus;
  prescribedIntervention: string;
  clinicalNotes: string;
  updatedAt: string;
}
