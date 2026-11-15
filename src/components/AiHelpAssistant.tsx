import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Globe,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  User,
  X,
  Zap,
} from 'lucide-react';
import { applyDatasetToBones, BoneDatasetEntry } from '../domain/osteosense';
import { Locale } from '../i18n/translations';
import { RouteId, TreatmentResult, UserProfile } from '../types/app';

interface AiHelpAssistantProps {
  route: RouteId;
  sessionUser: UserProfile | null;
  datasetEntries: BoneDatasetEntry[];
  focusedBoneId: string;
  treatmentResult: TreatmentResult | null;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const ROUTE_LABELS: Record<Locale, Record<RouteId, string>> = {
  en: {
    orbit: 'Orbit Home',
    signin: 'Sign In & Account',
    skeletons: 'My Skeleton',
    coach: 'Physical Treatment',
    approval: 'Doctor Approval',
    approved: 'Doctor Approved',
    writeReview: 'Write Review',
    doctors: 'Doctors Review',
    contact: 'Contact Us',
  },
  ar: {
    orbit: 'الصفحة الرئيسية',
    signin: 'تسجيل الدخول والحساب',
    skeletons: 'الهيكل العظمي',
    coach: 'العلاج الطبيعي',
    approval: 'اعتماد الطبيب',
    approved: 'تم اعتماد الخطة',
    writeReview: 'كتابة مراجعة',
    doctors: 'مراجعات الأطباء',
    contact: 'تواصل معنا',
  },
};

function getStarterPrompts(
  route: RouteId,
  role: 'doctor' | 'astronaut' | 'visitor',
  locale: Locale,
): string[] {
  if (locale === 'ar') {
    if (role === 'visitor' || route === 'signin') {
      return [
        'كيف أنشئ حساب طبيب أو رائد فضاء؟',
        'اشرح لي جميع تبويبات المنصة باختصار',
        'ما الفرق بين حساب الطبيب وحساب رائد الفضاء؟',
      ];
    }
    switch (route) {
      case 'skeletons':
        return [
          'ماذا تعني ألوان العظام ونسب الضعف هنا؟',
          'كيف ترتبط التعديلات هنا بصفحة العلاج الطبيعي؟',
          'اشرح حساسات QUS و EMG على البدلة ثلاثية الأبعاد',
        ];
      case 'coach':
        return role === 'doctor'
          ? [
              'اشرح التبويبات الأربعة في العلاج الطبيعي للطبيب',
              'كيف يتم حساب أحمال ARED ومستويات الشدة L1–L4؟',
              'كيف أرسل خطة العلاج إلى اعتماد الطبيب؟',
            ]
          : [
              'اشرح لي تمرين اليوم ومؤقت الراحة ببساطة',
              'كيف أتحقق من صحة أدائي بالمحاكي و EMG؟',
              'كيف أرسل تقريري للطبيب المشرف؟',
            ];
      case 'approval':
      case 'approved':
      case 'writeReview':
        return [
          'كيف تعمل صفحة اعتماد الطبيب ومن يمكنه الدخول لها؟',
          'ماذا يحدث عند الضغط على اعتماد أو عدم اعتماد؟',
        ];
      case 'doctors':
        return [
          'كيف أقرأ سجل مراجعات الأطباء وتوصيات التعديل؟',
          'ما الفرق بين الحالة المعتمدة والمرفوضة للتعديل؟',
        ];
      case 'contact':
        return [
          'متى أستخدم صفحة التواصل مقابل مراجعات الأطباء؟',
          'اشرح لي كيفية التنقل بين صفحات المنصة',
        ];
      default:
        return [
          'اشرح لي كل التبويبات وكيف أبدأ الفحص',
          'أين أدخل بيانات ضعف العظام وأين أرى التمارين؟',
          'كيف تتزامن صفحة الهيكل العظمي مع العلاج الطبيعي؟',
        ];
    }
  }

  if (role === 'visitor' || route === 'signin') {
    return [
      'How do I sign in or create a Doctor vs. Astronaut account?',
      'Walk me through what every tab in this app does',
      'What is the difference between Doctor and Astronaut views?',
    ];
  }

  switch (route) {
    case 'skeletons':
      return [
        'What do the bone color thresholds & weakness % mean?',
        'How do changes in My Skeleton sync with Physical Treatment?',
        'Explain the 8 QUS ultrasound probes & 22 EMG sensors',
      ];
    case 'coach':
      return role === 'doctor'
        ? [
            'Explain the 4 tabs in Doctor Physical Treatment',
            'How are ARED loads & L1–L4 severity levels calculated?',
            'How do I send a treatment plan to Doctor Approval?',
          ]
        : [
            "Explain today's workout, sets, and rest timer simply",
            'How do I verify my exercise form with the 3D simulator & EMG?',
            'How do I send my treatment progress to my Doctor?',
          ];
    case 'approval':
    case 'approved':
    case 'writeReview':
      return [
        'Why is Doctor Approval restricted and who can sign off?',
        'What happens when a Doctor clicks Approve vs. Not Approve?',
      ];
    case 'doctors':
      return [
        'How do I read the Doctors Review log & revision notes?',
        'Where do astronaut treatment updates show up for review?',
      ];
    case 'contact':
      return [
        'When should I use Contact Us vs. Doctors Review?',
        'Summarize how all tabs work together in sequence',
      ];
    default:
      return [
        'Explain every tab in order so I know where to start',
        'Where do I edit bone damage and where are the exercises?',
        'How do My Skeleton and Physical Treatment stay synced?',
      ];
  }
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="font-mono-tech text-[11px] px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-cyan-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

const FormattedAssistantText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: Array<{ ordered: boolean; content: string }> = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    const Tag = isOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`${keyPrefix}-list`}
        className={`my-1.5 space-y-1 ps-4 text-xs leading-relaxed text-slate-200 ${
          isOrdered ? 'list-decimal' : 'list-disc'
        }`}
      >
        {listItems.map((item, i) => (
          <li key={i}>{renderInlineMarkdown(item.content)}</li>
        ))}
      </Tag>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`empty-${idx}`);
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    const orderedMatch = line.match(/^\d+[.)]\s+(.*)$/);

    if (bulletMatch) {
      if (listItems.length > 0 && listItems[0].ordered) flushList(`switch-${idx}`);
      listItems.push({ ordered: false, content: bulletMatch[1] });
      return;
    }

    if (orderedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) flushList(`switch-${idx}`);
      listItems.push({ ordered: true, content: orderedMatch[1] });
      return;
    }

    flushList(`pre-${idx}`);

    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      const headingText = line.replace(/^#{1,3}\s+/, '');
      blocks.push(
        <p key={`h-${idx}`} className="font-display text-xs font-bold text-cyan-300 mt-2 first:mt-0">
          {renderInlineMarkdown(headingText)}
        </p>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className="text-xs leading-relaxed text-slate-200 my-1 first:mt-0 last:mb-0">
        {renderInlineMarkdown(line)}
      </p>,
    );
  });

  flushList('end');

  return <div className="space-y-1">{blocks}</div>;
};

