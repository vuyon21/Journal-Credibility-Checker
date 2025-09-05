/* ================= CONFIG ================= */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

/* Accredited lists (raw filenames in repo) */
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

/* Removed list */
const REMOVED_FILE = 'JOURNALS REMOVED IN PAST YEARS.csv';

/* Transformative agreements files */
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

/* ================ DOM ================ */
const $ = id => document.getElementById(id);
const qInput = $('q');
const btnSearch = $('btn-search');
const btnCopy = $('btn-copy');
const btnDownload = $('btn-download');
const btnShowRemoved = $('btn-show-removed');
const btnCopyRemoved = $('btn-copy-removed');
const loadingEl = $('loading');
const errBox = $('error');
const reportContainer = $('report-container');
const removedPanel = $('removed-panel');
const removedTableWrap = $('removed-table-wrap');
const acWrap = $('autocomplete-results');

/* ================ In-memory datasets ================ */
let accredited = [];   // normalized objects
let transformList = [];
let removedList = [];

/* ================ Utilities ================ */
function normalize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim(); }
function looksISSN(s){ return /\b\d{4}-?\d{3}[\dXx]\b/.test(s || ''); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* Robust CSV parser that returns array of rows (array of columns) */
function parseCSV(text){
  if(!text) return [];
  // remove BOM
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if(!lines.length) return [];
  // If header row (contains 'journal' or 'title' words), keep it for header mapping in callers
  return lines.map(line => {
    const cols = [];
    let cur = '', inQuotes = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){
        if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if(ch === ',' && !inQuotes){
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    return cols.map(c => c.trim());
  });
}

/* ================ UNIVERSAL FIELD EXTRACTION ================ */
class UniversalFieldExtractor {
  constructor() {
    this.fieldPatterns = {
      title: [
        'title', 'journal.*title', 'journal.*name', 'name', 'publication.*title',
        'journal', 'publication', 'journal title', 'journal name'
      ],
      issn: [
        'issn', 'issn.*1', 'issn.*2', 'issn.*online', 'issn.*print',
        'international.*standard.*serial.*number', 'issn.*number', 'print.*issn',
        'online.*issn', 'eissn', 'e.*issn'
      ],
      eissn: [
        'eissn', 'e.*issn', 'online.*issn', 'electronic.*issn', 'issn.*online',
        'digital.*issn'
      ],
      publisher: [
        'publisher', 'publishers', 'publisher.*details', 'publisher.*name',
        'journal.*publisher', 'published.*by', 'publishing.*house', 'publishing.*company',
        'pub.*', 'publisher.*information', 'publisher info'
      ],
      frequency: [
        'frequency', 'pub.*frequency', 'publication.*frequency', 'issues.*per.*year',
        'publication.*rate', 'issues.*per.*volume'
      ],
      lastReview: [
        'date.*last.*review', 'last.*review', 'review.*date', 'accreditation.*date',
        'year.*reviewed', 'date.*accreditation'
      ],
      international: [
        'international', 'international.*accreditation', 'international.*status',
        'index', 'indexed', 'indexing'
      ]
    };
  }

  extractField(row, header, fieldType) {
    if (!this.fieldPatterns[fieldType]) return '';
    
    const values = [];
    
    // First try to find by header name pattern matching
    for (let i = 0; i < header.length; i++) {
      const colName = String(header[i] || '').toLowerCase().trim();
      const value = String(row[i] || '').trim();
      
      if (!value || value.toLowerCase() === 'nan' || value.toLowerCase() === 'null') continue;
      
      for (const pattern of this.fieldPatterns[fieldType]) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(colName)) {
          if (value && !values.includes(value)) {
            values.push(value);
          }
          break;
        }
      }
    }
    
    // If no values found by header matching, try to find in any column by content pattern
    if (values.length === 0) {
      for (let i = 0; i < row.length; i++) {
        const value = String(row[i] || '').trim();
        if (!value || value.toLowerCase() === 'nan' || value.toLowerCase() === 'null') continue;
        
        // For specific field types, check if content matches expected patterns
        if (fieldType === 'issn' || fieldType === 'eissn') {
          if (looksISSN(value)) {
            values.push(value);
          }
        } else if (fieldType === 'publisher') {
          // Look for publisher-like content (company names, publishing terms)
          if (this.looksLikePublisher(value)) {
            values.push(value);
          }
        }
      }
    }
    
    return values.length > 0 ? values.join('; ') : '';
  }

  looksLikePublisher(value) {
    const lowerValue = value.toLowerCase();
    const publisherIndicators = [
      'publisher', 'publishing', 'press', 'publications', 'ltd', 'inc', 'llc',
      'gmbh', 'verlag', 'editorial', 'editions', 'books', 'academic', 'university',
      'college', 'institute', 'association', 'society', 'foundation', 'group',
      'corporation', 'company', 'co.', '& sons', '& daughters'
    ];
    
    return publisherIndicators.some(indicator => lowerValue.includes(indicator));
  }
}

