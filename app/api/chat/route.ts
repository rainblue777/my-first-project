import { GoogleGenAI, Type } from "@google/genai";
import {
  CONSULTATION_SUMMARY_FIELDS,
  DEFAULT_EMERGENCY_RISK,
  EMERGENCY_SUMMARY_RISK,
  INTAKE_QUESTIONS,
  MEDICAL_SYSTEM_INSTRUCTION,
  SUMMARY_GENERATION_PROMPT,
  SUMMARY_NOTICE,
  UNKNOWN_SUMMARY_VALUE,
  formatConsultationSummary,
  hasEmergencyKeyword,
  isConsultationSummary,
} from "../../lib/intake";
import type { ApiChatMessage, ConsultationSummary } from "../../lib/intake";

export const runtime = "nodejs";
export const maxDuration = 30;

const defaultModel = "gemini-2.5-flash";
const emptyPostTestPrompt = "한국어로 짧게 인사해줘.";
const geminiRequestTimeoutMs = 12000;
const geminiRetryAttempts = 2;
const isDevelopment = process.env.NODE_ENV !== "production";

type ChatMode = "chat" | "summary";

type ChatRequestBody = {
  mode?: unknown;
  messages?: unknown;
  conversation?: unknown;
  message?: unknown;
};

type GeminiContent = {
  role: "user" | "model";
  parts: Array<{ text: string }>;
};

