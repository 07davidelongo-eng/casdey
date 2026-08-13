type IconProps = { className?: string };

const BASE = "h-6 w-6";

function Svg({
  className = "",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${BASE} ${className}`}
    >
      {children}
    </svg>
  );
}

/** A patient list with one row picked out. */
export function IconFind(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 5h10M4 9.5h7M4 14h5" />
      <circle cx="16" cy="15" r="4.5" />
      <path d="m19.4 18.4 2.1 2.1" />
    </Svg>
  );
}

/** An outgoing message. */
export function IconMessage(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.6 3.2a.5.5 0 0 1-.79-.41V17H5.5" />
      <path d="m6.5 8 5.5 3.8L17.5 8" />
    </Svg>
  );
}

/** Bookings coming back. */
export function IconTrend(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 20h18" />
      <path d="m4 15.5 4.5-4.5 3.5 3L20 6" />
      <path d="M15.5 6H20v4.5" />
    </Svg>
  );
}

/** Data protection. */
export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9.5 4.1-1.9 7-5.3 7-9.5V6l-7-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Svg>
  );
}

/** Read-only access to the practice's records. */
export function IconReadOnly(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Svg>
  );
}

/** Time passing without contact. */
export function IconClock(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  );
}
