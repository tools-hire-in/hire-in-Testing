import { useState } from "react";
import { useSEO } from "@/hooks/use-seo";
import { Link } from "wouter";
import { Code, Brain, Globe, Shield, Cloud, Database, Lock, ArrowRight, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsultationModal } from "@/components/forms/ConsultationModal";

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "IT & Software Development Staffing",
  provider: { "@type": "Organization", name: "Hire'in Solutions", url: "https://hire-in.com" },
  serviceType: "IT Staffing",
  description: "Full-spectrum IT and software development staffing — engineers, DevOps, cloud, data, cybersecurity. AI-powered matching with kleriq.AI. 24-hour first candidate submissions.",
  areaServed: { "@type": "Country", name: "United States" },
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://hire-in.com/" },
    { "@type": "ListItem", position: 2, name: "Services", item: "https://hire-in.com/services" },
    { "@type": "ListItem", position: 3, name: "IT & Software Staffing", item: "https://hire-in.com/services/it-software" },
  ],
};

export default function ITSoftware() {
  useSEO({
    title: "IT & Software Development Staffing | Hire'in Solutions",
    description:
      "Find top IT and software development talent with Hire'in Solutions. We staff engineers, developers, architects, and technology leaders for contract and permanent roles.",
    canonical: "https://hire-in.com/services/it-software",
  });
  const [consultationOpen, setConsultationOpen] = useState(false);

  const specializations = [
    { icon: Code, title: "Software Engineering", items: ["Full-Stack Developers", "Frontend/Backend Specialists", "Mobile Developers", "QA Engineers"] },
    { icon: Cloud, title: "DevOps & Cloud", items: ["Cloud Architects", "DevOps Engineers", "Site Reliability Engineers", "Platform Engineers"] },
    { icon: Database, title: "Data & AI", items: ["Data Scientists", "ML Engineers", "Data Analysts", "AI Researchers"] },
    { icon: Lock, title: "Cybersecurity", items: ["Security Engineers", "Penetration Testers", "Security Analysts", "Compliance Specialists"] },
  ];

  return (
    <Layout>
      <SchemaHead schema={[SERVICE_SCHEMA, BREADCRUMB_SCHEMA]} />
      {/* Hero */}
      <section className="py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <Badge className="mb-6" variant="secondary">
            <Code className="h-3.5 w-3.5 mr-1" />
            IT & Software Development
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Elite Tech Talent, Faster
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            Full-spectrum IT hiring — software engineers, DevOps, cloud, data, cybersecurity.
            From startups to enterprises, we deliver modern technical talent, pre-vetted for
            both hard and soft skills.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={() => setConsultationOpen(true)}>
              Hire Tech Talent
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setConsultationOpen(true)}>
              Schedule Consultation
            </Button>
          </div>
        </div>
      </section>

      {/* Specializations */}
      <section className="py-16 px-4 lg:px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Our IT Specializations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {specializations.map((spec) => (
              <Card key={spec.title} className="hover-elevate">
                <CardHeader className="pb-2">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <spec.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{spec.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {spec.items.map((item) => (
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

      {/* Tech Stack Expertise */}
      <section className="py-16 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">Technologies We Recruit For</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {["React", "Node.js", "Python", "AWS", "Azure", "Kubernetes", "TypeScript", "Go", "Rust", "PostgreSQL", "MongoDB", "Docker"].map((tech) => (
              <div key={tech} className="bg-card rounded-lg p-4 text-center border hover-elevate">
                <span className="font-medium">{tech}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 lg:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-4">Scale Your Tech Team</h2>
          <p className="text-primary-foreground/80 mb-8">
            Whether you're a startup or enterprise, we help you find the technical talent you need.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" onClick={() => setConsultationOpen(true)}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/jobs">View Tech Jobs</Link>
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
