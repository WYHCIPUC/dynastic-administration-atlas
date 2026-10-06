import { loadExamples } from '@/lib/content';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const examples = await loadExamples();
  for (const example of examples) {
    for (const candidate of [example.primary, ...example.alternatives]) {
      const candidateSlug = `${slugify(candidate.ancient_candidate)}-${slugify(example.modern_input)}`;
      if (candidateSlug === slug || slugify(candidate.ancient_candidate) === slug) {
        return Response.json({ office: candidate, modernExample: example.modern_input, officeSlug: candidateSlug });
      }
    }
  }
  return Response.json({ error: '官职不存在' }, { status: 404 });
}
