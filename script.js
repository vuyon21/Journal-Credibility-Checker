/* ===================== CONFIG ===================== */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

const FILENAMES = {
  dhet: 'DHET_2025.csv',
  doaj: 'DOAJ_2025.csv',
  ibss: 'IBSS_2025.csv',
  norwegian: 'NORWEGIAN_2025.csv',
  other: 'OTHER INDEXED JOURNALS_2025.csv',
  scielo: 'SCIELO SA_2025.csv',
  scopus: 'SCOPUS_2025.csv',
  wos: 'WOS_2025.csv',
  removed: 'JOURNALS REMOVED IN PAST YEARS.csv'
};

const TRANSFORMATIVE_FILES = [
  {file:'WILEY_2025.csv', link:'https://sanlic.ac.za/wiley/'},
  {file:'The Company of Biologists_2025.csv', link:'https://sanlic.ac.za/the-company-of-biologists/'},
  {file:'Taylor & Francis_2025.csv', link:'https://sanlic.ac.za/taylor-francis/'},
  {file:'Springer_2025.csv', link:'https://sanlic.ac.za/springer/'},
  {file:'ScienceDirect (Elsevier)_2025.csv', link:'https://sanlic.ac.za/sciencedirect-elsevier/'},
  {file:'SAGE Publishing_2025.csv', link:'https://sanlic.ac.za/sage-publishing/'},
  {file:'Royal Society_2025.csv', link:'https://sanlic.ac.za/royal-society/'},
  {file:'Royal Society of Chemistry Platinum_2025.csv', link:'https://sanlic.ac.za/royal-society-of-chemistry/'},
  {file:'Oxford University Press Journals_2025.csv', link:'https://sanlic.ac.za/oxford-university-press-journals/'},
  {file:'IOPscienceExtra_2025.csv', link:'https://sanlic.ac.za/iopscience-extra/'},
  {file:'Emerald_2025.csv', link:'https://sanlic.ac.za/emerald/'},
  {file:'Cambridge University Press (CUP)_2025.csv', link:'https://sanlic.ac.za/cambridge-university-press/'},
  {file:'Bentham Science Publishers_2025.csv', link:'https://sanlic.ac.za/bentham-science-publishers-2/'},
  {file:'Association for Computing Machinery (ACM)_2025.csv', link:'https://sanlic.ac.za/association-for-computing-machinery-acm/'},
  {file:'American Institute of Physics (AIP)_2025.csv', link:'https://sanlic.ac.za/american-institute-of-physics-2/'},
  {file:'American Chemical Society (ACS)_2025.csv', link:'https://sanlic.ac.za/american-chemical-society-acs/'}
];

/* ===================== DOM ===================== */
const $ = id => document.getElementById(id);
const journalQuery = $('journal-query');
const checkBtn = $('check-btn');
const autocompleteResults = $('autocomplete-results');
const copyReportBtn = $('copy-report-btn');
const downloadReportBtn = $('download-report-btn');
const showRemovedBtn = $('show-removed-btn');
const copyRemovedBtn = $('copy-removed-btn');
const journalReport = $('journal-report');
const loadingMessage = $('loading-message');
const errorMessage = $('error-message');
const recommendationBadge = $('status-badge');
const infoBadge = $('info-badge');
const removedModal = $('removed-modal');
const closeRemoved = $('close-removed');
const removedTableBody = $('removed-table').querySelector('tbody');
const summaryBody = $('summary-body');
const infoTitle = $('info-title');
const infoIssn = $('info-issn');
const infoPublisher = $('info-publisher');
const infoIndexes = $('info-indexes');
const sDHET = $('s-dhet');
const sScopus = $('s-scopus');
const sWos = $('s-wos');
const sDoaj = $('s-doaj');
const sIbss = $('s-ibss');
const sScielo = $('s-scielo');
const transformativeInfo = $('transformative-info');
const realtimeInfo = $('realtime-info');
const exportJsonBtn = $('export-json');

let journalLists = { dhet:[], doaj:[], ibss:[], norwegian:[], other:[], scielo:[], scopus:[], wos:[], removed:[] };
let transformativeList = [];

