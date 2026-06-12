import { Calendar, Users, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { METRICS } from "@/lib/constants";

export function AboutSection() {
  const stats = [
    { icon: Calendar, value: METRICS.yearsInBusiness, label: "Years Experience" },
    { icon: Users, value: METRICS.clientRetention, label: "Client Retention" },
    { icon: Target, value: METRICS.aiAccuracy, label: "AI Accuracy" },
  ];

  return (
    <section className="py-12 px-4 lg:px-6" data-testid="section-about">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4" data-testid="text-about-title">
            About Hire'in Solutions
          </h2>
          <p className="text-xl text-primary font-medium mb-6">
            AI Meets Human Intuition
          </p>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Founded in 2014, Hire'in Solutions revolutionizes recruitment by combining
            cutting-edge AI technology with experienced human recruiters. We serve Healthcare,
            IT, and Professional sectors with unmatched efficiency and accuracy.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <Card key={stat.label} className="text-center hover-elevate">
              <CardContent className="pt-5 pb-4">
                <stat.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-muted-foreground font-medium">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
