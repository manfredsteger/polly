import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ConfirmEmail() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/email-bestaetigen/:token");
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>("");

  const token = params?.token;

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

  const confirmEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest('POST', '/api/v1/auth/confirm-email-change', { token });
      return response.json();
    },
    onSuccess: () => {
      setStatus('success');
      queryClient.invalidateQueries({ queryKey: ['/api/v1/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
    },
    onError: (error: any) => {
      setStatus('error');
      setErrorMessage(parseErrorMessage(error));
    },
  });

  useEffect(() => {
    if (token) {
      confirmEmailMutation.mutate(token);
    } else {
      setStatus('error');
      setErrorMessage("Ungültiger oder fehlender Bestätigungslink.");
    }
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-16 h-16 text-primary mx-auto animate-spin" />
              <h2 className="text-2xl font-bold">E-Mail wird bestätigt...</h2>
              <p className="text-muted-foreground">
                Bitte warten Sie einen Moment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
              <h2 className="text-2xl font-bold">Bestätigung fehlgeschlagen</h2>
              <p className="text-muted-foreground">{errorMessage}</p>
              <Button 
                className="w-full" 
                onClick={() => setLocation("/profil")}
                data-testid="button-back-to-profile"
              >
                Zurück zum Profil
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
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">E-Mail-Adresse geändert</h2>
            <p className="text-muted-foreground">
              Ihre E-Mail-Adresse wurde erfolgreich aktualisiert.
            </p>
            <Button 
              className="w-full kita-button-primary" 
              onClick={() => setLocation("/profil")}
              data-testid="button-back-to-profile"
            >
              Zurück zum Profil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
