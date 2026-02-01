import { useEffect } from "react";
import { useLocation } from "wouter";
import { LogIn, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/admin");
    }
  }, [isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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
            />
          </div>
          <CardTitle className="text-2xl">Admin Portal</CardTitle>
          <CardDescription>
            Sign in with your @hire-in.com account to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg text-sm text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" />
            <span>Access restricted to authorized personnel only</span>
          </div>
          <Button asChild className="w-full" size="lg">
            <a href="/api/login">
              <LogIn className="mr-2 h-4 w-4" />
              Sign in with Replit
            </a>
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Only @hire-in.com domain accounts are authorized to access this portal
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
