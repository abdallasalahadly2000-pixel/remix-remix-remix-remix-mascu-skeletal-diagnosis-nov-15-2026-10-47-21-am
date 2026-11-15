# Gemini AI Help Assistant — Implementation Plan

A context-aware, multi-turn Gemini assistant integrated directly into Mascu-Skeletal Diagnosis to explain every tab, translate NASA bone telemetry or exercise routines into plain guidance, and answer questions for doctors, astronauts, and signed-out visitors in real time.

> [!IMPORTANT]
> **User Review & Critical Decisions**
> - **Default Placement Across All Pages:** Because questions were skipped, the assistant is planned as a floating launch button paired with a non-blocking slide-over panel available on every screen (Sign-In & Onboarding, Orbit Launchpad, My Skeleton, both Doctor and Astronaut Physical Treatment copies, Doctor Approval, Doctors Review, and Contact Us) without altering the existing top navigation bar.
> - **Model Tier Selection:** The plan uses **Gemini 4 Hydrogen** (`gemini-4-hydrogen`) as the default conversational assistant and **Gemini 3.1 Flash Lite** (`gemini-3.1-flash-lite`) for fast page-overview prompts so it works immediately with standard project credentials. If you would also like an optional deep clinical reasoning toggle powered by **Gemini 4 Carbon** or **Gemini 4 Argon**, please let us know so we can run the paid model authorization step during implementation.
> - **Bilingual & Role Awareness:** The assistant automatically mirrors the active interface language (English or Arabic) and adapts its tone, depth, and quick-start prompts depending on whether the user is signed in as a Doctor, an Astronaut, or browsing before sign-in.

---

## 1. Overview & Core Concept

The Gemini AI Help Assistant acts as a built-in mission guide and clinical/training explainer across the entire application:

- **Explains Every Tab Clearly:** Users can ask what any tab or control does (for example, how **My Skeleton** color thresholds and 3D sensors work, why **Doctor Approval** is restricted to clinicians, how **Physical Treatment** syncs live with damaged bones, or how to create a Doctor vs. Astronaut account on the Sign-In screen).
- **Adapts to Role & Active Screen:**
  - **Doctor Role:** Explains QUS SOS/BUA ultrasound telemetry, 13-parameter bone matrices, NASA T/Z-score & BMD loss rates, severity tiers (L1–L4), biomechanical contraindications, and how edits in My Skeleton update Physical Treatment presets.
  - **Astronaut Role:** Translates medical scores into plain-language guidance, guides form/tempo/rest timers on the simplified workout console, and explains why certain high-impact movements are guarded.
  - **Visitor / Pre-Sign-In:** Helps new users sign in with Google or email/password, choose the right role, and understand what each section of the platform offers.
- **Multi-Turn Conversation:** Maintains full conversation memory within the active session so users can ask follow-up questions naturally without repeating context.

---

## 2. User Experience & Visual Design

The assistant interface strictly follows the app's dark aerospace telemetry aesthetic (deep obsidian surfaces, crisp 1px slate borders, cyan `#06B6D4` primary actions, `Plus Jakarta Sans` UI typography, and `JetBrains Mono` for numerical readouts):

- **Always-Available Floating Launcher:** A compact, high-contrast assistant button sits cleanly in the bottom-right corner (adjusting for RTL in Arabic) on every screen, including Sign-In and both Physical Treatment views, keeping the 3-zone header bar uncluttered.
- **Slide-Over Assistance Drawer:**
  - **Header Bar:** Displays the assistant title, a compact active-context indicator showing the current tab and detected role (e.g., *Doctor · Physical Treatment* or *Astronaut · My Skeleton*), an active language badge (EN / AR), a **New Chat** reset action, and a Close button.
  - **Dynamic Quick-Help Starters:** When a thread is empty—or via quick chips above the input—the user sees 3–4 tailored starter prompts specific to the screen they are currently viewing (for example, *"Explain my current bone status"*, *"How do My Skeleton & Physical Treatment sync?"*, or *"Walk me through ARED load & rest timing"*).
  - **Scrollable Message Thread:** Clearly distinguishes user messages from structured assistant responses (supporting clean lists, key metrics, and bold emphasis), auto-scrolls smoothly as replies stream in, and shows a clear typing indicator while generating.
  - **Composer & Resilience:** Multi-line input with Enter-to-send (Shift+Enter for newline), quick **Summarize This Tab** button powered by Gemini 3.1 Flash Lite, and an inline, non-blocking error banner with a **Retry** option if a network hiccup occurs. No API key input fields appear anywhere in the UI.

