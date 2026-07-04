import Link from "next/link";

export default function CheckPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-900">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-3xl border border-blue-100 bg-white p-7 shadow-xl shadow-blue-100/60">
          <p className="text-sm font-semibold text-blue-600">Medical Notice</p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
            시작 전 안내
          </h1>

          <div className="mt-6 space-y-4 text-base leading-7 text-slate-700">
            <p>본 서비스는 의학적 진단이나 처방을 제공하지 않습니다.</p>
            <p>정확한 진단과 치료는 반드시 의료진 상담이 필요합니다.</p>
            <p className="rounded-2xl border border-red-100 bg-red-50 p-4 font-medium text-red-700">
              흉통, 호흡곤란, 의식 저하, 심한 출혈 등 응급 증상이 있다면 즉시
              119 또는 가까운 응급실을 이용하세요.
            </p>
          </div>

          <Link
            href="/chat"
            className="mt-8 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-5 py-4 text-base font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            동의하고 시작하기
          </Link>
        </div>
      </section>
    </main>
  );
}
