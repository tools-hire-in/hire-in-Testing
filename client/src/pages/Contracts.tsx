import { Link } from "wouter";
import { Landmark, ShieldCheck, ArrowRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { CONTRACT_GROUPS, COMMERCIAL_CLIENTS, type ClientEntry } from "@/lib/contracts";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";

function ClientLogo({ client }: { client: ClientEntry }) {
  return (
    <div
      className="flex w-44 shrink-0 flex-col items-center gap-3 px-4"
      data-testid={`client-${client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
    >
      <div className="flex h-20 w-full items-center justify-center rounded-xl border bg-white p-3 shadow-sm transition-all duration-300 group-hover:shadow-md">
        {client.logo ? (
          <img
            src={client.logo}
            alt={`${client.name} logo`}
            loading="lazy"
            className="max-h-14 max-w-full object-contain grayscale transition-all duration-300 hover:grayscale-0"
          />
        ) : (
          <span
            className="text-center text-lg font-extrabold tracking-tight"
            style={{ color: NAVY }}
            aria-label={`${client.name} logo`}
          >
            {client.name}
          </span>
        )}
      </div>
      <span className="text-center text-xs font-medium text-muted-foreground">
        {client.name}
      </span>
    </div>
  );
}

export default function Contracts() {
  useSEO({
    title: "Contracts & Clients | Hire'in Solutions",
    description:
      "Explore Hire'in Solutions' contract vehicles and engagements — including the State of Texas DIR IT Staff Augmentation Contract (ITSAC) — and the commercial clients we proudly serve.",
  });

  // Duplicate the client list so the marquee scroll loops seamlessly.
  const marqueeClients = [...COMMERCIAL_CLIENTS, ...COMMERCIAL_CLIENTS];

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

      {/* Clients */}
      <section className="bg-muted/30 px-4 py-16 lg:px-6 lg:py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p
              className="mb-3 text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: ORANGE }}
              data-testid="text-clients-eyebrow"
            >
              // Clients
            </p>
            <h2 className="mb-3 text-3xl font-bold md:text-4xl" data-testid="text-clients-title">
              Trusted by Leading Organizations
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              We've delivered talent and staffing solutions for commercial clients
              across technology, healthcare, banking, and professional services.
            </p>
          </div>

          <div
            className="clients-marquee group relative overflow-hidden"
            data-testid="marquee-clients"
          >
            {/* edge fades */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-muted/30 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-muted/30 to-transparent" />
            <div className="clients-marquee-track py-2">
              {marqueeClients.map((client, i) => (
                <ClientLogo key={`${client.name}-${i}`} client={client} />
              ))}
            </div>
          </div>
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
