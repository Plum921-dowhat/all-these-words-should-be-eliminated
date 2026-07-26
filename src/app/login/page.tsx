"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EXAM_OPTIONS = [
  { value: "CET4", label: "英语四级" },
  { value: "CET6", label: "英语六级" },
  { value: "KY", label: "考研" },
  { value: "COMMON", label: "通用" },
  { value: "TEM4", label: "专四（预留）" },
  { value: "TEM8", label: "专八（预留）" },
  { value: "IELTS", label: "雅思（预留）" },
  { value: "TOEFL", label: "托福（预留）" },
];

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [targetExam, setTargetExam] = useState("CET4");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      name,
      targetExam,
      mode,
      redirect: false,
    });
    if (res?.error) {
      setError(
        res.error === "EMAIL_TAKEN"
          ? "该邮箱已注册，请直接登录"
          : "邮箱或密码错误"
      );
      return;
    }
    router.push("/learn");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card mt-8">
        <div className="mb-4 flex gap-2">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`btn flex-1 ${mode === m ? "btn-primary" : "btn-ghost"}`}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <input className="input" placeholder="昵称" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input
            className="input"
            type="email"
            required
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            required
            placeholder="密码（至少6位）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "register" && (
            <select className="input" value={targetExam} onChange={(e) => setTargetExam(e.target.value)}>
              {EXAM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">
            {mode === "login" ? "登录" : "注册并进入"}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-slate-400">
          注册即表示你同意我们的服务条款。返回 <Link href="/" className="text-brand-600">首页</Link>
        </p>
      </div>
    </div>
  );
}
