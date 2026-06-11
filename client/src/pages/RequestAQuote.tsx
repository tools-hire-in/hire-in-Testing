import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SchemaHead } from "@/components/SchemaHead";
import { useSEO } from "@/hooks/use-seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CONTACT } from "@/lib/constants";

const SERVICE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Staffing Services Quote Request",
  provider: {
    "@type": "Organization",
    name: "Hire'in Solutions",
    url: "https://hire-in.com",
  },
  serviceType: "Staffing and Recruitment",
  description:
    "Request a staffing quote from Hire'in Solutions for IT, Healthcare, Engineering, or Professional Services roles. Receive a response within one business day.",
  offers: {
    "@type": "Offer",
    url: "https://hire-in.com/request-a-quote",
    description: "Request a custom staffing quote for contract, contract-to-hire, or permanent placement.",
  },
};

const quoteFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  company: z.string().min(1, "Company name is required"),
  industry: z.string().min(1, "Please select an industry"),
  roleType: z.string().min(1, "Please select a role type"),
  engagementType: z.string().min(1, "Please select an engagement type"),
  headcount: z.string().min(1, "Please select headcount"),
  timeline: z.string().min(1, "Please select a timeline"),
  message: z.string().min(10, "Please provide more details about your needs"),
});

type QuoteFormData = z.infer<typeof quoteFormSchema>;

const INDUSTRIES = [
  "Healthcare",
  "Information Technology",
  "Engineering",
  "Finance & Accounting",
  "Marketing & Communications",
  "Operations & Supply Chain",
  "Professional Services",
  "Government / Public Sector",
  "Other",
];

const ROLE_TYPES = [
  "Software Engineering",
  "DevOps / Cloud / Infrastructure",
  "Data Science / Machine Learning",
  "Cybersecurity",
  "QA / Testing",
  "IT Project Management",
  "Business Analysis",
  "Enterprise Platforms (SAP/Salesforce/ServiceNow)",
  "Registered Nurse (RN / Travel)",
  "Physician / Locum Tenens",
  "Allied Health",
  "Healthcare Operations",
  "Mechanical / Electrical Engineering",
  "Civil / Structural Engineering",
  "Industrial / Manufacturing",
  "Finance / Accounting",
  "Marketing / Operations",
  "Other",
];

const ENGAGEMENT_TYPES = [
  "Contract (W2)",
  "Contract (Corp-to-Corp)",
  "Contract-to-Hire",
  "Permanent / Direct Hire",
  "Not sure yet",
];

const HEADCOUNTS = ["1", "2–5", "6–10", "11–25", "26–50", "50+"];

const TIMELINES = [
  "As soon as possible (within 2 weeks)",
  "Within 1 month",
  "Within 3 months",
  "More than 3 months",
  "Just exploring",
];

const WHY_POINTS = [
  "Receive first candidate submissions within 24 hours",
  "Pre-screened, compliance-verified candidates",
  "No upfront fees — pay only on successful placement",
  "Coverage across all 50 US states",
  "Specialized recruiters for IT, healthcare, and engineering",
  "92% AI match accuracy via kleriq.AI",
];

