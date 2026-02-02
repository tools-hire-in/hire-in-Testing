import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useLogin } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const loginMutation = useLogin();

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
    
    try {
      await loginMutation.mutateAsync({ email, password });
      setLocation("/admin");
    } catch (error: any) {
      const message = error?.message || "Login failed. Please try again.";
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
    }
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
            Admin Portal
          </CardTitle>
          <CardDescription>
            Sign in with your @hire-in.com email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span>Access restricted to authorized personnel only</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
              <Label htmlFor="password">Password</Label>
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

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={loginMutation.isPending}
              data-testid="button-submit"
            >
              {loginMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign In
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            Only @hire-in.com domain accounts are authorized to access this portal
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
