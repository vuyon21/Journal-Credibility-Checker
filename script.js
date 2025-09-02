/* ========================== CONFIG ========================== */
/* Point to your raw GitHub repo path */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

/* Accredited lists (CSV or comma-delimited TXT; headers optional) */
const ACCREDITED_FILES = [
  'DHET_2025.csv',
  'DHET_2_2025.csv',
  'DOAJ_2025.csv',
  'IBSS_2025.csv',
  'NORWEGIAN_2025.csv',
  'SCIELO SA_2025.csv',
  'SCOPUS_2025.csv',
  'WOS_2025.csv'
];

/* Removed list (special handling) */
const REMOVED_FILE = 'JOURNALS REMOVED IN PAST YEARS.csv';

/* Transformative Agreement files (CSV) */
const TRANSFORMATIVE_FILES = [
  'WILEY_2025.csv',
  'The Company of Biologists_2025.csv',
  'Taylir & Francis_2025.csv',
  'Springer_2025.csv',
  'ScienceDirect (Elsevier)_2025.csv',
  'SAGE Publishing_2025.csv',
  'Royal Society_2025.csv',
  'Royal Society of Chemistry Platinum_2025.csv',
  'Oxford University Press Journals_2025.csv',
  'IOPscienceExtra_2025.csv',
  'Emerald_2025.csv',
  'Cambridge University Press (CUP)_2025.csv',
  'Bentham Science Publisherst_2025.csv',
  'Association for Computing Machinery (ACM)_2025.csv',
  'American Institute of Physics (AIP)_2025.csv',
  'American Chemicals Society(ACS)_2025.csv'
];

/* UI elements */
const $ = (id) => document.getElementById(id);
const qInput = $('q');
const btnSearch = $('btn-search');
const btnCopy = $('btn-copy');
const btnDownload = $('btn-download');
const btnShowRemoved = $('btn-show-removed');
const btnCopyRemoved = $('btn-copy-removed');
const btnDownloadRemoved = $('btn-download-removed');
const loading = $('loading');
const errBox = $('error');
const report = $('report');
const rec = $('rec');
const removedPanel = $('removed-panel');
const removedTableWrap = $('removed-table-wrap');
const acWrap = $('autocomplete-results');

/* In-memory datasets */
let accredited = [];      // array of journal objects
let removedList = [];     // structured rows
let transformList = [];   // array of agreement journal objects

/* =================== CSV PARSER (robust) =================== */
function parseCSV(text) {
  // Split into lines, handle CRLF, trim BOM
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim().length > 0);

  const rows = [];
  let cur = [], inQuotes = false, field = '';
  function pushField(){ cur.push(field.trim()); field = ''; }
  function pushRow(){ rows.push(cur); cur = []; }

  for (const rawLine of lines) {
    let line = rawLine;
    // process char by char to respect quotes
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { field += '"'; i++; } // escaped quote
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        pushField();
      } else {
        field += ch;
      }
    }
    if (inQuotes) { field += '\n'; } // multi-line field
    else { pushField(); pushRow(); }
  }
  return rows;
}

