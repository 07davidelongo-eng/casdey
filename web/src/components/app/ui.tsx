import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * Product UI primitives. The marketing primitives in src/components/ui.tsx are
 * built for full-bleed sections and stay there. These are built for dense
 * screens: tighter type, tighter rhythm, same tokens.
 */

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[46ch]">
        {eyebrow ? <p className="label mb-2 text-teal">{eyebrow}</p> : null}
        <h1 className="display text-[1.75rem] sm:text-[2rem]">{title}</h1>
        {lede ? (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-graphite">
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`card p-6 ${className}`}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="display mb-1 text-[1.125rem] tracking-[-0.02em]">
      {children}
    </h2>
  );
}

/**
 * A single number with its label. The number is set in mono because it is a
 * literal, per the brand guide.
 *
 * `tone="rebooked"` is the one place amber appears in the product. Nothing else
 * may pass it.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "teal" | "rebooked";
}) {
  const valueTone =
    tone === "rebooked"
      ? "text-[color-mix(in_srgb,var(--amber)_62%,var(--ink))]"
      : tone === "teal"
        ? "text-teal"
        : "text-ink";

  return (
    <div className="card p-5">
      <p className="label text-stone">{label}</p>
      <p
        className={`literal mt-2 text-[2rem] leading-none font-medium ${valueTone}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[0.8125rem] text-stone">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <h2 className="display text-[1.25rem]">{title}</h2>
      <p className="max-w-[46ch] text-[0.9375rem] text-graphite">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
}) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function Pill({
  tone = "quiet",
  children,
}: {
  tone?: "quiet" | "teal" | "rebooked";
  children: ReactNode;
}) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

/* --- Buttons -------------------------------------------------------------- */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-4 py-2.5 text-[0.9375rem] font-semibold " +
  "transition-[transform,background-color,border-color,color,opacity] duration-200 ease-out active:translate-y-0 active:scale-[0.98]";

const VARIANTS = {
  primary:
    "bg-teal text-white hover:bg-teal-hover hover:-translate-y-px shadow-[0_1px_2px_rgba(12,46,51,0.12)]",
  quiet: "bg-white text-ink border border-ash hover:border-stone hover:-translate-y-px",
  ghost: "text-graphite hover:text-ink hover:bg-mist",
  danger:
    "bg-white text-[#8c1d18] border border-[color-mix(in_srgb,#b3261e_35%,transparent)] hover:bg-[color-mix(in_srgb,#b3261e_6%,var(--white))]",
} as const;

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={`${BUTTON_BASE} ${VARIANTS[variant]} disabled:opacity-55 disabled:hover:translate-y-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

/* --- Formatting ----------------------------------------------------------- */

/** Dates are always literal, always unambiguous. Never "12/06/2025". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "never";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function patientName(patient: {
  first_name: string | null;
  last_name: string | null;
}): string {
  const name = [patient.first_name, patient.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "unnamed patient";
}
