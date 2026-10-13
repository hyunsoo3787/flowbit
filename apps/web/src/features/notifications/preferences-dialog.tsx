import type { NotificationPreferences } from '@flowbit/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { preferencesQuery, useUpdatePreferences } from './queries';

const OPTIONS: (keyof NotificationPreferences)[] = [
  'emailMentions',
  'emailAssignments',
  'emailWatching',
  'emailDueSoon',
];

/** Which notifications also arrive by email. */
export function NotificationPreferencesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: preferences } = useQuery({ ...preferencesQuery, enabled: open });
  const update = useUpdatePreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('notifications.preferences.title')}</DialogTitle>
          <DialogDescription>{t('notifications.preferences.body')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {OPTIONS.map((option) => (
            <label key={option} className="flex items-start gap-3">
              <Checkbox
                className="mt-0.5"
                checked={preferences?.[option] ?? true}
                disabled={!preferences}
                onCheckedChange={(checked) => update.mutate({ [option]: checked === true })}
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">
                  {t(`notifications.preferences.${option}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`notifications.preferences.${option}Hint`)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
