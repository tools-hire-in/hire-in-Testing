import { useState } from "react";
import { Link } from "wouter";
import {
  Heart,
  Shield,
  Clock,
  Award,
  Brain,
  FileSearch,
  CheckCircle,
  Users,
  Stethoscope,
  Activity,
  ArrowRight,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import type { CTAType } from "@/lib/constants";

export default function HealthcareRecruitment() {
  useSEO({
    title: "Healthcare Recruitment Services | Hire'in Solutions",
    description:
      "Hire'in Solutions places qualified healthcare professionals — nurses, physicians, allied health staff — quickly and compliantly. Partner with us for your clinical staffing needs.",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);

  const valueProps = [
    { icon: Shield, title: "Joint Commission-Aligned", description: "Workflows built around TJC standards" },
    { icon: Clock, title: "Rapid Placement", description: "Fill critical positions faster" },
    { icon: Award, title: "Quality Guarantee", description: "98% first-year retention rate" },
  ];

  const aiTools = [
    { title: "Resume Parsing & Analysis", description: "Advanced NLP extracts medical credentials, certifications, and specializations" },
    { title: "Compliance Verification", description: "Automated licensing and credential checks across all 50 states" },
    { title: "Skills Matching", description: "Matches clinical specializations, EMR experience, and procedure competencies" },
    { title: "Telehealth Screening", description: "Evaluates remote care capabilities and virtual patient interaction skills" },
  ];

  const humanTouch = [
    { title: "Cultural Fit Assessment", description: "Understanding bedside manner and team dynamics" },
    { title: "Clinical Interview Coaching", description: "Preparing candidates for medical scenario discussions" },
    { title: "Career Guidance", description: "Personalized advice on specialization paths and career growth" },
    { title: "Onboarding Support", description: "Smooth transition assistance for new placements" },
  ];

  const successStories = [
    { client: "Regional Medical Center", result: "52 nurses in 28 days", metric: "98% retention" },
    { client: "Telehealth Startup", result: "25 positions in 3 weeks", metric: "200% capacity growth" },
    { client: "Children's Hospital", result: "100% compliance rate", metric: "60% faster time-to-hire" },
  ];

  const roles = {
    "Clinical Staff": ["RNs", "LPNs", "CNAs", "Medical Assistants"],
    "Physicians": ["Primary Care", "Specialists", "Hospitalists", "Emergency Medicine"],
    "Allied Health": ["Physical Therapists", "Occupational Therapists", "Respiratory Therapists", "Medical Technologists"],
    "Healthcare Operations": ["Administrators", "Medical Records", "Quality Assurance", "Compliance Officers"],
    "Telehealth": ["Remote Care Physicians", "Telehealth Nurses", "Virtual Care Specialists"],
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge className="mb-6" variant="secondary">
            <Heart className="h-3.5 w-3.5 mr-1" />
            Healthcare Recruitment
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            AI-Powered Healthcare Talent Solutions
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            Combining advanced AI screening with deep healthcare expertise to deliver Joint
            Commission compliant, licensed professionals who understand critical care
            environments and patient-centered service.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)}>
              Start Hiring Healthcare Talent
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setConsultationOpen(true)}>
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {valueProps.map((prop) => (
              <Card key={prop.title} className="text-center hover-elevate">
                <CardContent className="pt-8 pb-6">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <prop.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{prop.title}</h3>
                  <p className="text-muted-foreground">{prop.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Tools + Human Touch */}
      <section className="py-16 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* AI Tools */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Brain className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold">AI-Powered Tools</h2>
              </div>
              <div className="space-y-4">
                {aiTools.map((tool) => (
                  <Card key={tool.title}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1">{tool.title}</h3>
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Human Touch */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Users className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold">Human Expertise</h2>
              </div>
              <div className="space-y-4">
                {humanTouch.map((item) => (
                  <Card key={item.title}>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Success Stories</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {successStories.map((story) => (
              <Card key={story.client} className="hover-elevate">
                <CardContent className="p-6">
                  <Badge variant="secondary" className="mb-4">{story.metric}</Badge>
                  <h3 className="font-semibold mb-2">{story.client}</h3>
                  <p className="text-2xl font-bold text-primary">{story.result}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roles We Fill */}
      <section className="py-16 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Roles We Fill</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(roles).map(([category, positions]) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {positions.map((pos) => (
                      <li key={pos} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                        {pos}
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
          <h2 className="text-3xl font-bold mb-4">Ready to Build Your Healthcare Team?</h2>
          <p className="text-primary-foreground/80 mb-8">
            Let our healthcare recruitment specialists find the perfect candidates for your organization.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)}>
              Get Started Today
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/jobs">View Open Positions</Link>
            </Button>
          </div>
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
