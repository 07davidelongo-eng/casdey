import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { WhyCasdey } from "@/components/sections/why-casdey";
import { HowItWorks } from "@/components/sections/how-it-works";
import { MemberRecord } from "@/components/sections/member-record";
import { MemberData } from "@/components/sections/member-data";
import { Offer } from "@/components/sections/offer";
import { CtaBand } from "@/components/sections/cta-band";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <WhyCasdey />
        <HowItWorks />
        <MemberRecord />
        <MemberData />
        <Offer />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
