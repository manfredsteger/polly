import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User, ClipboardList, Shield, Moon, Sun, Mail, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomization } from "@/contexts/CustomizationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from 'react-i18next';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { settings } = useCustomization();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const handleResendVerification = async () => {
    if (isResendingVerification) return;
    setIsResendingVerification(true);
    try {
      await apiRequest('POST', '/api/v1/auth/resend-verification');
      toast({
        title: t('emailVerification.resendSuccess'),
        description: t('emailVerification.resendSuccessDescription'),
      });
    } catch (error) {
      toast({
        title: t('emailVerification.resendError'),
        description: t('emailVerification.resendErrorDescription'),
        variant: 'destructive',
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleTheme = () => {
    if (effectiveTheme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  const getThemeIcon = () => {
    if (effectiveTheme === 'light') return <Sun className="w-4 h-4" />;
    return <Moon className="w-4 h-4" />;
  };

  const siteName = settings?.branding?.siteName ?? '';
  const siteNameAccent = settings?.branding?.siteNameAccent ?? '';
  const hasSiteTitle = !!(siteName || siteNameAccent);
  const logoUrl = settings?.branding?.logoUrl;
  const footerDescription = settings?.footer?.description || t('footer.defaultDescription');
  const footerCopyright = settings?.footer?.copyrightText || '';
  const footerLinks = settings?.footer?.supportLinks || [
    { label: t('footer.privacy'), url: '#' },
    { label: t('footer.imprint'), url: '#' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-200">
      <nav className="bg-white dark:bg-gray-900 border-b border-border sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" aria-label={t('nav.home')}>
                <div className="flex items-center cursor-pointer" data-testid="logo">
                  {logoUrl ? (
                    <img src={logoUrl} alt={siteName || 'Logo'} className="h-10 mr-2" />
                  ) : null}
                  {hasSiteTitle && (
                    <h1 className="text-2xl font-bold text-foreground">
                      {siteName}<span className="text-polly-orange">{siteNameAccent}</span>
                    </h1>
                  )}
                </div>
              </Link>
            </div>
            
            <div className="flex items-center space-x-2">
              <LanguageSwitcher />
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9"
                title={effectiveTheme === 'light' ? t('theme.switchToDark') : t('theme.switchToLight')}
                aria-label={effectiveTheme === 'light' ? t('theme.switchToDark') : t('theme.switchToLight')}
                data-testid="button-theme-toggle"
              >
                {getThemeIcon()}
              </Button>
              
              {isLoading ? (
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              ) : isAuthenticated && user ? (
                <>
                  <Button asChild variant="ghost" size="sm" data-testid="link-my-polls">
                    <Link href="/meine-umfragen">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      {t('nav.myPolls')}
                    </Link>
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid="button-user-menu">
                        <User className="w-4 h-4 mr-2" />
                        {user.name || user.username}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => navigate('/profil')} data-testid="menu-profile">
                        <User className="w-4 h-4 mr-2" />
                        {t('nav.profile')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/meine-umfragen')} data-testid="menu-my-polls">
                        <ClipboardList className="w-4 h-4 mr-2" />
                        {t('nav.myPolls')}
                      </DropdownMenuItem>
                      {user.role === 'admin' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => navigate('/admin')} data-testid="menu-admin">
                            <Shield className="w-4 h-4 mr-2" />
                            {t('nav.admin')}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('nav.logout')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button asChild variant="ghost" size="sm" data-testid="button-login">
                  <Link href="/anmelden">
                    <LogIn className="w-4 h-4 mr-2" />
                    {t('nav.login')}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {isAuthenticated && user && !user.emailVerified && user.provider === 'local' && (
        <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {t('emailVerification.bannerMessage')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                className="border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900 text-amber-800 dark:text-amber-200"
              >
                {isResendingVerification ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {t('emailVerification.resendButton')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-[hsl(224,71%,4%)] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center mb-4">
                {logoUrl ? (
                  <img src={logoUrl} alt={siteName || 'Logo'} className="h-10 mr-2" />
                ) : null}
                {hasSiteTitle && (
                  <h3 className="text-2xl font-bold">
                    {siteName}<span className="text-polly-orange">{siteNameAccent}</span>
                  </h3>
                )}
              </div>
              <p className="text-gray-300 mb-6 max-w-md">
                {footerDescription}
              </p>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('footer.services')}</h4>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/create-poll" className="hover:text-white">{t('footer.schedulePolls')}</Link></li>
                <li><Link href="/create-survey" className="hover:text-white">{t('footer.surveys')}</Link></li>
                <li><Link href="/create-organization" className="hover:text-white">{t('footer.orgLists')}</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-lg font-semibold mb-4">{t('footer.support')}</h4>
              <ul className="space-y-2 text-gray-300">
                {footerLinks.map((link, index) => (
                  <li key={index}>
                    {link.url.startsWith('/') ? (
                      <Link href={link.url} className="hover:text-white">{link.label}</Link>
                    ) : (
                      <a href={link.url} className="hover:text-white">{link.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-400">
            {footerCopyright ? (
              <p>{footerCopyright}</p>
            ) : (
              <p>
                Polly © 2025 ·{' '}
                <a
                  href="https://opensource.org/licenses/MIT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white underline"
                >
                  {t('footer.mitLicense')}
                </a>
                {' · '}
                <a
                  href="https://github.com/manfredsteger/polly"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('footer.githubAriaLabel')}
                  className="inline-flex items-center hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="currentColor"
                    style={{ verticalAlign: 'text-bottom', marginRight: '4px' }}
                    aria-hidden="true"
                  >
                    <path d="M12 0C5.37 0 0 5.37 0 12a12 12 0 0 0 8.21 11.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.41-4.04-1.41-.55-1.38-1.34-1.75-1.34-1.75-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.08 1.84 2.82 1.31 3.5 1 .11-.79.42-1.31.76-1.61-2.67-.31-5.47-1.34-5.47-5.95 0-1.31.47-2.38 1.24-3.22-.12-.31-.54-1.56.12-3.25 0 0 1.01-.32 3.3 1.23A11.5 11.5 0 0 1 12 5.8c1.02.01 2.05.14 3.01.41 2.29-1.55 3.29-1.23 3.29-1.23.66 1.69.24 2.94.12 3.25.77.84 1.24 1.91 1.24 3.22 0 4.62-2.81 5.64-5.49 5.94.43.38.82 1.12.82 2.26v3.35c0 .32.22.7.83.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                  </svg>
                  GitHub
                </a>
                {' · '}
                {t('footer.madeInBavaria')}
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
