import { BOARD_BACKGROUND_PRESETS, boardBackgroundSchema, textToneFor } from '@flowbit/shared';
import { CheckIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PRESET_COLORS = new Set<string>(BOARD_BACKGROUND_PRESETS.map((preset) => preset.color));

/** Light presets plus a full color picker and a hex field for any other color. */
export function BackgroundPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  // What the user is typing in the hex field; null shows the current value.
  const [draftHex, setDraftHex] = useState<string | null>(null);
  const isCustom = !PRESET_COLORS.has(value);

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">{t('boards.background')}</legend>
      <div className="grid grid-cols-6 gap-2">
        {BOARD_BACKGROUND_PRESETS.map((preset) => {
          const selected = value === preset.color;
          return (
            <label
              key={preset.key}
              className="cursor-pointer"
              title={t(`boards.colors.${preset.key}`)}
            >
              <input
                type="radio"
                name={`${id}-background`}
                value={preset.color}
                checked={selected}
                onChange={() => onChange(preset.color)}
                className="peer sr-only"
              />
              <span
                className="grid h-9 place-items-center rounded-md text-slate-900 ring-offset-2 ring-offset-background peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
                style={{ backgroundColor: preset.color }}
              >
                {selected ? <CheckIcon className="size-4" aria-hidden /> : null}
                <span className="sr-only">{t(`boards.colors.${preset.key}`)}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={`${id}-custom`}
          className={cn(
            'relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md ring-offset-2 ring-offset-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
            !isCustom &&
              'bg-[conic-gradient(from_90deg,#f87171,#facc15,#4ade80,#22d3ee,#818cf8,#e879f9,#f87171)]',
          )}
          style={isCustom ? { backgroundColor: value } : undefined}
          title={t('boards.customColor')}
        >
          <input
            id={`${id}-custom`}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          {isCustom ? (
            <CheckIcon
              className={cn(
                'pointer-events-none size-4',
                textToneFor(value) === 'dark' ? 'text-slate-900' : 'text-white',
              )}
              aria-hidden
            />
          ) : null}
          <span className="sr-only">{t('boards.customColor')}</span>
        </label>
        <span className="text-sm text-muted-foreground">{t('boards.customColor')}</span>
        <Input
          value={draftHex ?? value}
          maxLength={7}
          spellCheck={false}
          aria-label={t('boards.hexColor')}
          className="ml-auto w-28 font-mono"
          onChange={(event) => {
            const next = event.target.value.trim();
            setDraftHex(next);
            const candidate = next.startsWith('#') ? next : `#${next}`;
            if (boardBackgroundSchema.safeParse(candidate).success)
              onChange(candidate.toLowerCase());
          }}
          onBlur={() => setDraftHex(null)}
        />
      </div>
    </fieldset>
  );
}
