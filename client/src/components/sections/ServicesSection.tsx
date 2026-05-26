import { Link } from "wouter";
import { Heart, Code, Briefcase, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SERVICES } from "@/lib/constants";

const iconMap: Record<string, React.ElementType> = {
  Heart,
  Code,
  Briefcase,
};

export function ServicesSection() {
  return (
    <section className="py-20 px-4 lg:px-6 bg-muted/30" data-testid="section-services">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">Our Services</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Specialized talent solutions across three critical sectors, delivering vetted
            professionals who drive your success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SERVICES.map((service) => {
            const Icon = iconMap[service.icon];
            return (
              <Card
                key={service.id}
                className={`h-full flex flex-col hover-elevate transition-all duration-300 ${
                  service.priority
                    ? "border-primary/50 shadow-md ring-1 ring-primary/20"
                    : ""
                }`}
                data-testid={`card-service-${service.id}`}
              >
                <CardHeader className="pb-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
                      service.priority
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  {service.priority && (
                    <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full w-fit mb-2">
                      Priority Service
                    </span>
                  )}
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="text-muted-foreground mb-4 leading-relaxed">
                    {service.description}
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {service.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/services/${service.slug}`} aria-label={`Learn more about ${service.title}`}>
                    <Button variant="outline" className="w-full group">
                      Learn More
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
