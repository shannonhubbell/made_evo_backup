/**
 * Heuristic matcher that maps an event title to the most likely Contentful Program,
 * using:
 *   1. Exact-title precedent: if this exact title was previously classified, reuse it.
 *   2. Substring precedent: if a program's own title appears inside the event title
 *      (e.g. "MADE Classroom: Level Design" contains "MADE Classroom").
 *   3. Fuzzy word-overlap: compares event title words against a "bag of words" built
 *      from the program's title + the titles of events already associated with it.
 *
 * Intentionally conservative: only returns a match when there's a single best program
 * (no ties) with real word evidence, so ambiguous events are left for manual review
 * instead of being force-mapped.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'at', 'in', 'on', 'for', 'with', 'to', 'of', 'and', 'made', 'this', 'is', 'it', '&',
]);

export function normalizeTitle(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Loose token equality allowing simple prefix-based stemming (e.g. "volunteer" / "volunteering"). */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

function scoreOverlap(eventTokens: Set<string>, bag: Set<string>): number {
  let score = 0;
  for (const et of eventTokens) {
    for (const bt of bag) {
      if (tokensMatch(et, bt)) {
        score++;
        break;
      }
    }
  }
  return score;
}

export interface ProgramInfo {
  id: string;
  title: string;
}

export interface TrainingEvent {
  title: string;
  programId: string;
}

interface ProgramIndexEntry {
  id: string;
  title: string;
  normalizedTitle: string;
  bag: Set<string>;
}

export interface ProgramIndex {
  entries: ProgramIndexEntry[];
  exactTitleMap: Map<string, string>;
}

export function buildProgramIndex(programs: ProgramInfo[], trainingEvents: TrainingEvent[]): ProgramIndex {
  const entries: ProgramIndexEntry[] = programs
    .filter((p) => !!p.title)
    .map((p) => ({
      id: p.id,
      title: p.title,
      normalizedTitle: normalizeTitle(p.title),
      bag: new Set(tokenize(p.title)),
    }));

  const exactTitleMap = new Map<string, string>();
  for (const ev of trainingEvents) {
    if (!ev.title) continue;
    const entry = entries.find((p) => p.id === ev.programId);
    if (entry) {
      for (const t of tokenize(ev.title)) entry.bag.add(t);
    }
    const norm = normalizeTitle(ev.title);
    if (!exactTitleMap.has(norm)) {
      exactTitleMap.set(norm, ev.programId);
    }
  }

  return { entries, exactTitleMap };
}

export interface ProgramMatch {
  programId: string;
  programTitle: string;
  confidence: 'exact' | 'substring' | 'fuzzy';
  score?: number;
}

export function matchProgram(eventTitle: string, index: ProgramIndex): ProgramMatch | null {
  if (!eventTitle) return null;
  const norm = normalizeTitle(eventTitle);

  const exactProgramId = index.exactTitleMap.get(norm);
  if (exactProgramId) {
    const entry = index.entries.find((p) => p.id === exactProgramId);
    if (entry) return { programId: entry.id, programTitle: entry.title, confidence: 'exact' };
  }

  for (const p of index.entries) {
    if (p.normalizedTitle && norm.includes(p.normalizedTitle)) {
      return { programId: p.id, programTitle: p.title, confidence: 'substring' };
    }
  }

  const eventTokens = new Set(tokenize(eventTitle));
  if (eventTokens.size === 0) return null;

  let bestId: string | null = null;
  let bestTitle = '';
  let bestScore = 0;
  let tieCount = 0;
  for (const p of index.entries) {
    const score = scoreOverlap(eventTokens, p.bag);
    if (score > bestScore) {
      bestScore = score;
      bestId = p.id;
      bestTitle = p.title;
      tieCount = 1;
    } else if (score === bestScore && score > 0) {
      tieCount++;
    }
  }

  if (bestId && bestScore >= 1 && tieCount === 1) {
    return { programId: bestId, programTitle: bestTitle, confidence: 'fuzzy', score: bestScore };
  }

  return null;
}