type GeminiTextResponse = {
  text?: string | (() => string | Promise<string>);
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const summaryFieldKeys = CONSULTATION_SUMMARY_FIELDS.map((field) => field.key);

const consultationSummaryResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.OBJECT,
      properties: {
        mainSymptom: {
          type: Type.STRING,
          description: "사용자가 말한 가장 중요한 증상. 진단명은 쓰지 않는다.",
        },
        onset: {
          type: Type.STRING,
          description: "증상이 시작된 시점 또는 기간.",
        },
        severity: {
          type: Type.STRING,
          description: "사용자가 표현한 증상 정도, 통증 점수, 악화/완화 정보.",
        },
        associatedSymptoms: {
          type: Type.STRING,
          description: "함께 나타난 증상. 확인되지 않으면 확인되지 않았다고 쓴다.",
        },
        medicalHistoryOrMedication: {
          type: Type.STRING,
          description: "기존 질환, 복용 약, 알레르기 등. 확인되지 않으면 확인되지 않았다고 쓴다.",
        },
        emergencyRisk: {
          type: Type.STRING,
          description: "응급 위험 신호 여부. 응급 키워드가 있으면 즉시 119/응급실 안내를 쓴다.",
        },
        doctorNote: {
          type: Type.STRING,
          description: "의료진에게 전달할 증상 중심 요약. 진단, 처방, 질병 추정은 쓰지 않는다.",
        },
        notice: {
          type: Type.STRING,
          description: "진단/처방이 아니며 정확한 진단은 의료진 상담이 필요하다는 안내.",
        },
      },
      required: summaryFieldKeys,
      propertyOrdering: summaryFieldKeys,
    },
  },
  required: ["summary"],
  propertyOrdering: ["summary"],
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || defaultModel;

  logDebug("route called");
  logDebug(`selected model: ${model}`);

  const body = await readRequestBody(request);
  const mode = normalizeMode(body.mode);
  const messages = normalizeMessages(body, mode);

  logDebug(`normalized mode: ${mode}`);
  logDebug(`normalized message count: ${messages.length}`);

  if (mode === "summary") {
    logDebug("summary mode request received");
    logDebug(`summary mode message count: ${messages.length}`);
  }

  if (!apiKey) {
    return jsonError("GEMINI_API_KEY is not configured.", 500);
  }

  if (mode === "summary" && messages.length === 0) {
    return jsonError("No conversation was provided for summary mode.", 400);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    if (mode === "summary") {
      const emergencyDetected = hasEmergencyInConversation(messages);
      const summary = await generateConsultationSummary(
        ai,
        model,
        messages,
        emergencyDetected,
      );
      const message = formatConsultationSummary(summary);

      logDebug("summary generation succeeded: true");

      return Response.json({
        message,
        summary,
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: buildChatContents(messages),
      config: {
        systemInstruction: MEDICAL_SYSTEM_INSTRUCTION,
        temperature: 0.4,
        httpOptions: {
          timeout: geminiRequestTimeoutMs,
          retryOptions: {
            attempts: geminiRetryAttempts,
          },
        },
      },
    });
    const message = await extractResponseText(response);

    return Response.json({
      message:
        message ||
        "응답을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
  } catch (error) {
    if (mode === "summary") {
      logDebug("summary generation succeeded: false");
    }

    logDebug("Gemini API request failed", error);

    if (isRecoverableGeminiError(error)) {
      if (mode === "summary") {
        const emergencyDetected = hasEmergencyInConversation(messages);
        const summary = enforceSummarySafety(
          createLocalSummary(messages),
          emergencyDetected,
        );

        return Response.json({
          message: formatConsultationSummary(summary),
          summary,
          fallback: true,
          warning:
            "AI service is temporarily unavailable. A local intake summary was generated.",
        });
      }

      return Response.json({
        message: createLocalChatFallback(messages),
        fallback: true,
        warning:
          "AI service is temporarily unavailable. A local intake question was generated.",
      });
    }

    const errorStatus = getGeminiErrorStatus(error);
    const status = errorStatus && errorStatus >= 400 ? errorStatus : 500;

    return jsonError(getGeminiErrorMessage(status), status, error);
  }
}

async function readRequestBody(request: Request): Promise<ChatRequestBody> {
  try {
    const rawBody = await request.text();

    if (!rawBody.trim()) {
      return {};
    }

    const parsedBody = JSON.parse(rawBody) as unknown;

    if (!parsedBody || typeof parsedBody !== "object") {
      return {};
    }

    return parsedBody as ChatRequestBody;
  } catch {
    return {};
  }
}

function normalizeMode(mode: unknown): ChatMode {
  return mode === "summary" ? "summary" : "chat";
}

function normalizeMessages(
  body: ChatRequestBody,
  mode: ChatMode,
): ApiChatMessage[] {
  const source =
    body.messages ?? body.conversation ?? (body.message ? [body.message] : []);
  const normalizedMessages = normalizeMessageSource(source);

  if (normalizedMessages.length > 0) {
    return mode === "summary" ? normalizedMessages : normalizedMessages.slice(-24);
  }

  if (mode === "summary") {
    return [];
  }

  return [
    {
      role: "user",
      content: emptyPostTestPrompt,
    },
  ];
}

function normalizeMessageSource(source: unknown): ApiChatMessage[] {
  if (typeof source === "string") {
    const message = normalizeSingleMessage(source, "user");
    return message ? [message] : [];
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((item) => normalizeSingleMessage(item, "user"))
    .filter((message): message is ApiChatMessage => Boolean(message));
}

function normalizeSingleMessage(
  value: unknown,
  fallbackRole: ApiChatMessage["role"],
): ApiChatMessage | null {
  if (typeof value === "string") {
    return toMessage(fallbackRole, value);
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const rawMessage = value as Record<string, unknown>;
  const role = normalizeRole(rawMessage.role ?? rawMessage.sender);
  const content =
    rawMessage.content ?? rawMessage.text ?? rawMessage.message ?? "";

  return toMessage(role ?? fallbackRole, content);
}

function normalizeRole(value: unknown): ApiChatMessage["role"] | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedRole = value.toLowerCase();

  if (normalizedRole === "assistant" || normalizedRole === "model") {
    return "assistant";
  }

  if (normalizedRole === "user" || normalizedRole === "human") {
    return "user";
  }

  return null;
}

function toMessage(role: ApiChatMessage["role"], content: unknown) {
  if (typeof content !== "string") {
    return null;
  }

  const trimmedContent = content.trim().slice(0, 2000);

  if (!trimmedContent) {
    return null;
  }

  return {
    role,
    content: trimmedContent,
  };
}

function buildChatContents(messages: ApiChatMessage[]): GeminiContent[] {
  const contents = messages.reduce<GeminiContent[]>((currentContents, message) => {
    const role = message.role === "assistant" ? "model" : "user";
    const lastContent = currentContents[currentContents.length - 1];

    if (lastContent?.role === role) {
      lastContent.parts.push({ text: message.content });
      return currentContents;
    }

    currentContents.push({
      role,
      parts: [{ text: message.content }],
    });

    return currentContents;
  }, []);

  while (contents[0]?.role === "model") {
    contents.shift();
  }

  return contents.length > 0
    ? contents
    : [
        {
          role: "user",
          parts: [{ text: emptyPostTestPrompt }],
        },
      ];
}

function buildSummaryContents(
  messages: ApiChatMessage[],
  emergencyDetected: boolean,
): GeminiContent[] {
  const transcript = messages
    .map((message) => {
      const speaker = message.role === "assistant" ? "문진 보조 AI" : "사용자";
      return `${speaker}: ${message.content}`;
    })
    .join("\n");
  const emergencyInstruction = emergencyDetected
    ? `응급 키워드 감지 여부: 감지됨. "emergencyRisk" 값은 반드시 "${EMERGENCY_SUMMARY_RISK}"라고 작성해.`
    : `응급 키워드 감지 여부: 감지되지 않음. 대화에서 명확한 응급 위험 신호가 없다면 "emergencyRisk" 값은 "${DEFAULT_EMERGENCY_RISK}"라고 작성해.`;

  return [
    {
      role: "user",
      parts: [
        {
          text: `다음은 병원 진료 전 문진 대화 전체입니다.\n\n${transcript}\n\n${emergencyInstruction}\n\n${SUMMARY_GENERATION_PROMPT}`,
        },
      ],
    },
  ];
}

async function generateConsultationSummary(
  ai: GoogleGenAI,
  model: string,
  messages: ApiChatMessage[],
  emergencyDetected: boolean,
): Promise<ConsultationSummary> {
  let lastText = "";
  let lastError: unknown;

  try {
    lastText = await requestGeminiSummary(ai, model, messages, emergencyDetected, true);
    const parsedSummary = parseSummaryResponseText(lastText);

    if (parsedSummary) {
      return enforceSummarySafety(parsedSummary, emergencyDetected);
    }

    logDebug("structured summary parsing failed; retrying strict JSON text");
  } catch (error) {
    lastError = error;

    if (isRecoverableGeminiError(error)) {
      logDebug("structured summary request failed; using local fallback", error);
      throw error;
    }

    logDebug("structured summary request failed; retrying strict JSON text", error);
  }

  try {
    lastText = await requestGeminiSummary(
      ai,
      model,
      messages,
      emergencyDetected,
      false,
    );
    const parsedSummary = parseSummaryResponseText(lastText);

    if (parsedSummary) {
      return enforceSummarySafety(parsedSummary, emergencyDetected);
    }

    logDebug("strict JSON summary parsing failed; using readable fallback");
  } catch (error) {
    lastError = error;
    logDebug("strict JSON summary request failed", error);
  }

  if (!lastText && lastError) {
    throw lastError;
  }

  return enforceSummarySafety(createFallbackSummary(lastText), emergencyDetected);
}

async function requestGeminiSummary(
  ai: GoogleGenAI,
  model: string,
  messages: ApiChatMessage[],
  emergencyDetected: boolean,
  useResponseSchema: boolean,
) {
  const response = await ai.models.generateContent({
    model,
    contents: buildSummaryContents(messages, emergencyDetected),
    config: {
      systemInstruction: MEDICAL_SYSTEM_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: "application/json",
      httpOptions: {
        timeout: geminiRequestTimeoutMs,
        retryOptions: {
          attempts: geminiRetryAttempts,
        },
      },
      ...(useResponseSchema
        ? { responseSchema: consultationSummaryResponseSchema }
        : {}),
    },
  });

  return extractResponseText(response);
}

function parseSummaryResponseText(text: string): ConsultationSummary | null {
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(extractJsonObjectText(text)) as unknown;
    const candidate =
      parsed && typeof parsed === "object" && "summary" in parsed
        ? (parsed as { summary?: unknown }).summary
        : parsed;

    return coerceSummary(candidate);
  } catch {
    return null;
  }
}

function extractJsonObjectText(text: string) {
  const withoutCodeFence = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (withoutCodeFence.startsWith("{") && withoutCodeFence.endsWith("}")) {
    return withoutCodeFence;
  }

  const firstBrace = withoutCodeFence.indexOf("{");
  const lastBrace = withoutCodeFence.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutCodeFence.slice(firstBrace, lastBrace + 1);
  }

  return withoutCodeFence;
}

function coerceSummary(value: unknown): ConsultationSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (isConsultationSummary(value)) {
    return normalizeSummaryValues(value);
  }

  const record = value as Record<string, unknown>;
  const summary = summaryFieldKeys.reduce<ConsultationSummary>(
    (currentSummary, key) => {
      currentSummary[key] = normalizeSummaryValue(record[key]);
      return currentSummary;
    },
    createEmptySummary(),
  );
  const hasAnyStructuredValue = summaryFieldKeys.some(
    (key) => summary[key] !== UNKNOWN_SUMMARY_VALUE,
  );

  return hasAnyStructuredValue ? summary : null;
}

