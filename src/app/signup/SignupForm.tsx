"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "./actions";

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.477 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function SignupForm({ serverError }: { serverError?: string }) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password !== confirm) {
      e.preventDefault();
      setClientError("Les mots de passe ne correspondent pas.");
      return;
    }
    setClientError(null);
  }

  const error = clientError ?? serverError;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Inscription</h1>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <form action={signup} onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
            />
          </div>

          {/* Mot de passe */}
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showPassword ? "Cacher le mot de passe" : "Voir le mot de passe"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Confirmation mot de passe */}
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-gray-700">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <input
                id="confirm"
                name="confirm"
                type={showConfirm ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`w-full rounded-md border px-3 py-2 pr-10 text-sm text-gray-900 focus:outline-none ${
                  mismatch
                    ? "border-red-400 focus:border-red-400"
                    : "border-gray-300 focus:border-gray-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showConfirm ? "Cacher" : "Voir"}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {mismatch && (
              <p className="mt-1 text-xs text-red-500">
                Les mots de passe ne correspondent pas.
              </p>
            )}
          </div>

          {/* Code d'acces */}
          <div>
            <label htmlFor="access_code" className="mb-1 block text-sm font-medium text-gray-700">
              Code d&apos;acces
            </label>
            <input
              id="access_code"
              name="access_code"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              placeholder="Code fourni par Kaizen"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Creer mon compte
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Deja un compte ?{" "}
          <Link href="/login" className="font-medium text-gray-900 underline">
            Connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
