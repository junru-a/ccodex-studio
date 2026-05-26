import type { SkillInfo } from '../types/shared';

type SkillCnMeta = {
  title: string;
  hint: string;
  keywords: string[];
};

const ZH = {
  frontend: '\u524d\u7aef/\u754c\u9762',
  frontendHint: '\u9002\u5408\u505a\u754c\u9762\u3001\u7ec4\u4ef6\u3001\u9875\u9762\u3001\u4eea\u8868\u76d8\u3001\u4ea4\u4e92\u548c\u89c6\u89c9\u4f18\u5316\u3002',
  docs: '\u6587\u6863/\u529e\u516c\u6587\u4ef6',
  docsHint: '\u9002\u5408\u5904\u7406 PDF\u3001Word\u3001PPT\u3001Markdown\u3001Excel \u7b49\u6587\u4ef6\u3002',
  papers: '\u8bba\u6587/\u79d1\u7814\u5199\u4f5c',
  papersHint: '\u9002\u5408\u67e5\u8bba\u6587\u3001\u505a\u7efc\u8ff0\u3001\u5199\u79d1\u7814\u6587\u672c\u3001\u7ba1\u7406\u5f15\u7528\u548c\u8bc4\u5ba1\u3002',
  data: '\u6570\u636e\u5206\u6790/\u53ef\u89c6\u5316',
  dataHint: '\u9002\u5408\u6570\u636e\u6e05\u6d17\u3001\u7edf\u8ba1\u5206\u6790\u3001\u63a2\u7d22\u6027\u5206\u6790\u548c\u7ed8\u56fe\u3002',
  ml: '\u673a\u5668\u5b66\u4e60/\u6a21\u578b',
  mlHint: '\u9002\u5408\u8bad\u7ec3\u3001\u8bc4\u4f30\u3001\u89e3\u91ca\u673a\u5668\u5b66\u4e60\u548c\u6df1\u5ea6\u5b66\u4e60\u6a21\u578b\u3002',
  bio: '\u751f\u4fe1/\u751f\u7269\u533b\u836f',
  bioHint: '\u9002\u5408\u57fa\u56e0\u7ec4\u3001\u5355\u7ec6\u80de\u3001\u86cb\u767d\u3001\u5206\u5b50\u3001\u836f\u7269\u548c\u751f\u7269\u5b9e\u9a8c\u5206\u6790\u3002',
  github: 'GitHub/\u534f\u4f5c',
  githubHint: '\u9002\u5408\u5904\u7406 PR\u3001CI\u3001issue\u3001\u4ee3\u7801\u5ba1\u67e5\u3001\u63d0\u4ea4\u548c\u53d1\u5e03\u3002',
  quantum: '\u91cf\u5b50\u8ba1\u7b97',
  quantumHint: '\u9002\u5408\u91cf\u5b50\u7ebf\u8def\u3001\u91cf\u5b50\u7b97\u6cd5\u3001\u91cf\u5b50\u4eff\u771f\u548c\u91cf\u5b50\u673a\u5668\u5b66\u4e60\u3002',
  geo: '\u5730\u7406\u7a7a\u95f4/GIS',
  geoHint: '\u9002\u5408\u5730\u56fe\u3001\u9065\u611f\u3001\u7a7a\u95f4\u6570\u636e\u3001GeoJSON \u548c GIS \u5206\u6790\u3002',
  general: '\u901a\u7528\u6280\u80fd',
  generalHint: '\u67e5\u770b\u82f1\u6587\u8bf4\u660e\u5224\u65ad\u7528\u9014\uff1b\u9002\u5408\u76f8\u5173\u4efb\u52a1\u65f6\u53ef\u4e00\u952e\u63d2\u5165\u8c03\u7528\u3002',
  noDescHint: '\u6682\u65e0\u8bf4\u660e\uff1b\u5efa\u8bae\u6253\u5f00 SKILL.md \u67e5\u770b\u89e6\u53d1\u6761\u4ef6\u548c\u4f7f\u7528\u65b9\u5f0f\u3002',
};

