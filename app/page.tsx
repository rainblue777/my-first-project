import Image from "next/image";

export default function Home() {
  const interests = ["창업", "게임 기획", "스토리텔링", "AI 서비스"];
  const favorites = [
    "영화와 애니메이션",
    "창업 아이디어 구상",
    "게임 기획",
    "깊은 대화와 이야기 만들기",
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),_transparent_34%),linear-gradient(135deg,_#f8fbff_0%,_#10203a_42%,_#071225_100%)] px-6 py-10 text-white md:py-14">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <article className="rounded-3xl border border-blue-200/25 bg-slate-800/75 p-6 shadow-2xl shadow-blue-950/35 backdrop-blur md:p-8">
          <div className="grid items-center gap-8 md:grid-cols-[280px_1fr]">
            <div className="relative h-80 w-full overflow-hidden rounded-3xl border border-blue-200/40 bg-slate-700 shadow-xl shadow-blue-500/20 transition duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-blue-400/30 md:h-96">
              <Image
                src="/profile.jpeg"
                alt="오상민 프로필 사진"
                fill
                sizes="(max-width: 768px) 100vw, 280px"
                className="object-cover transition duration-300"
                priority
              />
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-200">
                Portfolio
              </p>
              <h1 className="mt-4 text-4xl font-bold text-white md:text-6xl">
                오상민
              </h1>
              <p className="mt-3 text-base font-medium text-sky-100 md:text-lg">
                Entrepreneur · Game Planner · Storyteller
              </p>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">
                창업, 게임 기획, 스토리텔링으로 사람의 마음을 움직이는 것을 좋아합니다.
              </p>
            </div>
          </div>
        </article>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-2xl border border-slate-500/45 bg-slate-800/80 p-6 shadow-lg shadow-slate-950/25 transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-blue-300/70 hover:shadow-xl hover:shadow-blue-500/15">
            <p className="text-sm font-semibold text-blue-200">About Me</p>
            <h2 className="mt-3 text-2xl font-bold text-white">사람의 마음을 움직이는 기획</h2>
            <p className="mt-4 leading-7 text-slate-100">
              저는 서비스를 만들고, 게임을 기획하고, 이야기를 통해 사람의 마음을 움직이는 것을 좋아하는 사람입니다.
            </p>
          </article>

          <article className="rounded-2xl border border-blue-300/35 bg-blue-900/35 p-6 shadow-lg shadow-blue-950/25 transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-blue-200/75 hover:shadow-xl hover:shadow-blue-400/15">
            <p className="text-sm font-semibold text-blue-200">Interests</p>
            <h2 className="mt-3 text-2xl font-bold text-white">관심사</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-blue-200/45 bg-blue-300/15 px-4 py-2 text-sm font-medium text-blue-50 transition duration-300 hover:-translate-y-0.5 hover:border-blue-100/80 hover:bg-blue-300/25 hover:shadow-md hover:shadow-blue-400/20"
                >
                  {interest}
                </span>
              ))}
            </div>
          </article>
        </div>

        <article className="rounded-2xl border border-slate-500/45 bg-slate-800/80 p-6 shadow-lg shadow-slate-950/25 transition duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:border-blue-300/70 hover:shadow-xl hover:shadow-blue-500/15">
          <p className="text-sm font-semibold text-blue-200">Favorite Things</p>
          <h2 className="mt-3 text-2xl font-bold text-white">좋아하는 것</h2>
          <ul className="mt-5 grid gap-3 text-slate-100 md:grid-cols-2">
            {favorites.map((favorite) => (
              <li
                key={favorite}
                className="rounded-md border border-slate-500/45 bg-slate-700/65 px-4 py-3 transition duration-300 hover:-translate-y-0.5 hover:border-blue-200/70 hover:bg-blue-900/35 hover:text-blue-50 hover:shadow-md hover:shadow-blue-500/15"
              >
                {favorite}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
