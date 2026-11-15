import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 font-mono text-center">
      <h2 className="text-2xl font-extrabold mb-2">Page Not Found</h2>
      <p className="text-sm mb-4">The requested page does not exist.</p>
      <Link
        href="/"
        className="px-3 py-1.5 bg-violet-600 text-white font-bold rounded-lg text-xs hover:bg-violet-700 transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