/* ================ IMPROVED MAPPING FUNCTIONS ================ */
const fieldExtractor = new UniversalFieldExtractor();

function mapAccreditedRow(cols, header, sourceFileName) {
  const h = header.length > 0 ? header : Array(cols.length).fill('').map((_, i) => `Column${i+1}`);
  
  const title = fieldExtractor.extractField(cols, h, 'title') || cols[0] || '';
  const issn = fieldExtractor.extractField(cols, h, 'issn') || '';
  const eissn = fieldExtractor.extractField(cols, h, 'eissn') || '';
  const publisher = fieldExtractor.extractField(cols, h, 'publisher') || '';
  const lastReview = fieldExtractor.extractField(cols, h, 'lastReview') || '';
  const international = fieldExtractor.extractField(cols, h, 'international') || '';
  const frequency = fieldExtractor.extractField(cols, h, 'frequency') || '';

  // Determine the source list type from filename
  let listType = 'Unknown';
  if (sourceFileName.includes('DHET')) listType = 'DHET';
  else if (sourceFileName.includes('DOAJ')) listType = 'DOAJ';
  else if (sourceFileName.includes('IBSS')) listType = 'IBSS';
  else if (sourceFileName.includes('NORWEGIAN')) listType = 'NORWEGIAN';
  else if (sourceFileName.includes('SCIELO')) listType = 'SCIELO';
  else if (sourceFileName.includes('SCOPUS')) listType = 'SCOPUS';
  else if (sourceFileName.includes('WOS')) listType = 'WOS';

  return {
    title: title.trim(),
    titleNorm: normalize(title),
    issn: issn.replace(/\s+/g,''),
    eissn: eissn.replace(/\s+/g,''),
    publisher: publisher.trim(),
    lastReview: lastReview.trim(),
    international: international.trim(),
    frequency: frequency.trim(),
    source: 'accredited',
    listType: listType
  };
}

function mapTransformRow(cols, header, sourceFileName) {
  const h = header.length > 0 ? header : Array(cols.length).fill('').map((_, i) => `Column${i+1}`);
  
  const title = fieldExtractor.extractField(cols, h, 'title') || cols[0] || '';
  const eissn = fieldExtractor.extractField(cols, h, 'eissn') || '';
  const publisher = fieldExtractor.extractField(cols, h, 'publisher') || '';
  
  // For transformative agreements, we need to extract additional fields
  let oaStatus = '', included = '', notes = '', subject = '', duration = '';
  
  // Try to extract other fields by content pattern if headers don't match
  for (let i = 0; i < cols.length; i++) {
    const value = String(cols[i] || '').trim();
    if (!value) continue;
    
    const lowerValue = value.toLowerCase();
    
    if (!oaStatus && (lowerValue.includes('open access') || lowerValue.includes('oa'))) {
      oaStatus = value;
    }
    if (!included && (lowerValue.includes('included') || lowerValue.includes('yes') || lowerValue.includes('no'))) {
      included = value;
    }
    if (!subject && (lowerValue.includes('subject') || lowerValue.includes('discipline') || 
                     lowerValue.includes('field') || lowerValue.includes('category'))) {
      subject = value;
    }
    if (!duration && (lowerValue.includes('duration') || lowerValue.includes('period') || 
                     lowerValue.match(/\b(202[3-9]|203[0-9])\b/))) {
      duration = value;
    }
    if (!notes && (lowerValue.includes('note') || lowerValue.includes('comment') || 
                  lowerValue.includes('remark') || lowerValue.includes('explanation'))) {
      notes = value;
    }
  }

  return {
    title: title.trim(),
    titleNorm: normalize(title),
    eissn: eissn.replace(/\s+/g,''),
    oaStatus: oaStatus,
    included: included || 'Yes', // Default to Yes if not specified
    notes: notes,
    subject: subject,
    publisher: publisher.trim(),
    duration: duration,
    source: 'transformative'
  };
}