/* Try to map header names to standardized fields */
function mapAccreditedRow(cols, header) {
  const get = (nameList) => {
    // find the first header that exists (case/space-insensitive)
    const idx = header.findIndex(h => nameList.some(n =>
      h.replace(/\s+/g,'').toLowerCase() === n.replace(/\s+/g,'').toLowerCase()
    ));
    return (idx >= 0 && cols[idx]) ? cols[idx].trim() : '';
  };

  // Known header variants
  const title = get(['Journaltitle(Previoustitleifapplicable)','Journaltitle','Title','Journal']);
  const issn1 = get(['ISSN','PrintISSN','pISSN']);
  const issn2 = get(['eISSN','OnlineISSN']);
  const lastReview = get(['DATEOFLASTREVIEWORACCREDITATION','LastReview','AccreditedDate']);
  const intl = get(['InternationalAccreditation','International','Index']);
  const freq = get(['FREQUENCY','Frequency']);
  const publisher = get(['Publisher','Publisherdetails','Publisher’sdetails','Publisherdetails']);

  // ISSN/eISSN normalization: if both present, treat first as eISSN by rule you requested
  let eissn = '', pissn = '';
  const norm1 = (issn1 || '').replace(/\s+/g,'');
  const norm2 = (issn2 || '').replace(/\s+/g,'');
  if (norm1 && norm2) {
    eissn = norm1; pissn = norm2;
  } else if (norm1 && !norm2) {
    // single value goes to ISSN field
    pissn = norm1;
  } else if (!norm1 && norm2) {
    // only eISSN provided → goes to ISSN field if alone, else as eISSN
    pissn = norm2;
  }

  return {
    title: title || '',
    titleNorm: normalize(title),
    issn: pissn || '',
    eissn: eissn || '',
    lastReview: lastReview || '',
    internationalAccreditation: intl || '',
    frequency: freq || '',
    publisher: publisher || '',
    source: 'accredited'
  };
}

function mapRemovedRow(cols, header) {
  // We’ll try to find useful columns for removed display
  const get = (names) => {
    const idx = header.findIndex(h => names.some(n =>
      h.replace(/\s+/g,'').toLowerCase() === n.replace(/\s+/g,'').toLowerCase()
    ));
    return (idx >= 0 && cols[idx]) ? cols[idx].trim() : '';
  };
  const title = get(['JOURNALTITLE(Previoustitleifapplicable)','Journaltitle','Title']);
  const issn = get(['ISSN','ISSN(Online)','eISSN']);
  const reason = get(['Reason','REASON','Comment']);
  const review = get(['DATEOFLASTREVIEWORACCREDITATION','Reviewed','Reviewdate']);
  const publisher = get(['Publisher’sdetails','Publisherdetails','Publisher']);

  return {
    title: title || '',
    titleNorm: normalize(title),
    issn: (issn || '').replace(/\s+/g,''),
    reason: reason || '',
    review: review || '',
    publisher: publisher || ''
  };
}

function mapTransformRow(cols, header, fileLabel) {
  const get = (names) => {
    const idx = header.findIndex(h => names.some(n =>
      h.replace(/\s+/g,'').toLowerCase() === n.replace(/\s+/g,'').toLowerCase()
    ));
    return (idx >= 0 && cols[idx]) ? cols[idx].trim() : '';
  };

  const title = get(['JournalTitle','Title','Journal']);
  const eissn = get(['eISSN','EISSN','OnlineISSN']);
  const oaStatus = get(['OpenAccessStatus','OpenAccess','OAStatus']);
  const included = get(['IncludedinR&Pagreement','IncludedinRPagreement','Included','IncludedinR&Pagreement']);
  const notIncludedWhy = get(['Explanationifnotincluded','Explanation','Notes']);
  const subject = get(['Subject']);
  const publisher = get(['Publisher']);
  const agreeInfo = get(['AgreementInformation','AgreementInfo']);
  const agreeDuration = get(['AgreementDuration','Duration']);

  return {
    title: title || '',
    titleNorm: normalize(title),
    eissn: (eissn || '').replace(/\s+/g,''),
    issn: '', // not always present in TA files
    publisher: publisher || (fileLabel || ''),
    oaStatus: oaStatus || '',
    included: (included || '').toLowerCase().startsWith('y') ? 'Yes' : (included || ''),
    notes: notIncludedWhy || '',
    agreementInfo: agreeInfo || '',
    agreementDuration: agreeDuration || '',
    subject: subject || '',
    source: 'transformative'
  };
}

/* normalize strings for matching */
function normalize(s){ return (s || '').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim(); }
function looksISSN(s){ return /\b\d{4}-?\d{3}[\dXx]\b/.test(s || ''); }

/* =================== LOAD ALL LISTS =================== */
async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

