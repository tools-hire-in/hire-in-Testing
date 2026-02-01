import { useState } from "react";
import { Briefcase, TrendingUp, Users, Building, ArrowRight, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultationModal } from "@/components/forms/ConsultationModal";

export default function ProfessionalServices() {
  const [consultationOpen, setConsultationOpen] = useState(false);

  const categories = [
    { icon: TrendingUp, title: "Finance & Accounting", items: ["Accountants", "Financial Analysts", "Controllers", "Tax Specialists"] },
    { icon: Users, title: "Human Resources", items: ["HR Managers", "Recruiters", "Compensation Specialists", "Training Managers"] },
    { icon: Building, title: "Operations & Admin", items: ["Operations Managers", "Project Managers", "Executive Assistants", "Office Managers"] },
    { icon: Briefcase, title: "Marketing & Sales", items: ["Marketing Managers", "Sales Directors", "Account Executives", "Business Development"] },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge className="mb-6" variant="secondary">
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            Professional Services
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Business Professionals, Expertly Matched
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            Skilled professionals in finance, HR, marketing, operations, and administrative
            roles. Rigorous screening tailored to each industry, ensuring the right fit for
            every critical role.
          </p>
          <Button size="lg" onClick={() => setConsultationOpen(true)}>
            Find Professionals
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Professional Roles We Fill</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat) => (
              <Card key={cat.title} className="hover-elevate">
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <cat.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{cat.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {cat.items.map((item) => (
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
          <h2 className="text-3xl font-bold mb-4">Strengthen Your Business Team</h2>
          <p className="text-primary-foreground/80 mb-8">
            Find professionals who can drive your business operations forward.
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
