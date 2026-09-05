"use client";

import { useState } from "react";

import { AppShot, type View } from "../app-shot";
import { Reveal } from "../motion";
import { Container } from "../ui";

/**
 * The one interactive block on the page: pick a step, the screen changes.
 *
 * This replaces a row of three numbered cards, and then a scroll-drawn
 * timeline, neither of which showed the software. A gym owner clicking
 * through four real screens learns more in ten seconds than a diagram can
 * tell them, and it is the pattern every good software site has converged
 * on for exactly that reason.
 */

const STEPS: { view: View; title: string; body: string }[] = [
  {
    view: "members",
    title: "See who stopped coming",
    body: "Bring in a file from your gym software, or a CSV. casdey sorts your list by time since last visit and separates the members who drifted off from the ones still turning up.",
  },
  {
    view: "offer",
    title: "Know what they are worth",
    body: "Enter your own membership and class prices once. casdey values the quiet half of your list against them, so you know the number before a single message goes out.",
  },
  {
    view: "campaign",
    title: "Write in your gym's name",
    body: "One member, one reason to be contacted, one short message. It leaves from your gym's address, not ours, and you approve the first send before anything goes anywhere.",
  },
  {
    view: "booking",
    title: "Book them back in",
    body: "The reply lands with your front desk. casdey answers in your name and puts the session straight into your Google Calendar, so the only thing your team touches is the door.",
  },
];

export function WhatItDoes() {
  const [active, setActive] = useState(0);

  return (
    <section id="what-it-does" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <Reveal>
          <h2 className="display max-w-[24ch] text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink">
            Four screens, and your team touches one of them.
          </h2>

          <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-14">
            <ol className="list-none">
              {STEPS.map((step, i) => {
                const on = i === active;
                return (
                  <li key={step.view}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-current={on ? "true" : undefined}
                      className={
                        "w-full border-l-2 py-4 pl-5 text-left transition-colors duration-200 " +
                        (on ? "border-teal" : "border-ash hover:border-stone")
                      }
                    >
                      <span
                        className={
                          "block text-[1.0625rem] font-medium transition-colors duration-200 " +
                          (on ? "text-ink" : "text-stone")
                        }
                      >
                        {step.title}
                      </span>
                      {on && (
                        <span className="mt-2 block text-[0.9375rem] leading-relaxed text-graphite">
                          {step.body}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="lg:pt-1">
              <div key={active} className="view-fade">
                <AppShot view={STEPS[active].view} />
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