function mapRemovedRow(cols, header, sourceFileName) {
  const h = header.length > 0 ? header : Array(cols.length).fill('').map((_, i) => `Column${i+1}`);
  
  const title = fieldExtractor.extractField(cols, h, 'title') || cols[0] || '';
  const issn = fieldExtractor.extractField(cols, h, 'issn') || '';
  const publisher = fieldExtractor.extractField(cols, h, 'publisher') || '';
  
  // Try to find reason and review fields
  let reason = '', review = '';
  for (let i = 0; i < cols.length; i++) {
    const value = String(cols[i] || '').trim();
    if (!value) continue;
    
    const lowerValue = value.toLowerCase();
    
    if (!reason && (lowerValue.includes('reason') || lowerValue.includes('why') || 
                   lowerValue.includes('cause') || lowerValue.includes('explanation'))) {
      reason = value;
    }
    if (!review && (lowerValue.includes('review') || lowerValue.includes('date') || 
                   lowerValue.match(/\b(19|20)\d{2}\b/) || lowerValue.includes('year'))) {
      review = value;
    }
  }

  return {
    title: title.trim(),
    titleNorm: normalize(title),
    issn: issn.replace(/\s+/g,''),
    reason: reason,
    review: review,
    publisher: publisher.trim(),
    source: 'removed'
  };
}

/* ================== Fetch CSV text ================== */
async function fetchText(url){
  const r = await fetch(url, { cache: 'no-store' });
  if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

/* Load and normalize accredited files */
async function loadAccredited(){
  const results = [];
  for(const f of ACCREDITED_FILES){
    try{
      const text = await fetchText(RAW_BASE + encodeURIComponent(f));
      const rows = parseCSV(text);
      if(!rows.length) continue;
      
      // detect header possibility
      const header = rows[0].some(c => /journal|title|issn/i.test(String(c))) ? rows[0] : [];
      const dataRows = header.length ? rows.slice(1) : rows;
      
      for(const cols of dataRows){
        if(!cols.some(c => String(c || '').trim())) continue;
        const mapped = mapAccreditedRow(cols, header, f);
        if(mapped.title) results.push(mapped);
      }
    }catch(e){ console.warn('Failed to load accredited file', f, e); }
  }
  accredited = results;
}

/* Load removed */
async function loadRemoved(){
  const out = [];
  try{
    const text = await fetchText(RAW_BASE + encodeURIComponent(REMOVED_FILE));
    const rows = parseCSV(text);
    if(!rows.length) { removedList = []; return; }
    
    const header = rows[0].some(c => /journal|title|issn/i.test(String(c))) ? rows[0] : [];
    const dataRows = header.length ? rows.slice(1) : rows;
    
    for(const cols of dataRows){
      if(!cols.some(c => String(c || '').trim())) continue;
      out.push(mapRemovedRow(cols, header, REMOVED_FILE));
    }
  }catch(e){ console.warn('Failed to load removed file', e); }
  removedList = out;
}

/* Load transformative agreements */
async function loadTransformative(){
  const results = [];
  for(const f of TRANSFORMATIVE_FILES){
    try{
      const text = await fetchText(RAW_BASE + encodeURIComponent(f));
      const rows = parseCSV(text);
      if(!rows.length) continue;
      
      const header = rows[0].some(c => /journal|title|eissn|included/i.test(String(c))) ? rows[0] : [];
      const dataRows = header.length ? rows.slice(1) : rows;
      
      for(const cols of dataRows){
        if(!cols.some(c => String(c || '').trim())) continue;
        const mapped = mapTransformRow(cols, header, f);
        if(mapped.title) results.push(mapped);
      }
    }catch(e){ console.warn('Failed to load transformative file', f, e); }
  }
  transformList = results;
}

/* ================== Init (load all) ================== */
async function init(){
  try{
    loadingEl.style.display = 'block';
    await Promise.all([loadAccredited(), loadRemoved(), loadTransformative()]);
    // Setup autocomplete now that datasets are in memory
    setupAutocomplete();
    
    // Setup event listeners after everything is loaded
    setupEventListeners();
  }catch(e){
    console.error('Initialization error', e);
    errBox.style.display = 'block'; errBox.textContent = 'Failed to load CSV datasets. Check RAW_BASE and filenames.';
  } finally {
    loadingEl.style.display = 'none';
  }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  init();
});

