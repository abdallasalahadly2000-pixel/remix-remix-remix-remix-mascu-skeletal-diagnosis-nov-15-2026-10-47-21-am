# Mascu-Skeletal Diagnosis — Implementation Plan

Mascu-Skeletal Diagnosis is an orbital musculoskeletal health and bone-density diagnostic platform for astronauts and flight surgeons. It pairs a minimal, atmospheric Earth-orbit entry screen—featuring a stationary space backdrop, an independently floating astronaut with a glowing crimson osteoporotic leg bone, and four mission navigation modules—with full clinical workflows for crew authentication, interactive skeletal DEXA inspection, AI-guided bone countermeasure coaching, and physician sign-off.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Because the clarifying interview was skipped, the plan adopts the recommended full-stack configuration below. Review these defaults before proceeding; when execution begins, you will also see a one-time Firebase provisioning confirmation prompt to enable Google Sign-In and cloud persistence.

- **Default Choice 1 — Authentication & Persistence (`00. Sign In`)**: Uses **Firebase Authentication (Google Sign-In)** paired with **Cloud Firestore** to persist user roles (`Astronaut` vs. `Flight Surgeon`), crew skeletal scan records, AI exercise protocols, and physician review sign-offs across sessions.
- **Default Choice 2 — Crew Skeletal Console (`01. Skeletons of the Crew`)**: Combines an **interactive crew roster**, a **clickable anatomical skeleton scanner** (Femoral Neck, Tibia Shaft, Lumbar Spine L1–L4, Total Hip, Distal Radius) with osteoporotic porosity highlights, and a **dual-axis BMD trajectory chart**.
- **Default Choice 3 — AI Coach & Physician Workflow (`02. Coach AI-Model` & `03. Doctors Review`)**: Delivers a **live server-side Gemini AI coach (`gemini-4-hydrogen`)** grounded in each crew member's DEXA metrics alongside a **Flight Surgeon review queue** for clinical notes, countermeasure prescriptions, and EVA clearance status updates.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **Orbit Home View**: Preserves the ultra-clean space entry canvas—only `Mascu-Skeletal Diagnosis` in the top-left, a large white `Welcome` display title underneath, a stationary Earth/stars/Milky Way backdrop, an independently drifting astronaut (smaller and positioned higher) with a glowing red leg bone indicating microgravity bone loss, and four dark glassmorphic navigation buttons at the bottom-left (`00. Sign In`, `01. Skeletons of the Crew`, `02. Coach AI-Model`, `03. Doctors Review`).
  - **Sign In Module**: Authenticates users via Google Sign-In, lets them configure their callsign, mission assignment, and clinical role (`Astronaut` or `Flight Surgeon`), and persists their profile in Firestore.
  - **Skeletons of the Crew Module**: Lets users inspect crew members' regional Bone Mineral Density ($\text{g/cm}^2$), T-scores, monthly loss percentages, and orbital vs. Earth-recovery trajectories, plus log new DEXA scan updates.
  - **Coach AI-Model Module**: Connects via a server-side Express proxy to Gemini to generate structured resistive exercise (ARED) and nutrition countermeasure plans and answer bone-health questions tailored to the selected crew member's scan data.
  - **Doctors Review Module**: Gives flight surgeons a structured clinical queue to review skeletal scans and AI protocols, author diagnostic remarks, prescribe interventions, and update EVA/flight clearance status.
- **Target Audience**: Astronaut crew members monitoring microgravity bone loss during long-duration missions and aerospace flight surgeons overseeing countermeasure compliance and post-flight recovery.
- **Key Value**: Transforms an atmospheric space-medicine landing screen into a cohesive, end-to-end diagnostic, coaching, and physician sign-off platform without cluttering the signature entry experience.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Atmospheric Orbit Entry**: User lands on the full-viewport space scene (`Mascu-Skeletal Diagnosis` + large white `Welcome`). Only the astronaut gently drifts up and down while Earth and the Milky Way stay completely still.
2. **Module Selection**: User hovers over the bottom-left mission buttons (dark glass panels with subtle crimson edge glow and smooth slide-in feedback) and clicks any module to transition smoothly into that workspace, always retaining a `Back to orbit` return control.
3. **Authentication & Role Setup (`00. Sign In`)**: User signs in with Google, selects or confirms their role (`Astronaut` or `Flight Surgeon`) and mission details, and saves their profile.
4. **Skeletal Inspection (`01. Skeletons of the Crew`)**: User picks a crew member from the left roster, clicks anatomical bone regions on the interactive skeleton viewport to inspect localized T-scores and trabecular porosity, inspects the 12-month decay/recovery curve, and optionally records a new scan entry.
5. **AI Countermeasure Coaching (`02. Coach AI-Model`)**: User selects a crew member and target bone region, generates a structured ARED exercise & nutrition protocol, and chats live with the AI musculoskeletal specialist.
6. **Physician Sign-Off (`03. Doctors Review`)**: Flight Surgeon filters the crew review queue (`Pending Review`, `Intervention Required`, `Cleared for EVA`), inspects attached DEXA metrics and AI plans, records clinical findings, and commits a signed diagnostic decision.

