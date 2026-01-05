import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, User, ClipboardList, Shield, Moon, Sun } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomization } from "@/contexts/CustomizationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from 'react-i18next';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const { settings } = useCustomization();
  const { theme, setTheme, effectiveTheme } = useTheme();
  const { t } = useTranslation();

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

  const rawSiteName = settings?.branding?.siteName ?? '';
  const rawSiteNameAccent = settings?.branding?.siteNameAccent ?? '';
  const siteName = (rawSiteName || rawSiteNameAccent) ? rawSiteName : 'Poll';
  const siteNameAccent = (rawSiteName || rawSiteNameAccent) ? rawSiteNameAccent : 'y';
  const logoUrl = settings?.branding?.logoUrl;
  const footerDescription = settings?.footer?.description || t('footer.defaultDescription');
  const footerCopyright = settings?.footer?.copyrightText || t('footer.defaultCopyright');
  const footerLinks = settings?.footer?.supportLinks || [
    { label: t('footer.privacy'), url: '#' },
    { label: t('footer.imprint'), url: '#' },
  ];

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <nav className="bg-white dark:bg-gray-900 border-b border-border sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/">
                <div className="flex items-center cursor-pointer" data-testid="logo">
                  {logoUrl ? (
                    <img src={logoUrl} alt={siteName} className="h-10 mr-2" />
                  ) : null}
                  <h1 className="text-2xl font-bold text-foreground">
                    {siteName}<span className="text-polly-orange">{siteNameAccent}</span>
                  </h1>
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
                  <Link href="/meine-umfragen">
                    <Button variant="ghost" size="sm" data-testid="link-my-polls">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      {t('nav.myPolls')}
                    </Button>
                  </Link>
                  
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
                <Link href="/anmelden">
                  <Button variant="ghost" size="sm" data-testid="button-login">
                    <LogIn className="w-4 h-4 mr-2" />
                    {t('nav.login')}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-[hsl(224,71%,4%)] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center mb-4">
                {logoUrl ? (
                  <img src={logoUrl} alt={siteName} className="h-10 mr-2" />
                ) : null}
                <h3 className="text-2xl font-bold">
                  {siteName}<span className="text-polly-orange">{siteNameAccent}</span>
                </h3>
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
            <p>{footerCopyright}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