/* ================== Setup Event Listeners ================== */
function setupEventListeners() {
  // Search button click event
  if (btnSearch) {
    btnSearch.addEventListener('click', () => doSearch());
  }
  
  // Enter key in search input
  if (qInput) {
    qInput.addEventListener('keypress', (e) => { 
      if(e.key === 'Enter') doSearch(); 
    });
  }
  
  // Copy report button
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      if(!reportContainer.innerText.trim()){ alert('No report to copy'); return; }
      navigator.clipboard.writeText(reportContainer.innerText).then(()=>alert('Report copied to clipboard')).catch(()=>alert('Copy failed'));
    });
  }
  
  // Download report button
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      if(!reportContainer.innerText.trim()){ alert('No report to download'); return; }
      const blob = new Blob([reportContainer.innerText], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'journal_report.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
  
  // Show removed list button
  if (btnShowRemoved) {
    btnShowRemoved.addEventListener('click', () => {
      if(removedPanel.style.display === 'block'){ 
        removedPanel.style.display='none'; 
        btnShowRemoved.textContent='🚨 Show Removed 4rm Accredited List'; 
      } else {
        renderRemovedTable();
        removedPanel.style.display = 'block';
        btnShowRemoved.textContent='🚨 Hide Removed 4rm Accredited List';
      }
    });
  }
  
  // Copy removed list button
  if (btnCopyRemoved) {
    btnCopyRemoved.addEventListener('click', () => {
      if(!removedList.length){ alert('No removed list data to copy'); return; }
      const lines = removedList.map(r => `${r.title}, ${r.issn}, ${r.reason}, ${r.review}, ${r.publisher}`);
      navigator.clipboard.writeText(lines.join('\n')).then(()=>alert('Removed list copied to clipboard'));
    });
  }
}

/* ================== Autocomplete ================== */
function setupAutocomplete(){
  if (!qInput || !acWrap) return;
  
  qInput.addEventListener('input', ()=>{
    const q = normalize(qInput.value);
    acWrap.innerHTML = '';
    acWrap.style.display = 'none';
    if(q.length < 2) return;

    const seen = new Set();
    const suggestions = [];

    function addFrom(arr){
      for(const j of arr){
        if(!j.title) continue;
        const tn = j.titleNorm || normalize(j.title);
        if(tn.includes(q) && !seen.has(j.title)){
          seen.add(j.title);
          suggestions.push(j.title);
          if(suggestions.length >= 10) break;
        }
      }
    }
    addFrom(accredited);
    if(suggestions.length < 10) addFrom(transformList);

    if(suggestions.length){
      const frag = document.createDocumentFragment();
      suggestions.forEach(s => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = s;
        div.addEventListener('click', ()=>{
          qInput.value = s;
          acWrap.style.display = 'none';
          doSearch(s);
        });
        frag.appendChild(div);
      });
      acWrap.appendChild(frag);
      acWrap.style.display = 'block';
    }
  });

  document.addEventListener('click', (e) => {
    if(!acWrap.contains(e.target) && e.target !== qInput) acWrap.style.display = 'none';
  });
}

