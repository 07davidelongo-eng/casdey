import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Overview } from "@/components/sections/overview";
import { WhyCasdey } from "@/components/sections/why-casdey";
import { HowItWorks } from "@/components/sections/how-it-works";
import { PatientData } from "@/components/sections/patient-data";
import { Offer } from "@/components/sections/offer";
import { CtaBand } from "@/components/sections/cta-band";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Overview />
        <WhyCasdey />
        <HowItWorks />
        <PatientData />
        <Offer />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
