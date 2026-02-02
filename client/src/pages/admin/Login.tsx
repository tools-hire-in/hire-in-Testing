import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Shield, LogIn, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useLogin, useSetup } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  
  const loginMutation = useLogin();
  const setupMutation = useSetup();

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

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.endsWith("@hire-in.com")) {
      toast({
        title: "Invalid Email",
        description: "Only @hire-in.com email addresses are allowed",
        variant: "destructive",
      });
      return;
    }
    
    if (password.length < 8) {
      toast({
        title: "Weak Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await setupMutation.mutateAsync({ email, password, firstName, lastName });
      toast({
        title: "Setup Complete",
        description: "Your Super Admin account has been created!",
      });
      setLocation("/admin");
    } catch (error: any) {
      const message = error?.message || "Setup failed. Please try again.";
      toast({
        title: "Setup Failed",
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
            {isSetupMode ? "Setup Admin Portal" : "Admin Portal"}
          </CardTitle>
          <CardDescription>
            {isSetupMode 
              ? "Create your Super Admin account to get started" 
              : "Sign in with your @hire-in.com email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span>Access restricted to authorized personnel only</span>
          </div>

          <form onSubmit={isSetupMode ? handleSetup : handleLogin} className="space-y-4">
            {isSetupMode && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    data-testid="input-last-name"
                  />
                </div>
              </div>
            )}
            
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
                placeholder={isSetupMode ? "Minimum 8 characters" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isSetupMode ? 8 : 1}
                data-testid="input-password"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={loginMutation.isPending || setupMutation.isPending}
              data-testid="button-submit"
            >
              {(loginMutation.isPending || setupMutation.isPending) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isSetupMode ? (
                <UserPlus className="mr-2 h-4 w-4" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isSetupMode ? "Create Super Admin" : "Sign In"}
            </Button>
          </form>

          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => setIsSetupMode(!isSetupMode)}
              className="text-sm text-primary hover:underline"
              data-testid="button-toggle-mode"
            >
              {isSetupMode 
                ? "Already have an account? Sign in" 
                : "First time? Set up Super Admin account"}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Only @hire-in.com domain accounts are authorized to access this portal
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
