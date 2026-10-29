import { describe, expect, it } from 'vitest';
import { mentionQuery, toEditable, toMarkdown, toStored } from './mentions';

const ann = { id: '0192d5a0-0000-7000-8000-000000000001', name: 'Ann' };
const annLee = { id: '0192d5a0-0000-7000-8000-000000000002', name: 'Ann Lee' };
const people = [ann, annLee];

describe('mentions', () => {
  it('stores @Name as <@id>, preferring the longest name', () => {
    expect(toStored('Hi @Ann Lee and @Ann!', people)).toBe(`Hi <@${annLee.id}> and <@${ann.id}>!`);
    expect(toStored('mail@Ann.com @Annex @Bob', people)).toBe('mail@Ann.com @Annex @Bob');
  });

  it('shows stored mentions as @Name for editing', () => {
    expect(toEditable(`Hi <@${annLee.id}>`, people)).toBe('Hi @Ann Lee');
    const unknown = '<@0192d5a0-0000-7000-8000-00000000000f>';
    expect(toEditable(unknown, people)).toBe(unknown);
  });

  it('turns mentions into links for rendering', () => {
    expect(toMarkdown(`<@${ann.id}>`, people)).toBe(`[@Ann](mention:${ann.id})`);
    expect(toMarkdown(`<@${ann.id}>`, [{ id: ann.id, name: 'A]nn' }])).toBe(
      `[@A\\]nn](mention:${ann.id})`,
    );
  });

  it('finds the mention being typed', () => {
    expect(mentionQuery('Hi @an')).toBe('an');
    expect(mentionQuery('@')).toBe('');
    expect(mentionQuery('mail@an')).toBeNull();
    expect(mentionQuery('Hi @Ann done')).toBeNull();
  });
});
