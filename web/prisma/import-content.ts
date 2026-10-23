import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ContentStatus, EvidenceLevel, PrismaClient } from '@prisma/client';
import { parseCsv, type ExampleCandidate, type MappingExample } from '../src/lib/content';
import { slugify } from '../src/lib/slug';

const prisma = new PrismaClient();
const dataDir = path.join(process.cwd(), 'public', 'data');

function slug(value: string) {
  return slugify(value) || `entry-${Date.now()}`;
}

function evidence(value: string): EvidenceLevel {
  const grade = value.split('/')[0] as EvidenceLevel;
  return ['A', 'B', 'C', 'D', 'E'].includes(grade) ? grade : EvidenceLevel.D;
}

async function main() {
  const matrix = parseCsv(await readFile(path.join(dataDir, 'dynasty_systems.csv'), 'utf8'));
  const sources = parseCsv(await readFile(path.join(dataDir, 'source_registry.csv'), 'utf8'));
  const { examples } = JSON.parse(await readFile(path.join(dataDir, 'office_mapping_examples.json'), 'utf8')) as { examples: MappingExample[] };

  for (const source of sources) {
    await prisma.source.upsert({
      where: { id: source.source_id },
      update: { title: source.title, authorOrInstitution: source.author_or_institution || null, year: source.year || null, sourceType: source.source_type, authorityGrade: evidence(source.authority_grade), url: source.url || null, coverage: source.coverage || null, notes: source.notes || null, status: ContentStatus.PUBLISHED },
      create: { id: source.source_id, title: source.title, authorOrInstitution: source.author_or_institution || null, year: source.year || null, sourceType: source.source_type, authorityGrade: evidence(source.authority_grade), url: source.url || null, coverage: source.coverage || null, notes: source.notes || null, status: ContentStatus.PUBLISHED },
    });
  }

  const periodNames = [...new Set(matrix.map((row) => row.period))];
  const periods = new Map<string, string>();
  for (const [index, name] of periodNames.entries()) {
    const record = await prisma.period.upsert({
      where: { slug: slug(name) },
      update: { name, summary: `制度矩阵与研究报告中的${name}时期卡片`, sortOrder: index, status: ContentStatus.PUBLISHED },
      create: { slug: slug(name), name, regimeGroup: name, summary: `制度矩阵与研究报告中的${name}时期卡片`, sortOrder: index, status: ContentStatus.PUBLISHED },
    });
    periods.set(name, record.id);
  }

  for (const [index, row] of matrix.entries()) {
    const periodId = periods.get(row.period);
    if (!periodId) continue;
    const sourceIds = String(row.source_ids ?? '').split(';').filter(Boolean);
    await prisma.matrixEntry.upsert({
      where: { periodId_dimension: { periodId, dimension: row.dimension } },
      update: { legalStructure: row.legal_structure, actualOperation: row.actual_operation, reformsRisks: row.reforms_risks, evidenceGrade: row.evidence_grade, sourceIds, notes: row.notes || null, sortOrder: index, status: ContentStatus.PUBLISHED },
      create: { periodId, dimension: row.dimension, legalStructure: row.legal_structure, actualOperation: row.actual_operation, reformsRisks: row.reforms_risks, evidenceGrade: row.evidence_grade, sourceIds, notes: row.notes || null, sortOrder: index, status: ContentStatus.PUBLISHED },
    });
  }

  for (const example of examples) {
    const candidates: ExampleCandidate[] = [example.primary, ...example.alternatives];
    for (const [candidateIndex, candidate] of candidates.entries()) {
      const periodName = periodNames.find((name) => candidate.ancient_candidate.includes(name.split('（')[0])) ?? periodNames.find((name) => candidate.ancient_candidate.includes(name.slice(0, 2))) ?? periodNames[0];
      const periodId = periods.get(periodName);
      if (!periodId) continue;
      const officeName = candidate.ancient_candidate;
      const officeSlug = `${slug(officeName)}-${slug(example.modern_input)}`;
      const office = await prisma.office.upsert({
        where: { slug: officeSlug },
        update: { name: officeName, aliases: example.aliases ?? [], actualOperation: candidate.daily_activities, authorityBoundaries: [candidate.duty_difference], legalDuties: candidate.daily_activities, rankComparability: '不可直接换算', modernInput: example.modern_input, candidateIndex, similarity: candidate.similarity, confidence: candidate.confidence, evidenceLevel: candidate.evidence_level, sourceIds: candidate.source_ids, status: ContentStatus.PUBLISHED },
        create: { slug: officeSlug, name: officeName, aliases: example.aliases ?? [], institutionLevel: '中央', functionDomains: [], legalDuties: candidate.daily_activities, authorityBoundaries: [candidate.duty_difference], actualOperation: candidate.daily_activities, appointmentAndCareer: [], rankComparability: '不可直接换算', modernInput: example.modern_input, candidateIndex, similarity: candidate.similarity, confidence: candidate.confidence, evidenceLevel: candidate.evidence_level, sourceIds: candidate.source_ids, periodId, status: ContentStatus.PUBLISHED },
      });
      await prisma.lifestyleProfile.upsert({ where: { officeId: office.id }, update: { typicalTasks: candidate.daily_activities, scheduleOrWorkCycle: [], officeAndResidence: [candidate.life], attire: { officialOrPublicDress: candidate.clothing }, transport: null, foodAndConsumption: candidate.life, salaryAndAllowances: null, healthAndMedicine: null, ritualsAndHolidays: null, familyAndSocial: null, leisure: null, risks: candidate.risks, uncertaintyNotes: ['示例内容需在后台补充具体朝代和原典定位'], status: ContentStatus.PUBLISHED }, create: { officeId: office.id, typicalTasks: candidate.daily_activities, scheduleOrWorkCycle: [], officeAndResidence: [candidate.life], attire: { officialOrPublicDress: candidate.clothing }, transport: null, foodAndConsumption: candidate.life, salaryAndAllowances: null, healthAndMedicine: null, ritualsAndHolidays: null, familyAndSocial: null, leisure: null, risks: candidate.risks, uncertaintyNotes: ['示例内容需在后台补充具体朝代和原典定位'], status: ContentStatus.PUBLISHED } });
    }
  }
  console.log(`Imported ${sources.length} sources, ${periodNames.length} periods, ${matrix.length} matrix entries and ${examples.length * 3} office examples.`);
}

main().finally(() => prisma.$disconnect());