export default function RequestAQuote() {
  useSEO({
    title: "Request a Staffing Quote | IT, Healthcare & Engineering Staffing | Hire'in Solutions",
    description:
      "Request a custom staffing quote from Hire'in Solutions. Fill in your industry, role type, headcount, and timeline. Receive a response within one business day. No upfront fees.",
    canonical: "https://hire-in.com/request-a-quote",
  });

  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<QuoteFormData>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      industry: "",
      roleType: "",
      engagementType: "",
      headcount: "",
      timeline: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: QuoteFormData) => {
      return apiRequest("POST", "/api/contacts", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        subject: `RFQ: ${data.industry} — ${data.roleType} (${data.headcount} headcount)`,
        message: `STAFFING QUOTE REQUEST\n\nCompany: ${data.company}\nIndustry: ${data.industry}\nRole Type: ${data.roleType}\nEngagement: ${data.engagementType}\nHeadcount: ${data.headcount}\nTimeline: ${data.timeline}\n\nAdditional Details:\n${data.message}`,
        inquiryType: "contact-employers",
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact us directly at " + CONTACT.emails.general,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: QuoteFormData) => {
    mutation.mutate(data);
  };

  return (
    <Layout>
      <SchemaHead schema={SERVICE_SCHEMA} />

      <section className="py-20 lg:py-24 px-4 lg:px-6 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto max-w-5xl text-center">
          <p className="text-primary font-semibold tracking-wider uppercase text-xs mb-3">Staffing Quote</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Request a Staffing Quote
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
            Tell us what you need — industry, role type, headcount, and timeline — and a Hire'in Solutions specialist will respond within one business day with a custom quote and initial candidate availability assessment.
          </p>
          <p className="text-sm text-muted-foreground">
            No upfront fees. No obligation. First candidate submissions within 24 hours for most roles.
          </p>
        </div>
      </section>

      <section className="py-12 px-4 lg:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              {submitted ? (
                <Card>
                  <CardContent className="p-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Quote Request Received</h2>
                    <p className="text-muted-foreground mb-6">
                      Thank you. A Hire'in Solutions specialist will review your requirements and respond within one business day with a custom quote and initial candidate availability assessment.
                    </p>
                    <p className="text-sm text-muted-foreground mb-8">
                      Questions? Email us at{" "}
                      <a href={`mailto:${CONTACT.emails.general}`} className="text-primary hover:underline">
                        {CONTACT.emails.general}
                      </a>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button asChild>
                        <Link href="/staffing-faq">Browse Staffing FAQ</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/why-hire-in-solutions">About Hire'in Solutions</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-6">Quote Request Form</h2>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Jane" {...field} data-testid="input-rfq-first-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Smith" {...field} data-testid="input-rfq-last-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name *</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Healthcare" {...field} data-testid="input-rfq-company" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Work Email *</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="jane@acme.com" {...field} data-testid="input-rfq-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input type="tel" placeholder="+1 (555) 000-0000" {...field} data-testid="input-rfq-phone" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="border-t pt-5">
                          <p className="text-sm font-medium text-muted-foreground mb-4">Role Requirements</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="industry"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Industry *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-rfq-industry">
                                        <SelectValue placeholder="Select industry" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {INDUSTRIES.map((ind) => (
                                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="roleType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Role Type *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-rfq-role-type">
                                        <SelectValue placeholder="Select role type" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {ROLE_TYPES.map((r) => (
                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="engagementType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Engagement Type *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-rfq-engagement">
                                        <SelectValue placeholder="Contract, perm, etc." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {ENGAGEMENT_TYPES.map((e) => (
                                        <SelectItem key={e} value={e}>{e}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="headcount"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Headcount Needed *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-rfq-headcount">
                                        <SelectValue placeholder="How many roles?" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {HEADCOUNTS.map((h) => (
                                        <SelectItem key={h} value={h}>{h}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="timeline"
                              render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                  <FormLabel>Timeline *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-rfq-timeline">
                                        <SelectValue placeholder="When do you need to fill?" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {TIMELINES.map((t) => (
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <FormField
                          control={form.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Additional Details *</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Tell us more: tech stack or clinical specialty, seniority level, location preference (remote/on-site/city), must-have skills, or any other context that would help us match candidates accurately."
                                  rows={4}
                                  {...field}
                                  data-testid="input-rfq-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          className="w-full"
                          size="lg"
                          disabled={mutation.isPending}
                          data-testid="button-rfq-submit"
                        >
                          {mutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              Submit Quote Request <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          By submitting this form you agree to be contacted by a Hire'in Solutions specialist. No upfront fees. No obligation.
                        </p>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2 space-y-5">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">What to Expect</h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "Response within 1 business day",
                      "Custom quote based on your specific requirements",
                      "Initial candidate availability assessment",
                      "First submissions within 24 hours for most roles",
                      "No upfront fees or commitments",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Why Hire'in Solutions</h3>
                  <ul className="space-y-3">
                    {WHY_POINTS.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Prefer to Talk?</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">General:</span>{" "}
                      <a href={`tel:${CONTACT.phones.main}`} className="hover:text-primary">{CONTACT.phones.main}</a>
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Healthcare:</span>{" "}
                      <a href={`tel:${CONTACT.phones.healthcare}`} className="hover:text-primary">{CONTACT.phones.healthcare}</a>
                    </p>
                    <p>
                      <span className="font-medium text-foreground">IT:</span>{" "}
                      <a href={`tel:${CONTACT.phones.it}`} className="hover:text-primary">{CONTACT.phones.it}</a>
                    </p>
                    <p className="pt-2">
                      <a href={`mailto:${CONTACT.emails.general}`} className="text-primary hover:underline">
                        {CONTACT.emails.general}
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Also explore:</p>
                <Link href="/staffing-faq" className="block hover:text-primary">Staffing FAQ →</Link>
                <Link href="/why-hire-in-solutions" className="block hover:text-primary">Why Hire'in Solutions →</Link>
                <Link href="/it-staffing-guide" className="block hover:text-primary">IT Staffing Guide →</Link>
                <Link href="/healthcare-staffing-guide" className="block hover:text-primary">Healthcare Staffing Guide →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
