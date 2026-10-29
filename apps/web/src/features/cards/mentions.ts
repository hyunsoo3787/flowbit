import type { UserSummary } from '@flowbit/shared';

// Comments store mentions as <@userId>, so renaming someone keeps the mention
// pointing at them. While writing, people see and type @Name instead.

const STORED = /<@([0-9a-f-]{36})>/g;

type Person = Pick<UserSummary, 'id' | 'name'>;

/** Stored body → text for the editor: <@id> becomes @Name. */
export function toEditable(body: string, people: Person[]): string {
  return body.replace(STORED, (raw, id: string) => {
    const person = people.find((candidate) => candidate.id === id);
    return person ? `@${person.name}` : raw;
  });
}

/**
 * Editor text → stored body: @Name becomes <@id> for each person on the board.
 * Longer names win, so "@Ann Lee" isn't read as "@Ann" followed by "Lee".
 */
export function toStored(text: string, people: Person[]): string {
  const byLength = [...people].sort((a, b) => b.name.length - a.name.length);
  let result = '';
  let index = 0;
  while (index < text.length) {
    const at = text.indexOf('@', index);
    if (at === -1) break;
    result += text.slice(index, at);
    const startsWord = at === 0 || /\s|[([{]/.test(text[at - 1]!);
    const person = startsWord
      ? byLength.find((candidate) => {
          if (!text.startsWith(candidate.name, at + 1)) return false;
          const next = text[at + 1 + candidate.name.length];
          return next === undefined || !/[\p{L}\p{N}_]/u.test(next);
        })
      : undefined;
    if (person) {
      result += `<@${person.id}>`;
      index = at + 1 + person.name.length;
    } else {
      result += '@';
      index = at + 1;
    }
  }
  return result + text.slice(index);
}

const escapeLinkText = (text: string) => text.replace(/[[\]\\]/g, (char) => `\\${char}`);

/** Stored body → Markdown with mention links, rendered as chips by <Markdown>. */
export function toMarkdown(body: string, people: Person[]): string {
  return body.replace(STORED, (_raw, id: string) => {
    const person = people.find((candidate) => candidate.id === id);
    return `[@${escapeLinkText(person?.name ?? '?')}](mention:${id})`;
  });
}

/** The partial mention being typed right before the caret, e.g. "an" in "hi @an". */
export function mentionQuery(textBeforeCaret: string): string | null {
  const match = /(?:^|\s)@([^\s@]{0,30})$/u.exec(textBeforeCaret);
  return match ? match[1]! : null;
}
