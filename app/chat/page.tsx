"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_EMERGENCY_RISK,
  EMERGENCY_SUMMARY_RISK,
  GEMINI_INITIAL_MESSAGE,
  INTAKE_QUESTIONS,
  INTAKE_STORAGE_KEY,
  SUMMARY_NOTICE,
  UNKNOWN_SUMMARY_VALUE,
  hasEmergencyKeyword,
  isConsultationSummary,
} from "../lib/intake";
import type {
  ApiChatMessage,
  ChatMode,
  ConsultationSummary,
} from "../lib/intake";

type ChatMessage = ApiChatMessage & {
  id: string;
};

const emergencyWarning =
  "현재 입력하신 증상은 응급 상황일 수 있습니다. AI 문진을 계속하기보다 즉시 119 또는 가까운 응급실에 연락하는 것이 필요할 수 있습니다. 이 서비스는 진단이나 응급 대응을 대신할 수 없습니다.";

const apiErrorMessage =
  "AI 응답을 불러오지 못했습니다. API 키 설정 또는 네트워크 상태를 확인해주세요.";
const temporaryAiErrorMessage =
  "AI 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.";

const minimumUserMessagesForSummary = 3;

export default function ChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<ChatMode>("gemini");
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getInitialMessages("gemini"),
  );
  const [answers, setAnswers] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isWaitingForAi, setIsWaitingForAi] = useState(false);
  const [isCreatingSummary, setIsCreatingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    localStorage.removeItem(INTAKE_STORAGE_KEY);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isEmergency, isWaitingForAi, isCreatingSummary, errorMessage]);

  const userMessageCount = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.role === "user" && message.content.trim().length > 0,
      ).length,
    [messages],
  );
  const hasEnoughMessagesForSummary =
    userMessageCount >= minimumUserMessagesForSummary;
  const canCreateSummary =
    (isEmergency ? userMessageCount > 0 : hasEnoughMessagesForSummary) &&
    !isWaitingForAi &&
    !isCreatingSummary;
  const summaryHelperText = getSummaryHelperText(
    isEmergency,
    userMessageCount,
  );
  const summaryButtonText = isEmergency
    ? "응급 상황 요약 만들기"
    : "문진 요약 만들기";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (
      !trimmedInput ||
      isEmergency ||
      isComplete ||
      isWaitingForAi ||
      isCreatingSummary
    ) {
      return;
    }

    if (mode === "mock") {
      handleMockAnswer(trimmedInput);
      return;
    }

    await handleGeminiAnswer(trimmedInput);
  }

  function handleMockAnswer(trimmedInput: string) {
    const userMessage: ChatMessage = {
      id: `user-${answers.length}-${Date.now()}`,
      role: "user",
      content: trimmedInput,
    };
    const nextAnswers = [...answers, trimmedInput];

    if (hasEmergencyKeyword(trimmedInput)) {
      setMessages((currentMessages) => [...currentMessages, userMessage]);
      setAnswers(nextAnswers);
      setInput("");
      setErrorMessage("");
      setIsEmergency(true);
      return;
    }

    if (nextAnswers.length === INTAKE_QUESTIONS.length) {
      setMessages((currentMessages) => [...currentMessages, userMessage]);
      setAnswers(nextAnswers);
      setInput("");
      setIsComplete(true);
      localStorage.setItem(
        INTAKE_STORAGE_KEY,
        JSON.stringify({
          mode: "mock",
          answers: nextAnswers,
          summary: createMockSummary(nextAnswers),
          completedAt: new Date().toISOString(),
        }),
      );
      router.push("/result");
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${nextAnswers.length}-${Date.now()}`,
      role: "assistant",
      content: INTAKE_QUESTIONS[nextAnswers.length],
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ]);
    setAnswers(nextAnswers);
    setInput("");
    setErrorMessage("");
  }

  async function handleGeminiAnswer(trimmedInput: string) {
    const userMessage: ChatMessage = {
      id: `user-${userMessageCount}-${Date.now()}`,
      role: "user",
      content: trimmedInput,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setErrorMessage("");

    if (hasEmergencyKeyword(trimmedInput)) {
      setIsEmergency(true);
      return;
    }

    setIsWaitingForAi(true);

    try {
      const assistantResponse = await sendChatRequest(nextMessages);
      const assistantMessage: ChatMessage = {
        id: `assistant-${nextMessages.length}-${Date.now()}`,
        role: "assistant",
        content: assistantResponse,
      };

      setMessages((currentMessages) => [...currentMessages, assistantMessage]);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, apiErrorMessage));
    } finally {
      setIsWaitingForAi(false);
    }
  }

  async function handleCreateSummary() {
    if (!canCreateSummary) {
      return;
    }

    if (isEmergency) {
      localStorage.setItem(
        INTAKE_STORAGE_KEY,
        JSON.stringify({
          mode,
          messages: toApiMessages(messages),
          ...(mode === "mock" ? { answers } : {}),
          summary: createLocalSummary(messages),
          completedAt: new Date().toISOString(),
        }),
      );
      router.push("/result");
      return;
    }

    setIsCreatingSummary(true);
    setErrorMessage("");

    try {
      const { summary } = await sendSummaryRequest(messages);

      localStorage.setItem(
        INTAKE_STORAGE_KEY,
        JSON.stringify({
          mode,
          messages: toApiMessages(messages),
          ...(mode === "mock" ? { answers } : {}),
          summary,
          completedAt: new Date().toISOString(),
        }),
      );
      router.push("/result");
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "문진 요약을 만들지 못했습니다. 잠시 후 다시 시도해주세요.",
        ),
      );
    } finally {
      setIsCreatingSummary(false);
    }
  }

  function handleModeChange(nextMode: ChatMode) {
    setMode(nextMode);
    setMessages(getInitialMessages(nextMode));
    setAnswers([]);
    setInput("");
    setIsEmergency(false);
    setIsComplete(false);
    setIsWaitingForAi(false);
    setIsCreatingSummary(false);
    setErrorMessage("");
    localStorage.removeItem(INTAKE_STORAGE_KEY);
  }

  const isInputDisabled =
    isEmergency || isComplete || isWaitingForAi || isCreatingSummary;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-6 text-slate-900">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-sm font-semibold text-blue-600">MediCheck AI</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              AI 사전 문진
            </h1>
          </div>
          <span className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
            {mode === "mock"
              ? `${Math.min(answers.length + 1, INTAKE_QUESTIONS.length)}/${
                  INTAKE_QUESTIONS.length
                }`
              : "Gemini"}
          </span>
        </header>

        <div className="mt-3 grid grid-cols-2 rounded-2xl border border-blue-100 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => handleModeChange("gemini")}
            className={
              mode === "gemini"
                ? "rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                : "rounded-xl px-3 py-2 text-sm font-semibold text-slate-500"
            }
          >
            Gemini AI
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("mock")}
            className={
              mode === "mock"
                ? "rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                : "rounded-xl px-3 py-2 text-sm font-semibold text-slate-500"
            }
          >
            기본 문진
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
          흉통, 호흡곤란, 의식 저하, 심한 출혈, 갑작스러운 마비나 말 어눌함,
          극심한 두통이 있다면 즉시 119 또는 응급실을 이용하세요.
        </div>

        <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-100/60">
          <div className="flex min-h-[420px] flex-1 flex-col gap-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "flex justify-end"
                    : "flex justify-start"
                }
              >
                <p
                  className={
                    message.role === "user"
                      ? "max-w-[82%] rounded-2xl bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-md shadow-blue-100"
                      : "max-w-[82%] rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                  }
                >
                  {message.content}
                </p>
              </div>
            ))}

            {isWaitingForAi ? (
              <div className="flex justify-start">
                <p className="max-w-[82%] rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-700">
                  답변을 준비하고 있습니다...
                </p>
              </div>
            ) : null}

            {isEmergency ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">
                {emergencyWarning}
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>

          <form className="border-t border-slate-100 p-4" onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="증상을 입력해주세요"
                disabled={isInputDisabled}
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />
              <button
                type="submit"
                disabled={isInputDisabled || !input.trim()}
                className="rounded-2xl bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow-md shadow-blue-100 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                전송
              </button>
            </div>
          </form>
        </div>

        <button
          type="button"
          onClick={handleCreateSummary}
          disabled={!canCreateSummary}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {isCreatingSummary ? "요약 생성 중..." : summaryButtonText}
        </button>

        <p
          className={`mt-2 text-center text-xs leading-5 ${
            isEmergency ? "font-medium text-red-600" : "text-slate-500"
          }`}
        >
          {summaryHelperText}
        </p>

        {isEmergency ? (
          <Link
            href="/"
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 shadow-sm"
          >
            처음으로 돌아가기
          </Link>
        ) : null}
      </section>
    </main>
  );
}

function getInitialMessages(mode: ChatMode): ChatMessage[] {
  return [
    {
      id: `assistant-initial-${mode}`,
      role: "assistant",
      content: mode === "gemini" ? GEMINI_INITIAL_MESSAGE : INTAKE_QUESTIONS[0],
    },
  ];
}

function getSummaryHelperText(isEmergency: boolean, userMessageCount: number) {
  if (isEmergency) {
    return "응급 상황 가능성이 감지되었습니다. 즉시 119 또는 가까운 응급실 이용이 필요할 수 있습니다.";
  }

  if (userMessageCount === 0) {
    return "증상, 시작 시점, 정도, 동반 증상, 기존 질환 정보를 입력하면 요약을 만들 수 있습니다.";
  }

  if (userMessageCount < minimumUserMessagesForSummary) {
    return "조금 더 답변하면 문진 요약을 만들 수 있습니다.";
  }

  return "이제 문진 요약을 만들 수 있습니다.";
}

async function sendChatRequest(messages: ChatMessage[]) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "chat",
      messages: toApiMessages(messages),
    }),
  });

  const data = await readApiJson<{
    message?: string;
    error?: string;
  }>(response);

  if (!response.ok || !data.message) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.message;
}

async function sendSummaryRequest(messages: ChatMessage[]) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "summary",
      messages: toApiMessages(messages),
    }),
  });

  const data = await readApiJson<{
    message?: string;
    summary?: unknown;
    error?: string;
  }>(response);

  if (!response.ok || !data.message || !isConsultationSummary(data.summary)) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return {
    message: data.message,
    summary: data.summary,
  };
}

function toApiMessages(messages: ChatMessage[]): ApiChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

async function readApiJson<T extends object>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("temporarily unavailable") ||
    message.includes("503") ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return temporaryAiErrorMessage;
  }

  if (
    message.includes("authentication") ||
    message.includes("api key") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return apiErrorMessage;
  }

  if (message.includes("quota") || message.includes("rate limit")) {
    return "AI 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.";
  }

  return fallbackMessage;
}

function createLocalSummary(messages: ChatMessage[]): ConsultationSummary {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
  const emergencyDetected = userMessages.some(hasEmergencyKeyword);
  const doctorNote =
    userMessages.length > 0
      ? userMessages
          .map((message, index) => `${index + 1}. ${message}`)
          .join("\n")
      : UNKNOWN_SUMMARY_VALUE;

  return {
    mainSymptom: userMessages[0] || UNKNOWN_SUMMARY_VALUE,
    onset: userMessages[1] || UNKNOWN_SUMMARY_VALUE,
    severity: userMessages[2] || UNKNOWN_SUMMARY_VALUE,
    associatedSymptoms: userMessages[3] || UNKNOWN_SUMMARY_VALUE,
    medicalHistoryOrMedication: userMessages[4] || UNKNOWN_SUMMARY_VALUE,
    emergencyRisk: emergencyDetected
      ? EMERGENCY_SUMMARY_RISK
      : DEFAULT_EMERGENCY_RISK,
    doctorNote,
    notice: SUMMARY_NOTICE,
  };
}

function createMockSummary(answers: string[]): ConsultationSummary {
  return {
    mainSymptom: answers[0]?.trim() || UNKNOWN_SUMMARY_VALUE,
    onset: answers[1]?.trim() || UNKNOWN_SUMMARY_VALUE,
    severity: answers[2]?.trim() || UNKNOWN_SUMMARY_VALUE,
    associatedSymptoms: answers[3]?.trim() || UNKNOWN_SUMMARY_VALUE,
    medicalHistoryOrMedication: answers[4]?.trim() || UNKNOWN_SUMMARY_VALUE,
    emergencyRisk: DEFAULT_EMERGENCY_RISK,
    doctorNote:
      answers
        .map((answer, index) => `${INTAKE_QUESTIONS[index]} ${answer}`)
        .join(" ")
        .trim() || UNKNOWN_SUMMARY_VALUE,
    notice: SUMMARY_NOTICE,
  };
}