export const AiHelpAssistant: React.FC<AiHelpAssistantProps> = ({
  route,
  sessionUser,
  datasetEntries,
  focusedBoneId,
  treatmentResult,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>('en');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<{
    text: string;
    mode: 'standard' | 'fast';
  } | null>(null);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isAr = locale === 'ar';

  const role: 'doctor' | 'astronaut' | 'visitor' = sessionUser
    ? sessionUser.role === 'doctor'
      ? 'doctor'
      : 'astronaut'
    : 'visitor';

  const contextPayload = useMemo(() => {
    const bones = applyDatasetToBones(datasetEntries);
    const focused = bones.find((b) => b.id === focusedBoneId) || bones[0] || null;
    const damaged = bones
      .filter((b) => b.status === 'critical' || b.status === 'moderate')
      .sort((a, b) => (b.weaknessPercent ?? 0) - (a.weaknessPercent ?? 0))
      .slice(0, 6)
      .map((b) => ({
        name: locale === 'ar' ? b.nameAr : b.nameEn,
        weaknessPercent: b.weaknessPercent,
        status: b.status,
      }));

    return {
      route: ROUTE_LABELS.en[route],
      role,
      locale,
      userName: sessionUser?.fullName ?? null,
      focusedBone: focused
        ? {
            id: focused.id,
            name: locale === 'ar' ? focused.nameAr : focused.nameEn,
            weaknessPercent: focused.weaknessPercent,
            status: focused.status,
            sosMs: focused.sosMs,
            buaDbMhz: focused.buaDbMhz,
          }
        : null,
      damagedBonesSummary: damaged,
      treatmentSummary: treatmentResult
        ? {
            planCode: treatmentResult.planCode,
            prediction: treatmentResult.prediction,
            tScore: treatmentResult.tScore,
            sos: treatmentResult.sos,
            bua: treatmentResult.bua,
            approvalStatus: treatmentResult.approvalStatus,
          }
        : null,
    };
  }, [datasetEntries, focusedBoneId, locale, role, route, sessionUser?.fullName, treatmentResult]);

  const starterPrompts = useMemo(
    () => getStarterPrompts(route, role, locale),
    [locale, role, route],
  );

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isOpen, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const sendPrompt = useCallback(
    async (rawText: string, mode: 'standard' | 'fast' = 'standard') => {
      const trimmed = rawText.trim();
      if (!trimmed || isStreaming) return;

      setErrorMsg(null);
      setLastFailedPrompt(null);

      const userMessage: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      const assistantMessageId = `m-${Date.now() + 1}`;
      const historyForApi = [...messages, userMessage].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantMessageId, role: 'model', text: '' },
      ]);
      setInput('');
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: historyForApi,
            context: contextPayload,
            mode,
          }),
        });

        const contentType = res.headers.get('content-type') || '';

        if (!res.ok) {
          let serverError = `Assistant request failed (${res.status}).`;
          if (contentType.includes('application/json')) {
            const errJson = (await res.json()) as { error?: string };
            if (errJson.error) serverError = errJson.error;
          } else {
            const txt = await res.text();
            if (txt) serverError = txt;
          }
          throw new Error(serverError);
        }

        if (!res.body) {
          throw new Error('Empty response stream from server.');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';

          for (const evt of events) {
            const dataLines = evt
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim());

            for (const payloadStr of dataLines) {
              if (!payloadStr) continue;
              const parsed = JSON.parse(payloadStr) as {
                delta?: string;
                done?: boolean;
                error?: string;
              };
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.delta) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, text: m.text + parsed.delta }
                      : m,
                  ),
                );
              }
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId && !m.text
                ? {
                    ...m,
                    text: isAr
                      ? 'تم إيقاف الرد.'
                      : 'Response stopped.',
                  }
                : m,
            ),
          );
        } else {
          const message =
            err instanceof Error ? err.message : 'Unable to connect to the assistant.';
          setErrorMsg(message);
          setLastFailedPrompt({ text: trimmed, mode });
          setMessages((prev) =>
            prev.filter((m) => !(m.id === assistantMessageId && !m.text)),
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [contextPayload, isAr, isStreaming, messages],
  );

  const handleExplainCurrentTab = useCallback(() => {
    const tabName = ROUTE_LABELS[locale][route];
    const prompt =
      locale === 'ar'
        ? `اشرح لي تبويب "${tabName}" بالكامل وماذا يمكنني فعله هنا حسب دوري الحالي، وكيف يرتبط ببقية التبويبات.`
        : `Explain the "${tabName}" tab clearly for my current role, what each section does, and how it connects with the other tabs.`;
    void sendPrompt(prompt, 'fast');
  }, [locale, route, sendPrompt]);

  const handleStopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleResetChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setErrorMsg(null);
    setLastFailedPrompt(null);
    setIsStreaming(false);
  }, []);

  const roleLabel =
    locale === 'ar'
      ? role === 'doctor'
        ? 'طبيب'
        : role === 'astronaut'
          ? 'رائد فضاء'
          : 'زائر'
      : role === 'doctor'
        ? 'Doctor'
        : role === 'astronaut'
          ? 'Astronaut'
          : 'Visitor';

  const currentTabLabel = ROUTE_LABELS[locale][route];

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label={isAr ? 'فتح مساعد الذكاء الاصطناعي' : 'Open Mission AI Assistant'}
          className={`fixed bottom-5 ${
            isAr ? 'left-5' : 'right-5'
          } z-40 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-cyan-500/55 bg-[#080C15] hover:bg-[#0D1422] hover:border-cyan-400 text-slate-100 shadow-[0_12px_32px_rgba(2,6,23,0.75)] ui-transition cursor-pointer`}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
          </span>
          <Bot className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="font-display text-xs font-semibold whitespace-nowrap">
            {isAr ? 'المساعد الذكي' : 'Mission AI Help'}
          </span>
        </button>
      )}

      {isOpen && (
        <aside
          role="dialog"
          aria-label={isAr ? 'مساعد الذكاء الاصطناعي للمنصة' : 'Mission AI Assistant'}
          dir={isAr ? 'rtl' : 'ltr'}
          className={`fixed bottom-4 ${
            isAr ? 'left-4' : 'right-4'
          } z-50 w-[min(430px,calc(100vw-1.5rem))] h-[min(640px,calc(100vh-2.5rem))] flex flex-col rounded-xl border border-slate-700/85 bg-[#080C15] shadow-[0_24px_64px_rgba(2,6,23,0.88)] overflow-hidden`}
        >
          {/* Header */}
          <div className="shrink-0 px-4 py-3 border-b border-slate-800 bg-[#0B101B] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg border border-cyan-500/40 bg-cyan-500/12 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-cyan-300" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold text-white truncate">
                  {isAr ? 'مساعد التشخيص والتمارين الذكي' : 'Mission AI Help Assistant'}
                </h2>
                <p className="font-mono-tech text-[11px] text-cyan-300 truncate">
                  {roleLabel} · {currentTabLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setLocale((prev) => (prev === 'en' ? 'ar' : 'en'))}
                title={isAr ? 'Switch to English' : 'التبديل إلى العربية'}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-slate-700 bg-[#0E1422] hover:border-cyan-400/60 text-[11px] font-mono-tech font-medium text-slate-200 cursor-pointer ui-transition"
              >
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>{isAr ? 'EN' : 'AR'}</span>
              </button>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  title={isAr ? 'محادثة جديدة' : 'New chat'}
                  aria-label={isAr ? 'محادثة جديدة' : 'New chat'}
                  className="p-1.5 rounded-md border border-slate-700 bg-[#0E1422] hover:border-cyan-400/60 text-slate-300 hover:text-white cursor-pointer ui-transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title={isAr ? 'إغلاق' : 'Close'}
                aria-label={isAr ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-md border border-slate-700 bg-[#0E1422] hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer ui-transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Context Strip */}
          <div className="shrink-0 px-4 py-2 border-b border-slate-800/80 bg-[#090E19] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-slate-400 truncate">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">
                {isAr
                  ? 'متصل ببيانات الشاشة الحالية'
                  : 'Synced to active screen & bone telemetry'}
              </span>
            </div>
            <button
              type="button"
              disabled={isStreaming}
              onClick={handleExplainCurrentTab}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-cyan-500/45 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-50 text-[11px] font-semibold text-cyan-200 whitespace-nowrap shrink-0 cursor-pointer ui-transition"
            >
              <Zap className="w-3 h-3 text-cyan-300 shrink-0" />
              <span>{isAr ? 'اشرح هذا التبويب' : 'Explain This Tab'}</span>
            </button>
          </div>

          {/* Message Thread */}
          <div
            ref={threadRef}
            className="flex-1 overflow-y-auto thin-scroll px-4 py-3.5 space-y-3 bg-[#070A12]"
          >
            {messages.length === 0 ? (
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-slate-800 bg-[#0B101B] p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>
                      {isAr
                        ? 'اسألني عن أي تبويب أو تمرين أو قياس'
                        : 'Ask anything about any tab, telemetry, or exercise'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isAr
                      ? 'يمكنني شرح كيفية عمل تبويب الهيكل العظمي، وتزامن العلاج الطبيعي للطبيب ورائد الفضاء، واعتماد الطبيب، أو قراءة نسب ضعف العظام الحالية.'
                      : 'I can explain every tab—from My Skeleton color thresholds and QUS/EMG sensors to Doctor vs. Astronaut Physical Treatment and Doctor Approval.'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <p className="font-mono-tech text-[10px] uppercase tracking-wider text-slate-400">
                    {isAr ? 'أسئلة مقترحة لهذه الصفحة' : 'Suggested for this screen'}
                  </p>
                  <div className="space-y-1.5">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        disabled={isStreaming}
                        onClick={() => void sendPrompt(prompt, 'standard')}
                        className="w-full text-start px-3 py-2 rounded-lg border border-slate-800 bg-[#0B101B] hover:border-cyan-500/50 hover:bg-[#101829] text-xs text-slate-200 hover:text-white ui-transition cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                        isUser
                          ? 'border-cyan-500/45 bg-cyan-500/15 text-cyan-200'
                          : 'border-slate-700 bg-[#0E1422] text-cyan-400'
                      }`}
                    >
                      {isUser ? (
                        <User className="w-3.5 h-3.5" />
                      ) : (
                        <Bot className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2.5 border ${
                        isUser
                          ? 'bg-[#0C1D2D] border-cyan-500/40 text-slate-100 text-xs leading-relaxed'
                          : 'bg-[#0B101B] border-slate-800 text-slate-200'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : msg.text ? (
                        <FormattedAssistantText text={msg.text} />
                      ) : (
                        <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>{isAr ? 'جاري التحليل...' : 'Thinking...'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="shrink-0 mx-4 mb-2 px-3 py-2 rounded-lg border border-rose-500/45 bg-rose-950/40 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-rose-200 leading-snug">{errorMsg}</p>
              </div>
              {lastFailedPrompt && (
                <button
                  type="button"
                  onClick={() =>
                    void sendPrompt(lastFailedPrompt.text, lastFailedPrompt.mode)
                  }
                  className="px-2 py-1 rounded border border-rose-400/50 bg-rose-500/15 hover:bg-rose-500/25 text-[11px] font-semibold text-rose-100 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isAr ? 'إعادة المحاولة' : 'Retry'}
                </button>
              )}
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendPrompt(input, 'standard');
            }}
            className="shrink-0 p-3 border-t border-slate-800 bg-[#0B101B] space-y-2"
          >
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendPrompt(input, 'standard');
                  }
                }}
                placeholder={
                  isAr
                    ? 'اكتب سؤالك حول التبويبات أو حالة العظام أو التمارين...'
                    : 'Ask about any tab, bone telemetry, or workout...'
                }
                className="flex-1 resize-none rounded-lg border border-slate-700 bg-[#070A12] focus:border-cyan-400 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  title={isAr ? 'إيقاف الرد' : 'Stop response'}
                  className="h-10 px-3 rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 inline-flex items-center justify-center shrink-0 cursor-pointer ui-transition"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label={isAr ? 'إرسال' : 'Send message'}
                  className="h-10 px-3.5 rounded-lg bg-[#0891B2] hover:bg-[#06B6D4] disabled:opacity-45 disabled:hover:bg-[#0891B2] text-slate-950 font-semibold inline-flex items-center justify-center shrink-0 cursor-pointer ui-transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </aside>
      )}
    </>
  );
};