async function loadAccredited() {
  const all = [];
  for (const f of ACCREDITED_FILES) {
    try {
      const txt = await fetchText(RAW_BASE + encodeURIComponent(f));
      const rows = parseCSV(txt);
      if (!rows.length) continue;
      // If first row is header (has non-numeric words), treat as header
      const header = rows[0].map(h => String(h || '').trim());
      const body = rows.slice(1);
      for (const cols of body) {
        if (!cols.some(x => x && String(x).trim())) continue;
        const item = mapAccreditedRow(cols, header);
        if (item.title) all.push(item);
      }
    } catch (e) {
      console.warn('Accredited file load failed:', f, e);
    }
  }
  accredited = all;
}

async function loadRemoved() {
  try {
    const txt = await fetchText(RAW_BASE + encodeURIComponent(REMOVED_FILE));
    const rows = parseCSV(txt);
    if (!rows.length) { removedList = []; return; }
    const header = rows[0].map(h => String(h || '').trim());
    const body = rows.slice(1);
    removedList = body
      .filter(cols => cols && cols.some(x => x && String(x).trim()))
      .map(cols => mapRemovedRow(cols, header));
  } catch (e) {
    console.warn('Removed file load failed:', e);
    removedList = [];
  }
}

async function loadTransformative() {
  const all = [];
  for (const f of TRANSFORMATIVE_FILES) {
    try {
      const txt = await fetchText(RAW_BASE + encodeURIComponent(f));
      const rows = parseCSV(txt);
      if (!rows.length) continue;
      const header = rows[0].map(h => String(h || '').trim());
      const body = rows.slice(1);
      for (const cols of body) {
        if (!cols.some(x => x && String(x).trim())) continue;
        const item = mapTransformRow(cols, header, f.replace(/_2025\.csv$/,'').trim());
        if (item.title) all.push(item);
      }
    } catch (e) {
      console.warn('Transformative file load failed:', f, e);
    }
  }
  transformList = all;
}

async function init() {
  showLoading('Loading journal datasets…');
  await Promise.all([loadAccredited(), loadRemoved(), loadTransformative()]);
  hideLoading();
  setupAutocomplete();
}
init();

/* =================== AUTOCOMPLETE =================== */
function setupAutocomplete() {
  qInput.addEventListener('input', () => {
    const val = normalize(qInput.value);
    acWrap.innerHTML = '';
    acWrap.style.display = 'none';
    if (val.length < 2) return;

    const seen = new Set();
    const suggestions = [];

    function addSuggest(arr, field='title'){
      for (const j of arr) {
        const t = j[field] || '';
        if (!t) continue;
        if (normalize(t).includes(val) && !seen.has(t)) {
          seen.add(t);
          suggestions.push(t);
          if (suggestions.length >= 10) break;
        }
      }
    }
    addSuggest(accredited);
    if (suggestions.length < 10) addSuggest(transformList);

    if (suggestions.length) {
      for (const s of suggestions) {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = s;
        div.addEventListener('click', () => {
          qInput.value = s;
          acWrap.style.display = 'none';
          doSearch();
        });
        acWrap.appendChild(div);
      }
      acWrap.style.display = 'block';
    }
  });

  document.addEventListener('click', (e) => {
    if (!acWrap.contains(e.target) && e.target !== qInput) acWrap.style.display = 'none';
  });
}

