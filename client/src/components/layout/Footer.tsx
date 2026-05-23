import { Link } from "wouter";
import { Linkedin, Shield, Lock, Award, CheckCircle, MapPin } from "lucide-react";
import { COMPANY, CONTACT, COMPLIANCE_BADGES } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

const iconMap: Record<string, React.ElementType> = {
  Shield,
  Lock,
  Award,
  CheckCircle,
};

export function Footer() {
  return (
    <footer className="bg-card border-t">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 lg:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Company Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logoImage}
                alt="Hire'in Solutions"
                className="h-12 w-12 rounded-md object-cover"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold text-primary">Hire'in</span>
                  <span className="text-xl font-medium text-muted-foreground">Solutions</span>
                </div>
                <span className="text-xs text-muted-foreground">{COMPANY.brandLine}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              {COMPANY.tagline}. Transforming careers and empowering businesses through
              AI-powered recruitment solutions for Healthcare, IT, and Professional Services.
            </p>
            <div className="flex items-center gap-4">
              <a
                href={CONTACT.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Hire'in Solutions on LinkedIn"
                className="text-muted-foreground hover:text-primary transition-colors"
                data-testid="link-linkedin"
              >
                <Linkedin className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-about"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-jobs"
                >
                  Browse Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  data-testid="link-contact"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Our Offices */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Our Offices</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              <div className="flex items-start gap-2" data-testid="text-office-us">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">United States</p>
                  <p className="text-xs text-muted-foreground">
                    {CONTACT.address.city}, {CONTACT.address.state}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2" data-testid="text-office-india">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">India</p>
                  <p className="text-xs text-muted-foreground">
                    {CONTACT.addressIndia.city}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Services</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/services/healthcare-recruitment"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Healthcare Recruitment
                </Link>
              </li>
              <li>
                <Link
                  href="/services/it-software"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  IT & Software Development
                </Link>
              </li>
              <li>
                <Link
                  href="/services/engineering-technical"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Engineering & Technical
                </Link>
              </li>
              <li>
                <Link
                  href="/services/non-it-professional"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Professional Services
                </Link>
              </li>
              <li>
                <Link
                  href="/services/contract-staffing"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Contract Staffing
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Compliance Badges */}
      <div className="border-t border-b">
        <div className="container mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-wrap items-center justify-center gap-4">
            {COMPLIANCE_BADGES.map((badge) => {
              const Icon = iconMap[badge.icon];
              return (
                <div
                  key={badge.title}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border ${badge.bgColor} ${badge.borderColor}`}
                >
                  <Icon className={`h-4 w-4 ${badge.textColor}`} />
                  <span className={`text-xs font-medium ${badge.textColor}`}>{badge.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="container mx-auto px-4 lg:px-6 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; 2025 {COMPANY.name}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:text-primary transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
