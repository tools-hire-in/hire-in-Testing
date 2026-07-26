import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Award, Shield, CheckCircle, Linkedin, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

function LinkedInModal({ cert, open, onClose }: { cert: Certificate; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [post, setPost] = useState("");
  const [copied, setCopied] = useState(false);

  const draftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/praise/certificates/${cert.id}/linkedin-draft`);
      return res.json();
    },
    onSuccess: (data) => {
      setPost(data.post ?? "");
    },
    onError: () => toast({ title: "Failed to generate draft", description: "Please try again.", variant: "destructive" }),
  });

  const handleOpen = () => {
    if (!post) draftMutation.mutate();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(post);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard!", description: "Paste it into a new LinkedIn post." });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setPost(""); } else handleOpen(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-[#0A66C2]" />
            Share on LinkedIn
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Here's an AI-drafted post celebrating your <strong>{cert.badgeType?.name ?? "Recognition"}</strong> badge.
            Edit it as you like, then copy and paste into a new LinkedIn post.
          </p>
          {draftMutation.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating your post…</span>
            </div>
          ) : (
            <Textarea
              value={post}
              onChange={(e) => setPost(e.target.value)}
              rows={10}
              className="text-sm resize-none"
              placeholder="Your LinkedIn post will appear here…"
              data-testid="textarea-linkedin-post"
            />
          )}
          {!draftMutation.isPending && post && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
              💡 Paste this into a new LinkedIn post. You can edit freely before sharing.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onClose(); setPost(""); }}>Close</Button>
          {!draftMutation.isPending && post && (
            <Button
              onClick={handleCopy}
              className="bg-[#0A66C2] hover:bg-[#084d98] text-white"
              data-testid="btn-copy-linkedin-post"
            >
              {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          )}
          {!draftMutation.isPending && !post && (
            <Button onClick={() => draftMutation.mutate()} data-testid="btn-regenerate-linkedin-post">
              Generate Post
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyCertificates() {
  const { isAuthenticated } = useAuth();
  const [linkedinCert, setLinkedinCert] = useState<Certificate | null>(null);

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
    <>
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
                    {cert.status === "issued" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[#0A66C2] border-[#0A66C2]/30 hover:bg-[#0A66C2]/5"
                        onClick={() => setLinkedinCert(cert)}
                        data-testid={`btn-linkedin-cert-${cert.id}`}
                      >
                        <Linkedin className="h-3.5 w-3.5 mr-1" />
                        Share on LinkedIn
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

      {linkedinCert && (
        <LinkedInModal
          cert={linkedinCert}
          open={!!linkedinCert}
          onClose={() => setLinkedinCert(null)}
        />
      )}
    </>
  );
}
