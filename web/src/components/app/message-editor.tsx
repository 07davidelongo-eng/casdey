"use client";

import { useId, useRef, useState } from "react";

import { PLACEHOLDER_HELP } from "@/lib/template";

/**
 * The message box, with the merge fields put in by casdey rather than typed.
 *
 * The fields used to be documented in a legend under the textarea, which meant
 * a gym had to read a list, remember the exact spelling, and type
 * {{first_name}} by hand with the braces in the right places. A typo there does
 * not fail loudly: it sends "Hi {{first_name}}," to a real member, in the
 * gym's name.
 *
 * So the list became a control. Pick a field and it lands where the cursor
 * was, spelled correctly, and the legend stays underneath for anyone who wants
 * to know what each one means.
 *
 * On bold and italic, which is the obvious next ask: casdey sends plain text
 * on purpose, and that is not a shortcut. A plain-text note from a gym reads
 * as a note from a gym, and it stays out of the promotions tab that eats
 * HTML-formatted marketing mail. Offering bold here would mean sending HTML
 * email, which trades the deliverability the whole product depends on for
 * emphasis nobody asked a gym for. If that trade is ever worth making it is a
 * decision about what casdey sends, not a button to add to this toolbar.
 */
export function MessageEditor({
  value,
  onChange,
  disabled,
  rows = 12,
  showLegend = true,
  ariaLabelledBy,
  name,
  required,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  rows?: number;
  /** The follow-up boxes sit under a shared legend, so they hide their own. */
  showLegend?: boolean;
  ariaLabelledBy?: string;
  name?: string;
  required?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fallbackId = useId();
  const selectId = `${id ?? fallbackId}-insert`;
  const [justInserted, setJustInserted] = useState<string | null>(null);

  function insert(token: string) {
    const el = ref.current;
    if (!el) return;

    // Where the cursor actually is, not the end of the box. A gym writing a
    // message and reaching for a field means "here", every time.
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const before = value.slice(0, start);
    const after = value.slice(end);

    // A field pushed straight against a word ("HiAoife") is the other way this
    // goes wrong, so pad only where padding is missing.
    const needsLeading = before.length > 0 && !/[\s({[]$/.test(before);
    const text = `${needsLeading ? " " : ""}${token}`;

    onChange(`${before}${text}${after}`);
    setJustInserted(token);

    // Put the cursor after what was just inserted, so typing continues where
    // the person is looking.
    requestAnimationFrame(() => {
      const at = start + text.length;
      el.focus();
      el.setSelectionRange(at, at);
    });
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label htmlFor={selectId} className="text-[0.8125rem] text-stone">
          Insert a field
        </label>
        <select
          id={selectId}
          disabled={disabled}
          value=""
          onChange={(event) => {
            if (event.target.value) insert(event.target.value);
            // Back to the prompt, so the same field can be inserted twice.
            event.target.value = "";
          }}
          className="field w-auto py-1 text-[0.8125rem]"
        >
          <option value="">Choose one</option>
          {PLACEHOLDER_HELP.map((help) => (
            <option key={help.token} value={help.token}>
              {help.token}
            </option>
          ))}
        </select>
        {justInserted ? (
          <span aria-live="polite" className="text-[0.8125rem] text-teal">
            {justInserted} added
          </span>
        ) : null}
      </div>

      <textarea
        ref={ref}
        id={id}
        name={name}
        required={required}
        rows={rows}
        maxLength={5000}
        disabled={disabled}
        aria-labelledby={ariaLabelledBy}
        className="field font-[family-name:var(--font-inter)] leading-relaxed"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />

      {showLegend ? (
        <div className="field-hint">
          <p className="mb-1">What each field fills in:</p>
          <ul className="space-y-0.5">
            {PLACEHOLDER_HELP.map((help) => (
              <li key={help.token}>
                <code className="literal text-graphite">{help.token}</code>{" "}
                {help.means}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
