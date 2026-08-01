import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold">PausePal</h1>
      <p className="mt-3 max-w-md text-neutral-600">
        This is the PausePal app — sign up for a cohort and we&apos;ll match you with a
        meditation accountability partner.
      </p>
      <Link
        href="/signup"
        className="mt-8 rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
      >
        Sign up
      </Link>
    </main>
  );
}
