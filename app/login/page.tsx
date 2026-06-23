"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError("Incorrect admin password.");
      return;
    }

    router.replace(nextPath);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6fbf7] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-court-ink/10 bg-white p-6 shadow-sm">
        <span className="grid h-12 w-12 place-items-center rounded-md bg-court-mint text-court-ink">
          <LockKeyhole size={22} />
        </span>
        <h1 className="mt-5 text-3xl font-bold">Admin Login</h1>
        <p className="mt-2 text-sm text-court-ink/60">Enter the auction admin password to continue.</p>
        <label className="mt-6 grid gap-2 text-sm font-semibold">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="focus-ring rounded-md border border-court-ink/15 px-4 py-3 font-normal"
            autoFocus
          />
        </label>
        {error ? <p className="mt-3 rounded-md bg-court-clay/10 px-3 py-2 text-sm font-semibold text-court-clay">{error}</p> : null}
        <button disabled={isSubmitting} className="mt-5 w-full rounded-md bg-court-ink px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {isSubmitting ? "Checking..." : "Login"}
        </button>
      </form>
    </main>
  );
}
  useEffect(() => {
    setNextPath(new URLSearchParams(window.location.search).get("next") || "/admin");
  }, []);
