/* ================== CONFIG ================== */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
const FILENAMES = {
  dhet: 'DHET_2_2025.csv',
  dhet2: 'DHET_2025.csv',
  doaj: 'DOAJ_2025.csv',
  ibss: 'IBSS_2025.csv',
  norwegian: 'NORWEGIAN_2025.csv',
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

/* ================== DOM ================== */
const $ = id => document.getElementById(id);
const journalQuery = $('journal-query');
const checkBtn = $('check-btn');
const autocompleteResults = $('autocomplete-results');
const journalReportSection = $('report-section');
const infoTitle = $('info-title');
const infoIssn = $('info-issn');
const infoPublisher = $('info-publisher');
const infoIndexes = $('info-indexes');
const transformativeInfo = $('transformative-info');
const crossrefInfo = $('crossref-info');
const pubmedInfo = $('pubmed-info');
const statusBadge = $('status-badge');
const loadingMessage = $('loading-message');
const errorMessage = $('error-message');
const removedModal = $('removed-modal');
const closeRemoved = $('close-removed');
const removedTableBody = $('removed-table').querySelector('tbody');
const copyReportBtn = $('copy-report-btn');
const downloadReportBtn = $('download-report-btn');
const exportJsonBtn = $('export-json');
const showRemovedBtn = $('show-removed-btn');
const copyRemovedBtn = $('copy-removed-btn');

let journalLists = {};
let transformativeList = [];
let removedJournals = [];

/* ================== UTILS ================== */
function showLoading(msg){loadingMessage.textContent=msg;loadingMessage.style.display='block';}
function hideLoading(){loadingMessage.style.display='none';}
function showError(msg){errorMessage.textContent=msg;errorMessage.style.display='block';setTimeout(()=>errorMessage.style.display='none',7000);}
function normalizeTitle(t){return (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();}
function isISSN(s){return /\b\d{4}-?\d{3}[\dXx]\b/.test(s);}
function rawUrlFor(fname){return RAW_BASE + encodeURIComponent(fname);}
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length<1) return [];
  const delim = (lines[0].includes('|') && lines[0].split('|').length>1)?'|':',';
  const headers = lines[0].split(delim).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line=>{
    const parts=line.split(delim).map(p=>p.trim());
    const row={};
    headers.forEach((h,i)=>row[h]=parts[i]||'');
    return row;
  });
}

/* ================== LOAD CSV FILES ================== */
async function loadAllLists(){
  showLoading('Loading journal lists…');
  for(const [key,fname] of Object.entries(FILENAMES)){
    try{
      const res = await fetch(rawUrlFor(fname));
      const txt = await res.text();
      journalLists[key] = parseCSV(txt);
      if(key==='removed') removedJournals = journalLists[key];
    }catch(e){showError(`Could not load ${fname}`);}
  }
  // Transformative
  for(const t of TRANSFORMATIVE_FILES){
    try{
      const res = await fetch(rawUrlFor(t.file));
      const txt = await res.text();
      parseCSV(txt).forEach(r=>transformativeList.push({...r, link:t.link}));
    }catch(e){console.warn('Failed loading transformative',t.file);}
  }
  hideLoading();
}
loadAllLists();

/* ================== AUTOCOMPLETE ================== */
journalQuery.addEventListener('input',()=>{
  const q=normalizeTitle(journalQuery.value);
  autocompleteResults.innerHTML=''; autocompleteResults.style.display='none';
  if(q.length<2) return;
  const suggestions=new Set();
  Object.values(journalLists).forEach(arr=>{
    arr.forEach(j=>{
      const title=j['journal title']||j['journal']||j.title||j.name||'';
      if(normalizeTitle(title).includes(q)) suggestions.add(title);
    });
  });
  if(suggestions.size){
    suggestions.forEach(t=>{
      const div=document.createElement('div');
      div.className='autocomplete-item'; div.textContent=t;
      div.addEventListener('click',()=>{journalQuery.value=t; autocompleteResults.style.display='none'; runCheck();});
      autocompleteResults.appendChild(div);
    });
    autocompleteResults.style.display='block';
  }
});

