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
    title: "You import your list",
    body: "A file from your gym software, or a CSV. casdey sorts it by time since the last visit and separates the members who drifted off from the ones still turning up. This is the only step that needs you.",
  },
  {
    view: "offer",
    title: "It works out what they are worth",
    body: "Enter your own membership and class prices once. casdey values the quiet half of your list against them, so you know the number before a single message goes out.",
  },
  {
    view: "campaign",
    title: "It writes to each one, as you",
    body: "Not one message to a mailing list. Each member gets their own: their name, how long they have been away, why they left if you recorded it, and the offer you chose. It leaves from your gym's address, and you approve the first send.",
  },
  {
    view: "sequence",
    title: "It follows up, then it lets go",
    body: "Most people who come back do it on the second message, not the first. casdey nudges once, then writes a last one that says it is the last, and stops. The moment somebody books, the rest of their sequence is cancelled.",
  },
  {
    view: "booking",
    title: "It books them in",
    body: "The reply is answered in your gym's name, a free slot is found in your own calendar, and the session is put in it. Nobody at the gym has to open anything for this to happen.",
  },
];

export function WhatItDoes() {
  const [active, setActive] = useState(0);

  return (
    <section id="what-it-does" className="scroll-mt-24 py-24 sm:py-32">
      <Container>
        <Reveal>
          <h2 className="display max-w-[24ch] text-[clamp(1.6rem,2.6vw,2.15rem)] text-ink text-balance">
            You import your list. casdey does the rest.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-graphite text-pretty">
            Not a dashboard telling you who to chase. It writes to every one of
            them itself, follows up when they go quiet, answers the replies in
            your name, and books them in.
          </p>

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
