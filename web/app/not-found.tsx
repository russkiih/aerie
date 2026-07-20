import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-[13px] font-medium uppercase tracking-wider text-faint">
        404
      </div>
      <h1 className="mt-2 text-xl font-semibold text-ink">
        Nothing nesting here.
      </h1>
      <Link
        href="/"
        className="mt-5 rounded-lg border border-line bg-panel px-4 py-2 text-[13px] text-muted hover:border-accent-dim/60 hover:text-ink"
      >
        ← Back to overview
      </Link>
    </div>
  );
}
