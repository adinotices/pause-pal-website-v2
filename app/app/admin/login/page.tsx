import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <h1 className="text-xl font-semibold">Admin login</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
