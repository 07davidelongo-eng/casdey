import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Container({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[76rem] px-6 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

/** Mono, uppercase, wide-tracked. Marks the start of a section. */
export function Eyebrow({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={`label text-teal ${className}`}>{children}</p>;
}

export function SectionHeading({
  as: Tag = "h2",
  className = "",
  children,
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`display text-[clamp(1.85rem,3.4vw,2.6rem)] text-balance ${className}`}
    >
      {children}
    </Tag>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] px-5 py-3 text-[0.9375rem] font-semibold " +
  "transition-[transform,background-color,border-color,color] duration-200 ease-out " +
  "active:translate-y-0 active:scale-[0.98]";

const VARIANTS = {
  primary:
    "bg-teal text-white hover:bg-teal-hover hover:-translate-y-px shadow-[0_1px_2px_rgba(0,0,0,0.24)]",
  quiet:
    "bg-white text-ink border border-ash hover:border-stone hover:-translate-y-px",
  onDeep:
    "bg-ink/10 text-ink border border-deep-line hover:bg-ink/16 hover:-translate-y-px",
  brightOnDeep:
    "bg-teal-bright text-deep hover:bg-sea hover:-translate-y-px font-semibold",
} as const;

type Variant = keyof typeof VARIANTS;

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={`${BUTTON_BASE} ${VARIANTS[variant]} disabled:opacity-60 disabled:hover:translate-y-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ArrowUpRight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 ${className}`}
    >
      <path
        d="M4.5 11.5 11.5 4.5M6 4.5h5.5V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
