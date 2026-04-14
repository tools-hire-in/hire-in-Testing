import { useState } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import type { CTAType } from "@/lib/constants";

interface LayoutProps {
  children: React.ReactNode;
  hideFooter?: boolean;
  transparentHeader?: boolean;
}

export function Layout({ children, hideFooter = false, transparentHeader = false }: LayoutProps) {
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [ctaType, setCtaType] = useState<CTAType>("header-start-hiring");

  const handleOpenConsultation = (type: string) => {
    setCtaType(type as CTAType);
    setConsultationOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header onOpenConsultation={handleOpenConsultation} transparent={transparentHeader} />
      <main className={`flex-1 ${transparentHeader ? "" : "pt-16"}`}>{children}</main>
      {!hideFooter && <Footer />}
      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        ctaType={ctaType}
      />
    </div>
  );
}
