export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="26"
        height="26"
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden="true"
        className="text-brass-deep"
      >
        {/* balance scale — the mizan */}
        <path
          d="M13 3v18M6 21h14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M13 6 5 9m8-3 8 3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M2.5 9a2.5 2.5 0 0 0 5 0zM18.5 9a2.5 2.5 0 0 0 5 0z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-xl font-semibold tracking-tight text-ink">
        Mizan
      </span>
    </span>
  );
}
