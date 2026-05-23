import { useState } from "react";
import { Link } from "wouter";
import { Lightbulb, Shield, Heart, Award, ArrowRight, Calendar, Users, Target } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConsultationModal } from "@/components/forms/ConsultationModal";
import { VALUES, METRICS, COMPANY } from "@/lib/constants";
import type { CTAType } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  Lightbulb,
  Shield,
  Heart,
  Award,
};

export default function About() {
  useSEO({
    title: "About Us | Hire'in Solutions",
    description:
      "Learn about Hire'in Solutions — our mission, values, and the team behind our AI-powered recruitment services for Healthcare, IT, Engineering, and Professional Services.",
  });

  const [consultationOpen, setConsultationOpen] = useState(false);
  const [ctaType, setCtaType] = useState<CTAType>("header-start-hiring");

  const openConsultation = (type: CTAType) => {
    setCtaType(type);
    setConsultationOpen(true);
  };

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" data-testid="text-about-hero-title">
            Revolutionizing Recruitment: Where AI Meets Human Intuition
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
            {COMPANY.name} is a comprehensive recruitment firm that combines AI-powered matching
            with human expertise. While we excel across all industries, our healthcare
            recruitment capabilities and medical credentialing expertise make us the preferred
            partner for medical organizations.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              onClick={() => openConsultation("header-start-hiring")}
              data-testid="button-about-start-journey"
            >
              Start Your Journey
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#story">Our Story</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Company Story Section */}
      <section id="story" className="py-20 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Born from Recruitment Crisis, Powered by Innovation
            </h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-xl font-semibold text-primary mb-4">The Challenge We Saw</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Organizations across IT, Healthcare, Engineering, and other critical sectors
                were struggling with talent shortages. Skilled professionals were available,
                but the recruitment process was slow, inefficient, and often missed the
                perfect matches.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Businesses were losing competitive edge, and the industry needed a revolution.
                We realized that while technology could dramatically improve efficiency and
                accuracy, it could never replace the human touch that makes recruitment truly
                successful. That's when {COMPANY.name} was born.
              </p>
            </div>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h4 className="font-semibold text-primary mb-2">Our Mission</h4>
                  <p className="text-muted-foreground">
                    Empowering recruiters with AI while preserving human connection
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Our Vision</h4>
                  <p className="text-muted-foreground">
                    Creating the most transparent, efficient hiring universe
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-primary mb-2">Our Purpose</h4>
                  <p className="text-muted-foreground">
                    Full-service recruitment firm with expertise in healthcare and IT talent acquisition
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 px-4 lg:px-6 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Values That Drive Us</h2>
            <p className="text-lg text-muted-foreground">
              Every decision we make is guided by these four fundamental principles
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((value) => {
              const Icon = iconMap[value.icon];
              return (
                <Card key={value.title} className="text-center hover-elevate">
                  <CardContent className="pt-8 pb-6">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 lg:px-6 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Progress</h2>
            <p className="text-primary-foreground/80">
              Building meaningful connections between talent and opportunity since 2014.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <Calendar className="h-10 w-10 mx-auto mb-4 opacity-80" />
              <div className="text-5xl font-bold mb-2">{METRICS.yearsInBusiness}</div>
              <div className="text-primary-foreground/80">Years in Business</div>
            </div>
            <div className="text-center">
              <Users className="h-10 w-10 mx-auto mb-4 opacity-80" />
              <div className="text-5xl font-bold mb-2">{METRICS.clientRetention}</div>
              <div className="text-primary-foreground/80">Client Retention Rate</div>
            </div>
            <div className="text-center">
              <Target className="h-10 w-10 mx-auto mb-4 opacity-80" />
              <div className="text-5xl font-bold mb-2">{METRICS.aiAccuracy}</div>
              <div className="text-primary-foreground/80">AI Accuracy Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Partners Section */}
      <section className="py-20 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Technology Excellence</h2>
            <p className="text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              We partner with industry-leading AI platforms to deliver smarter, faster recruitment outcomes.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* kleriq.AI Card */}
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">kleriq.AI</h3>
                    <span className="text-sm text-muted-foreground">All Staffing Services</span>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Our core AI platform for smart resume matching and job simplification. kleriq.AI powers our data enrichment, candidate flagging, and intelligent matching across IT, Engineering, and Professional Services placements.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Smart Resume Matching
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Job Simplification & Analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Candidate Data Enrichment
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Automated Flag Raising
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* CredentialRx.ai Card */}
            <Card className="hover-elevate">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">CredentialRx.ai</h3>
                    <span className="text-sm text-muted-foreground">Healthcare Compliance</span>
                  </div>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Specialized healthcare credentialing platform that streamlines medical credential verification. This partnership ensures faster, more accurate compliance verification for all healthcare placements.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Medical License Verification
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Credential Tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Compliance Monitoring
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Healthcare-Specific Vetting
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-10">
            <Button variant="outline" onClick={() => openConsultation("header-start-hiring")}>
              Learn More About Our Process
            </Button>
          </div>
        </div>
      </section>

      <ConsultationModal
        open={consultationOpen}
        onOpenChange={setConsultationOpen}
        ctaType={ctaType}
      />
    </Layout>
  );
}
