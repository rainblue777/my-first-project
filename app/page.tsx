export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white px-6">
      <section className="max-w-2xl text-center space-y-6">
        <p className="text-sm text-blue-400 font-semibold">My First Next.js Page</p>

        <h1 className="text-5xl font-bold">
          안녕하세요, 오상민입니다.
        </h1>

        <p className="text-lg text-gray-300 leading-8">
          저는 창업, 게임 기획, 스토리텔링, 그리고 사람의 마음을 움직이는 서비스를 만드는 것에 관심이 있습니다.
        </p>

        <div className="rounded-2xl bg-white/10 p-6 text-left space-y-3">
          <h2 className="text-2xl font-semibold">좋아하는 것</h2>
          <ul className="list-disc list-inside text-gray-300">
            <li>영화와 애니메이션</li>
            <li>창업 아이디어 구상</li>
            <li>게임 기획</li>
            <li>깊은 대화와 이야기 만들기</li>
          </ul>
        </div>

        <p className="text-xl font-semibold text-blue-300">
          “계속 도전하는 사람입니다.”
        </p>
      </section>
    </main>
  );
}