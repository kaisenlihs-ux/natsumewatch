"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [u, setU] = useState("");
  const [e, setE] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await register(u, e, p);
      router.push("/");
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="mb-1 font-display text-2xl font-semibold">Регистрация</h1>
        <p className="mb-6 text-sm text-white/60">
          Создайте аккаунт, чтобы оставлять комментарии, ставить оценки и писать рецензии.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={u}
            onChange={(ev) => setU(ev.target.value)}
            placeholder="Имя пользователя"
            className="field"
            minLength={3}
            maxLength={32}
            required
          />
          <input
            type="email"
            value={e}
            onChange={(ev) => setE(ev.target.value)}
            placeholder="Email"
            className="field"
            required
          />
          <input
            type="password"
            value={p}
            onChange={(ev) => setP(ev.target.value)}
            placeholder="Пароль (≥ 6 символов)"
            className="field"
            minLength={6}
            required
          />
          {err && <div className="text-sm text-brand-400">{err}</div>}
          <button disabled={busy} className="btn-primary w-full">
            {busy ? "Создаём..." : "Создать аккаунт"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-white/60">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-brand-400 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
