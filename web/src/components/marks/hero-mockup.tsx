import { PatientTimeline } from "./patient-timeline";
import { IconCheck } from "./icons";

/**
 * The hero's product picture: one dormant patient record, the gap in their
 * history, and the booking that closed it. Everything here is illustrative and
 * labelled as such, since casdey holds no patient data yet.
 */
export function HeroMockup() {
  return (
    <div className="relative w-full max-w-[420px] pt-12 sm:pt-14">
      {/* Sits in front of the record's top-right corner, the way the
          confirmation arrives on top of everything else. */}
      {/* Offsets stay small and negative: the hero clips its background wash,
          so anything further out gets its corner cut off. */}
      <div className="absolute -right-2 top-0 z-20 w-[208px] rounded-[18px] bg-deep p-5 shadow-float sm:-right-3">
        <div className="flex items-center gap-2 text-teal-bright">
          <IconCheck className="h-4 w-4" />
          <span className="label text-teal-bright">rebooked</span>
        </div>
        <p className="mt-3 font-mono text-[1.375rem] leading-none text-ink">
          Tue 14:30
        </p>
        <p className="mt-2 text-[0.8125rem] leading-snug text-sea">
          Hygiene, 30 min
        </p>
      </div>

      <div className="relative z-10 w-full rounded-[22px] bg-white p-6 shadow-float sm:p-7">
        {/* The status pill stays left and the row keeps a right gutter: the
            floating card covers the top-right corner, so nothing that has to
            be read can live there. */}
        <div className="flex items-center gap-3 pr-24">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-shallow font-mono text-[0.8125rem] font-medium text-teal"
          >
            JO
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold leading-tight text-ink">
              J. Okafor
            </p>
            <p className="font-mono text-[0.75rem] leading-tight text-stone">
              since mar 2022
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-mist pt-5">
          <span className="label rounded-full bg-mist px-2.5 py-1 text-stone">
            dormant
          </span>
          <span className="font-mono text-[0.75rem] text-stone">
            last seen sep 2023
          </span>
        </div>

        <div className="mt-2">
          <PatientTimeline />
        </div>

        <div className="mt-4 rounded-[14px] bg-paper p-4">
          <p className="label text-stone">message sent</p>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-graphite">
            &ldquo;Hi Joseph, it has been a while since your last check-up with
            us. Would you like me to find you a time?&rdquo;
          </p>
        </div>

        <p className="label mt-4 text-stone">illustrative example</p>
      </div>
    </div>
  );
}
