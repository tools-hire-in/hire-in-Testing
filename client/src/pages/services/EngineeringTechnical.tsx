import { useState } from "react";
import { Link } from "wouter";
import { Wrench, Factory, Zap, Cog, ArrowRight, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultationModal } from "@/components/forms/ConsultationModal";

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Engineering & Technical Staffing",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "Engineering Staffing",
  description: "Hire'in Solutions sources and places mechanical, electrical, civil, and technical engineers for contract and direct-hire roles across the United States.",
  areaServed: { "@type": "Country", name: "United States" },
};

export default function EngineeringTechnical() {
  useSEO({
    title: "Engineering & Technical Staffing | Hire'in Solutions",
    description:
      "Hire'in Solutions sources and places mechanical, electrical, civil, and technical engineers for contract and direct-hire roles across industries.",
    canonical: "https://hire-in.com/services/engineering-technical",
  });
  const [consultationOpen, setConsultationOpen] = useState(false);

  const disciplines = [
    { icon: Factory, title: "Manufacturing & Industrial", items: ["Industrial Engineers", "Manufacturing Engineers", "Process Engineers", "Quality Engineers"] },
    { icon: Zap, title: "Electrical & Electronics", items: ["Electrical Engineers", "Electronics Engineers", "Control Systems Engineers", "Embedded Systems"] },
    { icon: Cog, title: "Mechanical Engineering", items: ["Mechanical Engineers", "Design Engineers", "CAD/CAM Specialists", "Project Engineers"] },
    { icon: Wrench, title: "Civil & Structural", items: ["Civil Engineers", "Structural Engineers", "Construction Managers", "Site Engineers"] },
  ];

  return (
    <Layout>
      <SchemaHead schema={SERVICE_SCHEMA} />
      {/* Hero */}
      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge className="mb-6" variant="secondary">
            <Wrench className="h-3.5 w-3.5 mr-1" />
            Engineering & Technical
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Engineering Excellence, Delivered
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            From manufacturing floors to design offices, we source skilled engineering
            professionals across all core disciplines with rigorous technical vetting.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)}>
              Hire Engineers
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setConsultationOpen(true)}>
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>

      {/* Disciplines */}
      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Engineering Disciplines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {disciplines.map((disc) => (
              <Card key={disc.title} className="hover-elevate">
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <disc.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{disc.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {disc.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 lg:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Build Your Engineering Team</h2>
          <p className="text-primary-foreground/80 mb-8">
            Find skilled engineers who can drive your projects forward.
          </p>
          <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)}>
            Get Started
          </Button>
        </div>
      </section>

      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        ctaType="header-start-hiring"
      />
    </Layout>
  );
}
