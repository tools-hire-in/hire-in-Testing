import { Link } from "wouter";
import { Landmark, ShieldCheck, ArrowRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { CONTRACT_GROUPS } from "@/lib/contracts";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";

export default function Contracts() {
  useSEO({
    title: "Contracts & Clients | Hire'in Solutions",
    description:
      "Explore Hire'in Solutions' contract vehicles and engagements — including the State of Texas DIR IT Staff Augmentation Contract (ITSAC) — and the commercial clients we proudly serve.",
    canonical: "https://hire-in.com/contracts",
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-primary/5 via-background to-primary/10 px-4 py-20 lg:px-6 lg:py-28">
        <div className="container mx-auto max-w-5xl">
          <p
            className="mb-4 text-xs font-bold uppercase tracking-[0.25em]"
            style={{ color: ORANGE }}
            data-testid="text-contracts-eyebrow"
          >
            // Contracts
          </p>
          <h1
            className="mb-6 text-4xl font-bold md:text-5xl lg:text-6xl"
            data-testid="text-contracts-title"
          >
            Contracts
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Hire'in Solutions partners with government agencies and leading
            commercial organizations to deliver compliant, high-quality staffing.
            Below are our active contract vehicles and the clients we serve.
          </p>
        </div>
      </section>

      {/* Contract groups */}
      <section className="px-4 py-16 lg:px-6 lg:py-20">
        <div className="container mx-auto max-w-5xl space-y-14">
          {CONTRACT_GROUPS.map((group) => (
            <div key={group.category} data-testid={`group-${group.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}>
              <div className="mb-6 flex items-center gap-2">
                <Landmark className="h-5 w-5" style={{ color: ORANGE }} />
                <h2
                  className="text-sm font-bold uppercase tracking-widest"
                  style={{ color: NAVY }}
                >
                  {group.category}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {group.entries.map((entry) => (
                  <div
                    key={entry.title}
                    className="hover-elevate flex flex-col rounded-2xl border bg-white p-6 shadow-sm"
                    data-testid={`card-contract-${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
                  >
                    <div className="mb-4 flex h-16 items-center">
                      <img
                        src={entry.logo}
                        alt={`${entry.agency} logo`}
                        className="max-h-14 max-w-[180px] object-contain"
                      />
                    </div>
                    <h3 className="mb-2 text-lg font-bold leading-snug" style={{ color: NAVY }}>
                      {entry.title}
                    </h3>
                    <p className="mb-3 text-sm font-medium text-muted-foreground">
                      {entry.agency}
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <ShieldCheck className="h-4 w-4" style={{ color: ORANGE }} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {entry.detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 lg:px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            Looking for a staffing partner?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Whether you're a government agency or a commercial enterprise, our team
            is ready to support your workforce needs.
          </p>
          <Button asChild size="lg" data-testid="button-contracts-cta">
            <Link href="/request-a-quote">
              Request a Quote
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
