import { type Locale, SUPPORTED_LOCALES } from '@flowbit/shared';
import { LanguagesIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChangeLanguage } from '@/features/auth/queries';
import { currentLocale } from '@/i18n';
import { type Theme, useTheme } from '@/lib/theme';

export const THEME_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;
export const THEMES: Theme[] = ['light', 'dark', 'system'];
export const themeLabelKey = {
  light: 'nav.themeLight',
  dark: 'nav.themeDark',
  system: 'nav.themeSystem',
} as const;

/** Language and theme pickers for pages without the signed-in header. */
export function PreferenceControls() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const changeLanguage = useChangeLanguage();
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={t('nav.language')}>
            <LanguagesIcon />
            {t(`languages.${currentLocale()}`)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={currentLocale()}
            onValueChange={(value) => changeLanguage(value as Locale, false)}
          >
            {SUPPORTED_LOCALES.map((locale) => (
              <DropdownMenuRadioItem key={locale} value={locale}>
                {t(`languages.${locale}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('nav.theme')}>
            <ThemeIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            {THEMES.map((option) => (
              <DropdownMenuRadioItem key={option} value={option}>
                {t(themeLabelKey[option])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
