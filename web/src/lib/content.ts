import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');

export type ExampleCandidate = {
  ancient_candidate: string;
  similarity: number;
  confidence: string;
  duty_difference: string;
  daily_activities: string[];
  clothing: string;
  life: string;
  risks: string[];
  evidence_level: string;
  source_ids: string[];
};

export type MappingExample = {
  modern_input: string;
  primary: ExampleCandidate;
  alternatives: ExampleCandidate[];
};

export type SourceRow = Record<string, string>;
export type MatrixRow = Record<string, string>;

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(dataDir, filename), 'utf8')) as T;
}

export async function loadExamples(): Promise<MappingExample[]> {
  const payload = await readJson<{ examples: MappingExample[] }>('office_mapping_examples.json');
  return payload.examples;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsv(text: string): SourceRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

export async function loadSources(): Promise<SourceRow[]> {
  return parseCsv(await readFile(path.join(dataDir, 'source_registry.csv'), 'utf8'));
}

export async function loadMatrix(): Promise<MatrixRow[]> {
  return parseCsv(await readFile(path.join(dataDir, 'dynasty_systems.csv'), 'utf8'));
}
