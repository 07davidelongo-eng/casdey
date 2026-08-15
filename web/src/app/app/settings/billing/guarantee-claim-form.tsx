"use client";

import { useState } from "react";

import { Button } from "@/components/app/ui";

/**
 * Two clicks, not one: the first arms it, the second actually fires the
 * refund. The same shape as the patient-data purge form in
 * ../data/purge-form.tsx, just without a typed confirmation — this returns
 * the practice's own money to them, so the stakes (and the friction) are
 * lower than permanently deleting patient data.
 */
export function GuaranteeClaimForm() {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button type="button" variant="primary" onClick={() => setArmed(true)}>
        Claim your refund
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action="/api/guarantee/claim" method="post">
        <Button type="submit" variant="primary">
          Yes, refund me
        </Button>
      </form>
      <Button type="button" variant="ghost" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </div>
  );
}
