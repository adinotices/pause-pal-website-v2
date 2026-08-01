import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — PausePal" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-24">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Enter the email you signed up with and we&apos;ll send you a link to your dashboard.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </main>
  );
}
