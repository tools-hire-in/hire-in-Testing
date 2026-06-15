import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { SignatureBlock } from "@/components/esign/SignatureBlock";
import {
  FileText, CheckCircle, Calendar, DollarSign, Clock,
  Shield, AlertCircle, Loader2
} from "lucide-react";

interface ContractPublicData {
  id: string;
  clientName: string;
  candidateName?: string;
  candidateRole?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  marginPerHour?: string;
  paymentTermsDays?: number;
  billingFrequency?: string;
  status: string;
  authCode?: string;
}

export default function ContractSign() {
  const [, params] = useRoute("/contracts/sign/:token");
  const token = params?.token;
  const { toast } = useToast();
  const [signed, setSigned] = useState(false);
  const [authCode, setAuthCode] = useState<string | null>(null);

  const { data: contract, isLoading, error } = useQuery<ContractPublicData>({
    queryKey: [`/api/contracts/sign/${token}`],
    enabled: !!token,
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/contracts/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Signing failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSigned(true);
      setAuthCode(data.authCode);
    },
    onError: (e: any) => {
      toast({ title: "Signing failed", description: e.message, variant: "destructive" });
    },
  });

  if (!token) {
    return <ErrorPage message="Invalid signing link." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !contract) {
    return <ErrorPage message="This signing link is invalid or has expired." />;
  }

  if (contract.status !== "sent" && !signed) {
    const labels: Record<string, string> = {
      draft: "This contract has not been sent for signing yet.",
      client_signed: "You have already signed this contract. Thank you!",
      countersigned: "This contract has been fully executed.",
      cancelled: "This contract has been cancelled.",
    };
    return <ErrorPage message={labels[contract.status] || "This contract is not available for signing."} />;
  }

  if (signed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-slate-900">Contract Signed!</h1>
            <p className="text-muted-foreground">
              Thank you, <strong>{contract.clientName}</strong>. Your signature has been recorded.
              Our team will countersign shortly and you will receive a confirmation email.
            </p>
            {authCode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Your verification code:</p>
                <p className="font-mono font-bold text-2xl text-green-800 tracking-widest">{authCode}</p>
                <p className="text-xs text-muted-foreground mt-2">Save this code — it verifies your contract's authenticity.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-[#1F3A6E]" />
            <span className="font-bold text-[#1F3A6E] text-lg">Rayomind Solutions LLP</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Staffing Services Contract</h1>
          <p className="text-muted-foreground mt-1">Please review the details below and sign electronically.</p>
        </div>

        {/* Contract Details Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Contract Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Client</p>
                <p className="font-semibold">{contract.clientName}</p>
              </div>
              {contract.candidateName && (
                <div>
                  <p className="text-muted-foreground text-xs">Candidate</p>
                  <p className="font-semibold">{contract.candidateName}</p>
                </div>
              )}
              {contract.candidateRole && (
                <div>
                  <p className="text-muted-foreground text-xs">Role / Position</p>
                  <p className="font-semibold">{contract.candidateRole}</p>
                </div>
              )}
              {contract.contractStartDate && (
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Start Date
                  </p>
                  <p className="font-semibold">{new Date(contract.contractStartDate).toLocaleDateString()}</p>
                </div>
              )}
              {contract.contractEndDate && (
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> End Date
                  </p>
                  <p className="font-semibold">{new Date(contract.contractEndDate).toLocaleDateString()}</p>
                </div>
              )}
              {contract.marginPerHour && (
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Margin / Hour
                  </p>
                  <p className="font-semibold">${contract.marginPerHour}</p>
                </div>
              )}
              {contract.paymentTermsDays && (
                <div>
                  <p className="text-muted-foreground text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Payment Terms
                  </p>
                  <p className="font-semibold">Net {contract.paymentTermsDays}</p>
                </div>
              )}
              {contract.billingFrequency && (
                <div>
                  <p className="text-muted-foreground text-xs">Billing Frequency</p>
                  <p className="font-semibold capitalize">{contract.billingFrequency.replace(/_/g, " ")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Legal notice */}
        <Card className="shadow-sm border-amber-200 bg-amber-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold">Electronic Signature Notice</p>
                <p className="mt-1">By signing electronically, you agree that your digital signature is legally binding and equivalent to a handwritten signature under applicable e-signature laws (including but not limited to the IT Act 2000 and the Electronic Signatures in Global and National Commerce Act).</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agreement + Sign */}
        <SignatureBlock
          consent={{
            boxed: true,
            label: (
              <>
                I, <strong>{contract.clientName}</strong>, have read and understood the contract terms above and agree to enter into this staffing services agreement with Rayomind Solutions LLP. I confirm I have authority to sign on behalf of the company.
              </>
            ),
          }}
          submitLabel="Sign Contract Electronically"
          submittingLabel="Signing..."
          submitSize="default"
          submitClassName="h-12 text-base font-semibold bg-[#1F3A6E] hover:bg-[#162d56]"
          submitTestId="button-sign-contract"
          submitting={signMutation.isPending}
          onSubmit={() => signMutation.mutate()}
          notice={
            <>
              Your IP address and timestamp will be recorded as part of this electronic signature.
              This signing session is secured by Rayomind Solutions LLP.
            </>
          }
        />
      </div>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900">Unable to load contract</h1>
          <p className="text-muted-foreground">{message}</p>
          <Badge variant="outline">Rayomind Solutions LLP</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
