import { COMMERCIAL_CLIENTS, type ClientEntry } from "@/lib/contracts";

const NAVY = "#1F3A6E";

function ClientLogo({ client }: { client: ClientEntry }) {
  return (
    <div
      className="flex shrink-0 items-center px-6"
      data-testid={`client-strip-${client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`}
    >
      {client.logo ? (
        <img
          src={client.logo}
          alt={`${client.name} logo`}
          loading="lazy"
          className="max-h-10 max-w-[120px] object-contain"
        />
      ) : (
        <span
          className="text-sm font-extrabold tracking-tight whitespace-nowrap"
          style={{ color: NAVY }}
          aria-label={`${client.name} wordmark`}
        >
          {client.name}
        </span>
      )}
    </div>
  );
}

export function ClientsStrip() {
  const marqueeClients = [...COMMERCIAL_CLIENTS, ...COMMERCIAL_CLIENTS];

  return (
    <section className="py-6 px-4 lg:px-6 border-y border-border/50" data-testid="section-clients-strip">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center gap-6">
          <span
            className="shrink-0 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground whitespace-nowrap"
            data-testid="text-clients-strip-label"
          >
            Trusted by
          </span>
          <div
            className="clients-marquee group relative flex-1 overflow-hidden"
            data-testid="marquee-clients-strip"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
            <div className="clients-marquee-track py-1">
              {marqueeClients.map((client, i) => (
                <ClientLogo key={`${client.name}-${i}`} client={client} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
