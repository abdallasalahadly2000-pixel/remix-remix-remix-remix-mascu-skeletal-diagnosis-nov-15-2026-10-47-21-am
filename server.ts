import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GoogleGenAI,
  ThinkingLevel,
  type Content,
  type GenerateContentResponse,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

interface AssistantContextInput {
  route?: string;
  role?: 'doctor' | 'astronaut' | 'visitor';
  locale?: 'en' | 'ar';
  userName?: string | null;
  focusedBone?: {
    id: string;
    name: string;
    weaknessPercent: number | null;
    status: string;
    sosMs: number | null;
    buaDbMhz: number | null;
  } | null;
  damagedBonesSummary?: Array<{
    name: string;
    weaknessPercent: number | null;
    status: string;
  }>;
  treatmentSummary?: {
    planCode?: string;
    prediction?: string;
    tScore?: number;
    sos?: number;
    bua?: number;
    approvalStatus?: string;
  } | null;
}

interface ChatRequestBody {
  messages?: ChatMessageInput[];
  context?: AssistantContextInput;
  mode?: 'standard' | 'fast';
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(context: AssistantContextInput = {}): string {
  const role = context.role ?? 'visitor';
  const locale = context.locale === 'ar' ? 'ar' : 'en';
  const route = context.route ?? 'orbit';

  const roleGuidance =
    role === 'doctor'
      ? 'The user is a signed-in FLIGHT SURGEON / DOCTOR. Use precise aerospace medical terminology when appropriate (QUS SOS in m/s, BUA in dB/MHz, Z-score/T-score, %1RM, ARED resistance loading, L1-L4 severity scaling, peak GRF, contraindications), while remaining concise and actionable.'
      : role === 'astronaut'
        ? 'The user is a signed-in ASTRONAUT. Keep explanations warm, encouraging, and easy to understand in plain language—translate medical telemetry (SOS, BUA, T-score) into practical training guidance, safe posture cues, tempo, and rest timing.'
        : 'The user is NOT signed in yet (VISITOR on the Sign-In & Onboarding screen). Help them choose between Google Sign-In or Email/Password, explain how Doctor vs. Astronaut accounts work, and preview what each section of the platform does.';

  const languageRule =
    locale === 'ar'
      ? 'Respond in clear, natural Arabic (العربية) unless the user explicitly writes a message in English, keeping standard technical acronyms like QUS, EMG, SOS, BUA, ARED, BMD, and 1RM clear.'
      : 'Respond in clear, concise English unless the user explicitly writes in Arabic.';

  const focusedBoneText = context.focusedBone
    ? `Currently focused bone: ${context.focusedBone.name} (${context.focusedBone.id}), status=${context.focusedBone.status}, weakness=${
        context.focusedBone.weaknessPercent !== null ? `${context.focusedBone.weaknessPercent}%` : 'unassessed'
      }, SOS=${context.focusedBone.sosMs ?? 'N/A'} m/s, BUA=${context.focusedBone.buaDbMhz ?? 'N/A'} dB/MHz.`
    : 'No specific bone is currently highlighted.';

  const damagedText =
    context.damagedBonesSummary && context.damagedBonesSummary.length > 0
      ? `Damaged/monitored bones synced from My Skeleton: ${context.damagedBonesSummary
          .map((b) => `${b.name} (${b.weaknessPercent ?? 0}%, ${b.status})`)
          .join('; ')}.`
      : 'No bones are currently flagged as moderate or critical in My Skeleton.';

  const treatmentText = context.treatmentSummary
    ? `Active Treatment Plan: ${context.treatmentSummary.planCode || 'Latest'}, classification=${
        context.treatmentSummary.prediction || 'N/A'
      }, T-score=${context.treatmentSummary.tScore ?? 'N/A'}, SOS=${
        context.treatmentSummary.sos ?? 'N/A'
      } m/s, BUA=${context.treatmentSummary.bua ?? 'N/A'} dB/MHz, approvalStatus=${
        context.treatmentSummary.approvalStatus || 'pending'
      }.`
    : 'No active treatment plan recorded in Firestore yet.';

  return [
    'You are the built-in Mission Help Assistant for "Mascu-Skeletal Diagnosis", an orbital bone-density, 3D skeletal diagnostics, physical countermeasure training, and flight-surgeon review platform.',
    roleGuidance,
    languageRule,
    '',
    'COMPLETE PLATFORM TAB MAP (explain these accurately whenever asked):',
    '1. Sign In & Account (#sign-in): Supports both Google Sign-In and Email/Password accounts (with email verification). Users choose Astronaut or Doctor role, specialty, mission name, and badge ID. Authorized users can also switch roles or sign out here.',
    '2. Orbit Home (#orbit): The mission launchpad displaying quick-access cards to every tab and primary buttons to enter My Skeleton or Physical Treatment.',
    '3. My Skeleton (#my-skeleton): Interactive 3D astronaut skeletal twin with 18 bones, 8 QUS ultrasound probes, and 22 EMG channels (11 muscle groups x 2 channels). Strictly focuses on bone damage & telemetry: weakness %, editable color thresholds (Healthy <18%, Moderate 18-37%, Critical >=38%, or No Dataset), JSON/CSV dataset upload, NASA BMD loss rates, and clinical notes. Clicking a bone opens its inspector where users can jump straight to its exercises in Physical Treatment. Every damage update in My Skeleton syncs LIVE with Physical Treatment.',
    '4. Physical Treatment (#physical-treatment): Automatically renders two role-tailored copies synced live with My Skeleton:',
    '   - Doctor View (Full Clinical Console): Has 4 sub-tabs: (a) 3D Exercises & Timing (ARED protocols, sets/reps, %1RM/kg/lb load, cadence & inter-set rest timer, biomechanical peak GRF & contraindications, L1-L4 severity scaling, 3D exercise simulator, 22-channel EMG form check), (b) Treatment Plan & QUS Engine (SOS/BUA inputs, 13-parameter NASA bone telemetry, send plan to Doctor Approval), (c) Telemetry Overview, and (d) 15-Bone Density Matrix.',
    '   - Astronaut View (Simplified Workout & Recovery Console): Has 2 user-friendly tabs: (a) Today\'s Workout (clear target bone, plain-language load/sets/reps, live rest countdown timer, interactive 3D form simulator, EMG self-check, and Send Progress to Doctor), and (b) Weekly Schedule (weekly countermeasure cadence & recovery guidance).',
    '5. Doctor Approval (#doctor-approval): Restricted to Doctor accounts (shows a Lock icon for Astronauts). Doctors review submitted treatment plans and either click Approve (clears the plan on Doctor Approved confirmation) or Not Approve (opens Write Review to record negative points and improvements).',
    '6. Doctors Review (#doctors-review): Shared audit log showing all flight-surgeon approvals, revision notices, negative points, and improvement instructions for both doctors and astronauts.',
    '7. Contact Us (#contact-us): Direct orbital medical telemetry desk and mission support contact details.',
    '',
    'LIVE SESSION CONTEXT:',
    `- Active route/tab: ${route}`,
    `- Signed-in user: ${context.userName ? `${context.userName} (${role})` : 'Visitor (signed out)'}`,
    `- ${focusedBoneText}`,
    `- ${damagedText}`,
    `- ${treatmentText}`,
    '',
    'RESPONSE RULES:',
    '- Be concise, structured (short bullets or numbered steps), and directly helpful.',
    '- Never mention internal model names, APIs, or developer implementation details.',
    '- When giving clinical or exercise explanations, briefly remind the user that this assistant supports understanding and training, while final medical clearance rests with the assigned flight surgeon in Doctor Approval.',
  ].join('\n');
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const errObj = error as { status?: number; message?: string; code?: string };
  const rawMessage = errObj?.message || 'Unable to reach the mission assistant service.';
  const status = typeof errObj?.status === 'number' ? errObj.status : 500;

  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(rawMessage)) {
    return {
      status: 400,
      message: 'Assistant credentials are invalid. Please check your key in Settings > Secrets.',
    };
  }
  if (status === 403 || /PERMISSION_DENIED/i.test(rawMessage)) {
    return {
      status: 403,
      message: 'Assistant access was denied. Please verify your API key in Settings > Secrets.',
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(rawMessage)) {
    return {
      status: 429,
      message: 'Assistant rate limit reached. Please wait a moment and try again.',
    };
  }
  if (status === 404 || /NOT_FOUND/i.test(rawMessage)) {
    return {
      status: 404,
      message: 'Requested assistant model could not be found. Please retry.',
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/assistant/chat', async (req: Request, res: Response) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Mission AI Assistant is not configured yet. Please ensure GEMINI_API_KEY is set in Settings > Secrets.',
      });
      return;
    }