/* ===================== UTILITIES ===================== */
function showLoading(msg){ loadingMessage.textContent = msg; loadingMessage.style.display = 'block'; }
function hideLoading(){ loadingMessage.style.display = 'none'; }
function showError(msg){ errorMessage.textContent = msg; errorMessage.style.display = 'block'; setTimeout(()=>errorMessage.style.display='none',7000); }
function normalizeTitle(t){ return (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim(); }
function isISSN(s){ return /\b\d{4}-?\d{3}[\dXx]\b/.test(s); }
function rawUrlFor(fname){ return RAW_BASE + encodeURIComponent(fname); }
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length < 1) return [];
  const delim = (lines[0].includes('|') && lines[0].split('|').length>1) ? '|' : ',';
  const headers = lines[0].split(delim).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line=>{
    const parts = line.split(delim).map(p=>p.trim());
    const row = {};
    headers.forEach((h,i)=> row[h] = (parts[i]||'').trim());
    return row;
  });
}

/* ===================== LOAD LISTS ===================== */
journalQuery.disabled = true;
async function loadAllLists(){
  showLoading('Loading journal lists (this may take a few seconds)…');
  for(const [key,fname] of Object.entries(FILENAMES)){
    try{
      const res = await fetch(rawUrlFor(fname));
      if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const txt = await res.text();
      journalLists[key] = parseCSV(txt);
    }catch(e){
      console.warn('Failed loading', fname, e);
      journalLists[key] = [];
      showError(`Warning: Could not load ${fname} (${e.message})`);
    }
  }

  // Transformative agreements
  transformativeList = [];
  for(const t of TRANSFORMATIVE_FILES){
    try{
      const res = await fetch(rawUrlFor(t.file));
      if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const txt = await res.text();
      const rows = parseCSV(txt);
      rows.forEach(r => transformativeList.push({...r, link: t.link}));
    }catch(e){
      console.warn('Failed loading transformative file', t.file, e);
    }
  }

  hideLoading();
  journalQuery.disabled = false;
}
loadAllLists();

/* ===================== AUTOCOMPLETE ===================== */
journalQuery.addEventListener('input', function(){
  const q = normalizeTitle(this.value || '');
  autocompleteResults.innerHTML = '';
  autocompleteResults.style.display = 'none';
  if(q.length < 2) return;
  const suggestions = new Set();
  for(const arr of Object.values(journalLists)){
    for(const j of arr){
      const title = j.title || j['journal title'] || j['journal'] || j.name || '';
      if(!title) continue;
      if(normalizeTitle(title).includes(q)) suggestions.add(title);
      if(suggestions.size >= 8) break;
    }
    if(suggestions.size >= 8) break;
  }
  if(suggestions.size){
    suggestions.forEach(t => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = t;
      div.addEventListener('click', ()=>{
        journalQuery.value = t;
        autocompleteResults.style.display = 'none';
        runCheck();
      });
      autocompleteResults.appendChild(div);
    });
    autocompleteResults.style.display = 'block';
  }
});

document.addEventListener('click', e=>{
  if(!autocompleteResults.contains(e.target) && e.target !== journalQuery) autocompleteResults.style.display = 'none';
});

/* ===================== SEARCH HELPERS ===================== */
function findOffline(query){
  const qNorm = normalizeTitle(query);
  const issnQuery = isISSN(query) ? query.replace('-','').toLowerCase() : null;
  const flags = {};
  let sample = null;

  for(const [key, arr] of Object.entries(journalLists)){
    if(key === 'removed') continue;
    flags[key] = false;
    for(const j of arr){
      const title = j.title || j['journal title'] || j['journal'] || j.name || '';
      const issn = (j.issn || j['issn'] || '').replace('-','').toLowerCase();
      if(issnQuery && issn === issnQuery){ flags[key] = true; sample = j; break; }
      if(title && normalizeTitle(title) === qNorm){ flags[key] = true; sample = j; break; }
    }
  }
  return { flags, sample };
}

function checkRemovedList(query){
  const qNorm = normalizeTitle(query);
  return journalLists.removed.find(j => normalizeTitle(j.title || j['journal title'] || j['journal'] || '') === qNorm);
}

