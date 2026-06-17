import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

type SubscribeResponse = {
  status: "subscribed" | "already_subscribed" | "invalid" | "error";
  message: string;
};

export function NewsletterSubscribe() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<null | "subscribed" | "already_subscribed">(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (value: string) => {
      const res = await apiRequest("POST", "/api/newsletter/subscribe", { email: value });
      return (await res.json()) as SubscribeResponse;
    },
    onSuccess: (data) => {
      if (data.status === "subscribed" || data.status === "already_subscribed") {
        setDone(data.status);
        setError(null);
        setEmail("");
      } else {
        setError(data.message || "Something went wrong. Please try again.");
      }
    },
    onError: async (err: any) => {
      let msg = "Something went wrong. Please try again.";
      try {
        const text = String(err?.message || "");
        const jsonStart = text.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(text.slice(jsonStart));
          if (parsed?.message) msg = parsed.message;
        }
      } catch {
        /* keep default */
      }
      setError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = email.trim();
    if (!value) {
      setError("Please enter a valid email address.");
      return;
    }
    mutation.mutate(value);
  };

  return (
    <section
      className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-primary/10 p-8 lg:p-10"
      data-testid="section-newsletter-subscribe"
    >
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-primary">
          <Mail className="h-4 w-4" />
          Newsletter
        </div>
        <h2 className="text-2xl font-bold md:text-3xl" data-testid="text-newsletter-heading">
          Get new insights in your inbox
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Be the first to read fresh articles on hiring, talent, and the future of work. No spam —
          unsubscribe anytime.
        </p>

        {done ? (
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-card px-5 py-3 text-sm font-medium text-primary"
            data-testid="status-newsletter-success"
          >
            <CheckCircle2 className="h-5 w-5" />
            {done === "already_subscribed"
              ? "You're already subscribed — thanks for being here!"
              : "You're subscribed! Check your inbox for a welcome note."}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
            data-testid="form-newsletter-subscribe"
          >
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-12 flex-1"
              aria-label="Email address"
              data-testid="input-newsletter-email"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12"
              disabled={mutation.isPending}
              data-testid="button-newsletter-subscribe"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subscribing…
                </>
              ) : (
                "Subscribe"
              )}
            </Button>
          </form>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive" data-testid="text-newsletter-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
