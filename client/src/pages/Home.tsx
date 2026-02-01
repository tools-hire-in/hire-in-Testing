import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { HeroCarousel } from "@/components/sections/HeroCarousel";
import { AboutSection } from "@/components/sections/AboutSection";
import { ServicesSection } from "@/components/sections/ServicesSection";
import { WhyChooseUsSection } from "@/components/sections/WhyChooseUsSection";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import type { CTAType } from "@/lib/constants";

export default function Home() {
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [ctaType, setCtaType] = useState<CTAType>("hero-start-hiring");

  const openConsultation = (type: CTAType) => {
    setCtaType(type);
    setConsultationOpen(true);
  };

  return (
    <Layout>
      <HeroCarousel
        onStartHiring={() => openConsultation("hero-start-hiring")}
        onApplyNow={() => openConsultation("hero-apply-now")}
      />
      <AboutSection />
      <ServicesSection />
      <WhyChooseUsSection />
      <HowItWorksSection onStartHiring={() => openConsultation("hero-start-hiring")} />
      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        ctaType={ctaType}
      />
    </Layout>
  );
}
