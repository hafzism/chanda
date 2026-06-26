import { createHash } from 'node:crypto';

const DEFAULT_MAX_CHARACTERS = 1_600;
const DEFAULT_OVERLAP_CHARACTERS = 200;
const MINIMUM_BREAK_RATIO = 0.55;

export interface TextChunkOptions {
  maxCharacters?: number;
  overlapCharacters?: number;
}

export interface KnowledgeChunk {
  characterEnd: number;
  characterStart: number;
  content: string;
  contentHash: string;
  estimatedTokenCount: number;
  heading: string | null;
  ordinal: number;
}

interface Section {
  end: number;
  heading: string | null;
  start: number;
}

export function normalizeKnowledgeText(input: string): string {
  const normalized = input.normalize('NFC').replace(/\r\n?/g, '\n');
  const withoutUnsafeControls = Array.from(normalized)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        (codePoint === 9 || codePoint === 10 || codePoint > 31) &&
        codePoint !== 127
      );
    })
    .join('');

  return withoutUnsafeControls
    .split('\n')
    .map((line) => line.replace(/[\t ]+$/g, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function estimateTokenCount(input: string): number {
  const units = input.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)?.length ?? 0;
  return Math.max(1, Math.ceil(units * 1.25));
}

export function chunkKnowledgeText(
  input: string,
  options: TextChunkOptions = {},
): KnowledgeChunk[] {
  const text = normalizeKnowledgeText(input);
  if (!text) return [];

  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const overlapCharacters =
    options.overlapCharacters ?? DEFAULT_OVERLAP_CHARACTERS;

  if (maxCharacters < 200) {
    throw new RangeError('maxCharacters must be at least 200.');
  }
  if (overlapCharacters < 0 || overlapCharacters >= maxCharacters / 2) {
    throw new RangeError(
      'overlapCharacters must be non-negative and less than half the chunk size.',
    );
  }

  const chunks: KnowledgeChunk[] = [];
  for (const section of findSections(text)) {
    let cursor = section.start;

    while (cursor < section.end) {
      const rawEnd = Math.min(cursor + maxCharacters, section.end);
      const end =
        rawEnd === section.end
          ? rawEnd
          : findNaturalBreak(text, cursor, rawEnd, maxCharacters);
      const slice = text.slice(cursor, end);
      const leadingWhitespace = slice.length - slice.trimStart().length;
      const trailingWhitespace = slice.length - slice.trimEnd().length;
      const characterStart = cursor + leadingWhitespace;
      const characterEnd = end - trailingWhitespace;
      const content = text.slice(characterStart, characterEnd);

      if (content) {
        chunks.push({
          characterEnd,
          characterStart,
          content,
          contentHash: createHash('sha256').update(content).digest('hex'),
          estimatedTokenCount: estimateTokenCount(content),
          heading: section.heading,
          ordinal: chunks.length,
        });
      }

      if (end >= section.end) break;
      cursor = nextCursor(text, cursor, end, overlapCharacters);
    }
  }

  return chunks;
}

function findSections(text: string): Section[] {
  const headingPattern = /^(?:#{1,6})[\t ]+(.+?)\s*$/gm;
  const headings = [...text.matchAll(headingPattern)];
  if (headings.length === 0) {
    return [{ end: text.length, heading: null, start: 0 }];
  }

  const sections: Section[] = [];
  const firstHeadingIndex = headings[0]?.index ?? 0;
  if (firstHeadingIndex > 0 && text.slice(0, firstHeadingIndex).trim()) {
    sections.push({ end: firstHeadingIndex, heading: null, start: 0 });
  }

  headings.forEach((match, index) => {
    const matchIndex = match.index ?? 0;
    const contentStart = matchIndex + match[0].length;
    const nextMatch = headings[index + 1];
    sections.push({
      end: nextMatch?.index ?? text.length,
      heading: match[1]?.trim() ?? null,
      start: contentStart,
    });
  });

  return sections.filter((section) =>
    text.slice(section.start, section.end).trim(),
  );
}

function findNaturalBreak(
  text: string,
  start: number,
  rawEnd: number,
  maxCharacters: number,
): number {
  const minimum = start + Math.floor(maxCharacters * MINIMUM_BREAK_RATIO);
  const candidates = [
    text.lastIndexOf('\n\n', rawEnd),
    text.lastIndexOf('. ', rawEnd),
    text.lastIndexOf('? ', rawEnd),
    text.lastIndexOf('! ', rawEnd),
    text.lastIndexOf('\n', rawEnd),
    text.lastIndexOf(' ', rawEnd),
  ];
  const boundary = Math.max(...candidates.filter((value) => value >= minimum));
  return boundary >= minimum ? boundary + 1 : rawEnd;
}

function nextCursor(
  text: string,
  previousCursor: number,
  end: number,
  overlapCharacters: number,
): number {
  const overlapStart = Math.max(previousCursor + 1, end - overlapCharacters);
  const nextSpace = text.indexOf(' ', overlapStart);
  const cursor =
    nextSpace >= overlapStart && nextSpace < end ? nextSpace + 1 : overlapStart;
  return Math.min(cursor, end);
}