    const body = (req.body || {}) as ChatRequestBody;
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const cleanedMessages = rawMessages
      .filter(
        (m): m is ChatMessageInput =>
          Boolean(m) &&
          (m.role === 'user' || m.role === 'model') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0,
      )
      .slice(-24);

    if (cleanedMessages.length === 0 || cleanedMessages[cleanedMessages.length - 1].role !== 'user') {
      res.status(400).json({ error: 'Please enter a message before sending.' });
      return;
    }

    const latestUserMessage = cleanedMessages[cleanedMessages.length - 1].text.trim();
    const priorHistory: Content[] = cleanedMessages.slice(0, -1).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const isFast = body.mode === 'fast';
    const model = isFast ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const systemInstruction = buildSystemInstruction(body.context);

    let streamStarted = false;

    const runWithRetry = async () => {
      let attempt = 0;
      let lastError: unknown;
      while (attempt < 2) {
        try {
          const chat = ai.chats.create({
            model,
            history: priorHistory,
            config: {
              systemInstruction,
              thinkingConfig: {
                thinkingLevel: isFast ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
              },
            },
          });
          return await chat.sendMessageStream({ message: latestUserMessage });
        } catch (err) {
          lastError = err;
          const status = (err as { status?: number })?.status;
          if (status && status < 500 && status !== 429) {
            throw err;
          }
          attempt += 1;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
          }
        }
      }
      throw lastError;
    };

    try {
      const responseStream = await runWithRetry();

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      streamStarted = true;

      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        const delta = c.text;
        if (delta) {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Gemini assistant route error:', error);
      const mapped = mapGeminiError(error);
      if (!streamStarted) {
        res.status(mapped.status).json({ error: mapped.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: mapped.message })}\n\n`);
        res.end();
      }
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mascu-Skeletal Diagnosis server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
