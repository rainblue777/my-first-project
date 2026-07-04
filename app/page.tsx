import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-3xl border border-blue-100 bg-white p-7 shadow-xl shadow-blue-100/60">
          <p className="text-sm font-semibold text-blue-600">Smart Hospital Intake</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
            MediCheck AI
          </h1>
          <p className="mt-4 text-xl font-semibold leading-8 text-slate-800">
            병원 방문 전, 내 증상을 AI와 함께 간단히 정리해보세요.
          </p>
          <p className="mt-5 text-base leading-7 text-slate-600">
            MediCheck AI는 진단이나 처방을 제공하지 않고, 진료 전 문진 내용을
            정리하는 보조 서비스입니다.
          </p>

          <Link
            href="/check"
            className="mt-8 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            AI 문진 시작하기
          </Link>
        </div>
      </section>
    </main>
  );
}