---

## 3. Key Product Decisions & Trade-Offs

- **Server-Side Proxy vs. Browser SDK:** All Gemini SDK calls run strictly on a lightweight Node/Express server proxy rather than in browser JavaScript. This keeps API credentials secure on the server while delivering fast streaming responses to the React client.
- **Floating Slide-Over Drawer vs. Dedicated Top-Bar Tab:** Placing the assistant in a global slide-over drawer rather than adding a sixth top-bar navigation tab lets users ask questions *while looking directly at* the 3D skeleton, sensor probes, or workout timer—without losing their place or navigating away.
- **Live Non-Sensitive Context Injection:** On each message, the client passes a compact, non-sensitive snapshot (active tab name, user role, current language, and active bone/treatment metrics currently on screen) into the server's dynamic system instruction. This avoids brittle hardcoded FAQ trees while keeping answers grounded in real on-screen values.
- **Session Memory vs. Persistent Cloud Chat History:** Conversation history stays in active client session memory with a one-click reset button, keeping the experience instant and private without requiring additional Firestore chat schemas unless requested later.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Browser Client (React + Tailwind CSS)                                   │
│                                                                         │
│  ┌──────────────────────────────┐    ┌───────────────────────────────┐  │
│  │ Active Workspace & Role      │───▶│ Floating AI Assistant Drawer  │  │
│  │ (Route, Role, EN/AR, Live    │    │ - Multi-turn message history  │  │
│  │  Bone & Treatment Snapshot)  │    │ - Role/tab starter prompts    │  │
│  └──────────────────────────────┘    │ - Streaming reply renderer    │  │
└──────────────────────────────────────┴───────────────┬──────────────────┘
                                                       │ POST (messages +
                                                       │ live screen context)
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Full-Stack Express Server (Port 3000)                                   │
│                                                                         │
│  - Serves Vite dev middleware / built frontend assets                   │
│  - Builds role-, language-, and tab-aware systemInstruction             │
│  - Invokes @google/genai multi-turn chat (`gemini-4-hydrogen` default,  │
│    `gemini-3.1-flash-lite` for fast tab summaries)                      │
│  - Streams response chunks cleanly back to the browser                  │
└──────────────────────────────────────────────────────┬──────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Google Gemini API (@google/genai Server SDK)                            │
│  - Uses server environment GEMINI_API_KEY (never exposed to client)     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data & Context Flow
1. **Context Snapshot:** The main application shell compiles a lightweight context object whenever the user switches tabs, changes language, or edits bone status in **My Skeleton**.
2. **Server Chat Turn:** Sending a message posts the conversation turns (`user` / `model` roles) and current context snapshot to the server chat endpoint.
3. **System Prompt Grounding:** The server constructs a concise `systemInstruction` embedding:
   - Role rules (Doctor clinical depth vs. Astronaut plain-language guidance vs. Visitor onboarding help).
   - Full map of application tabs and how **My Skeleton** syncs live with **Physical Treatment**.
   - Current bone telemetry, active ARED/exercise parameters, and safety reminder that AI guidance supports—never overrides—clinician approval.
4. **Streaming Delivery:** The server streams text chunks back to the drawer so long clinical explanations or step-by-step workout walkthroughs appear smoothly in real time.
