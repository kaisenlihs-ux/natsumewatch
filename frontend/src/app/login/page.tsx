"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(id, pw);
      router.push("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка входа");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="mb-1 font-display text-2xl font-semibold">Вход</h1>
        <p className="mb-6 text-sm text-white/60">Войдите в свой аккаунт NatsumeWatch.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Email или имя пользователя"
            className="field"
            required
          />
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Пароль"
            className="field"
            required
          />
          {err && <div className="text-sm text-brand-400">{err}</div>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Входим..." : "Войти"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-white/60">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-brand-400 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
