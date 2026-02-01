import { useState } from "react";
import { Clock, FileCheck, Repeat, Scale, ArrowRight, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultationModal } from "@/components/forms/ConsultationModal";

export default function ContractStaffing() {
  const [consultationOpen, setConsultationOpen] = useState(false);

  const benefits = [
    { icon: Clock, title: "Rapid Deployment", description: "Get qualified contractors on-site within days, not weeks" },
    { icon: Scale, title: "Scalable Workforce", description: "Scale up or down based on project demands" },
    { icon: FileCheck, title: "Compliance Handled", description: "We manage all contractor compliance and documentation" },
    { icon: Repeat, title: "Contract-to-Hire", description: "Option to convert contractors to permanent employees" },
  ];

  const industries = ["Healthcare", "IT & Technology", "Engineering", "Finance", "Manufacturing", "Professional Services"];

  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge className="mb-6" variant="secondary">
            <Clock className="h-3.5 w-3.5 mr-1" />
            Contract Staffing
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Flexible Workforce Solutions
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            Short-term projects, seasonal demands, or specialized expertise — our contract
            staffing solutions provide the flexibility you need without compromising on quality.
          </p>
          <Button size="lg" onClick={() => setConsultationOpen(true)}>
            Get Contract Staff
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Why Contract Staffing?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit) => (
              <Card key={benefit.title} className="hover-elevate">
                <CardContent className="flex items-start gap-4 p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{benefit.title}</h3>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industries */}
      <section className="py-16 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Industries We Serve</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {industries.map((industry) => (
              <div key={industry} className="flex items-center gap-2 p-4 bg-card rounded-lg border">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">{industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 lg:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Scale Your Team?</h2>
          <p className="text-primary-foreground/80 mb-8">
            Get the flexibility you need with our contract staffing solutions.
          </p>
          <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)}>
            Contact Us Today
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