const EXACT: Record<string, SkillCnMeta> = {
  'frontend-design': {
    title: '\u524d\u7aef\u754c\u9762\u8bbe\u8ba1',
    hint: '\u505a\u7f51\u9875\u3001\u5e94\u7528\u754c\u9762\u3001\u7ec4\u4ef6\u7f8e\u5316\u3001\u4eea\u8868\u76d8\u548c\u4ea4\u4e92\u4f53\u9a8c\u65f6\u4f7f\u7528\u3002',
    keywords: ['\u524d\u7aef', '\u754c\u9762', '\u7f51\u9875', '\u7ec4\u4ef6', '\u7f8e\u5316', 'UI', 'React'],
  },
  pdf: {
    title: 'PDF \u5904\u7406',
    hint: '\u8bfb\u53d6\u3001\u63d0\u53d6\u3001\u8f6c\u6362\u3001\u5206\u6790 PDF \u6587\u4ef6\u65f6\u4f7f\u7528\u3002',
    keywords: ['PDF', '\u6587\u6863', '\u8bfb\u53d6', '\u8f6c\u6362'],
  },
  docx: {
    title: 'Word \u6587\u6863',
    hint: '\u521b\u5efa\u3001\u8bfb\u53d6\u3001\u7f16\u8f91 Word \u6216 .docx \u6587\u4ef6\u65f6\u4f7f\u7528\u3002',
    keywords: ['Word', 'docx', '\u6587\u6863', '\u7f16\u8f91'],
  },
  pptx: {
    title: 'PowerPoint',
    hint: '\u521b\u5efa\u3001\u7f16\u8f91\u3001\u5206\u6790 .pptx \u6f14\u793a\u6587\u7a3f\u65f6\u4f7f\u7528\u3002',
    keywords: ['PPT', 'PowerPoint', '\u5e7b\u706f\u7247'],
  },
  xlsx: {
    title: 'Excel \u8868\u683c',
    hint: '\u5904\u7406 Excel\u3001.xlsx\u3001\u8868\u683c\u5206\u6790\u548c\u5de5\u4f5c\u7c3f\u751f\u6210\u65f6\u4f7f\u7528\u3002',
    keywords: ['Excel', 'xlsx', '\u8868\u683c'],
  },
  'github:gh-fix-ci': {
    title: '\u4fee GitHub CI',
    hint: 'GitHub Actions\u3001PR \u68c0\u67e5\u5931\u8d25\u3001CI \u62a5\u9519\u6392\u67e5\u65f6\u4f7f\u7528\u3002',
    keywords: ['GitHub', 'CI', 'Actions', 'PR'],
  },
  'github:gh-address-comments': {
    title: '\u5904\u7406 PR \u8bc4\u8bba',
    hint: '\u67e5\u770b\u5e76\u9010\u6761\u5904\u7406 GitHub PR review comments \u65f6\u4f7f\u7528\u3002',
    keywords: ['GitHub', 'PR', 'review', '\u8bc4\u8bba'],
  },
  'github:yeet': {
    title: '\u63d0\u4ea4\u5e76\u63a8\u9001',
    hint: '\u6574\u7406\u672c\u5730\u6539\u52a8\u3001\u63d0\u4ea4 commit\u3001push \u5230 GitHub \u65f6\u4f7f\u7528\u3002',
    keywords: ['GitHub', '\u63d0\u4ea4', 'push', 'commit'],
  },
  scanpy: {
    title: '\u5355\u7ec6\u80de\u5206\u6790',
    hint: '\u505a\u5355\u7ec6\u80de RNA-seq \u8d28\u63a7\u3001\u805a\u7c7b\u3001\u964d\u7ef4\u548c\u5dee\u5f02\u5206\u6790\u65f6\u4f7f\u7528\u3002',
    keywords: ['\u5355\u7ec6\u80de', 'RNA', 'scanpy', '\u751f\u4fe1'],
  },
  anndata: {
    title: 'AnnData \u6570\u636e',
    hint: '\u8bfb\u53d6\u548c\u5904\u7406 .h5ad\u3001\u5355\u7ec6\u80de AnnData \u5bf9\u8c61\u65f6\u4f7f\u7528\u3002',
    keywords: ['\u5355\u7ec6\u80de', 'h5ad', 'AnnData', '\u751f\u4fe1'],
  },
  astropy: {
    title: '\u5929\u6587\u6570\u636e',
    hint: '\u5904\u7406\u5929\u6587\u5b66\u3001\u5929\u4f53\u7269\u7406\u3001FITS \u548c\u5750\u6807\u7cfb\u7edf\u65f6\u4f7f\u7528\u3002',
    keywords: ['\u5929\u6587', 'FITS', '\u5929\u4f53\u7269\u7406'],
  },
};

