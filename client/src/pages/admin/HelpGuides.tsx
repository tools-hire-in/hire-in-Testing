import { BookOpen, Compass, ClipboardList, BookMarked, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";

interface GuideCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  roles?: string[];
}

const guides: GuideCard[] = [
  {
    icon: <Compass className="h-6 w-6 text-orange-500" />,
    title: "CEO Command Guide",
    description: "One reference for every major platform lever — how to run the business from the portal.",
    href: "/admin/ceo-guide",
    roles: ["super_admin"],
  },
  {
    icon: <ClipboardList className="h-6 w-6 text-orange-500" />,
    title: "Probation Guide",
    description: "Step-by-step playbook for managing the 90-day probation period — milestones, reviews, and decision framework.",
    href: "/admin/probation-guide",
    roles: ["super_admin", "admin", "hr", "manager"],
  },
  {
    icon: <BookMarked className="h-6 w-6 text-orange-500" />,
    title: "Knowledge Hub",
    description: "McKinsey market strategy, VC investment narrative, and go-to-market playbooks for Hire'in 360.",
    href: "/admin/knowledge-hub",
    roles: ["super_admin"],
  },
];

export default function HelpGuides() {
  const { enabled: newLook } = useNewLook();

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-6 py-10 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={HelpCircle}
            eyebrow="Help"
            title="Help & Guides"
            subtitle="Platform playbooks and reference guides"
          />
        ) : (
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Help & Guides</h1>
              <p className="text-sm text-muted-foreground">Platform playbooks and reference guides</p>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {guides.map((guide) => (
            <Link key={guide.href} href={guide.href}>
              <div
                className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 hover:border-orange-300 hover:shadow-sm transition-all cursor-pointer"
                data-testid={`guide-card-${guide.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="mt-0.5 h-10 w-10 shrink-0 rounded-lg bg-orange-50 flex items-center justify-center">
                  {guide.icon}
                </div>
                <div>
                  <div className="font-semibold text-foreground group-hover:text-orange-600 transition-colors">
                    {guide.title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {guide.description}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
