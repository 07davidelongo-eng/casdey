import type { Gym } from "../types";

/**
 * Who a member thinks the message is from.
 *
 * Kept free of "server-only" on purpose: the campaign editor previews the
 * sending identity in the browser, and the rule for choosing it has to be the
 * same one the sender uses, or the preview lies.
 */

export type SendingIdentity = {
  /** Display name shown in the inbox list. */
  name: string;
  /** Envelope address, or null to use casdey's shared domain. */
  address: string | null;
  /** True once the address is on the gym's own verified domain. */
  ownDomain: boolean;
};

/**
 * The From address for a gym's mail.
 *
 * Only a `verified` domain is used. `pending` is the dangerous case and the
 * reason this checks status rather than just presence: the row has a domain
 * the moment setup starts, but DNS may not be in place for hours. Sending from
 * it then is worse than sending from casdey, because unauthenticated mail on
 * the gym's own domain is what spam filters punish hardest, and it damages a
 * domain reputation that belongs to the customer, not to us.
 */
export function sendingIdentity(gym: Gym): SendingIdentity {
  const name = gym.sender_name ?? gym.name;

  if (gym.sending_domain && gym.sending_domain_status === "verified") {
    const local = gym.sending_from_local || "hello";
    return { name, address: `${local}@${gym.sending_domain}`, ownDomain: true };
  }

  return { name, address: null, ownDomain: false };
}
