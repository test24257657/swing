import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 font-mono text-center">
      <h2 className="text-2xl font-extrabold mb-2 text-text">Page Not Found</h2>
      <p className="text-xs text-text-secondary mb-4">The requested page does not exist.</p>
      <Link
        href="/screener"
        className="px-3 py-1.5 bg-accent text-white font-bold rounded-lg text-xs hover:bg-accent-hover transition-colors"
      >
        Go to Screener
      </Link>
    </div>
  );
}

