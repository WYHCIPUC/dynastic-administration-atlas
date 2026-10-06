import { loadExamples, type ExampleCandidate, type MappingExample } from './content';

const domains: Record<string, string[]> = {
  finance: ['财政', '税务', '财务', '预算', '国库', '审计', '赋税', '田赋', '漕运', '盐政'],
  military: ['军队', '军事', '军区', '驻防', '边防', '司令', '兵营', '武官', '武警', '作战'],
  policing: ['公安', '警察', '治安', '刑侦', '捕盗', '巡检', '监狱'],
  justice: ['法院', '检察', '司法', '审判', '刑狱', '律法', '案件'],
  administration: ['政府', '行政', '厅', '局', '委', '部', '处', '县长', '市长', '省长', '主任'],
  education: ['教育', '学校', '教委', '大学', '教师', '科举', '讲学'],
  medical: ['医院', '医疗', '医生', '卫生', '药', '医馆', '疾病'],
  engineering: ['工程', '水利', '交通', '建设', '工务', '营造'],
  frontier: ['外交', '使馆', '边疆', '民族', '西藏', '新疆', '蒙古', '藩属', '都护'],
  technology: ['技术', '研发', '工程师', '研究员', '实验室', '软件', '科学'],
};

const levels: Record<string, string[]> = {
  central: ['中央', '国家', '部委', '国务院', '京师', '朝廷'],
  provincial: ['省', '省级', '厅', '巡抚', '总督'],
  prefectural: ['市', '地区', '府', '州'],
  county: ['县', '县级'],
  grassroots: ['乡', '镇', '街道', '村', '里'],
  frontier: ['边疆', '边防', '驻防', '口岸', '都护'],
};

export type MatchResult = ExampleCandidate & {
  modern_input: string;
  matched_domains: string[];
  matched_levels: string[];
  score: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, '');
}

function detect(value: string, dictionary: Record<string, string[]>) {
  const normalized = normalize(value);
  return Object.entries(dictionary)
    .filter(([, words]) => words.some((word) => normalized.includes(word)))
    .map(([key]) => key);
}

function candidateText(candidate: ExampleCandidate) {
  return normalize([
    candidate.ancient_candidate,
    candidate.duty_difference,
    candidate.daily_activities.join(' '),
    candidate.clothing,
    candidate.life,
    candidate.risks.join(' '),
  ].join(' '));
}

function score(query: string, modernInput: string, candidate: ExampleCandidate): MatchResult {
  const queryDomains = new Set(detect(query, domains));
  const queryLevels = new Set(detect(query, levels));
  const text = `${normalize(modernInput)} ${candidateText(candidate)}`;
  const candidateDomains = new Set(detect(text, domains));
  const candidateLevels = new Set(detect(text, levels));
  const domainHits = [...queryDomains].filter((domain) => candidateDomains.has(domain));
  const levelHits = [...queryLevels].filter((level) => candidateLevels.has(level));
  const lexical = normalize(modernInput) === normalize(query) ? 1 : Math.min(1, normalize(query).length / Math.max(normalize(modernInput).length, 1));
  const domainScore = queryDomains.size ? domainHits.length / queryDomains.size : lexical;
  const levelScore = queryLevels.size ? levelHits.length / queryLevels.size : 0.5;
  const baseScore = Math.max(0, Math.min(1, Number(candidate.similarity) || 0));
  const authorityScore = (candidateDomains.size ? domainHits.length / candidateDomains.size : lexical) * 0.55 + baseScore * 0.45;
  const scopeScore = levelScore;
  const timeScore = /秦|汉|魏晋|南北朝|隋唐|宋|辽|西夏|金|元|明|清/.test(query) && !candidateText(candidate).includes(normalize(query)) ? 0.45 : 1;
  const evidenceScore = candidate.source_ids.length >= 2 ? 1 : candidate.source_ids.length ? 0.8 : 0.2;
  // 首版采用可审计的六项加权模型；现代职级不参与品秩换算。
  const resultScore = Math.min(1, 0.35 * domainScore + 0.20 * levelScore + 0.15 * authorityScore + 0.10 * scopeScore + 0.10 * timeScore + 0.10 * evidenceScore);
  return {
    ...candidate,
    modern_input: modernInput,
    matched_domains: domainHits,
    matched_levels: levelHits,
    score: Number(resultScore.toFixed(3)),
  };
}

export function inferScenario(query: string) {
  const detectedLevels = detect(query, levels);
  let location = '按候选官职的典型驻地分别呈现';
  if (detectedLevels.includes('frontier')) location = '边疆驻防或边镇';
  else if (detectedLevels.includes('central')) location = '京师中央官署';
  else if (detectedLevels.includes('provincial')) location = '省城或路府治所';
  else if (detectedLevels.includes('prefectural')) location = '府州城';
  else if (detectedLevels.includes('county')) location = '县城与县署';
  else if (detectedLevels.includes('grassroots')) location = '乡里、里甲或保甲基层';
  return {
    dynasty: '未指定；按候选官职所属时期分别呈现',
    location,
    assumption: '现代输入未指定朝代和地区，生活细节使用典型情景，并把推测标为情景重建。',
  };
}

export async function matchRole(query: string, limit = 3) {
  const examples = await loadExamples();
  const candidates = examples.flatMap((example: MappingExample) => [
    score(query, example.modern_input, example.primary),
    ...example.alternatives.map((candidate) => score(query, example.modern_input, candidate)),
  ]);
  const results = candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  return {
    query,
    inferredScenario: inferScenario(query),
    detectedDomains: detect(query, domains),
    detectedLevels: detect(query, levels),
    candidates: results,
  };
}
