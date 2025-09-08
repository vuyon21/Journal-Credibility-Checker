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
const recommendation = $('recommendation');
const removedModal = $('removed-modal');
const closeRemoved = $('close-removed');
const removedTableBody = $('removed-table').querySelector('tbody');

let journalLists = { dhet:[], doaj:[], ibss:[], norwegian:[], other:[], scielo:[], scopus:[], wos:[], removed:[] };
let transformativeList = [];

/* ===================== UTILITIES ===================== */
function showLoading(msg){ loadingMessage.textContent=msg; loadingMessage.style.display='block'; }
function hideLoading(){ loadingMessage.style.display='none'; }
function showError(msg){ errorMessage.textContent=msg; errorMessage.style.display='block'; setTimeout(()=>errorMessage.style.display='none',7000); }
function normalizeTitle(t){ return (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim(); }
function isISSN(s){ return /\b\d{4}-?\d{3}[\dXx]\b/.test(s); }
function rawUrlFor(fname){ return RAW_BASE + encodeURIComponent(fname); }

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(Boolean);
  if(lines.length < 2) return [];
  // detect delimiter
  const delimiter = (lines[0].split('|').length > lines[0].split(',').length) ? '|' : ',';
  const headers = lines[0].split(delimiter).map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const parts = line.split(delimiter).map(p=>p.trim());
    let obj = {};
    headers.forEach((h,i)=>{ obj[h.toLowerCase()] = parts[i] || ''; });
    return obj;
  });
}

/* ===================== LOAD LISTS ===================== */
async function loadAllLists(){
  showLoading('Loading journal lists...');
  for(const [key,fname] of Object.entries(FILENAMES)){
    try{
      const res = await fetch(rawUrlFor(fname));
      const text = await res.text();
      journalLists[key] = parseCSV(text);
    }catch(e){ console.warn('Failed loading',fname,e); journalLists[key]=[]; }
  }
  transformativeList = [];
  for(const t of TRANSFORMATIVE_FILES){
    try{
      const res = await fetch(rawUrlFor(t.file));
      const text = await res.text();
      const rows = parseCSV(text);
      rows.forEach(r=>{
        transformativeList.push({...r, link:t.link});
      });
    }catch(e){ console.warn('Failed loading transformative file',t.file,e); }
  }
  hideLoading();
}
loadAllLists();

/* ===================== AUTOCOMPLETE ===================== */
journalQuery.addEventListener('input', function(){
  const q = normalizeTitle(this.value||'');
  autocompleteResults.innerHTML=''; autocompleteResults.style.display='none';
  if(q.length<2) return;
  const suggestions=[];
  for(const list of Object.values(journalLists)){
    for(const j of list){
      if(normalizeTitle(j.title||'').includes(q) && !suggestions.includes(j.title)){
        suggestions.push(j.title);
        if(suggestions.length>=8) break;
      }
    }
    if(suggestions.length>=8) break;
  }
  if(suggestions.length){
    for(const t of suggestions){
      const div=document.createElement('div');
      div.className='autocomplete-item'; div.textContent=t;
      div.addEventListener('click',()=>{ journalQuery.value=t; autocompleteResults.style.display='none'; runCheck(); });
      autocompleteResults.appendChild(div);
    }
    autocompleteResults.style.display='block';
  }
});
document.addEventListener('click',e=>{ if(!autocompleteResults.contains(e.target)&&e.target!==journalQuery) autocompleteResults.style.display='none'; });

/* ===================== SEARCH ===================== */
function findOffline(query){
  const qNorm=normalizeTitle(query);
  const issnQuery=isISSN(query)?query.replace('-','').toLowerCase():null;
  let flags={}, sample=null;
  for(const [key,arr] of Object.entries(journalLists)){
    if(key==='removed') continue;
    flags[key]=false;
    for(const j of arr){
      if(issnQuery && (j.issn||'').replace('-','').toLowerCase()===issnQuery){ flags[key]=true; sample=j; break; }
      if(normalizeTitle(j.title||'')===qNorm){ flags[key]=true; sample=j; break; }
    }
  }
  return {flags,sample};
}
function checkRemovedList(query){
  const qNorm=normalizeTitle(query);
  return journalLists.removed.find(j=>normalizeTitle(j.title||'')===qNorm);
}

/* ===================== BUILD REPORT ===================== */
function buildReportText(query,offlineHit,removedHit){
  const f=offlineHit.flags||{}, hit=offlineHit.sample||{title:query};
  let recText='⚠️ Not found in major lists. Verify with librarian.';
  let recClass='not-recommended';
  if(f.dhet||f.scopus||f.wos){ recText='✅ Recommended: Appears in major credible indexes'; recClass='recommended'; }
  else if(f.doaj||f.ibss||f.scielo){ recText='⚠️ Verify manually: Appears in minor indexes'; recClass='verify'; }
  if(removedHit){ recText='❌ Not recommended: Appears on removed list'; recClass='not-recommended'; }
  
  // Transformative
  let trans = transformativeList.filter(t=>normalizeTitle(t.journal||t.title)===normalizeTitle(hit.title));
  let transText = 'Transformative: No';
  if(trans.length){
    const t=trans[0];
    transText=`Transformative: Yes (${t.publisher||t.journal})\nDuration: ${t.duration||''}\n🔗 View Agreement: ${t.link}`;
  }

  const parts=[
`🔍 Search: ${query}`,
`📘 Journal: ${hit.title||'N/A'}`,
`📋 ISSN: ${hit.issn||'N/A'}`,
`🏢 Publisher: ${hit.publisher||'Unknown'}`,
`💡 ${transText}`,
``,
`=== LOCAL ACCREDITATION LISTS ===`,
`DHET:     ${f.dhet?'✅ Found':'❌ Not found'}`,
`DOAJ:     ${f.doaj?'✅ Found':'❌ Not found'}`,
`IBSS:     ${f.ibss?'✅ Found':'❌ Not found'}`,
`Norwegian:${f.norwegian?'✅ Found':'❌ Not found'}`,
`Other:    ${f.other?'✅ Found':'❌ Not found'}`,
`SciELO:   ${f.scielo?'✅ Found':'❌ Not found'}`,
`Scopus:   ${f.scopus?'✅ Found':'❌ Not found'}`,
`WOS:      ${f.wos?'✅ Found':'❌ Not found'}`,
``,
`=== RECOMMENDATION ===`,
`${recText}`
  ];
  return {text:parts.join('\n'),recClass,recText};
}
function showReport(text,recClass,recText){
  journalReport.textContent=text; journalReport.style.display='block';
  recommendation.textContent=recText; recommendation.className='recommendation '+recClass; recommendation