/* =================== SEARCH =================== */
function findMatches(query) {
  const norm = normalize(query);
  const issnQuery = looksISSN(query) ? query.replace('-','').toLowerCase() : null;

  let offlineHit = null;
  const flags = {
    accreditedHit: false,
    transformativeHit: false
  };

  // Accredited search
  for (const j of accredited) {
    const p = (j.issn || '').replace(/-/g,'').toLowerCase();
    const e = (j.eissn || '').replace(/-/g,'').toLowerCase();

    if (
      (issnQuery && (p === issnQuery || e === issnQuery)) ||
      normalize(j.title) === norm ||
      (normalize(j.title).includes(norm) && norm.length > 2)
    ) {
      offlineHit = j;
      flags.accreditedHit = true;
      break;
    }
  }

  // Transformative search
  let taHit = null;
  for (const t of transformList) {
    const e = (t.eissn || '').replace(/-/g,'').toLowerCase();
    if (
      (issnQuery && e === issnQuery) ||
      normalize(t.title) === norm ||
      (normalize(t.title).includes(norm) && norm.length > 2)
    ) {
      taHit = t;
      flags.transformativeHit = true;
      // keep going only if we had no accredited hit
      if (!offlineHit) offlineHit = {
        title: t.title,
        titleNorm: t.titleNorm,
        issn: t.issn || '',
        eissn: t.eissn || '',
        lastReview: '',
        internationalAccreditation: '',
        frequency: '',
        publisher: t.publisher || ''
      };
      break;
    }
  }

  // Removed check
  const removed = removedList.some(r =>
    (issnQuery && r.issn.replace(/-/g,'').toLowerCase() === issnQuery) ||
    r.titleNorm === norm ||
    (r.titleNorm.includes(norm) && norm.length > 2)
  );

  return { offlineHit, taHit, flags, removed };
}

/* =================== LIVE LOOKUPS =================== */
async function fetchCrossRef(titleOrISSN) {
  try {
    if (looksISSN(titleOrISSN)) {
      const id = titleOrISSN.replace('-','');
      const r = await fetch(`https://api.crossref.org/journals/${encodeURIComponent(id)}`);
      if (!r.ok) return null;
      const j = await r.json();
      const m = j?.message;
      if (!m) return null;
      return {
        publisher: m.publisher || null,
        issn: (m.ISSN || []).join(' / ') || null,
        licenseUrl: m.license?.[0]?.URL || null
      };
    } else {
      const r = await fetch(`https://api.crossref.org/works?query.container-title=${encodeURIComponent(titleOrISSN)}&rows=1`);
      if (!r.ok) return null;
      const j = await r.json();
      const it = j?.message?.items?.[0];
      if (!it) return null;
      const lic = (it.license && it.license[0] && it.license[0].URL) ? it.license[0].URL : null;
      return {
        publisher: it.publisher || null,
        issn: (it.ISSN || []).join(' / ') || null,
        licenseUrl: lic
      };
    }
  } catch(e){ console.warn('Crossref lookup failed', e); return null; }
}

async function fetchPubMedCount(title) {
  try {
    // Count only (no IDs) to keep fast
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(title)}[journal]&retmax=0`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const count = j?.esearchresult?.count;
    return (typeof count !== 'undefined') ? Number(count) : null;
  } catch(e){ console.warn('PubMed count failed', e); return null; }
}

async function fetchOpenAlex(titleOrISSN) {
  try {
    // Try venue by ISSN or title
    let url = '';
    if (looksISSN(titleOrISSN)) {
      const stripped = titleOrISSN.replace('-','');
      url = `https://api.openalex.org/venues?search=${encodeURIComponent(stripped)}&per-page=1`;
    } else {
      url = `https://api.openalex.org/venues?search=${encodeURIComponent(titleOrISSN)}&per-page=1`;
    }
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const v = j?.results?.[0];
    if (!v) return null;
    return {
      publisher: v.publisher || null,
      issn_l: v.issn_l || null,
      homepage_url: v?.homepage_url || null,
      oa_status: v?.is_oa ? 'Open Access' : null  // not always present for venues
    };
  } catch(e){ console.warn('OpenAlex lookup failed', e); return null; }
}

