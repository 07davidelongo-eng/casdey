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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold " +
  "transition-[transform,background-color,border-color,color] duration-200 ease-out " +
  "active:translate-y-0 active:scale-[0.98]";

/*
 * Padding is a variant, not something a caller passes in className.
 *
 * Tailwind settles a clash like py-3 against py-2 by stylesheet order, not by
 * the order the classes appear in the attribute, so an override passed in
 * from outside was silently losing: the header's button rendered 49px tall
 * inside a 58px bar and looked welded to its edges.
 */
const SIZES = {
  md: "px-5 py-3 text-[0.9375rem]",
  sm: "px-3.5 py-2 text-[0.875rem]",
} as const;

type Size = keyof typeof SIZES;

const VARIANTS = {
  primary:
    "bg-teal-bright text-deep hover:brightness-[1.06] hover:-translate-y-px shadow-[0_1px_2px_rgba(21,21,15,0.12),0_6px_16px_-6px_rgba(212,175,55,0.55)]",
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
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link
      className={`${BUTTON_BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`${BUTTON_BASE} ${SIZES[size]} ${VARIANTS[variant]} disabled:opacity-60 disabled:hover:translate-y-0 ${className}`}
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