/* ===================== BUILD REPORT ===================== */
function buildReportText(query, offlineHit, removedHit){
  const f = offlineHit.flags || {};
  const hit = offlineHit.sample || { title: query };

  let recText = '⚠️ Not found in major lists. Verify with librarian.';
  let recClass = 'not-recommended';
  if(f.dhet || f.scopus || f.wos){ recText = '✅ Recommended: Appears in major credible indexes'; recClass = 'recommended'; }
  else if(f.doaj || f.ibss || f.scielo){ recText = '⚠️ Verify manually: Appears in minor indexes'; recClass = 'verify'; }
  if(removedHit){ recText = '❌ Not recommended: Appears on removed list'; recClass = 'not-recommended'; }

  let trans = transformativeList.filter(t => {
    const tTitle = t.journal || t.title || t['journal title'] || '';
    return normalizeTitle(tTitle) === normalizeTitle(hit.title || '');
  });

  let transText = 'Transformative: No';
  if(trans.length){
    const t = trans[0];
    transText = `Transformative: Yes\nPublisher: ${t.publisher || t.journal || ''}\nDuration: ${t.duration || ''}\nLink: ${t.link || ''}`;
  }

  const indexedIn = Object.keys(f).filter(k => f[k]).join(', ') || 'None';

  const parts = [
    `Search: ${query}`,
    `Journal: ${hit.title || query}`,
    `ISSN: ${hit.issn || hit['issn'] || 'N/A'}`,
    `Publisher: ${hit.publisher || hit['publisher'] || 'Unknown'}`,
    `Indexed in: ${indexedIn}`,
    '',
    '=== Transformative Agreement ===',
    transText,
    '',
    '=== Recommendation ===',
    recText
  ];

  return { text: parts.join('\n'), recClass, recText, meta: { query, hit, flags: f, transformed: trans } };
}

/* ===================== CROSSREF LIVE LOOKUP ===================== */
async function fetchCrossRefInfo(issn) {
  if(!issn) {
    realtimeInfo.textContent = 'No ISSN to query CrossRef';
    return;
  }
  realtimeInfo.textContent = 'Fetching license info...';
  try {
    const resp = await fetch(`https://api.crossref.org/journals/${issn}`);
    const data = await resp.json();
    if(data.status === 'ok' && data.message) {
      const journal = data.message;
      if(journal.license && journal.license.length) {
        const lic = journal.license[0];
        realtimeInfo.innerHTML = `License: <a href="${lic.URL}" target="_blank">${lic['content-version']}</a>`;
      } else {
        realtimeInfo.textContent = 'No license info found';
      }
    } else {
      realtimeInfo.textContent = 'No CrossRef data';
    }
  } catch(e) {
    realtimeInfo.textContent = 'Error fetching CrossRef data';
    console.error(e);
  }
}