/* =================== REPORT BUILDER =================== */
function buildReport(query, offlineHit, taHit, flags, removed, live) {
  const title = offlineHit?.title || query;
  const pub = offlineHit?.publisher || live.crossref?.publisher || live.openalex?.publisher || 'Unknown';
  const issnLine = [
    offlineHit?.issn || '',
    offlineHit?.eissn ? `eISSN: ${offlineHit.eissn}` : ''
  ].filter(Boolean).join(' | ');
  const licenseUrl = live?.crossref?.licenseUrl || null;

  // recommendation logic
  let recText = '';
  let recClass = 'verify';

  if (removed) {
    recText = '❌ Not recommended: Appears on the "Removed 4rm Accredited List".';
    recClass = 'not-recommended';
  } else if (flags.accreditedHit && flags.transformativeHit) {
    recText = '✅ Recommended: Appears in credible indexes and is included in a Transformative Agreement.';
    recClass = 'recommended';
  } else if (flags.accreditedHit) {
    recText = '✅ Recommended: Appears in credible indexes.';
    recClass = 'recommended';
  } else if (flags.transformativeHit) {
    recText = '⚠️ Verify with your Librarian: Not in key lists, but covered by a Transformative Agreement.';
    recClass = 'verify';
  } else {
    recText = '⚠️ This journal was not found in any of the key lists. Kindly confirm its credibility with your Faculty Librarian.';
    recClass = 'not-recommended';
  }

  const parts = [];

  parts.push('=== Journal Identification ===');
  parts.push(`Journal Title: ${title}`);
  if (issnLine) parts.push(`ISSN: ${issnLine}`);
  parts.push(`Publisher: ${pub}`);
  parts.push('');

  parts.push('=== Accreditation Checks ===');
  parts.push(`Found in Accredited Lists: ${flags.accreditedHit ? 'Yes' : 'No'}`);
  parts.push(`Removed 4rm Accredited List: ${removed ? 'Yes (historical)' : 'No'}`);
  parts.push('');

  parts.push('=== Transformative Agreements ===');
  if (flags.transformativeHit && taHit) {
    const provider = taHit.publisher || 'Agreement';
    const tf = `Transformative: Yes (${provider})`;
    parts.push(tf);
    if (taHit.agreementDuration) parts.push(`Duration: ${taHit.agreementDuration}`);
    if (taHit.notes) parts.push(`Notes: ${taHit.notes}`);
    if (taHit.oaStatus) parts.push(`Open Access Status: ${taHit.oaStatus}`);
  } else {
    parts.push('Transformative: No match found');
  }
  parts.push('');

  parts.push('=== Live Lookups ===');
  const crIssn = live?.crossref?.issn ? ` | Crossref ISSN(s): ${live.crossref.issn}` : '';
  parts.push(`Crossref: ${live?.crossref ? 'Found' : 'No/Unavailable'}${crIssn}`);
  parts.push(`OpenAlex: ${live?.openalex ? 'Found' : 'No/Unavailable'}`);
  parts.push(`PubMed (indexed article count): ${Number.isFinite(live?.pubmedCount) ? live.pubmedCount : 'Not available'}`);
  if (licenseUrl) parts.push(`Licence: CC (see link) → ${licenseUrl}`);
  parts.push('');

  parts.push('=== Recommendation ===');
  parts.push(recText);
  parts.push('');
  parts.push('⚠️ Note: While this journal meets credibility checks, researchers should ensure alignment with their field of study and intended audience before submission.');

  return { text: parts.join('\n'), recText, recClass };
}

/* =================== UI HELPERS =================== */
function showLoading(msg){ loading.textContent = msg; loading.style.display = 'block'; }
function hideLoading(){ loading.style.display = 'none'; }
function showError(msg){ errBox.textContent = msg; errBox.style.display = 'block'; setTimeout(()=>errBox.style.display='none',7000); }
function showReport(text, recText, recClass){
  report.textContent = text;
  report.style.display = 'block';
  rec.textContent = recText;
  rec.className = `rec ${recClass}`;
  rec.style.display = 'block';
}

