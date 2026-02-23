import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({ title: "Email required", description: "Please enter your email address", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoImage} alt={COMPANY.name} className="h-16 w-16 rounded-lg object-cover" data-testid="img-logo" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-forgot-title">
            {submitted ? "Check Your Email" : "Reset Password"}
          </CardTitle>
          <CardDescription>
            {submitted
              ? "We've sent a password reset link to your email"
              : "Enter your email and we'll send you a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                <p className="text-sm text-center text-muted-foreground">
                  If an account exists for <strong>{email}</strong>, you'll receive an email with instructions to reset your password. The link expires in 1 hour.
                </p>
              </div>
              <Button variant="outline" className="w-full" asChild data-testid="button-back-to-login">
                <Link href="/admin/login">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-primary" />
                <span>We'll send a reset link to your registered email</span>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@hire-in.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    data-testid="input-email"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-submit">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Reset Link
                </Button>
              </form>
              <Button variant="ghost" className="w-full" asChild data-testid="button-back-to-login">
                <Link href="/admin/login">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
