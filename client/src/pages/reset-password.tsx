import { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Key, CheckCircle, AlertCircle, Check, X } from "lucide-react";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function PasswordStrengthIndicator({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  const requirements: PasswordRequirement[] = useMemo(() => [
    { label: 'Mindestens 8 Zeichen', met: password.length >= 8 },
    { label: 'Mindestens ein Großbuchstabe', met: /[A-Z]/.test(password) },
    { label: 'Mindestens ein Kleinbuchstabe', met: /[a-z]/.test(password) },
    { label: 'Mindestens eine Zahl', met: /[0-9]/.test(password) },
    { label: 'Mindestens ein Sonderzeichen (!@#$%^&*...)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ], [password]);

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const allRequirementsMet = requirements.every(r => r.met);
  
  const strengthPercentage = (requirements.filter(r => r.met).length / requirements.length) * 100;
  
  const getStrengthColor = () => {
    if (strengthPercentage < 40) return 'bg-red-500';
    if (strengthPercentage < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (strengthPercentage < 40) return 'Schwach';
    if (strengthPercentage < 80) return 'Mittel';
    return 'Stark';
  };

  if (password.length === 0) return null;

  return (
    <div className="space-y-3 mt-2 p-3 bg-muted/50 rounded-lg border" data-testid="password-strength-indicator">
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Passwortstärke</span>
          <span className={`font-medium ${strengthPercentage === 100 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
            {getStrengthLabel()}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${getStrengthColor()}`}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>
      
      <div className="space-y-1.5">
        {requirements.map((req, index) => (
          <div 
            key={index} 
            className={`flex items-center gap-2 text-xs ${req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
            data-testid={`password-requirement-${index}`}
          >
            {req.met ? (
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
      
      {confirmPassword.length > 0 && (
        <div className={`flex items-center gap-2 text-xs pt-2 border-t ${passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
          {passwordsMatch ? (
            <Check className="h-3.5 w-3.5 flex-shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 flex-shrink-0" />
          )}
          <span>{passwordsMatch ? 'Passwörter stimmen überein' : 'Passwörter stimmen nicht überein'}</span>
        </div>
      )}
    </div>
  );
}

function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)
  );
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/passwort-zuruecksetzen/:token");
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = params?.token;

  useEffect(() => {
    if (!token) {
      setError("Ungültiger oder fehlender Token.");
    }
  }, [token]);

  const parseErrorMessage = (error: any): string => {
    if (!error?.message) return "Ein unbekannter Fehler ist aufgetreten.";
    const msg = error.message;
    const colonIndex = msg.indexOf(': ');
    if (colonIndex > -1) {
      const jsonPart = msg.substring(colonIndex + 2);
      try {
        const parsed = JSON.parse(jsonPart);
        return parsed.error || parsed.message || msg;
      } catch {
        return jsonPart;
      }
    }
    return msg;
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      const response = await apiRequest('POST', '/api/v1/auth/reset-password', data);
      return response.json();
    },
    onSuccess: () => {
      setCompleted(true);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die Passwörter stimmen nicht überein.",
        variant: "destructive",
      });
      return;
    }

    if (!validatePassword(newPassword)) {
      toast({
        title: "Fehler",
        description: "Das Passwort erfüllt nicht alle Anforderungen (8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen).",
        variant: "destructive",
      });
      return;
    }

    if (!token) {
      toast({
        title: "Fehler",
        description: "Ungültiger Token.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ token, newPassword });
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold">Ungültiger Link</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/passwort-vergessen")}
                data-testid="button-request-new"
              >
                Neuen Link anfordern
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Passwort geändert</h2>
              <p className="text-muted-foreground">
                Ihr Passwort wurde erfolgreich zurückgesetzt. Sie können sich jetzt mit Ihrem neuen Passwort anmelden.
              </p>
              <Button 
                className="w-full kita-button-primary" 
                onClick={() => setLocation("/anmelden")}
                data-testid="button-login"
              >
                Zur Anmeldung
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Neues Passwort vergeben
          </CardTitle>
          <CardDescription>
            Vergeben Sie ein neues sicheres Passwort für Ihr Konto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Neues Passwort</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1"
                data-testid="input-new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
                data-testid="input-confirm-password"
              />
            </div>
            
            <PasswordStrengthIndicator password={newPassword} confirmPassword={confirmPassword} />
            <Button 
              type="submit" 
              className="w-full kita-button-primary"
              disabled={resetPasswordMutation.isPending || !validatePassword(newPassword) || newPassword !== confirmPassword}
              data-testid="button-submit"
            >
              {resetPasswordMutation.isPending ? "Wird gespeichert..." : "Passwort speichern"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
