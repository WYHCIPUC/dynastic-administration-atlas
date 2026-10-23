import { ContentStatus, type MatrixEntry, type Period } from '@prisma/client';
import { prisma } from './prisma';
import { slugify } from './slug';
import type { ExampleCandidate, MappingExample, MatrixRow, SourceRow } from './content';

function fail(context: string, error: unknown): never {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`已发布内容读取失败（${context}）：${detail}`);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toMatrixRows(periods: Array<Period & { matrixEntries: MatrixEntry[] }>): MatrixRow[] {
  return periods.flatMap((period) =>
    period.matrixEntries.map((entry) => ({
      period: period.name,
      regime: period.regimeGroup,
      dimension: entry.dimension,
      legal_structure: entry.legalStructure,
      actual_operation: entry.actualOperation,
      reforms_risks: entry.reformsRisks,
      source_ids: stringArray(entry.sourceIds).join(';'),
      evidence_grade: entry.evidenceGrade,
      notes: entry.notes ?? '',
    })),
  );
}

export async function loadPublishedMatrix(): Promise<MatrixRow[]> {
  try {
    const periods = await prisma.period.findMany({
      where: { status: ContentStatus.PUBLISHED },
      orderBy: { sortOrder: 'asc' },
      include: { matrixEntries: { where: { status: ContentStatus.PUBLISHED }, orderBy: { sortOrder: 'asc' } } },
    });
    return toMatrixRows(periods);
  } catch (error) {
    fail('制度矩阵', error);
  }
}

export async function findPublishedPeriod(slug: string): Promise<{ name: string; summary: string; rows: MatrixRow[] } | null> {
  try {
    const period = await prisma.period.findFirst({
      where: { status: ContentStatus.PUBLISHED, OR: [{ slug }, { name: slug }] },
      include: { matrixEntries: { where: { status: ContentStatus.PUBLISHED }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!period) return null;
    return { name: period.name, summary: period.summary, rows: toMatrixRows([period]) };
  } catch (error) {
    fail(`时期制度卡 ${slug}`, error);
  }
}

export async function loadPublishedSources(): Promise<SourceRow[]> {
  try {
    const sources = await prisma.source.findMany({ where: { status: ContentStatus.PUBLISHED }, orderBy: { id: 'asc' } });
    return sources.map((source) => ({
      source_id: source.id,
      title: source.title,
      author_or_institution: source.authorOrInstitution ?? '',
      year: source.year ?? '',
      source_type: source.sourceType,
      authority_grade: source.authorityGrade,
      url: source.url ?? '',
      coverage: source.coverage ?? '',
      notes: source.notes ?? '',
      locator: source.locator ?? '',
    }));
  } catch (error) {
    fail('来源索引', error);
  }
}

type OfficeWithLifestyle = NonNullable<Awaited<ReturnType<typeof findOfficeWithLifestyle>>>;

async function findOfficeWithLifestyle(slug: string) {
  return prisma.office.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED, modernInput: { not: null } },
    include: { lifestyle: true },
  });
}

function toCandidate(office: OfficeWithLifestyle): ExampleCandidate {
  const attire = office.lifestyle?.attire;
  const clothing = attire && typeof attire === 'object' && !Array.isArray(attire)
    ? String((attire as Record<string, unknown>).officialOrPublicDress ?? '')
    : '';
  return {
    ancient_candidate: office.name,
    similarity: office.similarity ?? 0,
    confidence: office.confidence ?? '',
    duty_difference: stringArray(office.authorityBoundaries)[0] ?? '',
    daily_activities: stringArray(office.actualOperation),
    clothing,
    life: office.lifestyle?.foodAndConsumption ?? '',
    risks: stringArray(office.lifestyle?.risks),
    evidence_level: office.evidenceLevel ?? '',
    source_ids: stringArray(office.sourceIds),
  };
}

export async function loadPublishedExamples(): Promise<MappingExample[]> {
  try {
    const offices = await prisma.office.findMany({
      where: { status: ContentStatus.PUBLISHED, modernInput: { not: null } },
      include: { lifestyle: true },
      orderBy: [{ modernInput: 'asc' }, { candidateIndex: 'asc' }],
    });
    const groups = new Map<string, OfficeWithLifestyle[]>();
    for (const office of offices) {
      if (!office.modernInput) continue;
      const list = groups.get(office.modernInput) ?? [];
      list.push(office);
      groups.set(office.modernInput, list);
    }
    return [...groups.entries()].flatMap(([modern_input, list]) => {
      const [first, ...rest] = list;
      if (!first) return [];
      const example: MappingExample = { modern_input, primary: toCandidate(first), alternatives: rest.map(toCandidate) };
      const aliases = stringArray(first.aliases);
      if (aliases.length) example.aliases = aliases;
      return [example];
    });
  } catch (error) {
    fail('职位映射案例', error);
  }
}

export async function findPublishedOfficeBySlug(slug: string): Promise<{ office: ExampleCandidate; modernExample: string; officeSlug: string } | null> {
  try {
    let office = await findOfficeWithLifestyle(slug);
    if (!office) {
      const candidates = await prisma.office.findMany({
        where: { status: ContentStatus.PUBLISHED, modernInput: { not: null } },
        include: { lifestyle: true },
      });
      office = candidates.find((item) => slugify(item.name) === slug) ?? null;
    }
    if (!office?.modernInput) return null;
    return { office: toCandidate(office), modernExample: office.modernInput, officeSlug: office.slug };
  } catch (error) {
    fail(`官职档案 ${slug}`, error);
  }
}
