import { useState } from "react";
import { Link, useSearch } from "wouter";
import { Lock, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

export default function ResetPassword() {
  const { toast } = useToast();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast({ title: "Password too short", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are identical", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (error: any) {
      toast({ title: "Reset Failed", description: error?.message || "Invalid or expired reset link. Please request a new one.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logoImage} alt={COMPANY.name} className="h-16 w-16 rounded-lg object-cover" data-testid="img-logo" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-reset-title">Invalid Link</CardTitle>
            <CardDescription>This password reset link is missing or invalid.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3 p-4 bg-destructive/10 rounded-lg mb-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-center text-muted-foreground">
                The reset link appears to be broken. Please request a new password reset.
              </p>
            </div>
            <Button className="w-full" asChild data-testid="button-request-new">
              <Link href="/admin/forgot-password">Request New Reset Link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={logoImage} alt={COMPANY.name} className="h-16 w-16 rounded-lg object-cover" data-testid="img-logo" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-reset-title">
            {success ? "Password Reset" : "Set New Password"}
          </CardTitle>
          <CardDescription>
            {success ? "Your password has been updated successfully" : "Enter your new password below"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
                <p className="text-sm text-center text-muted-foreground">
                  Your password has been changed. You can now sign in with your new password.
                </p>
              </div>
              <Button className="w-full" size="lg" asChild data-testid="button-go-to-login">
                <Link href="/admin/login">Go to Login</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-primary" />
                <span>Choose a strong password with at least 8 characters</span>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    data-testid="input-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    data-testid="input-confirm-password"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting} data-testid="button-submit">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Reset Password
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