const RULES: Array<{ pattern: RegExp; meta: SkillCnMeta }> = [
  { pattern: /front.?end|react|ui|interface|component|dashboard|design/i, meta: { title: ZH.frontend, hint: ZH.frontendHint, keywords: ['\u524d\u7aef', '\u754c\u9762', '\u7ec4\u4ef6', 'UI'] } },
  { pattern: /pdf|docx|document|word|markdown|pptx|presentation|slides|spreadsheet|xlsx|excel/i, meta: { title: ZH.docs, hint: ZH.docsHint, keywords: ['\u6587\u6863', 'PDF', 'Word', 'PPT', '\u8868\u683c'] } },
  { pattern: /paper|literature|citation|scholar|manuscript|grant|peer.review/i, meta: { title: ZH.papers, hint: ZH.papersHint, keywords: ['\u8bba\u6587', '\u6587\u732e', '\u7efc\u8ff0', '\u5f15\u7528'] } },
  { pattern: /data|analysis|statistics|statistical|plot|visuali[sz]ation|matplotlib|seaborn|polars|pandas/i, meta: { title: ZH.data, hint: ZH.dataHint, keywords: ['\u6570\u636e', '\u7edf\u8ba1', '\u5206\u6790', '\u53ef\u89c6\u5316'] } },
  { pattern: /machine learning|deep learning|transformer|pytorch|sklearn|model|forecast|classification|regression/i, meta: { title: ZH.ml, hint: ZH.mlHint, keywords: ['\u673a\u5668\u5b66\u4e60', '\u6df1\u5ea6\u5b66\u4e60', '\u6a21\u578b'] } },
  { pattern: /genomic|bio|protein|rna|dna|single-cell|molecular|chem|drug|cell/i, meta: { title: ZH.bio, hint: ZH.bioHint, keywords: ['\u751f\u4fe1', '\u57fa\u56e0', '\u86cb\u767d', '\u5355\u7ec6\u80de'] } },
  { pattern: /github|pull request|ci|actions|commit|repository/i, meta: { title: ZH.github, hint: ZH.githubHint, keywords: ['GitHub', 'PR', 'CI', '\u63d0\u4ea4'] } },
  { pattern: /quantum|qiskit|cirq|pennylane|qutip/i, meta: { title: ZH.quantum, hint: ZH.quantumHint, keywords: ['\u91cf\u5b50', '\u7ebf\u8def', '\u4eff\u771f'] } },
  { pattern: /geo|spatial|map|gis|remote sensing/i, meta: { title: ZH.geo, hint: ZH.geoHint, keywords: ['\u5730\u56fe', 'GIS', '\u7a7a\u95f4'] } },
];

export function getSkillCnMeta(skill: SkillInfo): SkillCnMeta {
  const exact = EXACT[skill.name];
  if (exact) return exact;

  const haystack = `${skill.name} ${skill.description}`;
  const rule = RULES.find((candidate) => candidate.pattern.test(haystack));
  if (rule) return rule.meta;

  return {
    title: ZH.general,
    hint: skill.description ? ZH.generalHint : ZH.noDescHint,
    keywords: ['\u6280\u80fd', '\u901a\u7528', '\u5de5\u5177'],
  };
}

export function matchesSkillCnQuery(skill: SkillInfo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const meta = getSkillCnMeta(skill);
  const fields = [skill.name, skill.description, meta.title, meta.hint, ...meta.keywords];
  return fields.some((field) => field.toLowerCase().includes(q));
}

export function scoreSkillForContext(skill: SkillInfo, context: string, usageCount = 0): number {
  const meta = getSkillCnMeta(skill);
  const haystack = [skill.name, skill.description, meta.title, meta.hint, ...meta.keywords].join(' ').toLowerCase();
  const lowerContext = context.toLowerCase();

  let score = Math.min(usageCount, 8) * 2;
  for (const token of meta.keywords) {
    if (lowerContext.includes(token.toLowerCase())) score += 10;
  }

  const rules: Array<[RegExp, RegExp, number]> = [
    [/react|tsx|css|ui|component|frontend|\u9875\u9762|\u754c\u9762|\u7ec4\u4ef6/, /front|react|ui|design|vercel/, 18],
    [/pdf|docx|pptx|xlsx|word|excel|\u6587\u6863|\u8868\u683c/, /pdf|docx|pptx|xlsx|spreadsheet|document/, 18],
    [/paper|\u8bba\u6587|\u6587\u732e|citation|\u7efc\u8ff0/, /paper|literature|citation|scholar|writing/, 18],
    [/error|failed|exception|traceback|\u62a5\u9519|\u5931\u8d25|exit code/, /debug|test|ci|github|vercel|best-practices|frontend/, 14],
    [/data|csv|\u7edf\u8ba1|\u5206\u6790|plot|\u53ef\u89c6\u5316/, /data|stat|plot|matplotlib|seaborn|polars|analysis/, 16],
    [/git|github|pr|ci|actions|commit/, /github|gh-|ci|yeet/, 16],
    [/rna|\u5355\u7ec6\u80de|\u57fa\u56e0|\u86cb\u767d|\u5206\u5b50|\u836f\u7269/, /scanpy|anndata|bio|rdkit|protein|drug|molecular/, 16],
  ];

  for (const [contextPattern, skillPattern, points] of rules) {
    if (contextPattern.test(lowerContext) && skillPattern.test(haystack)) score += points;
  }

  return score;
}
