/**
 * Security Rules Specification & Dirty Dozen Verification Suite
 * Targets Firestore Security Rules defined in firestore.rules against the
 * local Firestore Emulator REST API (default http://127.0.0.1:8080).
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  docId: string;
  operation: 'get' | 'list' | 'create' | 'update';
  authUid: string | null;
  emailVerified: boolean;
  email?: string;
  payload?: Record<string, unknown>;
  expectedStatus: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Plan Injection',
    collection: 'treatmentPlans',
    docId: 'plan-01',
    operation: 'create',
    authUid: null,
    emailVerified: false,
    payload: {
      planCode: 'QUS-1001',
      ownerId: 'astronaut-1',
      assignedDoctorUid: 'unassigned',
      astronautName: 'Elena Vance',
      astronautBadge: 'VANCE-01',
      mode: 'dual',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      prediction: 'Osteopenia',
      confidence: 88,
      tScore: -1.4,
      bhi: 72,
      bdsPercent: 18.5,
      ebmd: 0.44,
      clinicalTier: 'Osteopenia / Early Deterioration',
      recommendation: 'Resistive loading protocol.',
      selectedBoneIds: ['femoral-neck'],
      severityLevel: 'L2',
      approvalStatus: 'pending',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Invalid Admin Role Injection',
    collection: 'users',
    docId: 'astronaut-1',
    operation: 'create',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      uid: 'astronaut-1',
      role: 'admin',
      fullName: 'Rogue Astronaut',
      badgeId: 'AST-01',
      specialty: 'Flight Surgeon',
      missionName: 'Expedition 74',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Role Mutation on Profile Update',
    collection: 'users',
    docId: 'astronaut-1',
    operation: 'update',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      role: 'doctor',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Ghost / Shadow Field Injection',
    collection: 'treatmentPlans',
    docId: 'plan-02',
    operation: 'create',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      planCode: 'QUS-1002',
      ownerId: 'astronaut-1',
      assignedDoctorUid: 'unassigned',
      astronautName: 'Elena Vance',
      astronautBadge: 'VANCE-01',
      mode: 'dual',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      prediction: 'Osteopenia',
      confidence: 88,
      tScore: -1.4,
      bhi: 72,
      bdsPercent: 18.5,
      ebmd: 0.44,
      clinicalTier: 'Osteopenia / Early Deterioration',
      recommendation: 'Resistive loading protocol.',
      selectedBoneIds: ['femoral-neck'],
      severityLevel: 'L2',
      approvalStatus: 'pending',
      isVerified: true,
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Plan Creation',
    collection: 'treatmentPlans',
    docId: 'plan-03',
    operation: 'create',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      planCode: 'QUS-1003',
      ownerId: 'astronaut-2',
      assignedDoctorUid: 'unassigned',
      astronautName: 'Spoofed Crew',
      astronautBadge: 'CREW-02',
      mode: 'dual',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      prediction: 'Normal',
      confidence: 92,
      tScore: -0.4,
      bhi: 90,
      bdsPercent: 4.5,
      ebmd: 0.56,
      clinicalTier: 'Normal Bone Integrity',
      recommendation: 'Standard maintenance.',
      selectedBoneIds: ['calcaneus'],
      severityLevel: 'L1',
      approvalStatus: 'pending',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Workflow State Shortcutting',
    collection: 'treatmentPlans',
    docId: 'plan-04',
    operation: 'create',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      planCode: 'QUS-1004',
      ownerId: 'astronaut-1',
      assignedDoctorUid: 'unassigned',
      astronautName: 'Elena Vance',
      astronautBadge: 'VANCE-01',
      mode: 'dual',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      prediction: 'Normal',
      confidence: 92,
      tScore: -0.4,
      bhi: 90,
      bdsPercent: 4.5,
      ebmd: 0.56,
      clinicalTier: 'Normal Bone Integrity',
      recommendation: 'Standard maintenance.',
      selectedBoneIds: ['calcaneus'],
      severityLevel: 'L1',
      approvalStatus: 'approved',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Astronaut Self-Approval',
    collection: 'treatmentPlans',
    docId: 'plan-01',
    operation: 'update',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      approvalStatus: 'approved',
      reviewedByUid: 'astronaut-1',
      reviewedByName: 'Self Approver',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Cross-User PII Read',
    collection: 'users/astronaut-1/private',
    docId: 'info',
    operation: 'get',
    authUid: 'astronaut-2',
    emailVerified: true,
    email: 'astronaut2@mission.org',
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Blanket List Query Scraping',
    collection: 'treatmentPlans',
    docId: '',
    operation: 'list',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'ID Poisoning & Resource Exhaustion',
    collection: 'treatmentPlans',
    docId: 'invalid-id-'.repeat(20),
    operation: 'create',
    authUid: 'astronaut-1',
    emailVerified: true,
    email: 'astronaut1@mission.org',
    payload: {
      planCode: 'QUS-1010',
      ownerId: 'astronaut-1',
      assignedDoctorUid: 'unassigned',
      astronautName: 'Elena Vance',
      astronautBadge: 'VANCE-01',
      mode: 'dual',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      prediction: 'Normal',
      confidence: 92,
      tScore: -0.4,
      bhi: 90,
      bdsPercent: 4.5,
      ebmd: 0.56,
      clinicalTier: 'Normal Bone Integrity',
      recommendation: 'X'.repeat(5000),
      selectedBoneIds: ['calcaneus'],
      severityLevel: 'L1',
      approvalStatus: 'pending',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Timestamp Forgery / Unverified Email Write',
    collection: 'treatmentPlans',
    docId: 'plan-11',
    operation: 'create',
    authUid: 'admin-spoof',
    emailVerified: false,
    email: 'moaaz.amr.bakeer@gmail.com',
    payload: {
      planCode: 'QUS-1011',
      ownerId: 'admin-spoof',
      assignedDoctorUid: 'unassigned',
      astronautName: 'Spoofed Admin',
      astronautBadge: 'ADM-01',
      mode: 'dual',
      sos: 1505,
      bua: 74,
      unloadingMonths: 6,
      prediction: 'Normal',
      confidence: 92,
      tScore: -0.4,
      bhi: 90,
      bdsPercent: 4.5,
      ebmd: 0.56,
      clinicalTier: 'Normal Bone Integrity',
      recommendation: 'Standard maintenance.',
      selectedBoneIds: ['calcaneus'],
      severityLevel: 'L1',
      approvalStatus: 'pending',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Orphaned / Non-Atomic Doctor Review',
    collection: 'treatmentFeedback',
    docId: 'fb-12',
    operation: 'create',
    authUid: 'doctor-1',
    emailVerified: true,
    email: 'moaaz.amr.bakeer@gmail.com',
    payload: {
      planId: 'nonexistent-plan-999',
      planCode: 'QUS-9999',
      patientUid: 'astronaut-1',
      patientName: 'Elena Vance',
      doctorUid: 'doctor-1',
      doctorName: 'Dr. Aris Thorne',
      decision: 'approved',
      negativePoints: '',
      improvements: '',
    },
    expectedStatus: 'PERMISSION_DENIED',
  },
];

export async function verifyDirtyDozenAgainstEmulator(
  emulatorHost = 'http://127.0.0.1:8080',
  projectId = 'gen-lang-client-0746044227',
): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  for (const testCase of DIRTY_DOZEN_PAYLOADS) {
    const tokenPayload = testCase.authUid
      ? Buffer.from(
          JSON.stringify({
            sub: testCase.authUid,
            user_id: testCase.authUid,
            email: testCase.email || `${testCase.authUid}@mission.org`,
            email_verified: testCase.emailVerified,
          }),
        ).toString('base64url')
      : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (tokenPayload) {
      headers['Authorization'] = `Bearer ${Buffer.from('{"alg":"none"}').toString('base64url')}.${tokenPayload}.`;
    }

    const base = `${emulatorHost}/v1/projects/${projectId}/databases/(default)/documents`;
    const targetUrl =
      testCase.operation === 'list'
        ? `${base}/${testCase.collection}`
        : `${base}/${testCase.collection}/${testCase.docId}`;

    const method =
      testCase.operation === 'get' || testCase.operation === 'list'
        ? 'GET'
        : testCase.operation === 'create'
          ? 'PATCH'
          : 'PATCH';

    const res = await fetch(targetUrl, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify({ fields: testCase.payload || {} }),
    });

    if (res.status === 403) {
      passed += 1;
    } else {
      failed += 1;
      console.error(`Dirty Dozen #${testCase.id} (${testCase.name}) expected 403, got ${res.status}`);
    }
  }

  return { passed, failed };
}
