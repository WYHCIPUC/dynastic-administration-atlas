import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, ContentStatus, EvidenceLevel } from '@prisma/client';

const prisma = new PrismaClient();
const dataDir = path.join(process.cwd(), 'public', 'data');

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { fields.push(current); current = ''; }
    else current += char;
  }
  fields.push(current);
  return fields;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] ?? '');
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parseCsvLine(line)[index] ?? ''])));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^\u4e00-\u9fff\w]+/g, '-').replace(/^-|-$/g, '') || `entry-${Date.now()}`;
}

function evidence(value: string): EvidenceLevel {
  const grade = value.split('/')[0] as EvidenceLevel;
  return ['A', 'B', 'C', 'D', 'E'].includes(grade) ? grade : EvidenceLevel.D;
}

async function main() {
  const matrix = parseCsv(await readFile(path.join(dataDir, 'dynasty_systems.csv'), 'utf8'));
  const sources = parseCsv(await readFile(path.join(dataDir, 'source_registry.csv'), 'utf8'));
  const examples = JSON.parse(await readFile(path.join(dataDir, 'office_mapping_examples.json'), 'utf8')) as { examples: Array<{ modern_input: string; primary: any; alternatives: any[] }> };

  for (const source of sources) {
    await prisma.source.upsert({
      where: { id: source.source_id },
      update: { title: source.title, authorOrInstitution: source.author_or_institution || null, year: source.year || null, sourceType: source.source_type, authorityGrade: evidence(source.authority_grade), url: source.url || null, coverage: source.coverage || null, notes: source.notes || null, status: ContentStatus.PUBLISHED },
      create: { id: source.source_id, title: source.title, authorOrInstitution: source.author_or_institution || null, year: source.year || null, sourceType: source.source_type, authorityGrade: evidence(source.authority_grade), url: source.url || null, coverage: source.coverage || null, notes: source.notes || null, status: ContentStatus.PUBLISHED },
    });
  }

  const periodNames = [...new Set(matrix.map((row) => row.period))];
  const periods = new Map<string, string>();
  for (const name of periodNames) {
    const record = await prisma.period.upsert({ where: { slug: slug(name) }, update: { name, summary: `制度矩阵与研究报告中的${name}时期卡片`, status: ContentStatus.PUBLISHED }, create: { slug: slug(name), name, regimeGroup: name, summary: `制度矩阵与研究报告中的${name}时期卡片`, status: ContentStatus.PUBLISHED } });
    periods.set(name, record.id);
  }

  for (const example of examples.examples) {
    const candidates = [example.primary, ...example.alternatives];
    for (const candidate of candidates) {
      const periodName = periodNames.find((name) => candidate.ancient_candidate.includes(name.split('（')[0])) ?? periodNames.find((name) => candidate.ancient_candidate.includes(name.slice(0, 2))) ?? periodNames[0];
      const periodId = periods.get(periodName);
      if (!periodId) continue;
      const officeName = candidate.ancient_candidate;
      const officeSlug = `${slug(officeName)}-${slug(example.modern_input)}`;
      const office = await prisma.office.upsert({
        where: { slug: officeSlug },
        update: { name: officeName, actualOperation: candidate.daily_activities, authorityBoundaries: [candidate.duty_difference], legalDuties: candidate.daily_activities, functionDomains: [], rankComparability: '不可直接换算', status: ContentStatus.PUBLISHED },
        create: { slug: officeSlug, name: officeName, aliases: [], institutionLevel: '中央', functionDomains: [], legalDuties: candidate.daily_activities, authorityBoundaries: [candidate.duty_difference], actualOperation: candidate.daily_activities, appointmentAndCareer: [], rankComparability: '不可直接换算', periodId, status: ContentStatus.PUBLISHED },
      });
      await prisma.lifestyleProfile.upsert({ where: { officeId: office.id }, update: { typicalTasks: candidate.daily_activities, scheduleOrWorkCycle: [], officeAndResidence: [candidate.life], attire: { officialOrPublicDress: candidate.clothing }, transport: null, foodAndConsumption: candidate.life, salaryAndAllowances: null, healthAndMedicine: null, ritualsAndHolidays: null, familyAndSocial: null, leisure: null, risks: candidate.risks, uncertaintyNotes: ['示例内容需在后台补充具体朝代和原典定位'], status: ContentStatus.PUBLISHED }, create: { officeId: office.id, typicalTasks: candidate.daily_activities, scheduleOrWorkCycle: [], officeAndResidence: [candidate.life], attire: { officialOrPublicDress: candidate.clothing }, transport: null, foodAndConsumption: candidate.life, salaryAndAllowances: null, healthAndMedicine: null, ritualsAndHolidays: null, familyAndSocial: null, leisure: null, risks: candidate.risks, uncertaintyNotes: ['示例内容需在后台补充具体朝代和原典定位'], status: ContentStatus.PUBLISHED } });
    }
  }
  console.log(`Imported ${sources.length} sources, ${periodNames.length} periods and ${examples.examples.length * 3} office examples.`);
}

main().finally(() => prisma.$disconnect());
