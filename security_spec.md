# Security Specification — Mascu-Skeletal Diagnosis

## 1. Data Invariants

1. **Global Default-Deny**: Any path not explicitly matched under `/databases/{database}/documents` is denied for all reads and writes.
2. **Verified Email Requirement**: All authenticated write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User email addresses are stored exclusively in `/users/{userId}/private/info` and are readable/writable only by the owning user (`request.auth.uid == userId`) or the Bootstrapped Admin (`moaaz.amr.bakeer@gmail.com`). Public profile documents at `/users/{userId}` never store `email`, `phone`, or `address`.
4. **Controlled Role Integrity**:
   - Verified users creating their own `/users/{userId}` document may register directly as `'astronaut'` or `'doctor'`, while arbitrary roles (e.g., `'admin'`) and cross-user UID spoofing are rejected.
   - Standard `'astronaut'` users cannot mutate their `role` field to `'doctor'` on update; only verified doctors (`isVerifiedDoctor()`) or the Bootstrapped Admin can update roles.
5. **Doctor-Gated Clearance & Atomicity**:
   - Every newly created `/treatmentPlans/{planId}` must set `ownerId == request.auth.uid`, `approvalStatus == 'pending'`, and `createdAt == request.time && updatedAt == request.time`.
   - Only a verified doctor (`isVerifiedDoctor()`) can transition `approvalStatus` from `'pending'` to `'approved'` or `'not_approved'`, and only via `affectedKeys().hasOnly(['approvalStatus', 'reviewedByUid', 'reviewedByName', 'updatedAt'])`.
   - Terminal State Lock: Once `approvalStatus` reaches `'approved'` or `'not_approved'`, non-admin updates are blocked.
   - Atomic Review Guarantee (`getAfter` + `exists`): Creating a `/treatmentFeedback/{feedbackId}` entry requires `isVerifiedDoctor()`, `doctorUid == request.auth.uid`, `exists()` on the target `/treatmentPlans/{planId}`, matching `patientUid`, and `getAfter(...)` verifying the target `treatmentPlans/{planId}` reflects `approvalStatus == incoming().decision` and `reviewedByUid == request.auth.uid` in the same atomic write batch.
6. **Bounded Arrays & Strings**:
   - Every string field enforces explicit `.size()` min/max bounds matching `firebase-blueprint.json`.
   - `selectedBoneIds` is bounded to `1..15` elements and verifies `data.selectedBoneIds[0] is string`.
   - All IDs match `^[a-zA-Z0-9_\\-]+$` and max length 128.
7. **Secure List Queries**:
   - No `allow list: if isSignedIn();` blanket list rules.
   - No `get()` or `exists()` lookups inside `allow list` rules.
   - `treatmentPlans` `allow list` checks `resource.data.ownerId == request.auth.uid || resource.data.assignedDoctorUid == request.auth.uid || resource.data.assignedDoctorUid == 'unassigned' || isBootstrappedAdmin()`.
   - `treatmentFeedback` `allow list` checks `resource.data.patientUid == request.auth.uid || resource.data.doctorUid == request.auth.uid || isBootstrappedAdmin()`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

All 12 payloads below MUST evaluate to `PERMISSION_DENIED`:

1. **Unauthenticated Plan Injection**: Unauthenticated client attempts `create` on `/treatmentPlans/plan-01` with valid schema.
2. **Invalid Admin Role Injection**: User `astronaut-1` attempts `create` on `/users/astronaut-1` with `"role": "admin"`.
3. **Role Mutation on Profile Update**: Non-doctor user `astronaut-1` attempts `update` on `/users/astronaut-1` changing `"role"` from `"astronaut"` to `"doctor"`.
4. **Ghost / Shadow Field Injection**: User `astronaut-1` creates `/treatmentPlans/plan-02` with all required fields plus extra field `"isVerified": true`.
5. **Identity Spoofing on Plan Creation**: User `astronaut-1` creates `/treatmentPlans/plan-03` setting `"ownerId": "astronaut-2"`.
6. **Workflow State Shortcutting**: User `astronaut-1` creates `/treatmentPlans/plan-04` with `"approvalStatus": "approved"` directly, bypassing doctor review.
7. **Astronaut Self-Approval**: User `astronaut-1` updates their own `/treatmentPlans/plan-01` setting `"approvalStatus": "approved"`.
8. **Cross-User PII Read**: User `astronaut-2` attempts `get` on `/users/astronaut-1/private/info`.
9. **Blanket List Query Scraping**: User `astronaut-1` executes an unfiltered `list` query on `/treatmentPlans` without a `where('ownerId', '==', 'astronaut-1')` constraint.
10. **ID Poisoning & Resource Exhaustion**: User `astronaut-1` attempts `create` on `/treatmentPlans/<200-char-invalid-id>` or injects a 5,000-character `recommendation` string.
11. **Timestamp Forgery / Unverified Email Write**: User attempts `create` with spoofed admin email `moaaz.amr.bakeer@gmail.com` while `emailVerified` is `false`.
12. **Orphaned / Non-Atomic Doctor Review**: Verified doctor attempts `create` on `/treatmentFeedback/fb-01` pointing to a non-existent `planId` or without atomically updating `treatmentPlans/{planId}` in the same batch.
