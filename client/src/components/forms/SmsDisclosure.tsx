import { Link } from "wouter";

interface SmsDisclosureProps {
  className?: string;
}

export function SmsDisclosure({ className }: SmsDisclosureProps) {
  return (
    <p
      className={className ?? "text-xs text-muted-foreground"}
      data-testid="text-sms-disclosure"
    >
      By providing a telephone number and submitting this form, you consent to
      receive SMS text messages from Hire'in Solutions related to your inquiry,
      application, interview coordination, credential/document follow-up,
      onboarding, or staffing support. Message frequency may vary. Message and
      data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent
      is not a condition of purchase or employment consideration. See our{" "}
      <Link href="/privacy" className="text-primary hover:underline">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