function normalizeSummaryValues(summary: ConsultationSummary) {
  return summaryFieldKeys.reduce<ConsultationSummary>((currentSummary, key) => {
    currentSummary[key] = normalizeSummaryValue(summary[key]);
    return currentSummary;
  }, createEmptySummary());
}

function normalizeSummaryValue(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : UNKNOWN_SUMMARY_VALUE;
}

function createFallbackSummary(text: string): ConsultationSummary {
  return {
    ...createEmptySummary(),
    emergencyRisk: DEFAULT_EMERGENCY_RISK,
    doctorNote:
      text.trim() ||
      "요약을 구조화하지 못했습니다. 대화 내용을 의료진에게 직접 전달해주세요.",
    notice: SUMMARY_NOTICE,
  };
}

function createLocalSummary(messages: ApiChatMessage[]): ConsultationSummary {
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean);
  const doctorNote =
    userMessages.length > 0
      ? userMessages
          .map((message, index) => `${index + 1}. ${message}`)
          .join("\n")
      : UNKNOWN_SUMMARY_VALUE;

  return {
    ...createEmptySummary(),
    mainSymptom: userMessages[0] || UNKNOWN_SUMMARY_VALUE,
    onset: userMessages[1] || UNKNOWN_SUMMARY_VALUE,
    severity: userMessages[2] || UNKNOWN_SUMMARY_VALUE,
    associatedSymptoms: userMessages[3] || UNKNOWN_SUMMARY_VALUE,
    medicalHistoryOrMedication: userMessages[4] || UNKNOWN_SUMMARY_VALUE,
    doctorNote,
    notice: SUMMARY_NOTICE,
  };
}

