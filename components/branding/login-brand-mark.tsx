type LoginBrandMarkProps = {
  className?: string;
};

export function LoginBrandMark({ className }: LoginBrandMarkProps) {
  return (
    <div className={className} aria-hidden="true">
      <div className="mx-auto max-w-[300px] rounded-3xl border border-slate-100 bg-gradient-to-br from-emerald-50/80 via-blue-50/60 to-slate-50 p-4 dark:border-slate-700 dark:from-emerald-950/40 dark:via-slate-800 dark:to-slate-900">
        <svg
        viewBox="0 0 320 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full max-w-[280px]"
        role="img"
        aria-label="LeadFlow"
      >
        <defs>
          <linearGradient id="login-brand-emerald" x1="24" y1="18" x2="108" y2="102" gradientUnits="userSpaceOnUse">
            <stop stopColor="#059669" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="login-brand-blue" x1="212" y1="24" x2="296" y2="96" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <filter id="login-brand-shadow" x="0" y="0" width="320" height="120" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#0f172a" floodOpacity="0.08" />
          </filter>
        </defs>

        <rect x="8" y="8" width="304" height="104" rx="24" fill="white" fillOpacity="0.72" stroke="#e2e8f0" strokeWidth="1" className="dark:fill-slate-800/80 dark:stroke-slate-600" />

        <g filter="url(#login-brand-shadow)">
          <rect x="28" y="30" width="60" height="60" rx="18" fill="url(#login-brand-emerald)" />
          <path
            d="M44 58h12c6.627 0 12 5.373 12 12s-5.373 12-12 12H44V58Z"
            fill="white"
            fillOpacity="0.95"
          />
          <path
            d="M58 46h12c6.627 0 12 5.373 12 12s-5.373 12-12 12H58V46Z"
            fill="white"
            fillOpacity="0.72"
          />
        </g>

        <path
          d="M100 60h28"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />
        <circle cx="142" cy="60" r="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2" />
        <circle cx="142" cy="60" r="4" fill="#2563eb" />

        <path
          d="M156 60h28"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />
        <circle cx="198" cy="60" r="10" fill="#d1fae5" stroke="#10b981" strokeWidth="2" />
        <circle cx="198" cy="60" r="4" fill="#059669" />

        <path
          d="M212 60h24"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 6"
        />

        <g filter="url(#login-brand-shadow)">
          <rect x="236" y="34" width="52" height="52" rx="16" fill="url(#login-brand-blue)" />
          <path
            d="M252 60h8m8 0h8M260 52v16"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>

        <text
          x="58"
          y="108"
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="0.18em"
        >
          ROUTE
        </text>
        <text
          x="142"
          y="108"
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="0.18em"
        >
          MATCH
        </text>
        <text
          x="198"
          y="108"
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="0.18em"
        >
          DELIVER
        </text>
        <text
          x="262"
          y="108"
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          letterSpacing="0.18em"
        >
          TRACK
        </text>
      </svg>
      </div>

      <div className="mt-4 text-center">
        <p className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Lead<span className="text-emerald-700 dark:text-emerald-400">Flow</span>
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
          Lead Management Platform
        </p>
      </div>
    </div>
  );
}
