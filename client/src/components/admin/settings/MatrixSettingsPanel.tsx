import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageSquare,
  Building2,
  Wifi,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff
} from "lucide-react";

interface MatrixSettings {
  enabled: boolean;
  homeserverUrl: string;
  botUserId: string;
  botAccessToken: string;
  searchEnabled: boolean;
}

export function MatrixSettingsPanel({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [matrixEnabled, setMatrixEnabled] = useState(false);
  const [homeserverUrl, setHomeserverUrl] = useState('');
  const [botUserId, setBotUserId] = useState('');
  const [botAccessToken, setBotAccessToken] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const { data: customization, isLoading } = useQuery<{ matrix?: MatrixSettings }>({
    queryKey: ['/api/v1/admin/customization'],
  });

  useEffect(() => {
    if (customization?.matrix) {
      setMatrixEnabled(customization.matrix.enabled);
      setHomeserverUrl(customization.matrix.homeserverUrl);
      setBotUserId(customization.matrix.botUserId);
      setSearchEnabled(customization.matrix.searchEnabled);
    }
  }, [customization]);

  const saveMutation = useMutation({
    mutationFn: async (settings: MatrixSettings) => {
      const response = await apiRequest('PUT', '/api/v1/admin/customization', {
        matrix: settings,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: t('admin.toasts.saved'), description: t('admin.matrix.saved') });
      queryClient.invalidateQueries({ queryKey: ['/api/v1/admin/customization'] });
      setBotAccessToken('');
    },
    onError: () => {
      toast({ title: t('errors.generic'), description: t('admin.toasts.settingsSaveError'), variant: "destructive" });
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      enabled: matrixEnabled,
      homeserverUrl,
      botUserId,
      botAccessToken: botAccessToken || '',
      searchEnabled,
    });
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const response = await apiRequest('POST', '/api/v1/matrix/test');
      const result = await response.json();
      if (result.success) {
        setTestStatus('success');
        setTestMessage(t('admin.matrix.connectedAs', { userId: result.userId }));
      } else {
        setTestStatus('error');
        setTestMessage(result.error || t('admin.matrix.connectionFailed'));
      }
    } catch (error: any) {
      setTestStatus('error');
      setTestMessage(t('admin.matrix.connectionTestFailed'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-settings">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t('admin.matrix.backToSettings')}
        </Button>
        <ChevronRight className="w-4 h-4" />
        <span className="font-medium text-foreground">Matrix Chat</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t('admin.matrix.title')}</h2>
          <p className="text-muted-foreground">{t('admin.matrix.description')}</p>
        </div>
        <Badge variant="outline" className={matrixEnabled ? "text-green-600 border-green-600" : "text-muted-foreground border-muted"}>
          {matrixEnabled ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('admin.matrix.enabled')}
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 mr-1" />
              {t('admin.matrix.disabled')}
            </>
          )}
        </Badge>
      </div>

      <Card className="polly-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <MessageSquare className="w-5 h-5 mr-2" />
              {t('admin.matrix.connection')}
            </div>
            {saveMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
          <CardDescription>{t('admin.matrix.connectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={`flex items-center justify-between p-4 border rounded-lg ${matrixEnabled ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-muted/50 border-muted'}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-lg ${matrixEnabled ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
                <MessageSquare className={`w-6 h-6 ${matrixEnabled ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium text-foreground">{t('admin.matrix.enableIntegration')}</p>
                <p className="text-sm text-muted-foreground">
                  {matrixEnabled 
                    ? t('admin.matrix.ssoUsersCanReceive') 
                    : t('admin.matrix.onlyEmailActive')}
                </p>
              </div>
            </div>
            <Switch 
              id="matrix-enabled" 
              checked={matrixEnabled}
              onCheckedChange={setMatrixEnabled}
              data-testid="switch-matrix-enabled" 
            />
          </div>

          {matrixEnabled && (
            <>
              <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-start space-x-3">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">{t('admin.matrix.homeserverUrl')}</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {t('admin.matrix.homeserverNote')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="matrix-homeserver">{t('admin.matrix.homeserverUrl')}</Label>
                  <Input 
                    id="matrix-homeserver" 
                    placeholder="https://matrix.example.com"
                    value={homeserverUrl}
                    onChange={(e) => setHomeserverUrl(e.target.value)}
                    data-testid="input-matrix-homeserver"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.matrix.homeserverUrlLabel')}</p>
                </div>
                <div>
                  <Label htmlFor="matrix-bot-user">{t('admin.matrix.botUserId')}</Label>
                  <Input 
                    id="matrix-bot-user" 
                    placeholder="@pollbot:matrix.example.com"
                    value={botUserId}
                    onChange={(e) => setBotUserId(e.target.value)}
                    data-testid="input-matrix-bot-user"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t('admin.matrix.botUserIdLabel')}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="matrix-token">{t('admin.matrix.botAccessToken')}</Label>
                <div className="relative">
                  <Input 
                    id="matrix-token" 
                    type={showToken ? "text" : "password"}
                    placeholder={customization?.matrix?.botAccessToken ? "••••••••••••••••" : "syt_xxx..."}
                    value={botAccessToken}
                    onChange={(e) => setBotAccessToken(e.target.value)}
                    data-testid="input-matrix-token"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.matrix.leaveEmptyToKeep')}
                </p>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg">
                <Switch 
                  id="matrix-search" 
                  checked={searchEnabled}
                  onCheckedChange={setSearchEnabled}
                  data-testid="switch-matrix-search"
                />
                <div className="flex-1">
                  <Label htmlFor="matrix-search" className="font-medium">{t('admin.matrix.userDirectorySearch')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.matrix.searchDescription')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing' || !homeserverUrl || !botUserId}
                    data-testid="button-test-matrix"
                  >
                    {testStatus === 'testing' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('admin.matrix.testing')}
                      </>
                    ) : (
                      <>
                        <Wifi className="w-4 h-4 mr-2" />
                        {t('admin.matrix.testConnection')}
                      </>
                    )}
                  </Button>
                  {testStatus === 'success' && (
                    <span className="text-sm text-green-600 dark:text-green-400 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      {testMessage}
                    </span>
                  )}
                  {testStatus === 'error' && (
                    <span className="text-sm text-red-600 dark:text-red-400 flex items-center">
                      <XCircle className="w-4 h-4 mr-1" />
                      {testMessage}
                    </span>
                  )}
                </div>
                <Button 
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !homeserverUrl || !botUserId}
                  className="polly-button-primary"
                  data-testid="button-save-matrix"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('admin.matrix.saving')}
                    </>
                  ) : (
                    t('admin.matrix.saveSettings')
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {matrixEnabled && (
        <Card className="polly-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {t('admin.matrix.setupTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-polly-orange">1.</span>
                <div>
                  <p className="font-medium">{t('admin.matrix.setupHints.createBotAccount')}</p>
                  <p className="text-muted-foreground">{t('admin.matrix.setupHints.createBotAccountDescription')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-polly-orange">2.</span>
                <div>
                  <p className="font-medium">{t('admin.matrix.setupHints.generateToken')}</p>
                  <p className="text-muted-foreground">{t('admin.matrix.setupHints.generateTokenDescription')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <span className="font-bold text-polly-orange">3.</span>
                <div>
                  <p className="font-medium">{t('admin.matrix.setupHints.userDirectory')}</p>
                  <p className="text-muted-foreground">
                    {t('admin.matrix.setupHints.userDirectoryDescription')} 
                    <code className="mx-1 px-1 bg-background rounded">user_directory.search_all_users: true</code>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
