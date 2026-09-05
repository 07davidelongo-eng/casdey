import type { ReactNode } from "react";

/**
 * A section's heading and the sentence that supports it, stacked.
 *
 * These two used to sit side by side in a two-column grid, which read as two
 * separate statements competing across a gutter rather than one thought and
 * its qualification. Stacked, the eye finishes the heading and drops straight
 * into the sentence that explains it, and the measure stays short enough to
 * read without the paragraph stretching the width of the panel below.
 */
export function SectionIntro({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="max-w-[46ch]">
      <h2 className="display text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink text-balance">
        {title}
      </h2>
      <p className="mt-5 text-[1.0625rem] leading-relaxed text-graphite text-pretty">
        {children}
      </p>
    </div>
  );
}