### Visual Identity & Theme

- **Aesthetic Direction**: Calibrated orbital aerospace medicine—quiet, high-contrast scientific authority on the inner consoles paired with cinematic stillness on the entry orbit screen.
- **Color Palette (60-30-10 Discipline)**:
  - **60% Dominant Background**: Deep space obsidian (`#07090E` / `#0B0E17`) and crisp dark slate viewports.
  - **30% Structural Surfaces**: Translucent obsidian glass (`rgba(15, 23, 42, 0.72)`) and flat dark slate diagnostic panels (`#111827`) bounded by 1px hairline borders (`#1E293B`).
  - **10% Precision Accents**: Diagnostic crimson (`#EF4444`) for osteoporotic bone-loss alerts and active mission button highlights, paired with calibrated telemetry cyan (`#06B6D4`) for nominal/recovery curves and interactive scan crosshairs.
- **Typography & Hierarchy**:
  - **Display / Headings**: `Chakra Petch` (technical aerospace character, `text-wrap: balance`, high legibility on dark surfaces).
  - **Body Prose**: `Plus Jakarta Sans` (`15px–16px`, comfortable line-height for clinical notes and coaching guidance).
  - **Telemetry & Metrics**: `JetBrains Mono` with `tabular-nums` for all BMD values ($\text{g/cm}^2$), T-scores, percentages, and timestamps.
- **Anti-Slop & Restraint Rules**:
  - Zero static pill badges or capsule chips around metadata; metadata uses quiet inline text separated by `·` or `/`.
  - No `//` or `>_` code-comment prefixes on headers; clean numerical indices (`00.`, `01.`, `02.`, `03.`) only.
  - No pulsing decorative dots or thick left accent borders; state indicators use text-first glyphs (`● Nominal`, `▲ Monitoring`, `✖ Critical`).
  - **Custom Visual Assets**: Generated in a single parallel batch via `generate_image`—one stationary high-altitude Earth & Milky Way orbital horizon backdrop, and an isolated floating astronaut figure (with transparent/clean edge extraction or masked compositing) holding his leg with a glowing crimson osteoporotic bone inside, ensuring the background never shifts while the astronaut drifts.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Layered Astronaut Motion Isolation**
  - *Chosen Approach*: Render the Earth/Milky Way space vista as a fixed `inset-0` background layer and composite the astronaut in an independent upper-right floating layer animated solely via GPU-composited `transform: translateY(...)` (respecting `prefers-reduced-motion`).
  - *Why*: Guarantees the background stays 100% pixel-stationary while only the astronaut drifts gently, matching the exact visual intent.
  - *Alternatives Considered*: Animating a single combined image or CSS background-position, which moves the stars and Earth together.

- **Decision 2 — Cloud Persistence via Firebase vs. Local-Only State**
  - *Chosen Approach*: Provision Firebase Authentication (Google Sign-In) and Cloud Firestore with strict role-based security rules (`Astronaut` vs. `Flight Surgeon`) and seeded baseline expedition crew data for immediate exploration.
  - *Why*: Enables real multi-session login on `00. Sign In`, persistent doctor reviews, and authentic role-gated clinical sign-offs.
  - *Alternatives Considered*: Browser `localStorage`, which cannot support shared crew records or real physician-astronaut sign-off workflows.

- **Decision 3 — Server-Side Gemini Proxy (`gemini-4-hydrogen`) for Coach AI-Model**
  - *Chosen Approach*: Route all `@google/genai` SDK calls through Express API endpoints (`/api/coach/protocol` and `/api/coach/chat`) using `gemini-4-hydrogen` with structured JSON schema output for workout/nutrition protocols and multi-turn chat for Q&A.
  - *Why*: Keeps `GEMINI_API_KEY` strictly on the server, works out-of-the-box without requiring a paid-key flow, and grounds AI responses in real Firestore DEXA metrics.
  - *Alternatives Considered*: Static pre-written workout cards, which lack genuine diagnostic interactivity.

