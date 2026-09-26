type BrandMarkProps = {
  compact?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export function BrandMark({ compact = false, className = "", size = "sm" }: BrandMarkProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src="/stratosphere-io-logo.png"
        alt="Stratosphere.io"
        className={`${sizeClasses[size]} rounded-control border border-line object-cover shadow-lg shadow-tint`}
      />
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold text-fg">Stratosphere.io</p>
          <p className="text-xs text-fg-subtle">Productivity coach</p>
        </div>
      )}
    </div>
  );
}