document.addEventListener('click', e=>{if(!autocompleteResults.contains(e.target) && e.target!==journalQuery) autocompleteResults.style.display='none';});

/* ================== SEARCH & REPORT ================== */
async function runCheck(){
  const query=journalQuery.value.trim();
  if(!query) return showError('Enter journal title or ISSN');
  journalReportSection.style.display='block';
  // Reset
  infoTitle.textContent='—'; infoIssn.textContent='—'; infoPublisher.textContent='—';
  infoIndexes.textContent='—'; transformativeInfo.textContent='—'; crossrefInfo.textContent='—';
  pubmedInfo.textContent='—'; statusBadge.textContent='—';

  const qNorm = normalizeTitle(query);
  let found=null;
  for(const key in journalLists){
    if(key==='removed') continue;
    found = journalLists[key].find(j=>normalizeTitle(j['journal title']||j['journal']||j.title||'')===qNorm || j.issn===query);
    if(found) break;
  }
  if(!found) return showError('Journal not found');

  infoTitle.textContent=found['journal title']||found.title||'—';
  infoIssn.textContent=(found.issn||found.eissn||'—');
  infoPublisher.textContent=found.publisher||'—';

  // Indexed in
  const indexes=[];
  if(journalLists.dhet.find(j=>j['journal title']===found['journal title'])) indexes.push('DHET');
  if(journalLists.scopus.find(j=>j['journal title']===found['journal title'])) indexes.push('Scopus');
  if(journalLists.wos.find(j=>j['journal title']===found['journal title'])) indexes.push('WOS');
  if(journalLists.doaj.find(j=>j['journal title']===found['journal title'])) indexes.push('DOAJ');
  if(journalLists.ibss.find(j=>j['journal title']===found['journal title'])) indexes.push('IBSS');
  if(journalLists.scielo.find(j=>j['journal title']===found['journal title'])) indexes.push('SciELO');
  infoIndexes.textContent=indexes.join(', ')||'None';

  // Transformative
  const trans=transformativeList.find(t=>normalizeTitle(t['journal title']||t.title||'')===qNorm);
  if(trans) transformativeInfo.innerHTML=`Yes (<a href="${trans.link}" target="_blank">View Agreement</a>)`; 
  else transformativeInfo.textContent='No';

  // CrossRef
  crossrefInfo.textContent='Fetching...';
  const issnQuery=found.issn||found.eissn||'';
  if(issnQuery){
    try{
      const res=await fetch(`https://api.crossref.org/journals/${issnQuery}`);
      const data=await res.json();
      if(data.status==='ok' && data.message){
        const lic=data.message['license']?.[0]?.['URL']||data.message['license']?.[0]?.['start']||'';
        crossrefInfo.innerHTML=lic?`<a href="${lic}" target="_blank">License</a>`:'License info not available';
      } else crossrefInfo.textContent='License info not found';
    } catch(e){crossrefInfo.textContent='Error fetching CrossRef';}
  }

  // PubMed
  pubmedInfo.textContent='Fetching...';
  try{
    const pubmedRes=await fetch(`https://api.ncbi.nlm.nih.gov/lit/ctxp/v1/journals/${issnQuery}`);
    const pubmedData=await pubmedRes.json();
    pubmedInfo.textContent=pubmedData.count || '0';
  }catch(e){pubmedInfo.textContent='Error fetching PubMed';}

  statusBadge.textContent='Checked';
}

/* ================== REMOVED MODAL ================== */
showRemovedBtn.addEventListener('click',()=>{
  removedTableBody.innerHTML='';
  const years = Array.from(new Set(removedJournals.map(r=>r['year removed'])));
  years.forEach(y=>{
    removedJournals.filter(r=>r['year removed']===y).forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${r['journal title']}</td><td>${r.issn}</td><td><b>${y}</b></td><td>${r['date of last review or accreditation']||''}</td>`;
      removedTableBody.appendChild(tr);
    });
  });
  removedModal.style.display='flex';
});
closeRemoved.addEventListener('click',()=>removedModal.style.display='none');
window.addEventListener('click',e=>{if(e.target===removedModal) removedModal.style.display='none';});
