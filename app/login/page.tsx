import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Sign in — Mizan" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 flex justify-center">
          <Link href="/" aria-label="Mizan home">
            <Logo />
          </Link>
        </div>
        <div className="card">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            New here? Same form — your account is created on first sign-in.
          </p>
          <div className="mt-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-soft">
          By signing in you agree to our terms. We never share your data.
        </p>
      </div>
    </main>
  );
}