---

## 4. Technical Architecture & Data Strategy

### System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Application (React)                      │
│                                                                         │
│  ┌──────────────────────┐        ┌───────────────────────────────────┐  │
│  │  Orbit Home Screen   │        │       Inner Mission Consoles      │  │
│  │                      │        │                                   │  │
│  │ • Stationary Earth   │───────▶│ 00. Sign In (Profile & Role)      │  │
│  │ • Floating Astronaut │        │ 01. Skeletons of the Crew (DEXA)  │  │
│  │ • Welcome + 4 Navs   │◀───────│ 02. Coach AI-Model (Chat + Plan)  │  │
│  └──────────────────────┘        │ 03. Doctors Review (Sign-Off)     │  │
│                                  └───────────┬───────────────┬───────┘  │
└──────────────────────────────────────────────┼───────────────┼──────────┘
                                               │               │
                      Firebase SDK (Auth/DB)   │               │ HTTP /api/coach/*
                                               ▼               ▼
┌────────────────────────────────────┐   ┌────────────────────────────────┐
│       Firebase Cloud Services      │   │     Express Backend Server     │
│                                    │   │                                │
│ • Auth: Google Sign-In             │   │ • @google/genai SDK            │
│ • Firestore:                       │   │   (model: gemini-4-hydrogen)   │
│   - /users/{uid}                   │   │ • Structured Protocol Schema   │
│   - /crewMembers/{crewId}          │   │ • Context-Grounded Chat Proxy  │
│   - /reviews/{reviewId}            │   └────────────────────────────────┘
│ • Hardened firestore.rules         │
└────────────────────────────────────┘
```

### Data Model & Entities

- **User Profile (`/users/{uid}`)**: Stores `uid`, `displayName`, `callsign`, `role` (`astronaut` | `flight_surgeon`), `missionName`, `avatarUrl`, `createdAt`, `updatedAt`. Protected so users only edit their own non-privileged profile fields, with safe role onboarding rules.
- **Crew Member Skeletal Record (`/crewMembers/{crewId}`)**: Stores `id`, `name`, `callsign`, `roleTitle`, `missionDays`, `status` (`nominal` | `monitoring` | `critical`), `overallTScore`, `monthlyLossPct`, `regions` (Femoral Neck, Tibia Shaft, Lumbar Spine, Total Hip, Distal Radius BMD & T-scores), `trajectory` (12-month orbital + recovery data points), and `updatedAt`.
- **Coach Protocol (`/crewMembers/{crewId}/protocols/{protocolId}`)**: Stores AI-generated ARED resistance exercises, weekly cadence, calcium/vitamin-D targets, target bone zone, and `createdByUid` / `createdAt`.
- **Doctor Review (`/reviews/{reviewId}`)**: Stores `crewId`, `crewName`, `reviewerUid`, `reviewerName`, `clearanceStatus` (`pending` | `intervention_required` | `cleared_for_eva`), `clinicalNotes`, `prescribedIntervention`, `tScoreSnapshot`, `createdAt`, and `updatedAt`.

### Interactive Component & State Mapping

- **View Router & Transition State**: Smooth single-page state transitions between `orbit`, `signin`, `skeletons`, `coach`, and `doctors` views with URL hash sync so browser back/forward works seamlessly and every inner view exposes `Back to orbit`.
- **Firebase Provider & Auth Guard**: Initializes Firebase on boot, runs a server connectivity check, listens to `onAuthStateChanged`, seeds initial expedition crew records cleanly if empty, and wraps all Firestore reads/writes in structured `handleFirestoreError` diagnostics.
- **Interactive Skeletal Scanner**: Clicking any anatomical bone zone updates `selectedRegion`, highlighting the corresponding bone segment in crimson/cyan and updating the quantitative BMD readout panel and decay chart series.
- **AI Coach Form & Streaming/Async Handler**: Submitting a protocol request disables duplicate triggers with clear loading state, calls `POST /api/coach/protocol`, renders structured exercise/nutrition steps, and allows one-click saving to the crew member's Firestore record; chat messages call `POST /api/coach/chat` with full crew scan context.
- **Physician Review Queue & Sign-Off Form**: Selecting a case populates clinical telemetry and AI recommendations; submitting a Flight Surgeon review validates field lengths, writes atomic server timestamps via `updateDoc`/`addDoc`, and immediately updates the queue status badge and crew clearance state.