/* =================== MAIN SEARCH FLOW =================== */
async function doSearch(){
  const query = qInput.value.trim();
  if (!query) { showError('Enter a journal title or ISSN'); return; }

  showLoading('Checking (accredited lists + transformative files + live lookups)…');

  // find offline matches
  const { offlineHit, taHit, flags, removed } = findMatches(query);

  // live lookups
  const live = { crossref: null, pubmedCount: null, openalex: null };
  try {
    const [cr, pm, oa] = await Promise.all([
      fetchCrossRef(offlineHit?.eissn || offlineHit?.issn || offlineHit?.title || query),
      fetchPubMedCount(offlineHit?.title || query),
      fetchOpenAlex(offlineHit?.eissn || offlineHit?.issn || offlineHit?.title || query)
    ]);
    live.crossref = cr;
    live.pubmedCount = pm;
    live.openalex = oa;
  } catch(e){ console.warn('Live lookups failed partially', e); }

  const rep = buildReport(query, offlineHit, taHit, flags, removed, live);
  hideLoading();
  showReport(rep.text, rep.recText, rep.recClass);
}

/* =================== REMOVED LIST VIEW =================== */
function renderRemovedTable() {
  if (!removedList.length) {
    removedTableWrap.innerHTML = '<div style="color:#8B8D8E">No removed data loaded.</div>';
    return;
  }
  const header = `
    <table>
      <thead>
        <tr>
          <th>Journal Title</th>
          <th>ISSN</th>
          <th>Reason</th>
          <th>Review/Year</th>
          <th>Publisher</th>
        </tr>
      </thead>
      <tbody>
  `;
  const rows = removedList.map(r => `
    <tr>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.issn)}</td>
      <td>${escapeHtml(r.reason)}</td>
      <td>${escapeHtml(r.review)}</td>
      <td>${escapeHtml(r.publisher)}</td>
    </tr>
  `).join('');
  const footer = '</tbody></table>';
  removedTableWrap.innerHTML = header + rows + footer;
}

function copyRemovedToClipboard(){
  if (!removedList.length) { showError('No removed list data to copy'); return; }
  const lines = [
    'Journal Title,ISSN,Reason,Review/Year,Publisher',
    ...removedList.map(r => [
      csvSafe(r.title),
      csvSafe(r.issn),
      csvSafe(r.reason),
      csvSafe(r.review),
      csvSafe(r.publisher)
    ].join(','))
  ];
  navigator.clipboard.writeText(lines.join('\n'))
    .then(()=>{})
    .catch(err=>showError('Copy failed: '+err));
}

function downloadRemovedCSV(){
  if (!removedList.length) { showError('No removed list data to download'); return; }
  const lines = [
    'Journal Title,ISSN,Reason,Review/Year,Publisher',
    ...removedList.map(r => [
      csvSafe(r.title),
      csvSafe(r.issn),
      csvSafe(r.reason),
      csvSafe(r.review),
      csvSafe(r.publisher)
    ].join(','))
  ];
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'Removed_from_Accredited_List.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* =================== UTIL =================== */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function csvSafe(s){
  const t = String(s || '');
  if (t.includes(',') || t.includes('"') || t.includes('\n')) return `"${t.replace(/"/g,'""')}"`;
  return t;
}

/* =================== EVENTS =================== */
btnSearch.addEventListener('click', doSearch);
qInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doSearch(); });

btnCopy.addEventListener('click', () => {
  if (report.style.display !== 'block') { showError('No report to copy'); return; }
  navigator.clipboard.writeText(report.textContent).catch(err=>showError('Copy failed: '+err));
});

btnDownload.addEventListener('click', () => {
  if (report.style.display !== 'block') { showError('No report to download'); return; }
  const blob = new Blob([report.textContent], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'journal_report.txt'; a.click();
  URL.revokeObjectURL(url);
});

btnShowRemoved.addEventListener('click', () => {
  if (removedPanel.style.display === 'block') {
    removedPanel.style.display = 'none';
    btnShowRemoved.textContent = '🚨 Show Removed 4rm Accredited List';
  } else {
    renderRemovedTable();
    removedPanel.style.display = 'block';
    btnShowRemoved.textContent = '🚨 Hide Removed 4rm Accredited List';
  }
});

btnCopyRemoved.addEventListener('click', copyRemovedToClipboard);
btnDownloadRemoved.addEventListener('click', downloadRemovedCSV);