/* ================== Live lookups ================== */
async function fetchCrossRef(titleOrISSN){
  try{
    if(looksISSN(titleOrISSN)){
      // use journals endpoint (ISSN)
      const id = titleOrISSN.replace('-','');
      const r = await fetch(`https://api.crossref.org/journals/${encodeURIComponent(id)}`);
      if(!r.ok) return null;
      const j = await r.json();
      return { publisher: j?.message?.publisher || null, issn: (j?.message?.ISSN || []).join(' / ') || null, source: 'CrossRef' };
    } else {
      // fallback: search works (container-title)
      const r = await fetch(`https://api.crossref.org/works?query.container-title=${encodeURIComponent(titleOrISSN)}&rows=1`);
      if(!r.ok) return null;
      const j = await r.json();
      const it = j?.message?.items?.[0];
      if(!it) return null;
      const lic = it.license && it.license[0] && it.license[0].URL ? it.license[0].URL : null;
      return { publisher: it.publisher || null, issn: (it.ISSN||[]).join(' / ') || null, license: lic, source: 'CrossRef' };
    }
  }catch(e){ console.warn('CrossRef lookup failed', e); return null; }
}

async function fetchOpenAlex(titleOrISSN){
  try{
    // search venues by ISSN or name
    const q = looksISSN(titleOrISSN) ? `filter=issn:${encodeURIComponent(titleOrISSN)}` : `search=${encodeURIComponent(titleOrISSN)}`;
    const url = looksISSN(titleOrISSN) ? `https://api.openalex.org/venues?filter=issn:${encodeURIComponent(titleOrISSN)}&per-page=1` : `https://api.openalex.org/venues?search=${encodeURIComponent(titleOrISSN)}&per-page=1`;
    const r = await fetch(url);
    if(!r.ok) return null;
    const j = await r.json();
    const v = j?.results?.[0];
    if(!v) return null;
    return { publisher: v.publisher || null, issn_l: v.issn_l || null, homepage_url: v?.homepage_url || null, oa_status: v?.is_oa ? 'Open Access' : 'Closed', source: 'OpenAlex' };
  }catch(e){ console.warn('OpenAlex lookup failed', e); return null; }
}

