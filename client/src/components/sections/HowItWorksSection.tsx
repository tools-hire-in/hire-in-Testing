import { FileText, Brain, Users, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { STEPS } from "@/lib/constants";

const stepIcons = [FileText, Brain, Users, CheckCircle];

interface HowItWorksSectionProps {
  onStartHiring?: () => void;
}

export function HowItWorksSection({ onStartHiring }: HowItWorksSectionProps) {
  return (
    <section className="py-12 px-4 lg:px-6 bg-muted/30" data-testid="section-how-it-works">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Our proven 4-step process combines AI efficiency with human expertise to deliver
            exceptional results
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {STEPS.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <Card key={step.number} className="relative overflow-hidden hover-elevate">
                <CardContent className="pt-5 pb-4">
                  {/* Step Number */}
                  <div className="absolute -top-2 -right-2 w-16 h-16 flex items-center justify-center">
                    <span className="text-6xl font-bold text-primary/10">{step.number}</span>
                  </div>

                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>

                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    {step.description}
                  </p>

                  {/* Highlight */}
                  <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground">{step.highlight}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-6 md:p-8">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Experience the Difference?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Let our AI-human hybrid approach find your perfect candidates faster than ever
            before.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" onClick={onStartHiring} data-testid="button-cta-start-hiring">
              Start Hiring Now
            </Button>
            <Button size="lg" variant="outline" onClick={onStartHiring}>
              Schedule Consultation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