/* ===================== UI RENDER ===================== */
function showReport(text, recClass, recText, meta){
  journalReport.textContent = text;
  journalReport.style.display = 'block';

  const hit = meta?.hit || {};
  infoTitle.textContent = hit.title || meta?.query || '—';
  infoIssn.textContent = hit.issn || hit['issn'] || '—';
  infoPublisher.textContent = hit.publisher || hit['publisher'] || '—';
  const indexes = Object.keys(meta?.flags || {}).filter(k => meta.flags[k]).map(k => k.toUpperCase()).join(', ') || 'None';
  infoIndexes.textContent = indexes;

  const f = meta.flags || {};
  sDHET.className = `pill ${f.dhet ? 'ok' : 'nope'}`; sDHET.textContent = f.dhet ? 'Found' : 'No';
  sScopus.className = `pill ${f.scopus ? 'ok' : 'nope'}`; sScopus.textContent = f.scopus ? 'Found' : 'No';
  sWos.className = `pill ${f.wos ? 'ok' : 'nope'}`; sWos.textContent = f.wos ? 'Found' : 'No';
  sDoaj.className = `pill ${f.doaj ? 'ok' : 'nope'}`; sDoaj.textContent = f.doaj ? 'Found' : 'No';
  sIbss.className = `pill ${f.ibss ? 'ok' : 'nope'}`; sIbss.textContent = f.ibss ? 'Found' : 'No';
  sScielo.className = `pill ${f.scielo ? 'ok' : 'nope'}`; sScielo.textContent = f.scielo ? 'Found' : 'No';

  infoBadge.className = 'badge ' + (recClass === 'recommended' ? 'good' : (recClass==='verify' ? 'warn' : 'bad'));
  infoBadge.textContent = recClass === 'recommended' ? 'Verified' : (recClass === 'verify' ? 'Check' : 'Not recommended');

  recommendationBadge.className = 'badge ' + (recClass === 'recommended' ? 'good' : (recClass==='verify' ? 'warn' : 'bad'));
  recommendationBadge.textContent = recText;

  if(meta.transformed && meta.transformed.length){
    const t = meta.transformed[0];
    transformativeInfo.innerHTML = `<div><strong>${t.title || t.journal || ''}</strong></div>
      <div>Publisher: ${t.publisher || ''}</div>
      <div>Duration: ${t.duration || ''}</div>
      <div><a href="${t.link || '#'}" target="_blank" rel="noopener">View agreement</a></div>`;
  } else {
    transformativeInfo.textContent = 'No transformative agreement found';
  }

  summaryBody.scrollIntoView({ behavior: 'smooth' });
}

/* ===================== RUN CHECK ===================== */
function runCheck(){
  const query = journalQuery.value.trim();
  if(!query) return showError('Please enter a journal title or ISSN');

  const offlineHit = findOffline(query);
  const removedHit = checkRemovedList(query);
  const report = buildReportText(query, offlineHit, removedHit);
  showReport(report.text, report.recClass, report.recText, report.meta);

  // Live CrossRef lookup
  const issn = offlineHit.sample?.issn || offlineHit.sample?.ISSN || '';
  fetchCrossRefInfo(issn);
}

/* ===================== BUTTON HANDLERS ===================== */
checkBtn.addEventListener('click', runCheck);
journalQuery.addEventListener('keypress', e => { if(e.key === 'Enter') runCheck(); });

copyReportBtn.addEventListener('click', ()=>{
  navigator.clipboard.writeText(journalReport.textContent || '').then(()=> showError('Report copied to clipboard'));
});

downloadReportBtn.addEventListener('click', ()=>{
  const blob = new Blob([journalReport.textContent || ''], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'journal-report.txt'; a.click();
  URL.revokeObjectURL(url);
});

exportJsonBtn.addEventListener('click', ()=>{
  const payload = { exportedAt: new Date().toISOString(), report: journalReport.textContent || '' };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'journal-report.json'; a.click(); 
  URL.revokeObjectURL(url);
});

/* ===================== REMOVED MODAL ===================== */
showRemovedBtn.addEventListener('click', ()=>{
  removedTableBody.innerHTML = '';
  if(journalLists.removed.length === 0){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4">No removed journals loaded.</td>';
    removedTableBody.appendChild(tr);
  } else {
    journalLists.removed.forEach(j => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${j.title || j['journal title'] || ''}</td>
                      <td>${j.issn || j['issn'] || ''}</td>
                      <td>${j.year_removed || j.year || ''}</td>
                      <td>${j.last_review || j['date of last review'] || ''}</td>`;
      removedTableBody.appendChild(tr);
    });
  }
  removedModal.setAttribute('aria-hidden','false');
  removedModal.style.display = 'flex';
});

closeRemoved.addEventListener('click', ()=>{ removedModal.setAttribute('aria-hidden','true'); removedModal.style.display='none'; });
window.addEventListener('click', e=>{ if(e.target === removedModal) removedModal.style.display='none'; });

copyRemovedBtn.addEventListener('click', ()=>{
  let text = journalLists.removed.map(j => `${j.title || j['journal title'] || ''}\t${j.issn || j['issn'] || ''}\t${j.year_removed || j.year || ''}\t${j.last_review || j['date of last review'] || ''}`).join('\n');
  navigator.clipboard.writeText(text).then(()=> showError('Removed journals copied'));
});
