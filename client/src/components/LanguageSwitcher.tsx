import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { supportedLanguages, languageNames, type SupportedLanguage } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest, queryClient } from '@/lib/queryClient';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('polly-language', lang);
    
    if (isAuthenticated && user) {
      try {
        await apiRequest('PATCH', '/api/v1/users/me/language', { language: lang });
        queryClient.invalidateQueries({ queryKey: ['/api/v1/auth/me'] });
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9"
          aria-label={t('nav.switchLanguage')}
          data-testid="button-language-switcher"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={currentLanguage === lang ? 'bg-accent' : ''}
            data-testid={`menu-item-language-${lang}`}
          >
            <span className="mr-2">{lang === 'de' ? '🇩🇪' : '🇬🇧'}</span>
            {languageNames[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
