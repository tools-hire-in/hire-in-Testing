import { SiLinkedin, SiInstagram, SiFacebook, SiX } from "react-icons/si";
import { Mail } from "lucide-react";

const SOCIAL_LINKS = [
  {
    href: "https://www.linkedin.com/company/hirein-solutions",
    icon: SiLinkedin,
    label: "LinkedIn",
    color: "#0A66C2",
  },
  {
    href: "https://www.instagram.com/hireinsolutions",
    icon: SiInstagram,
    label: "Instagram",
    color: "#E1306C",
  },
  {
    href: "https://www.facebook.com/hireinsolutions",
    icon: SiFacebook,
    label: "Facebook",
    color: "#1877F2",
  },
  {
    href: "https://twitter.com/hireinsolutions",
    icon: SiX,
    label: "X (Twitter)",
    color: "#000000",
  },
];

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";

export function SocialFollowBanner() {
  return (
    <section
      className="rounded-2xl px-6 py-8 flex flex-col sm:flex-row items-center gap-6"
      style={{ background: `${NAVY}08`, border: `1px solid ${NAVY}18` }}
      data-testid="section-social-follow"
    >
      <div className="flex-1 text-center sm:text-left">
        <p
          className="text-sm font-semibold uppercase tracking-widest mb-1"
          style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }}
        >
          Stay connected
        </p>
        <h3
          className="text-lg font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: NAVY }}
        >
          Follow Hire'in Solutions
        </h3>
        <p className="text-sm text-gray-500" style={{ fontFamily: "'Inter', sans-serif" }}>
          Get the latest staffing insights, career tips, and industry updates.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2">
          {SOCIAL_LINKS.map(({ href, icon: Icon, label, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow us on ${label}`}
              title={`Follow Hire'in Solutions on ${label}`}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-transform hover:scale-110"
              style={{ background: `${color}15`, color }}
              data-testid={`link-social-${label.toLowerCase().replace(/[^a-z]/g, "")}`}
            >
              <Icon className="w-5 h-5" />
            </a>
          ))}
        </div>
        <a
          href="#newsletter"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-85"
          style={{ background: ORANGE, color: "#fff", fontFamily: "'Inter', sans-serif", textDecoration: "none" }}
          data-testid="link-subscribe-insights"
        >
          <Mail className="w-4 h-4" />
          Subscribe to Insights
        </a>
      </div>
    </section>
  );
}
