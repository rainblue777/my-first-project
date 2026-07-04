"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  CONSULTATION_SUMMARY_FIELDS,
  INTAKE_STORAGE_KEY,
  formatConsultationSummary,
  isConsultationSummary,
} from "../lib/intake";
import type { ConsultationSummary, IntakeRecord } from "../lib/intake";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener("storage", callback);
  };
}

function getStoredRecord() {
  return localStorage.getItem(INTAKE_STORAGE_KEY);
}

function getServerRecord() {
  return null;
}

export default function ResultPage() {
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState("");
  const savedRecord = useSyncExternalStore(
    subscribeToStorage,
    getStoredRecord,
    getServerRecord,
  );

  const summary = useMemo(() => readSummary(savedRecord), [savedRecord]);

  async function handleCopySummary() {
    if (!summary) {
      return;
    }

    try {
      await navigator.clipboard.writeText(formatConsultationSummary(summary));
      setCopyStatus("요약이 복사되었습니다.");
    } catch {
      setCopyStatus("복사에 실패했습니다.");
    }
  }

  function handleStartAgain() {
    localStorage.removeItem(INTAKE_STORAGE_KEY);
    router.push("/chat");
  }

  function handleReturnHome() {
    localStorage.removeItem(INTAKE_STORAGE_KEY);
    router.push("/");
  }

  if (!summary) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
          <div className="rounded-3xl border border-blue-100 bg-white p-7 shadow-xl shadow-blue-100/60">
            <p className="text-sm font-semibold text-blue-600">
              Consultation Summary
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
              진료 전 문진 요약
            </h1>
            <p className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5 text-base leading-7 text-slate-700">
              아직 생성된 문진 요약이 없습니다.
            </p>
            <button
              type="button"
              onClick={handleStartAgain}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              문진하러 가기
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
      <section className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-blue-600">
            Consultation Summary
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            진료 전 문진 요약
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            의료진에게 보여주기 쉽도록 문진 내용을 항목별로 정리했습니다.
          </p>
        </header>

        <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-xl shadow-blue-100/60 sm:p-7">
          <div className="grid gap-4 md:grid-cols-2">
            {CONSULTATION_SUMMARY_FIELDS.map((field) => {
              const isWide =
                field.key === "emergencyRisk" ||
                field.key === "doctorNote" ||
                field.key === "notice";
              const isEmergencyField =
                field.key === "emergencyRisk" &&
                summary.emergencyRisk.includes("119");

              return (
                <section
                  key={field.key}
                  className={`rounded-2xl border p-4 ${
                    isWide ? "md:col-span-2" : ""
                  } ${
                    isEmergencyField
                      ? "border-red-200 bg-red-50"
                      : "border-slate-100 bg-slate-50"
                  }`}
                >
                  <h2
                    className={`text-sm font-semibold ${
                      isEmergencyField ? "text-red-700" : "text-blue-700"
                    }`}
                  >
                    {field.label}
                  </h2>
                  <p
                    className={`mt-2 whitespace-pre-wrap text-base leading-7 ${
                      isEmergencyField ? "text-red-800" : "text-slate-700"
                    }`}
                  >
                    {summary[field.key]}
                  </p>
                </section>
              );
            })}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              요약 복사하기
            </button>
            <button
              type="button"
              onClick={handleStartAgain}
              className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              다시 문진하기
            </button>
            <button
              type="button"
              onClick={handleReturnHome}
              className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              처음으로 돌아가기
            </button>
          </div>

          {copyStatus ? (
            <p className="mt-4 text-center text-sm font-medium text-slate-500">
              {copyStatus}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function readSummary(savedRecord: string | null): ConsultationSummary | null {
  if (!savedRecord) {
    return null;
  }

  try {
    const parsedRecord = JSON.parse(savedRecord) as IntakeRecord;

    return isConsultationSummary(parsedRecord.summary)
      ? parsedRecord.summary
      : null;
  } catch {
    return null;
  }
}
