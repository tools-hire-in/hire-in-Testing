import { Brain, Share2, Shield, Eye, Award, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FEATURES, METRICS } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  Brain,
  Share2,
  Shield,
  Eye,
  Award,
  Clock,
};

export function WhyChooseUsSection() {
  const metrics = [
    { value: METRICS.clientSatisfaction, label: "Client Satisfaction", icon: "Award" },
    { value: METRICS.fasterPlacements, label: "Faster Placements", icon: "Clock" },
    { value: METRICS.healthcareCompliance, label: "Healthcare Compliance", icon: "Shield" },
  ];

  return (
    <section className="py-20 px-4 lg:px-6" data-testid="section-why-choose">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Why Choose Hire'in Solutions?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Where cutting-edge AI meets human expertise to deliver perfect talent matches
            for your organization.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon];
            return (
              <Card key={feature.title} className="text-center hover-elevate">
                <CardContent className="pt-8 pb-6">
                  <Badge variant="secondary" className="mb-4">
                    {feature.badge}
                  </Badge>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Proven Results */}
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold mb-2">Proven Results That Speak for Themselves</h3>
          <p className="text-muted-foreground">
            Our AI-human hybrid approach delivers measurable success
          </p>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric) => {
            const Icon = iconMap[metric.icon];
            return (
              <Card
                key={metric.label}
                className="text-center bg-primary/5 border-primary/20"
              >
                <CardContent className="py-8">
                  <Icon className="h-8 w-8 text-primary mx-auto mb-4" />
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {metric.value}
                  </div>
                  <div className="text-muted-foreground font-medium">{metric.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
