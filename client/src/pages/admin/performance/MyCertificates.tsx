import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Award, Shield, CheckCircle } from "lucide-react";

interface Certificate {
  id: string;
  certificateId: string;
  referenceNumber: string;
  status: string;
  version: number;
  issuedAt: string | null;
  publicCitation: string;
  recognitionDescription: string;
  contributionSummary: string;
  pdfUrl: string | null;
  approverName: string;
  approverTitle: string | null;
  badgeType: { name: string; emoji: string; color: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  issued: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  superseded: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  revoked: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function MyCertificates() {
  const { user, isAuthenticated } = useAuth();

  const { data: certs = [], isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/praise/my-certificates"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading your certificates...
      </div>
    );
  }

  if (certs.length === 0) {
    return (
      <div className="text-center py-16">
        <Award className="h-14 w-14 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No certificates yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          When a manager approves a recognition you&apos;ve been given, a verified certificate will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="my-certificates-list">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {certs.length} certificate{certs.length !== 1 ? "s" : ""} issued to you
        </p>
      </div>

      {certs.map((cert) => (
        <Card key={cert.id} data-testid={`cert-card-${cert.id}`} className="overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: cert.badgeType ? `${cert.badgeType.color}20` : "#f3f4f6" }}
              >
                {cert.badgeType?.emoji ?? "🏅"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-bold text-[#1F3A6E]">{cert.badgeType?.name ?? "Recognition"} Badge</h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[cert.status] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {cert.status}
                  </span>
                  {cert.version > 1 && (
                    <span className="text-xs text-muted-foreground">v{cert.version}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <Shield className="h-3 w-3" />
                  <span>{cert.referenceNumber}</span>
                  <span>·</span>
                  <span>
                    Issued {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                  </span>
                  <span>·</span>
                  <span>By {cert.approverName}</span>
                </div>

                {cert.publicCitation && (
                  <p className="text-sm italic text-slate-600 dark:text-slate-400 mb-3 border-l-2 border-[#F47C20] pl-3">
                    &ldquo;{cert.publicCitation}&rdquo;
                  </p>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {cert.pdfUrl && cert.status === "issued" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#1F3A6E] border-[#1F3A6E]/30 hover:bg-[#1F3A6E]/5"
                      onClick={() => window.open(`/api/growth/certificates/${cert.id}/download`, "_blank")}
                      data-testid={`btn-download-cert-${cert.id}`}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download PDF
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => window.open(`/verify?ref=${encodeURIComponent(cert.referenceNumber)}`, "_blank")}
                    data-testid={`btn-verify-cert-${cert.id}`}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    Verify
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
