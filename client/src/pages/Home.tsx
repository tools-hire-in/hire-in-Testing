import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { HeroCarousel } from "@/components/sections/HeroCarousel";
import { AboutSection } from "@/components/sections/AboutSection";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { WhyChooseUsSection } from "@/components/sections/WhyChooseUsSection";
import { ClientsStrip } from "@/components/sections/ClientsStrip";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import { useSEO } from "@/hooks/use-seo";
import type { CTAType } from "@/lib/constants";

export default function Home() {
  useSEO({
    title: "Hire'in Solutions | AI-Powered Recruitment & Staffing Agency",
    description:
      "Hire'in Solutions connects top employers with skilled candidates across Healthcare, IT, Engineering, and Professional Services. Start hiring or find your next role today.",
    canonical: "https://hire-in.com/",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);
  const [ctaType, setCtaType] = useState<CTAType>("hero-start-hiring");

  const openConsultation = (type: CTAType) => {
    setCtaType(type);
    setConsultationOpen(true);
  };

  return (
    <Layout transparentHeader>
      <HeroCarousel
        onStartHiring={() => openConsultation("hero-start-hiring")}
        onApplyNow={() => openConsultation("hero-apply-now")}
      />
      <AboutSection />
      <ServicesSection />
      <WhyChooseUsSection />
      <ClientsStrip />
      <HowItWorksSection onStartHiring={() => openConsultation("hero-start-hiring")} />
      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        ctaType={ctaType}
      />
    </Layout>
  );
}
