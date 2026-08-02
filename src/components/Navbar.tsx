"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">L</span>
          {process.env.NEXT_PUBLIC_APP_NAME}
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link href="/reading" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">分级阅读</Link>
          <Link href="/learn" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">背单词</Link>
          <Link href="/wordbook" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">生词本</Link>
          <Link href="/word-library" className="rounded-lg px-3 py-1.5 hover:bg-slate-100">单词库</Link>
          {session ? (
            <button onClick={() => signOut()} className="btn-ghost ml-2">退出</button>
          ) : (
            <Link href="/login" className="btn-primary ml-2">登录</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
