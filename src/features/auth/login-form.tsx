"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} aria-invalid={state.error ? true : undefined} />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={state.error ? true : undefined} />
      </Field>
      {state.error ? (
        <p className="rounded-xl bg-negative-soft px-3 py-2.5 text-sm font-medium text-negative" role="alert">
          {state.error}
        </p>
      ) : null}
      <SubmitButton className="w-full" size="lg" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
