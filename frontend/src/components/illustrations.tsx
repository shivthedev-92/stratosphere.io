type IllustrationProps = {
  className?: string;
};

export function RhythmIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 920 520"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M86 350C168 232 236 401 322 274C407 149 482 245 555 190C626 137 689 81 831 112"
        stroke="#38bdf8"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M76 407C168 289 247 459 332 333C416 207 491 303 565 248C636 196 705 143 849 176"
        stroke="#34d399"
        strokeWidth="5"
        strokeLinecap="round"
        strokeOpacity=".75"
      />
      <path
        d="M122 143H315C331 143 344 156 344 172V365C344 381 331 394 315 394H122C106 394 93 381 93 365V172C93 156 106 143 122 143Z"
        fill="#111827"
        stroke="#475569"
        strokeWidth="3"
      />
      <path d="M133 205H305" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <path d="M133 247H282" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <path d="M133 289H252" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <path d="M133 331H294" stroke="#64748b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="219" cy="143" r="44" fill="#312e81" stroke="#818cf8" strokeWidth="4" />
      <path d="M202 143L214 155L239 128" stroke="#f8fafc" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M583 164H753C769 164 782 177 782 193V363C782 379 769 392 753 392H583C567 392 554 379 554 363V193C554 177 567 164 583 164Z"
        fill="#0f172a"
        stroke="#475569"
        strokeWidth="3"
      />
      <path d="M608 332H730" stroke="#475569" strokeWidth="12" strokeLinecap="round" />
      <path d="M608 292H707" stroke="#f59e0b" strokeWidth="12" strokeLinecap="round" />
      <path d="M608 252H748" stroke="#34d399" strokeWidth="12" strokeLinecap="round" />
      <circle cx="669" cy="206" r="26" fill="#0f766e" stroke="#5eead4" strokeWidth="4" />
      <path d="M669 190V207L682 216" stroke="#ecfeff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyGoalsIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 160"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="36" y="28" width="188" height="108" rx="8" fill="#111827" stroke="#475569" />
      <path d="M62 60H181" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <path d="M62 86H154" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <path d="M62 112H196" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <circle cx="202" cy="46" r="22" fill="#312e81" stroke="#818cf8" strokeWidth="3" />
      <path d="M192 46H212M202 36V56" stroke="white" strokeWidth="4" strokeLinecap="round" />
      <path d="M38 139C82 121 164 121 221 139" stroke="#34d399" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function CoachIllustration({ className = "" }: IllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 280 190"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M54 52C54 39 65 28 78 28H184C197 28 208 39 208 52V98C208 111 197 122 184 122H111L78 151V122C65 122 54 111 54 98V52Z"
        fill="#111827"
        stroke="#475569"
        strokeWidth="3"
      />
      <path d="M82 65H172" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <path d="M82 90H146" stroke="#64748b" strokeWidth="6" strokeLinecap="round" />
      <circle cx="211" cy="130" r="35" fill="#0f766e" stroke="#5eead4" strokeWidth="4" />
      <path d="M195 130L207 142L229 116" stroke="#ecfeff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="72" cy="42" r="12" fill="#f59e0b" />
      <path d="M26 162C72 142 127 147 164 166" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function InsightIllustration({
  className = "",
  variant = "chart",
}: IllustrationProps & { variant?: "chart" | "map" | "list" }) {
  const accent = variant === "chart" ? "#f59e0b" : variant === "map" ? "#38bdf8" : "#34d399";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 110"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="18" y="16" width="144" height="78" rx="8" fill="#111827" stroke="#334155" />
      {variant === "chart" && (
        <>
          <path d="M46 76V58" stroke={accent} strokeWidth="10" strokeLinecap="round" />
          <path d="M76 76V39" stroke="#34d399" strokeWidth="10" strokeLinecap="round" />
          <path d="M106 76V49" stroke="#38bdf8" strokeWidth="10" strokeLinecap="round" />
          <path d="M136 76V30" stroke="#818cf8" strokeWidth="10" strokeLinecap="round" />
        </>
      )}
      {variant === "map" && (
        <>
          <path d="M41 72C63 33 84 82 104 46C119 19 134 35 145 28" stroke={accent} strokeWidth="5" strokeLinecap="round" />
          <circle cx="42" cy="72" r="6" fill="#34d399" />
          <circle cx="104" cy="46" r="6" fill="#f59e0b" />
          <circle cx="145" cy="28" r="6" fill="#818cf8" />
        </>
      )}
      {variant === "list" && (
        <>
          <path d="M48 42H132" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
          <path d="M48 61H113" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
          <path d="M48 80H126" stroke="#64748b" strokeWidth="5" strokeLinecap="round" />
          <circle cx="35" cy="42" r="4" fill={accent} />
          <circle cx="35" cy="61" r="4" fill={accent} />
          <circle cx="35" cy="80" r="4" fill={accent} />
        </>
      )}
    </svg>
  );
}