function createEmptySummary(): ConsultationSummary {
  return {
    mainSymptom: UNKNOWN_SUMMARY_VALUE,
    onset: UNKNOWN_SUMMARY_VALUE,
    severity: UNKNOWN_SUMMARY_VALUE,
    associatedSymptoms: UNKNOWN_SUMMARY_VALUE,
    medicalHistoryOrMedication: UNKNOWN_SUMMARY_VALUE,
    emergencyRisk: UNKNOWN_SUMMARY_VALUE,
    doctorNote: UNKNOWN_SUMMARY_VALUE,
    notice: SUMMARY_NOTICE,
  };
}

function enforceSummarySafety(
  summary: ConsultationSummary,
  emergencyDetected: boolean,
): ConsultationSummary {
  const safeSummary = normalizeSummaryValues(summary);

  return {
    ...safeSummary,
    emergencyRisk: emergencyDetected
      ? EMERGENCY_SUMMARY_RISK
      : safeSummary.emergencyRisk === UNKNOWN_SUMMARY_VALUE
        ? DEFAULT_EMERGENCY_RISK
        : normalizeSummaryValue(safeSummary.emergencyRisk),
    notice: SUMMARY_NOTICE,
  };
}

function hasEmergencyInConversation(messages: ApiChatMessage[]) {
  return messages.some((message) => hasEmergencyKeyword(message.content));
}

function createLocalChatFallback(messages: ApiChatMessage[]) {
  const userMessageCount = messages.filter(
    (message) => message.role === "user",
  ).length;
  const nextQuestion = INTAKE_QUESTIONS[userMessageCount];

  if (nextQuestion) {
    return `현재 AI 응답이 일시적으로 지연되어 기본 문진 질문으로 이어갈게요. ${nextQuestion}`;
  }

  return "현재 AI 응답이 일시적으로 지연되고 있습니다. 입력해주신 내용을 바탕으로 문진 요약을 만들 수 있습니다. 정확한 진단과 치료 방향은 의료진 상담이 필요합니다.";
}

async function extractResponseText(response: GeminiTextResponse) {
  if (typeof response.text === "string") {
    return response.text.trim();
  }

  if (typeof response.text === "function") {
    const text = await response.text();
    return text.trim();
  }

  return (
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter((text): text is string => Boolean(text))
      .join("")
      .trim() || ""
  );
}

function jsonError(message: string, status: number, error?: unknown) {
  return Response.json(
    {
      error: message,
      ...(isDevelopment && error ? { detail: getErrorDetail(error) } : {}),
    },
    { status },
  );
}

function isRecoverableGeminiError(error: unknown) {
  const status = getGeminiErrorStatus(error);

  if (status) {
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }

  const detail = getErrorDetail(error).toLowerCase();

  return (
    detail.includes("503") ||
    detail.includes("unavailable") ||
    detail.includes("overloaded") ||
    detail.includes("timeout") ||
    detail.includes("timed out")
  );
}

function getGeminiErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const maybeStatus = (error as { status?: unknown; statusCode?: unknown })
    .status;
  const maybeStatusCode = (error as { status?: unknown; statusCode?: unknown })
    .statusCode;
  const status = Number(maybeStatus ?? maybeStatusCode);

  return Number.isInteger(status) ? status : null;
}

function getGeminiErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return "Gemini API authentication failed.";
  }

  if (status === 429) {
    return "Gemini API quota or rate limit was exceeded.";
  }

  if (status === 408 || status >= 500) {
    return "Gemini service is temporarily unavailable.";
  }

  return "Gemini response failed.";
}

function getErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function logDebug(message: string, error?: unknown) {
  if (!isDevelopment) {
    return;
  }

  if (error) {
    console.error(`[api/chat] ${message}:`, getErrorDetail(error));
    return;
  }

  console.log(`[api/chat] ${message}`);
}
