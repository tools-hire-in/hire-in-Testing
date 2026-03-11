import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Shield, LogIn, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showTotpStep, setShowTotpStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totpError, setTotpError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/admin");
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.endsWith("@hire-in.com")) {
      toast({
        title: "Access Denied",
        description: "Only @hire-in.com email addresses are allowed",
        variant: "destructive",
      });
      return;
    }
    
    if (showTotpStep) {
      if (!totpCode || totpCode.length < 6) {
        setTotpError("Please enter the 6-digit code from your authenticator app.");
        return;
      }
      setTotpError("");
    }

    setIsSubmitting(true);
    try {
      const payload: any = { email, password };
      if (showTotpStep) {
        payload.totpCode = totpCode;
      }

      const response = await apiRequest("POST", "/api/auth/login", payload);
      const data = await response.json();

      if (data.totpRequired) {
        setShowTotpStep(true);
        setTotpError("");
        setIsSubmitting(false);
        return;
      }

      queryClient.setQueryData(["/api/auth/me"], data);
      setLocation("/admin");
    } catch (error: any) {
      const message = error?.message || "Login failed. Please try again.";
      if (showTotpStep) {
        setTotpError(message);
        setTotpCode("");
      } else {
        toast({
          title: "Login Failed",
          description: message,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setShowTotpStep(false);
    setTotpCode("");
    setPassword("");
    setTotpError("");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={logoImage}
              alt={COMPANY.name}
              className="h-16 w-16 rounded-lg object-cover"
              data-testid="img-logo"
            />
          </div>
          <CardTitle className="text-2xl" data-testid="text-login-title">
            {showTotpStep ? "Two-Factor Authentication" : "Admin Portal"}
          </CardTitle>
          <CardDescription>
            {showTotpStep
              ? "Enter the 6-digit code from your authenticator app"
              : "Sign in with your @hire-in.com email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showTotpStep && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>Access restricted to authorized personnel only</span>
            </div>
          )}

          {showTotpStep && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>Open your authenticator app to get the code</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {!showTotpStep ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@hire-in.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link href="/admin/forgot-password" className="text-xs text-primary hover:underline" data-testid="link-forgot-password">
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-password"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totpCode">Verification Code</Label>
                <Input
                  id="totpCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => {
                    setTotpCode(e.target.value.replace(/\D/g, ""));
                    if (totpError) setTotpError("");
                  }}
                  autoFocus
                  className={`text-center text-2xl tracking-widest font-mono ${totpError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  data-testid="input-totp-code"
                />
                {totpError && (
                  <p className="text-sm text-destructive" data-testid="text-totp-error">{totpError}</p>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={isSubmitting}
              data-testid="button-submit"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : showTotpStep ? (
                <KeyRound className="mr-2 h-4 w-4" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {showTotpStep ? "Verify" : "Sign In"}
            </Button>

            {showTotpStep && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleBackToLogin}
                data-testid="button-back-to-login"
              >
                Back to login
              </Button>
            )}
          </form>

          {!showTotpStep && (
            <p className="text-xs text-center text-muted-foreground">
              Only @hire-in.com domain accounts are authorized to access this portal
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