async function fetchPubMedCount(title){
  try{
    // Use journal name search (restrict to journal field)
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(title)}[Journal]&retmax=0`;
    const r = await fetch(url);
    if(!r.ok) return null;
    const j = await r.json();
    const count = j?.esearchresult?.count;
    return (typeof count !== 'undefined') ? Number(count) : null;
  }catch(e){ console.warn('PubMed count failed', e); return null; }
}

/* ================== Search and report builder ================== */
async function doSearch(rawQuery){
  const query = (typeof rawQuery === 'string' && rawQuery.trim()) ? rawQuery.trim() : qInput.value.trim();
  if(!query) { 
    if (errBox) {
      errBox.style.display='block'; 
      errBox.textContent = 'Enter a journal title or ISSN'; 
      setTimeout(()=>{
        if (errBox) errBox.style.display='none';
      },4000); 
    }
    return; 
  }

  // UI reset
  if (loadingEl) loadingEl.style.display = 'block';
  if (reportContainer) reportContainer.innerHTML = '';

  // offline matches
  const norm = normalize(query);
  const issnQuery = looksISSN(query) ? query.replace(/-/g,'') : null;

  // find accredited
  const accreditedHits = accredited.filter(j => {
    const p = (j.issn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    const e = (j.eissn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    return (issnQuery && (p === issnQuery || e === issnQuery)) || j.titleNorm === norm || (j.titleNorm.includes(norm) && norm.length > 2);
  });

  // Get unique list types from accredited hits
  const foundInLists = [...new Set(accreditedHits.map(hit => hit.listType))].filter(Boolean);

  // transformative
  const taHits = transformList.filter(t => {
    const e = (t.eissn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    return (issnQuery && e === issnQuery) || t.titleNorm === norm || (t.titleNorm.includes(norm) && norm.length > 2);
  });

  // removed
  const removedMatch = removedList.some(r => {
    const p = (r.issn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    return (issnQuery && p === issnQuery) || r.titleNorm === norm || (r.titleNorm.includes(norm) && norm.length > 2);
  });

  // Live API lookups (best-effort)
  const live = { crossref: null, openalex: null, pubmedCount: null };
  try{
    const [cr, oa, pm] = await Promise.all([
      fetchCrossRef( accreditedHits[0]?.eissn || accreditedHits[0]?.issn || taHits[0]?.eissn || taHits[0]?.issn || query ),
      fetchOpenAlex( accreditedHits[0]?.eissn || accreditedHits[0]?.issn || taHits[0]?.eissn || taHits[0]?.issn || query ),
      fetchPubMedCount(accreditedHits[0]?.title || taHits[0]?.title || query)
    ]);
    live.crossref = cr;
    live.openalex = oa;
    live.pubmedCount = pm;
  }catch(e){
    console.warn('Live lookups partially failed', e);
  }

  // Recommendation logic
  let recText = '';
  let recClass = '';
  if(removedMatch){
    recText = '❌ Not recommended: Appears on the "Removed 4rm Previous Accredited List".';
    recClass = 'removed';
  } else if(accreditedHits.length && taHits.length){
    recText = '✅ Recommended: Appears in credible indexes and is included in a Transformative Agreement.';
    recClass = 'accredited';
  } else if(accreditedHits.length){
    recText = '✅ Recommended: Appears in credible indexes.';
    recClass = 'accredited';
  } else if(taHits.length){
    recText = '⚠️ Verify: Not in 2025 accredited lists, but appears in a Transformative Agreement.';
    recClass = 'transformative';
  } else {
    recText = '⚠️ Not found in key lists — please verify with your Faculty Librarian.';
    recClass = 'live';
  }

  // Build report sections as separate tables
  const parts = [];

  // Journal Identification - Use proper publisher info from our extracted data
  const idTitle = accreditedHits[0]?.title || taHits[0]?.title || (qInput ? qInput.value : '') || query;
  const idPublisher = accreditedHits[0]?.publisher || taHits[0]?.publisher || live.crossref?.publisher || live.openalex?.publisher || '';
  const idISSN = [accreditedHits[0]?.issn, accreditedHits[0]?.eissn, taHits[0]?.eissn].filter(Boolean).join(' | ');
  
  const identificationRows = [
    ['Journal Title', idTitle],
    ['ISSN', idISSN || 'N/A']
  ];
  
  // Only add Publisher field if we have data
  if (idPublisher) {
    identificationRows.push(['Publisher', idPublisher]);
  }
  
  // Add other fields if available
  if (accreditedHits[0]?.lastReview) {
    identificationRows.push(['Last Review', accreditedHits[0].lastReview]);
  }
  
  if (accreditedHits[0]?.frequency) {
    identificationRows.push(['Frequency', accreditedHits[0].frequency]);
  }
  
  if (accreditedHits[0]?.international) {
    identificationRows.push(['International', accreditedHits[0].international]);
  }
  
  parts.push({ title: 'Journal Identification', rows: identificationRows });

  // Accreditation Checks
  const accRows = [
    ['Found in 2025 Accredited Lists', accreditedHits.length ? `Yes (${foundInLists.join(', ')})` : 'No'],
    ['Removed 4rm Previous Accredited List', removedMatch ? 'Yes (historical)' : 'No']
  ];
  parts.push({ title: 'Accreditation Checks', rows: accRows });

  // Transformative Agreements - IMPROVED: Show "Not applicable" when not found
  const taRows = [];
  if(taHits.length){
    const t = taHits[0];
    taRows.push(['Transformative', t.included || 'Yes']);
    if(t.duration) taRows.push(['Duration', t.duration]);
    if(t.oaStatus) taRows.push(['Open Access Status', t.oaStatus]);
    if(t.publisher) taRows.push(['Publisher', t.publisher]);
    if(t.notes) taRows.push(['Notes', t.notes]);
    if(t.subject) taRows.push(['Subject', t.subject]);
  } else {
    taRows.push(['Transformative', 'Not applicable']);
  }
  parts.push({ title: 'Transformative Agreements', rows: taRows });

  // Live Lookups
  const liveRows = [];
  liveRows.push(['CrossRef', live.crossref ? `Found | ${live.crossref.issn ? 'ISSN(s): ' + live.crossref.issn : ''} ${live.crossref?.license ? '| License: ' + live.crossref.license : ''}` : 'No/Unavailable']);
  liveRows.push(['OpenAlex', live.openalex ? `Found | ${live.openalex.issn_l ? 'ISSN-L: ' + live.openalex.issn_l : ''} ${live.openalex?.oa_status ? '| OA: ' + live.openalex.oa_status : ''}` : 'No/Unavailable']);
  liveRows.push(['PubMed (indexed article count)', Number.isFinite(live.pubmedCount) ? String(live.pubmedCount) : 'Not available']);
  parts.push({ title: 'Live Lookups', rows: liveRows });

  // Render parts to DOM
  if (reportContainer) {
    reportContainer.innerHTML = '';
    for(const part of parts){
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = `<tr><th colspan="2">${escapeHtml(part.title)}</th></tr>`;
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      for(const r of part.rows){
        const tr = document.createElement('tr');
        const tdKey = document.createElement('td');
        tdKey.style.width = '30%';
        tdKey.textContent = r[0];
        const tdVal = document.createElement('td');
        tdVal.innerHTML = r[1] || '';
        tr.appendChild(tdKey);
        tr.appendChild(tdVal);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      reportContainer.appendChild(table);
    }

    // Add Recommendation as a special section
    const recContainer = document.createElement('div');
    recContainer.className = `rec ${recClass}`;
    recContainer.style.display = 'block';
    recContainer.style.marginTop = '20px';
    recContainer.style.padding = '15px';
    recContainer.style.borderRadius = '8px';
    recContainer.style.fontWeight = 'bold';
    recContainer.style.border = '1px solid transparent';
    recContainer.innerHTML = `<h3 style="margin:0 0 10px 0;">Recommendation</h3><p style="margin:0; font-size:16px;">${recText}</p>`;
    
    reportContainer.appendChild(recContainer);
  }

  if (loadingEl) loadingEl.style.display = 'none';
}

function renderRemovedTable(){
  if(!removedTableWrap) return;
  
  if(!removedList.length){ 
    removedTableWrap.innerHTML = '<div style="color:var(--muted)">No removed data loaded.</div>'; 
    return; 
  }
  let html = '<table><thead><tr><th>Journal Title</th><th>ISSN</th><th>Reason</th><th>Review/Year</th><th>Publisher</th></tr></thead><tbody>';
  html += removedList.map(r => `<tr class="removed"><td>${escapeHtml(r.title)}</td><td>${escapeHtml(r.issn)}</td><td>${escapeHtml(r.reason)}</td><td>${escapeHtml(r.review)}</td><td>${escapeHtml(r.publisher)}</td></tr>`).join('');
  html += '</tbody></table>';
  removedTableWrap.innerHTML = html;
}

/* ================== EXPORT / DEBUG UTIL ================== */
window._ufsDatasets = {
  get accredited(){ return accredited; },
  get transformList(){ return transformList; },
  get removedList(){ return removedList; }
};
