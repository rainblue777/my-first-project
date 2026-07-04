export const INTAKE_STORAGE_KEY = "medicheck-ai-intake";

export const UNKNOWN_SUMMARY_VALUE = "대화에서 확인되지 않았습니다.";

export const EMERGENCY_SUMMARY_RISK =
  "응급 상황 가능성이 있어 즉시 119 또는 가까운 응급실 이용이 필요할 수 있습니다.";

export const DEFAULT_EMERGENCY_RISK =
  "대화에서 응급 위험 신호가 명확히 확인되지 않았습니다.";

export const SUMMARY_NOTICE =
  "이 요약은 진단이나 처방이 아닌 진료 전 증상 정리용입니다. 정확한 진단과 치료 방향은 의료진 상담이 필요합니다.";

export const MEDICAL_SYSTEM_INSTRUCTION = `너는 의료 진단을 내리는 의사가 아니라, 병원 진료 전 환자의 증상을 정리하는 문진 보조 AI야.

규칙:

1. 절대 병명을 확정하거나 진단하지 않는다.
2. 절대 약을 처방하거나 복용량을 말하지 않는다.
3. 사용자의 증상, 시작 시점, 통증 정도, 동반 증상, 기존 질환 여부를 차례대로 질문한다.
4. 흉통, 호흡곤란, 의식 저하, 심한 출혈, 갑작스러운 마비, 말이 어눌해짐, 극심한 두통 같은 응급 증상이 있으면 즉시 119 또는 가까운 응급실 안내를 한다.
5. 마지막에는 의료진에게 전달할 수 있는 문진 요약을 만들 수 있다.
6. 모든 답변은 한국어로 한다.
7. 항상 ‘정확한 진단은 의료진 상담이 필요합니다’라는 태도를 유지한다.
8. 환자의 불안을 과하게 자극하지 말고, 차분하고 명확하게 안내한다.`;

export const INTAKE_QUESTIONS = [
  "어디가 가장 불편하신가요?",
  "언제부터 증상이 있었나요?",
  "통증이나 불편함의 정도는 1~10 중 몇 점인가요?",
  "열, 기침, 어지러움, 구토 같은 동반 증상이 있나요?",
  "기존에 앓고 있는 질환이나 복용 중인 약이 있나요?",
  "마지막으로 의료진에게 전달하고 싶은 말이 있나요?",
] as const;

export const SUMMARY_FIELDS = [
  "주요 증상",
  "발생 시점",
  "불편 정도",
  "동반 증상",
  "기존 질환/복용 약",
  "추가 전달사항",
] as const;

export const CONSULTATION_SUMMARY_FIELDS = [
  { key: "mainSymptom", label: "주요 증상" },
  { key: "onset", label: "발생 시점" },
  { key: "severity", label: "증상 정도" },
  { key: "associatedSymptoms", label: "동반 증상" },
  { key: "medicalHistoryOrMedication", label: "기존 질환/복용 약" },
  { key: "emergencyRisk", label: "응급 위험 신호" },
  { key: "doctorNote", label: "의료진에게 전달할 요약" },
  { key: "notice", label: "주의 안내" },
] as const;

export const EMERGENCY_KEYWORDS = [
  "가슴 통증",
  "흉통",
  "숨이 안 쉬",
  "호흡곤란",
  "의식",
  "출혈",
  "마비",
  "말이 어눌",
  "극심한 두통",
  "쓰러짐",
] as const;

export const GEMINI_INITIAL_MESSAGE =
  "안녕하세요. 병원 진료 전 문진 내용을 정리해드릴게요. 어디가 가장 불편하신가요?";

export const SUMMARY_GENERATION_PROMPT = `지금까지의 문진 대화를 바탕으로 의료진에게 보여줄 수 있는 안전한 문진 요약을 작성해줘.

중요한 안전 규칙:
- 이 앱은 진단 앱이 아니며, 요약은 진료 전 증상 정리용이다.
- 병명 진단, 의심 질환명, 확정적인 의학적 판단, 약 처방, 복용량 안내를 포함하지 않는다.
- "가능성이 있습니다" 같은 표현은 응급실/외래/빠른 상담 같은 진료 방향 안내에만 사용하고, 질병 가능성 표현에는 사용하지 않는다.
- 사용자가 특정 질병을 가지고 있다고 말하지 않는다.
- 정확한 진단은 의료진 상담이 필요하다는 내용을 반드시 포함한다.
- 확인되지 않은 항목은 "대화에서 확인되지 않았습니다."라고 쓴다.

출력은 아래 JSON 객체 하나만 반환한다. 코드블록, 마크다운, 추가 설명은 쓰지 않는다.

{
  "summary": {
    "mainSymptom": "string",
    "onset": "string",
    "severity": "string",
    "associatedSymptoms": "string",
    "medicalHistoryOrMedication": "string",
    "emergencyRisk": "string",
    "doctorNote": "string",
    "notice": "string"
  }
}`;

export type ChatMode = "gemini" | "mock";

export type ApiChatRole = "user" | "assistant";

export type ApiChatMessage = {
  role: ApiChatRole;
  content: string;
};

export type ConsultationSummary = {
  mainSymptom: string;
  onset: string;
  severity: string;
  associatedSymptoms: string;
  medicalHistoryOrMedication: string;
  emergencyRisk: string;
  doctorNote: string;
  notice: string;
};

export type ConsultationSummaryKey = keyof ConsultationSummary;

export type IntakeRecord = {
  mode: ChatMode;
  answers?: string[];
  messages?: ApiChatMessage[];
  summary?: ConsultationSummary | string;
  completedAt: string;
};

export function hasEmergencyKeyword(input: string) {
  const normalizedInput = normalizeForMatching(input);

  return EMERGENCY_KEYWORDS.some((keyword) =>
    normalizedInput.includes(normalizeForMatching(keyword)),
  );
}

function normalizeForMatching(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function isConsultationSummary(
  value: unknown,
): value is ConsultationSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return CONSULTATION_SUMMARY_FIELDS.every(
    (field) => typeof record[field.key] === "string",
  );
}

export function formatConsultationSummary(summary: ConsultationSummary) {
  return CONSULTATION_SUMMARY_FIELDS.map(
    (field) => `${field.label}: ${summary[field.key]}`,
  ).join("\n");
}
