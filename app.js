/*
 * 历代行政静态数据应用（原生 JavaScript）
 *
 * index.html 只需要引入本文件，并提供下列 data-* 钩子（都不是强制的）：
 *   [data-role-input] / [data-role-form] / [data-action="match"]
 *   [data-match-results] / [data-match-scenario] / [data-match-error]
 *   [data-matrix-search] / [data-matrix-list]
 *   [data-source-search] / [data-source-list]
 *   [data-loading] / [data-error]
 * 若页面没有这些元素，数据仍会加载，并可通过 window.HistoricalAdminApp API 使用。
 */

(function (global) {
  'use strict';

  var DEFAULT_PATHS = {
    examples: [
      './data/office_mapping_examples.json',
      '/data/office_mapping_examples.json',
      './office_mapping_examples.json',
      '/office_mapping_examples.json',
      './public/data/office_mapping_examples.json'
    ],
    matrix: [
      './data/dynasty_systems.csv',
      '/data/dynasty_systems.csv',
      './dynasty_systems.csv',
      '/dynasty_systems.csv',
      './public/data/dynasty_systems.csv'
    ],
    sources: [
      './data/source_registry.csv',
      '/data/source_registry.csv',
      './source_registry.csv',
      '/source_registry.csv',
      './public/data/source_registry.csv'
    ]
  };

  var EXAMPLE_ALIASES = {
    '财政厅厅长': ['财政厅', '财政部门负责人', '预算负责人', '财税负责人', '财务厅长', '财政局长'],
    '县公安局长': ['公安局长', '县公安负责人', '县警察局长', '治安负责人', '公安负责人'],
    '军分区主官': ['军分区司令', '军分区政委', '军队区域主官', '驻军主官', '军区负责人'],
    '医院负责人': ['医院院长', '医疗机构负责人', '医院管理者', '医疗部门负责人'],
    '企业技术人员': ['企业工程师', '技术负责人', '研发人员', '生产技术人员', '公司技术人员'],
    '省级教育部门负责人': ['教育部门负责人', '教育厅负责人', '教育局长', '省教育负责人', '教育主管'],
    '法院院长': ['法院负责人', '审判机关负责人', '司法机构负责人', '高级法院院长'],
    '边疆事务负责人': ['边疆负责人', '边疆事务主管', '边境事务负责人', '民族边疆负责人', '边防负责人']
  };

  var DIMENSION_LABELS = {
    political_administration: '政治与行政',
    finance_economy: '财政与经济',
    military_frontier: '军务与边疆',
    law_oversight: '法律与监察',
    personnel_education: '选官与教育',
    ritual_religion: '礼制与宗教',
    social_daily_life: '社会与日常',
    reform_crisis: '改革与危机'
  };

  var state = {
    examples: [],
    matrix: [],
    sources: [],
    query: '',
    candidates: [],
    scenario: null,
    candidateFilter: 'all',
    selectedIndex: 0,
    matrixQuery: '',
    matrixFilters: {},
    matrixPeriods: null,
    matrixLimit: 12,
    sourceQuery: '',
    sourceLimit: 10,
    loading: true,
    errors: [],
    ready: false
  };

  var listenersBound = false;

  function toText(value) {
    if (value === undefined || value === null) return '';
    return String(value);
  }

  function normalize(value) {
    return toText(value)
      .toLowerCase()
      .replace(/[“”‘’「」『』（）()［］[\]【】{}<>《》、，。；：:·|/\\_\-—–…!?！？\s]+/g, '');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return toText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  }

  function csvParse(text) {
    var input = toText(text).replace(/^\uFEFF/, '');
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;
    var i;
    for (i = 0; i < input.length; i += 1) {
      var ch = input[i];
      if (quoted) {
        if (ch === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"' && field.length === 0) {
        quoted = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && input[i + 1] === '\n') i += 1;
        row.push(field);
        if (row.some(function (cell) { return cell !== ''; })) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      if (row.some(function (cell) { return cell !== ''; })) rows.push(row);
    }
    if (!rows.length) return [];
    var headers = rows[0].map(function (header) { return toText(header).trim(); });
    return rows.slice(1).map(function (cells) {
      var record = {};
      headers.forEach(function (header, index) {
        record[header] = toText(cells[index]).trim();
      });
      return record;
    });
  }

  function fetchFirst(paths, parser) {
    var index = 0;
    function next(lastError) {
      if (index >= paths.length) {
        return Promise.reject(lastError || new Error('找不到数据文件'));
      }
      var path = paths[index];
      index += 1;
      return fetch(path, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
          return response.text();
        })
        .then(parser)
        .catch(next);
    }
    return next();
  }

  function findAll(selectors, scope) {
    if (typeof document === 'undefined') return [];
    var target = scope || document;
    var seen = [];
    selectors.forEach(function (selector) {
      target.querySelectorAll(selector).forEach(function (node) {
        if (seen.indexOf(node) < 0) seen.push(node);
      });
    });
    return seen;
  }

  function first(selectors, scope) {
    var all = findAll(selectors, scope);
    return all[0] || null;
  }

  function setVisible(nodes, visible) {
    nodes.forEach(function (node) {
      node.hidden = !visible;
      node.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  function setText(nodes, value) {
    nodes.forEach(function (node) {
      node.textContent = toText(value);
    });
  }

  function renderLoading() {
    var nodes = findAll(['[data-loading]', '[data-state="loading"]']);
    setVisible(nodes, state.loading);
    var containers = findAll(['[data-app]', '[data-role-app]']);
    containers.forEach(function (node) { node.setAttribute('aria-busy', state.loading ? 'true' : 'false'); });
  }

  function renderError() {
    var nodes = findAll(['[data-error]', '[data-app-error]', '[data-match-error]']);
    var message = state.errors.join('；');
    setText(nodes, message);
    setVisible(nodes, Boolean(message));
  }

  function renderEmpty(container, message) {
    if (!container) return;
    container.innerHTML = '<div class="empty" data-empty role="status">' + escapeHtml(message) + '</div>';
  }

  function similarity(a, b) {
    var left = normalize(a);
    var right = normalize(b);
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.indexOf(right) >= 0 || right.indexOf(left) >= 0) {
      return 0.78 + 0.22 * (Math.min(left.length, right.length) / Math.max(left.length, right.length));
    }
    var leftChars = left.split('');
    var rightChars = right.split('');
    var common = 0;
    leftChars.forEach(function (character) {
      var index = rightChars.indexOf(character);
      if (index >= 0) {
        common += 1;
        rightChars.splice(index, 1);
      }
    });
    return (2 * common) / (left.length + right.length);
  }

  function exampleLabel(example) {
    return toText(example && example.modern_input).trim();
  }

  function allExampleTerms(example) {
    var label = exampleLabel(example);
    return [label].concat(EXAMPLE_ALIASES[label] || []);
  }

  function termsForQuery(query) {
    var normalizedQuery = normalize(query);
    var terms = [toText(query)];
    Object.keys(EXAMPLE_ALIASES).forEach(function (label) {
      EXAMPLE_ALIASES[label].forEach(function (alias) {
        if (normalizedQuery.indexOf(normalize(alias)) >= 0 || normalize(alias).indexOf(normalizedQuery) >= 0) {
          terms.push(label);
        }
      });
      if (normalizedQuery.indexOf(normalize(label)) >= 0 || normalize(label).indexOf(normalizedQuery) >= 0) terms.push(label);
    });
    return terms;
  }

  function scoreExample(query, example) {
    var terms = termsForQuery(query);
    var best = 0;
    allExampleTerms(example).forEach(function (term) {
      terms.forEach(function (queryTerm) { best = Math.max(best, similarity(queryTerm, term)); });
    });
    var queryNormalized = normalize(query);
    var labelNormalized = normalize(exampleLabel(example));
    var label = exampleLabel(example);
    var aliases = EXAMPLE_ALIASES[label] || [];
    var semantic = 0;
    aliases.forEach(function (alias) {
      if (queryNormalized.indexOf(normalize(alias)) >= 0) semantic = Math.max(semantic, 1);
    });
    Object.keys(EXAMPLE_ALIASES).forEach(function (key) {
      var keyNorm = normalize(key);
      if (queryNormalized.indexOf(keyNorm) >= 0 && label === key) semantic = 1;
    });
    var fit = Math.max(best, semantic);
    var base = Number(example.primary && (example.primary.similarity || example.primary.score)) || 0;
    return clamp(0.52 * fit + 0.48 * base, 0, 1);
  }

  function inferScenario(query, candidate) {
    var title = toText(candidate && candidate.ancient_candidate);
    var dynasty = (title.match(/[（(]([^）)]+)[）)]/) || [])[1] || '跨时期制度参照';
    var normalized = normalize(query);
    var location = '依输入职位的职能与辖区推定';
    if (normalized.indexOf('县') >= 0) location = '县域或基层行政单元';
    else if (normalized.indexOf('省') >= 0 || normalized.indexOf('厅') >= 0) location = '区域／省级行政单元';
    else if (normalized.indexOf('军') >= 0 || normalized.indexOf('边') >= 0) location = '军镇或边疆驻地';
    else if (normalized.indexOf('医院') >= 0) location = '官署医疗机构或宫廷医疗机构';
    else if (normalized.indexOf('企业') >= 0) location = '官营工场或技术生产单位';
    return {
      dynasty: dynasty,
      location: location,
      assumption: '结果按职能相似度生成，仅作历史类比；现代职级不直接换算古代品秩。'
    };
  }

  function confidenceFor(candidate, score) {
    var source = toText(candidate && candidate.confidence);
    if (source) return source;
    if (score >= 0.75) return '高';
    if (score >= 0.52) return '中';
    return '低';
  }

  function evidenceKey(level) {
    var map = { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' };
    return map[String(level || '').trim().charAt(0).toUpperCase()] || 'd';
  }

  function normalizeCandidate(raw, score) {
    var candidate = raw || {};
    var actualScore = clamp(Number(score || candidate.similarity || candidate.score || 0), 0, 1);
    return {
      ancient_candidate: toText(candidate.ancient_candidate || candidate.office_name || '未命名历史职官'),
      similarity: actualScore,
      score: actualScore,
      confidence: confidenceFor(candidate, actualScore),
      duty_difference: toText(candidate.duty_difference || candidate.duties || '暂无职责差异说明。'),
      daily_activities: asArray(candidate.daily_activities || candidate.typical_tasks || candidate.daily_life && candidate.daily_life.typical_tasks),
      clothing: toText(candidate.clothing || candidate.attire || candidate.daily_life && candidate.daily_life.attire && (candidate.daily_life.attire.official_or_public_dress || candidate.daily_life.attire.ritual_or_court_dress) || '暂无服饰资料，需按时代和品秩核验。'),
      life: toText(candidate.life || candidate.daily_life_text || candidate.daily_life && candidate.daily_life.office_and_residence && candidate.daily_life.office_and_residence.join('；') || '暂无生活资料。'),
      risks: asArray(candidate.risks || candidate.reform_or_crisis_context),
      evidence_level: toText(candidate.evidence_level || candidate.evidence || '未分级'),
      source_ids: asArray(candidate.source_ids || candidate.evidence_refs && candidate.evidence_refs.map(function (item) { return item.source_id; })),
      raw: candidate
    };
  }

  function matchRole(query) {
    var text = toText(query).trim();
    if (!text || !state.examples.length) return [];
    var ranked = state.examples.map(function (example, index) {
      return { example: example, score: scoreExample(text, example), index: index };
    }).sort(function (left, right) {
      return right.score - left.score || left.index - right.index;
    });
    var selected = ranked[0];
    if (!selected || selected.score < 0.05) return [];
    var primary = selected.example.primary || {};
    var candidates = [normalizeCandidate(primary, selected.score)];
    asArray(selected.example.alternatives).slice(0, 2).forEach(function (alternative, index) {
      var factor = Math.max(0.2, 0.92 - index * 0.09);
      candidates.push(normalizeCandidate(alternative, selected.score * factor));
    });
    // 某些外部数据可能只有一个备选。为了保持稳定的三卡片接口，补充相邻示例的主候选。
    var fallbackIndex = 1;
    while (candidates.length < 3 && fallbackIndex < ranked.length) {
      var fallback = ranked[fallbackIndex];
      if (fallback && fallback.example && fallback.example.primary) {
        candidates.push(normalizeCandidate(fallback.example.primary, Math.max(0.18, fallback.score * 0.82)));
      }
      fallbackIndex += 1;
    }
    return candidates.slice(0, 3);
  }

  function renderCandidate(candidate, index, sharedEvidence) {
    var activities = candidate.daily_activities.length
      ? '<ul>' + candidate.daily_activities.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '<p class="muted">暂无日常活动资料。</p>';
    var risks = candidate.risks.length
      ? '<ul>' + candidate.risks.map(function (item) { return '<li>风险：' + escapeHtml(item) + '</li>'; }).join('') + '</ul>'
      : '<p class="muted">暂无风险条目。</p>';
    var era = dynastyOf(candidate);
    var sourceText = candidate.source_ids.length ? candidate.source_ids.join(' · ') : '待补充来源';
    var sourceControl = candidate.source_ids.length
      ? '<button class="source-jump" type="button" data-action="jump-source" data-source-ids="' + escapeHtml(candidate.source_ids.join(',')) + '" title="跳转到来源登记并定位">来源 ' + escapeHtml(sourceText) + '</button>'
      : '<span class="muted">来源待补充</span>';
    var pct = Math.round(candidate.similarity * 100);
    var tier = pct >= 85 ? 'high' : (pct >= 70 ? 'mid' : 'low');
    var tagRow = sharedEvidence ? '' :
      '<div class="tag-row"><span class="tag tag-evidence evidence-' + evidenceKey(candidate.evidence_level) + '">' + escapeHtml(candidate.evidence_level) + '级证据</span><span class="tag tag-muted">置信度 ' + escapeHtml(candidate.confidence) + '</span></div>';
    return '<article class="candidate-card ' + (index === 0 ? 'is-featured' : '') + '" data-candidate-index="' + index + '">' +
      '<div class="card-topline"><span class="period-label">' + escapeHtml(era || '功能类比') + '</span><span class="topline-right"><span class="conf-chip" title="证据支撑的确定程度">置信度 ' + escapeHtml(candidate.confidence) + '</span><span class="match-score match-tier-' + tier + '" title="职能匹配度（检索相关性）">' + pct + '<span>%</span></span></span></div>' +
      '<div class="match-bar match-bar-' + tier + '" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '<h3>' + escapeHtml(candidate.ancient_candidate) + '</h3>' +
      '<p class="card-subtitle">' + (index === 0 ? '主候选 · ' : '备选 · ') + '功能类比</p>' +
      '<p class="card-description">' + escapeHtml(candidate.duty_difference) + '</p>' +
      tagRow +
      '<details class="detail-box" data-candidate-details><summary>展开职责、日常与生活百科</summary>' +
        '<div class="detail-section"><strong>日常活动</strong>' + activities + '</div>' +
        '<p><strong>服饰：</strong>' + escapeHtml(candidate.clothing) + '</p>' +
        '<p><strong>生活：</strong>' + escapeHtml(candidate.life) + '</p>' +
        '<div class="detail-section"><strong>风险</strong>' + risks + '</div>' +
      '</details>' +
      '<div class="card-footer"><button class="detail-cta" type="button" data-action="select-office" data-candidate-index="' + index + '">查看详情 →</button>' + sourceControl + '</div>' +
    '</article>';
  }

  function filterCandidates() {
    if (state.candidateFilter === 'high-confidence') {
      return state.candidates.filter(function (candidate) {
        return candidate.similarity >= 0.75 || candidate.confidence === '高';
      });
    }
    if (state.candidateFilter === 'period') {
      var seen = {};
      var unique = [];
      state.candidates.forEach(function (candidate) {
        var key = toText(candidate.raw && (candidate.raw.period || candidate.raw.dynasty) || '').replace(/[（(].*$/, '') || candidate.ancient_candidate;
        if (!seen[key]) { seen[key] = 1; unique.push(candidate); }
      });
      return unique;
    }
    return state.candidates;
  }

  function renderCandidates() {
    var list = filterCandidates();
    var shared = list.length > 1 &&
      list.every(function (c) { return c.evidence_level === list[0].evidence_level; }) &&
      list.every(function (c) { return c.confidence === list[0].confidence; });
    var noteHtml = shared
      ? '<p class="shared-evidence-note">本组候选均为 ' + escapeHtml(list[0].evidence_level) + ' 级证据 · 置信度 ' + escapeHtml(list[0].confidence) + '：证据支撑相同，差异体现在职能范围与时代背景，请结合“查看详情”判断。</p>'
      : '';
    findAll(['[data-match-results]', '[data-results]', '[data-role="candidate-list"]']).forEach(function (container) {
      if (state.loading) {
        renderEmpty(container, '正在加载资料…');
      } else if (list.length) {
        container.innerHTML = noteHtml + '<div class="result-grid">' + list.map(function (candidate, index) {
          return renderCandidate(candidate, index, shared);
        }).join('') + '</div>';
      } else if (!state.candidates.length) {
        renderEmpty(container, state.query ? '没有找到相近的历史职官，请换一个职能描述。' : '输入职位开始探索。');
      } else {
        renderEmpty(container, '当前筛选下没有候选官职，试试“全部”。');
      }
    });
    setText(findAll(['[data-role="candidate-count"]']), list.length);
  }

  function renderMatch() {
    renderCandidates();
    var scenarioText = state.scenario ? state.scenario.dynasty + ' · ' + state.scenario.location : (state.query ? '暂无场景推定' : '输入职位开始探索');
    setText(findAll(['[data-match-scenario]', '[data-scenario]']), scenarioText);
    setText(findAll(['[data-match-assumption]', '[data-scenario-assumption]']), state.scenario ? state.scenario.assumption : '');
    state.selectedIndex = 0;
    renderSelectedDetail(state.candidates[0] || null);
  }

  function metricHtml(label, strong, small) {
    return '<div class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(strong) + '</strong>' + (small ? '<small>' + escapeHtml(small) + '</small>' : '') + '</div>';
  }

  function factHtml(dt, dd) {
    return '<div><dt>' + escapeHtml(dt) + '</dt><dd>' + escapeHtml(dd) + '</dd></div>';
  }

  function dynastyOf(candidate) {
    var match = toText(candidate && candidate.ancient_candidate).match(/[（(]([^）)]+)[）)]/);
    return match ? match[1] : '';
  }

  function renderTimeline(candidate) {
    var panel = first(['[data-panel="timeline"]']);
    if (!panel) return;
    var era = dynastyOf(candidate);
    if (!era) {
      panel.innerHTML = '<p class="chain-note">该候选未锚定单一时期，请在下方制度矩阵按时期浏览相关制度。</p>';
      return;
    }
    var keys = era.split('').filter(function (ch) { return /[\u4e00-\u9fa5]/.test(ch); });
    var rows = uniqueByContent(state.matrix.filter(function (row) {
      var period = toText(row.period);
      return keys.some(function (k) { return period.indexOf(k) >= 0; });
    })).slice(0, 5);
    if (!rows.length) {
      panel.innerHTML = '<p class="chain-note">暂无与“' + escapeHtml(era) + '”直接对应的制度条目。</p>';
      return;
    }
    panel.innerHTML = '<ul class="timeline">' + rows.map(function (row) {
      var dim = DIMENSION_LABELS[row.dimension] || row.dimension || '制度维度';
      var text = toText(row.legal_structure);
      if (text.length > 92) text = text.slice(0, 92) + '……';
      return '<li><span class="timeline-era">' + escapeHtml(row.period) + '</span><strong>' + escapeHtml(dim) + '</strong><p>' + escapeHtml(text) + '</p></li>';
    }).join('') + '</ul><p class="chain-note">时期与摘录来自制度矩阵，完整条目可在“制度浏览”中查看。</p>';
  }

  function renderEvidence(candidate) {
    var panel = first(['[data-panel="evidence"]']);
    if (!panel) return;
    var ids = candidate.source_ids || [];
    if (!ids.length) {
      panel.innerHTML = '<p class="chain-note">该候选暂未登记来源编号。</p>';
      return;
    }
    var items = ids.map(function (id) {
      var found = null;
      state.sources.forEach(function (row) {
        if (toText(row.source_id).toUpperCase() === toText(id).toUpperCase()) found = row;
      });
      if (!found) {
        return '<div class="chain-item"><span class="evidence-label evidence-d">?</span><div><h4>' + escapeHtml(id) + '</h4><p>来源登记表中未收录该编号。</p></div></div>';
      }
      var meta = [found.author_or_institution, found.year].filter(Boolean).join(' · ');
      var link = found.url ? '<a href="' + escapeHtml(found.url) + '" target="_blank" rel="noreferrer">打开来源 ↗</a>' : '';
      return '<div class="chain-item"><span class="evidence-label evidence-' + evidenceKey(found.authority_grade) + '">' + escapeHtml(toText(found.authority_grade).charAt(0) || '?') + '</span><div><h4>' + escapeHtml(found.title || id) + '</h4><p>' + escapeHtml(meta) + '</p>' + link + '</div></div>';
    });
    panel.innerHTML = '<div class="evidence-chain">' + items.join('') + '</div><p class="chain-note">证据等级 ' + escapeHtml(candidate.evidence_level) + ' 级；服饰、生活等细节为情景重建，不等同原典记载。</p>';
  }

  function loadSaved() {
    try { return JSON.parse(global.localStorage.getItem('archive-saved') || '[]') || []; } catch (error) { return []; }
  }

  function writeSaved(list) {
    try { global.localStorage.setItem('archive-saved', JSON.stringify(list)); } catch (error) { /* 存储不可用时静默降级 */ }
  }

  function updateSaveButton(candidate) {
    var button = first(['[data-action="save-office"]']);
    if (!button || !candidate) return;
    var saved = loadSaved().indexOf(candidate.ancient_candidate) >= 0;
    button.classList.toggle('is-saved', saved);
    button.setAttribute('aria-pressed', saved ? 'true' : 'false');
    button.innerHTML = '<span aria-hidden="true">' + (saved ? '★' : '☆') + '</span> ' + (saved ? '已收藏' : '收藏条目');
  }

  function renderSelectedDetail(candidate) {
    if (!candidate) return;
    setText(findAll(['[data-role="office-title"]']), candidate.ancient_candidate);
    setText(findAll(['[data-role="office-confidence"]']), '匹配度 ' + Math.round(candidate.similarity * 100) + '% · 置信度 ' + candidate.confidence);
    var detailMain = first(['.detail-main']);
    if (detailMain) {
      var detailPct = Math.round(candidate.similarity * 100);
      var detailTier = detailPct >= 85 ? 'high' : (detailPct >= 70 ? 'mid' : 'low');
      detailMain.classList.remove('tier-high', 'tier-mid', 'tier-low');
      detailMain.classList.add('tier-' + detailTier);
    }
    setText(findAll(['[data-role="function-compare"] .compare-intro:first-child p']), candidate.duty_difference);
    var difference = candidate.risks.length
      ? '主要风险：' + candidate.risks[0] + '。此外，历史官职的辖区、制度身份与权力来源各有时代差异，不能直接等同现代编制或职级。'
      : '历史官职的辖区、制度身份与权力来源各有时代差异，不能直接等同现代编制或职级。';
    setText(findAll(['[data-role="function-compare"] .compare-difference p']), difference);
    setText(findAll(['[data-role="office-location"]']), '辖区与驻地依职能推定');

    var era = dynastyOf(candidate) || (state.scenario ? state.scenario.dynasty : '跨时期');
    var metrics = first(['[data-role="office-metrics"]']);
    if (metrics) {
      metrics.innerHTML =
        metricHtml('证据等级', candidate.evidence_level + ' 级', '关联来源 ' + candidate.source_ids.length + ' 项') +
        metricHtml('置信度', candidate.confidence, '职能类比 · 非品秩换算') +
        metricHtml('时期背景', era, state.scenario ? state.scenario.location : '');
    }
    var facts = first(['.fact-list']);
    if (facts) {
      var rows = [
        factHtml('现代类比', (state.query || '当前职位') + '（职能类比）'),
        factHtml('职能边界', candidate.duty_difference),
        factHtml('服饰形制', candidate.clothing),
        factHtml('生活形态', candidate.life)
      ];
      if (candidate.risks.length) rows.push(factHtml('主要风险', candidate.risks.join('；')));
      facts.innerHTML = rows.join('');
    }

    var list = first(['[data-section="life-encyclopedia"] .life-list']);
    if (list) {
      var labels = ['典型事务', '日程与流程', '协调要点'];
      var items = candidate.daily_activities.slice(0, 3);
      list.innerHTML = (items.length ? items : ['典型工作周期需结合时期、驻地和现存文书判断。']).map(function (item, index) {
        return '<li><span class="life-marker">0' + (index + 1) + '</span><div><strong>' + labels[index] + '</strong><p>' + escapeHtml(item) + '</p></div></li>';
      }).join('');
    }
    var footnote = first(['[data-section="life-encyclopedia"] .life-footnote span:last-child']);
    if (footnote) footnote.textContent = '服饰与生活细节为情景推演，主要依据来源 ' + (candidate.source_ids.join('、') || '待补充') + '；非原典直载。';

    renderTimeline(candidate);
    renderEvidence(candidate);
    updateSaveButton(candidate);
  }

  function readMatrixFilters() {
    var filters = {};
    findAll(['[data-matrix-filter]']).forEach(function (node) {
      var key = node.getAttribute('data-matrix-filter') || node.name || node.getAttribute('data-field');
      if (key && toText(node.value).trim()) filters[key] = toText(node.value).trim();
    });
    return filters;
  }

  function getFilteredMatrix() {
    var query = normalize(state.matrixQuery);
    var filters = Object.assign({}, state.matrixFilters, readMatrixFilters());
    var periods = state.matrixPeriods || null;
    return state.matrix.filter(function (row) {
      if (periods) {
        var period = normalize(toText(row.period));
        var inGroup = periods.some(function (term) { return period.indexOf(normalize(term)) >= 0; });
        if (!inGroup) return false;
      }
      var haystack = normalize(Object.keys(row).map(function (key) { return row[key]; }).join(' '));
      if (query && haystack.indexOf(query) < 0) return false;
      return Object.keys(filters).every(function (key) {
        var value = normalize(filters[key]);
        return !value || normalize(row[key] || '').indexOf(value) >= 0;
      });
    });
  }

  function excerptAtSentence(text, limit) {
    var t = toText(text);
    if (t.length <= limit) return t;
    var cut = t.slice(0, limit);
    var i = cut.lastIndexOf('。');
    if (i > limit * 0.5) return cut.slice(0, i + 1) + '……';
    return cut + '……';
  }

  function uniqueByContent(rows) {
    var seen = {};
    return rows.filter(function (row) {
      var key = toText(row.period) + '|' + toText(row.legal_structure);
      if (seen[key]) return false;
      seen[key] = 1;
      return true;
    });
  }

  function renderMatrix() {
    var rows = uniqueByContent(getFilteredMatrix());
    findAll(['[data-matrix-count]']).forEach(function (node) { node.textContent = rows.length + ' 条'; });
    findAll(['[data-matrix-list]', '[data-system-matrix]', '[data-role="system-list"]']).forEach(function (container) {
      if (!rows.length) {
        renderEmpty(container, state.matrix.length ? '没有符合条件的制度条目。' : '制度矩阵尚未加载。');
        return;
      }
      var visible = rows.slice(0, state.matrixLimit);
      var html = visible.map(function (row, index) {
        var sources = toText(row.source_ids).split(';').filter(Boolean).join(' · ');
        var codes = toText(row.source_ids).split(';').filter(Boolean);
        var codeButtons = codes.length
          ? codes.map(function (code) {
              return '<button class="source-jump source-jump--dark" type="button" data-action="jump-source" data-source-ids="' + escapeHtml(code) + '" title="在来源登记中定位 ' + escapeHtml(code) + '">' + escapeHtml(code) + '</button>';
            }).join('<span class="code-sep"> · </span>')
          : '待补充';
        var excerpt = excerptAtSentence(row.legal_structure, 110);
        return '<article class="system-card" data-matrix-index="' + index + '">' +
          '<span class="dimension">' + codeButtons + '</span>' +
          '<h3>' + escapeHtml(row.period || row.regime || '未标时期') + '</h3>' +
          '<p><strong>制度：</strong>' + escapeHtml(excerpt) + '</p>' +
          '<details data-matrix-details><summary>展开全文</summary>' +
          '<p><strong>制度：</strong>' + escapeHtml(row.legal_structure || '') + '</p>' +
          '<p><strong>实际运行：</strong>' + escapeHtml(row.actual_operation || '') + '</p>' +
          '<p><strong>改革与风险：</strong>' + escapeHtml(row.reforms_risks || '') + '</p>' +
          '<p><strong>来源：</strong>' + escapeHtml(sources || '待补充') + '</p>' +
          '</details>' +
        '</article>';
      }).join('');
      if (rows.length > visible.length) {
        html += '<div class="load-more-row"><button class="load-more" type="button" data-action="load-more-matrix">显示更多 · 还有 ' + (rows.length - visible.length) + ' 条</button></div>';
      }
      container.innerHTML = html;
      var endText = '';
      if (rows.length && rows.length <= visible.length) {
        var totalUnique = state.matrixTotalUnique || rows.length;
        endText = !state.matrixQuery && !state.matrixPeriods
          ? '制度矩阵共收录 ' + rows.length + ' 个时期条目，至此呈现完毕；证据分级与来源编码可在下方“来源登记”中逐条核验。'
          : '当前筛选出 ' + rows.length + ' 条；点击“全部”或清除搜索可查看全部 ' + totalUnique + ' 条。';
      }
      setText(findAll(['[data-matrix-endnote]']), endText);
    });
  }

  function getFilteredSources() {
    var query = normalize(state.sourceQuery);
    if (!query) return state.sources;
    return state.sources.filter(function (source) {
      return normalize(Object.keys(source).map(function (key) { return source[key]; }).join(' ')).indexOf(query) >= 0;
    });
  }

  function renderSources() {
    var rows = getFilteredSources();
    setText(findAll(['[data-source-count]']), String(rows.length));
    findAll(['[data-source-list]', '[data-sources]']).forEach(function (container) {
      if (!rows.length) {
        renderEmpty(container, state.sources.length ? '没有符合条件的来源。' : '来源索引尚未加载。');
        return;
      }
      var visible = rows.slice(0, state.sourceLimit);
      var html = visible.map(function (source, index) {
        var grade = toText(source.authority_grade || source.evidence_level || '?');
        var meta = [source.author_or_institution, source.year, source.coverage || source.notes].filter(Boolean).join(' · ');
        var titleHtml = source.url
          ? '<a class="source-title-link" href="' + escapeHtml(source.url) + '" target="_blank" rel="noreferrer">' + escapeHtml(source.title || source.source_id) + '</a>'
          : '<strong>' + escapeHtml(source.title || source.source_id) + '</strong>';
        var link = source.url ? '' : '<span class="muted">原典或无在线链接</span>';
        return '<article class="source-item" data-source-index="' + index + '">' +
          '<div>' + titleHtml +
          '<div class="candidate-meta">' + escapeHtml(meta) + '</div>' + link + '</div>' +
          '<span class="source-code">' + escapeHtml(toText(source.source_id)) + '</span>' +
          '<span class="source-level evidence-label evidence-' + evidenceKey(grade) + '">' + escapeHtml(grade.charAt(0) || '?') + '</span>' +
        '</article>';
      }).join('');
      if (rows.length > visible.length) {
        html += '<div class="load-more-row"><button class="load-more" type="button" data-action="load-more-sources">展开全部 · 共 ' + rows.length + ' 条</button></div>';
      }
      container.innerHTML = html;
    });
  }

  function updateGradeStats() {
    var counts = {};
    state.sources.forEach(function (source) {
      var grade = toText(source.authority_grade).trim().charAt(0).toUpperCase();
      if (/[ABCD]/.test(grade)) counts[grade] = (counts[grade] || 0) + 1;
    });
    var box = first(['[data-grade-stats]']);
    if (!box) return;
    box.innerHTML = ['A', 'B', 'C', 'D'].map(function (grade) {
      if (!counts[grade]) return '';
      return '<p class="grade-stat"><span class="evidence-label evidence-' + grade.toLowerCase() + '">' + grade + '</span><span>' + counts[grade] + ' 条登记 · 主分级</span></p>';
    }).join('');
  }

  function updateCounts() {
    var periods = {};
    state.matrix.forEach(function (row) { periods[toText(row.period)] = 1; });
    state.matrixTotalUnique = uniqueByContent(state.matrix).length;
    setText(findAll(['[data-count="periods"]']), String(Object.keys(periods).length));
    setText(findAll(['[data-count="sources"]']), String(state.sources.length));
    var letters = {};
    (state.matrix.map(function (row) { return toText(row.evidence_grade); }).join('') +
      state.sources.map(function (source) { return toText(source.authority_grade); }).join('')).split('').forEach(function (ch) {
      if (/[ABCDE]/.test(ch)) letters[ch] = 1;
    });
    setText(findAll(['[data-count="grades"]']), Object.keys(letters).length + ' 级');
    updateGradeStats();
  }

  function runMatch(value) {
    var input = value;
    if (input === undefined) {
      var node = first(['[data-role-input]', '[data-match-input]', '[data-role-query]', 'input[name="role"]']);
      input = node ? node.value : state.query;
    }
    state.query = toText(input).trim();
    state.candidates = matchRole(state.query);
    state.scenario = state.candidates.length ? inferScenario(state.query, state.candidates[0]) : null;
    renderMatch();
    return state.candidates;
  }

  var PERIOD_GROUPS = {
    '先秦': ['夏、商与西周', '春秋战国'],
    '秦汉': ['秦（', '两汉（'],
    '隋唐': ['三国两晋南北朝', '隋唐（'],
    '宋元': ['五代十国与两宋', '辽（916', '元（1271'],
    '明清': ['明（1368', '清至清末']
  };

  function bindEvents() {
    if (listenersBound || typeof document === 'undefined') return;
    listenersBound = true;
    findAll(['[data-role-form]', '[data-match-form]', '[data-role="search-form"]']).forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        runMatch();
      });
    });
    findAll(['[data-action="match"]', '[data-action="submit-search"]', '[data-match-submit]']).forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        runMatch();
      });
    });
    findAll(['[data-role-input]', '[data-match-input]', '[data-role-query]']).forEach(function (input) {
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          runMatch(input.value);
        }
      });
    });
    findAll(['[data-action="clear-input"]']).forEach(function (button) {
      button.addEventListener('click', function () {
        var input = first(['[data-role-input]', '[data-match-input]', 'input[name="role"]']);
        if (input) { input.value = ''; input.focus(); }
        runMatch('');
      });
    });
    findAll(['[data-query]']).forEach(function (button) {
      button.addEventListener('click', function () {
        var query = button.getAttribute('data-query') || '';
        var input = first(['[data-role-input]', '[data-match-input]', 'input[name="role"]']);
        if (input) input.value = query;
        runMatch(query);
      });
    });

    findAll(['[data-role="detail-tabs"] .tab-button']).forEach(function (button) {
      button.addEventListener('click', function () {
        findAll(['[data-role="detail-tabs"] .tab-button']).forEach(function (item) {
          var active = item === button;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        var tab = button.getAttribute('data-tab');
        findAll(['[data-role="detail-panel"]']).forEach(function (panel) {
          panel.hidden = panel.getAttribute('data-panel') !== tab;
        });
      });
    });

    findAll(['[data-role="candidate-filters"] .filter-button']).forEach(function (button) {
      button.addEventListener('click', function () {
        findAll(['[data-role="candidate-filters"] .filter-button']).forEach(function (item) {
          item.classList.toggle('is-selected', item === button);
        });
        state.candidateFilter = button.getAttribute('data-filter') || 'all';
        renderCandidates();
      });
    });

    var saveButton = first(['[data-action="save-office"]']);
    if (saveButton) {
      saveButton.addEventListener('click', function () {
        var candidate = state.candidates[state.selectedIndex] || state.candidates[0];
        if (!candidate) return;
        var saved = loadSaved();
        var key = candidate.ancient_candidate;
        if (saved.indexOf(key) >= 0) {
          saved = saved.filter(function (item) { return item !== key; });
        } else {
          saved.push(key);
        }
        writeSaved(saved);
        updateSaveButton(candidate);
      });
    }

    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest ? event.target.closest('[data-action="select-office"]') : null;
      if (target) {
        var index = Number(target.getAttribute('data-candidate-index'));
        if (state.candidates[index]) {
          state.selectedIndex = index;
          renderSelectedDetail(state.candidates[index]);
          var detail = first(['#detail']);
          if (detail && !global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        return;
      }
      var delegated = event.target && event.target.closest ? event.target : null;
      if (!delegated) return;
      if (delegated.closest('[data-action="jump-source"]')) {
        var jump = delegated.closest('[data-action="jump-source"]');
        var ids = toText(jump.getAttribute('data-source-ids')).split(',').filter(Boolean);
        if (ids.length) {
          state.sourceQuery = ids[0];
          state.sourceLimit = state.sources.length;
          var sourceSearch = first(['[data-source-search]']);
          if (sourceSearch) sourceSearch.value = ids[0];
          renderSources();
          var sourcesSection = first(['#sources']);
          if (sourcesSection && !global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            sourcesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        return;
      }
      if (delegated.closest('[data-action="load-more-matrix"]')) {
        state.matrixLimit += 12;
        renderMatrix();
        return;
      }
      if (delegated.closest('[data-action="load-more-sources"]')) {
        state.sourceLimit = state.sources.length;
        renderSources();
        return;
      }
      if (delegated.closest('[data-action="view-all-systems"]')) {
        state.matrixQuery = '';
        state.matrixPeriods = null;
        state.matrixLimit = 12;
        var searchInput = first(['[data-matrix-search]']);
        if (searchInput) searchInput.value = '';
        findAll(['[data-role="period-tabs"] button[data-period]']).forEach(function (item) {
          var isAll = item.getAttribute('data-period') === 'all';
          item.classList.toggle('is-active', isAll);
          item.setAttribute('aria-selected', isAll ? 'true' : 'false');
        });
        renderMatrix();
      }
    });

    findAll(['[data-matrix-search]', '[data-system-search]']).forEach(function (input) {
      input.addEventListener('input', function () {
        state.matrixQuery = input.value;
        state.matrixPeriods = null;
        state.matrixLimit = 12;
        renderMatrix();
      });
    });
    findAll(['[data-matrix-filter]']).forEach(function (input) {
      input.addEventListener('change', function () { state.matrixFilters = readMatrixFilters(); renderMatrix(); });
      input.addEventListener('input', function () { state.matrixFilters = readMatrixFilters(); renderMatrix(); });
    });
    findAll(['[data-source-search]', '[data-sources-search]']).forEach(function (input) {
      input.addEventListener('input', function () {
        state.sourceQuery = input.value;
        state.sourceLimit = 10;
        renderSources();
      });
    });
    findAll(['[data-role="period-tabs"] button[data-period]']).forEach(function (button) {
      button.addEventListener('click', function () {
        var isAll = button.getAttribute('data-period') === 'all';
        findAll(['[data-role="period-tabs"] button[data-period]']).forEach(function (item) {
          item.classList.toggle('is-active', item === button);
          item.setAttribute('aria-selected', item === button ? 'true' : 'false');
        });
        var label = toText((button.querySelector('span') || button).textContent).replace(/\s+/g, ' ').trim();
        state.matrixPeriods = isAll ? null : (PERIOD_GROUPS[label] || null);
        state.matrixQuery = '';
        state.matrixLimit = 12;
        var search = first(['[data-matrix-search]']);
        if (search) search.value = isAll ? '' : label;
        renderMatrix();
      });
    });
  }

  function loadData() {
    state.loading = true;
    state.errors = [];
    renderLoading();
    renderError();
    var jobs = [
      fetchFirst(DEFAULT_PATHS.examples, function (text) { return JSON.parse(text); }),
      fetchFirst(DEFAULT_PATHS.matrix, csvParse),
      fetchFirst(DEFAULT_PATHS.sources, csvParse)
    ];
    return Promise.allSettled(jobs).then(function (results) {
      var labels = ['职位映射示例', '制度矩阵', '来源索引'];
      results.forEach(function (result, index) {
        if (result.status === 'fulfilled') {
          if (index === 0) state.examples = asArray(result.value && result.value.examples ? result.value.examples : result.value);
          if (index === 1) state.matrix = Array.isArray(result.value) ? result.value : [];
          if (index === 2) state.sources = Array.isArray(result.value) ? result.value : [];
        } else {
          state.errors.push(labels[index] + '加载失败：' + toText(result.reason && result.reason.message || result.reason));
        }
      });
      state.loading = false;
      state.ready = true;
      renderLoading();
      renderError();
      runMatch();
      renderMatrix();
      renderSources();
      updateCounts();
      return state;
    }).catch(function (error) {
      state.loading = false;
      state.errors.push('数据加载失败：' + toText(error && error.message || error));
      renderLoading();
      renderError();
      renderMatch();
      renderMatrix();
      renderSources();
      return state;
    });
  }

  function init() {
    if (global.location && global.location.search.indexOf('layoutprobe') >= 0) {
      var hero = document.querySelector('.hero.shell');
      var copy = document.querySelector('.hero-copy');
      var facts = document.querySelector('.hero-facts');
      var card = document.querySelector('.search-card');
      var h1 = document.querySelector('.hero h1');
      global.document.title = 'PROBE ' + JSON.stringify({
        vw: global.document.documentElement.clientWidth,
        docScrollW: global.document.documentElement.scrollWidth,
        heroW: hero && hero.clientWidth,
        heroScrollW: hero && hero.scrollWidth,
        copyW: copy && Math.round(copy.getBoundingClientRect().width),
        copyRight: copy && Math.round(copy.getBoundingClientRect().right),
        factsW: facts && Math.round(facts.getBoundingClientRect().width),
        factsScrollW: facts && facts.scrollWidth,
        cardRight: card && Math.round(card.getBoundingClientRect().right),
        h1Font: h1 && getComputedStyle(h1).fontSize
      });
    }
    bindEvents();
    renderLoading();
    renderMatch();
    renderMatrix();
    renderSources();
    return loadData();
  }

  var api = {
    init: init,
    load: loadData,
    match: runMatch,
    filterMatrix: function (query, filters) {
      state.matrixQuery = toText(query || '');
      state.matrixFilters = filters || {};
      state.matrixPeriods = null;
      state.matrixLimit = 12;
      renderMatrix();
      return getFilteredMatrix();
    },
    searchSources: function (query) {
      state.sourceQuery = toText(query || '');
      renderSources();
      return getFilteredSources();
    },
    getState: function () { return state; },
    parseCsv: csvParse,
    paths: DEFAULT_PATHS
  };

  if (global) global.HistoricalAdminApp = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this)));
