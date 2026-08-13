import { supabaseAdmin } from "@/lib/supabase";
import { UnsubscribeForm } from "./form";

import "@/styles/product.css";

export const metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/**
 * Where the link at the bottom of every patient email goes.
 *
 * Public by design. The page tells them which practice this is about before
 * they confirm, so they are not choosing blind, and confirmation is a POST
 * rather than the page load itself: mail scanners follow links automatically,
 * and a GET that unsubscribes would take people off lists they never asked to
 * leave.
 */
export default async function UnsubscribePage(
  props: PageProps<"/u/[token]">,
) {
  const { token } = await props.params;

  const { data } = await supabaseAdmin()
    .from("campaign_messages")
    .select("practice_id, practices ( name )")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  // The embed is typed as an array even though the foreign key makes it one row.
  const practices = data?.practices as { name?: string }[] | { name?: string } | null | undefined;
  const practiceName = Array.isArray(practices)
    ? practices[0]?.name
    : practices?.name;

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-5 py-14">
      <div className="w-full max-w-[30rem]">
        {!data ? (
          <div className="card p-7">
            <h1 className="display text-[1.375rem]">This link is not valid</h1>
            <p className="mt-3 text-[0.9375rem] text-graphite">
              It may have already been used. If you are still getting emails you
              do not want, reply to one of them and say so, and it will stop.
            </p>
          </div>
        ) : (
          <UnsubscribeForm
            token={token}
            practiceName={practiceName ?? "this practice"}
          />
        )}
      </div>
    </div>
  );
}
