import {
  BOARD_BACKGROUNDS,
  BOARD_NAME_MAX_LENGTH,
  BOARD_VISIBILITIES,
  type BoardBackground,
  type BoardVisibility,
} from '@flowbit/shared';
import { useNavigate } from '@tanstack/react-router';
import { CheckIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { BACKGROUND_CLASSES } from './backgrounds';
import { useCreateBoard } from './queries';

export function CreateBoardDialog({
  workspaceId,
  trigger,
}: {
  workspaceId: string;
  trigger: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createBoard = useCreateBoard(workspaceId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [background, setBackground] = useState<BoardBackground>('blue');
  const [visibility, setVisibility] = useState<BoardVisibility>('WORKSPACE');
  const trimmed = name.trim();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed) return;
    try {
      const board = await createBoard.mutateAsync({ name: trimmed, background, visibility });
      toast.success(t('boards.created'));
      setOpen(false);
      setName('');
      await navigate({ to: '/b/$boardId', params: { boardId: board.id } });
    } catch (error) {
      toast.error(errorMessage(t, error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('boards.createTitle')}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={onSubmit}>
          <div
            className={cn(
              'grid h-24 place-items-center rounded-lg px-4 text-center font-semibold text-white',
              BACKGROUND_CLASSES[background],
            )}
            aria-hidden
          >
            <span className="line-clamp-2">{trimmed || t('boards.namePlaceholder')}</span>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="board-name">{t('boards.name')}</Label>
            <Input
              id="board-name"
              value={name}
              maxLength={BOARD_NAME_MAX_LENGTH}
              placeholder={t('boards.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('boards.background')}</legend>
            <div className="flex flex-wrap gap-2">
              {BOARD_BACKGROUNDS.map((color) => (
                <label key={color} className="cursor-pointer">
                  <input
                    type="radio"
                    name="background"
                    value={color}
                    checked={background === color}
                    onChange={() => setBackground(color)}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'grid size-9 place-items-center rounded-md text-white ring-offset-2 ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                      BACKGROUND_CLASSES[color],
                    )}
                    title={t(`boards.colors.${color}`)}
                  >
                    {background === color ? <CheckIcon className="size-4" aria-hidden /> : null}
                    <span className="sr-only">{t(`boards.colors.${color}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t('boards.visibility')}</legend>
            {BOARD_VISIBILITIES.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[:checked]:border-primary has-[:checked]:bg-accent/50"
              >
                <input
                  type="radio"
                  name="visibility"
                  value={option}
                  checked={visibility === option}
                  onChange={() => setVisibility(option)}
                  className="mt-1 accent-primary"
                />
                <span className="grid gap-0.5">
                  <span className="text-sm font-medium">{t(`boards.visibility${option}`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`boards.visibility${option}Hint`)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!trimmed || createBoard.isPending}>
              {t('boards.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
