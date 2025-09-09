/* ===================== CONFIG ===================== */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
const FILENAMES = {
  dhet:'DHET_2025.csv', dhet2:'DHET_2_2025.csv', doaj:'DOAJ_2025.csv', ibss:'IBSS_2025.csv', norwegian:'NORWEGIAN_2025.csv', scielo:'SCIELO SA_2025.csv', scopus:'SCOPUS_2025.csv', wos:'WOS_2025.csv', removed:'JOURNALS REMOVED IN PAST YEARS.csv'
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

/* DOM */
const $ = id => document.getElementById(id);
const journalQuery = $('journal-query');
const checkBtn = $('check-btn');
const autocompleteResults = $('autocomplete-results');
const journalReport = $('report-section');
const loadingMessage = $('loading-message');
const errorMessage = $('error-message');
const infoTitle=$('info-title'); const infoIssn=$('info-issn'); const infoPublisher=$('info-publisher'); const infoIndexes=$('info-indexes');
const sDHET=$('s-dhet'); const sScopus=$('s-scopus'); const sWos=$('s-wos'); const sDoaj=$('s-doaj'); const sIbss=$('s-ibss'); const sScielo=$('s-scielo');
const transformativeInfo=$('transformative-info'); const crossrefInfo=$('crossref-info'); const pubmedInfo=$('pubmed-info'); const recommendationBadge=$('status-badge');

const copyReportBtn=$('copy-report-btn');
const downloadReportBtn=$('download-report-btn');
const exportJsonBtn=$('export-json');
const showRemovedBtn=$('show-removed-btn');
const removedModal=$('removed-modal');
const closeRemoved=$('close-removed');
const removedTableBody=$('removed-table').querySelector('tbody');
let journalLists={}, removedJournals=[], transformativeList=[];

/* ===================== FETCH CSV ===================== */
async function fetchCSV(fname){
  const res = await fetch(RAW_BASE + encodeURIComponent(fname));
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const delim = (lines[0].includes('|') && lines[0].split('|').length>1)? '|' : ',';
  const headers = lines[0].split(delim).map(h=>h.trim());
  return lines.slice(1).map(l=>{
    const cols = l.split(delim).map(c=>c.trim());
    let obj={};
    headers.forEach((h,i)=>obj[h]=cols[i]||'');
    return obj;
  });
}

/* ===================== INIT ===================== */
async function init(){
  loadingMessage.style.display='block';
  try{
    for(const key in FILENAMES){
      if(key==='removed'){ removedJournals=await fetchCSV(FILENAMES[key]); continue;}
      journalLists[key]=await fetchCSV(FILENAMES[key]);
    }
    for(const t of TRANSFORMATIVE_FILES){
      const data = await fetchCSV(t.file);
      data.forEach(d=>d.link=t.link);
      transformativeList.push(...data);
    }
  }catch(e){ showError('Error loading journal lists'); console.error(e);}
  loadingMessage.style.display='none';
}
init();

/* ===================== AUTOCOMPLETE ===================== */
function normalizeTitle(t){return (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').trim();}
journalQuery.addEventListener('input',()=>{
  const val=normalizeTitle(journalQuery.value);
  autocompleteResults.innerHTML=''; if(!val) return autocompleteResults.style.display='none';
  let suggestions=[];
  Object.values(journalLists).forEach(list=>list.forEach(j=>{
    if(normalizeTitle(j['Journal Title']||j['Journal title']||j['Title']||'').includes(val)) suggestions.push(j);
  }));
  suggestions=suggestions.slice(0,8);
  suggestions.forEach(j=>{
    const item=document.createElement('div'); item.className='autocomplete-item';
    item.textContent=j['Journal Title']||j['Journal title']||j['Title'];
    item.addEventListener('click',()=>{journalQuery.value=item.textContent; autocompleteResults.style.display='none'; runCheck();});
    autocompleteResults.appendChild(item);
  });
  autocompleteResults.style.display=suggestions.length?'block':'none';
});
document.addEventListener('click', e=>{if(!autocompleteResults.contains(e.target) && e.target!==journalQuery) autocompleteResults.style.display='none';});

/* ===================== FETCH CROSSREF ===================== */
async function fetchCrossRef(issn){
  crossrefInfo.textContent='Fetching...';
  try{
    const resp=await fetch(`https://api.crossref.org/journals/${issn}`);
    const data=await resp.json();
    if(data.status==='ok' && data.message){
      const lic = data.message.license?.[0];
      crossrefInfo.innerHTML=lic?`<a href="${lic.URL}" target="_blank">${lic['content-version']}</a>`:'No license found';
    }else crossrefInfo.textContent='No CrossRef data';
  }catch(e){ crossrefInfo.textContent='Error fetching CrossRef'; console.error(e);}
}

/* ===================== FETCH PUBMED ===================== */
async function fetchPubMed(title){
  pubmedInfo.textContent='Fetching...';
  try{
    const resp=await fetch(`https://api.openalex.org/journals?filter=display_name.search:${encodeURIComponent(title)}`);
    const data=await resp.json();
    if(data.meta && data.meta.count!=null) pubmedInfo.textContent=data.meta.count;
    else pubmedInfo.textContent='No articles found';
  }catch(e){ pubmedInfo.textContent='Error fetching PubMed'; console.error(e);}
}

/* ===================== RUN CHECK ===================== */
function findOffline(query){
  const qNorm=normalizeTitle(query);
  const flags={};
  let sample=null;
  for(const [key, arr] of Object.entries(journalLists)){
    if(key==='removed') continue;
    flags[key]=false;
    for(const j of arr){
      const title=j['Journal Title']||j['Journal title']||j['Title']||'';
      const issn=j['ISSN']||j['issn']||'';
      if(normalizeTitle(title)===qNorm || issn.replace('-','')===query.replace('-','')) { flags[key]=true; sample=j; break; }
    }
  }
  return {flags, sample};
}
function checkRemovedList(query){return removedJournals.find(j=>normalizeTitle(j['Journal Title']||j['Journal title']||'')===normalizeTitle(query));}

async function runCheck(){
  const query=journalQuery.value.trim(); if(!query){alert('Enter journal'); return;}
  const offline=findOffline(query); const removedHit=checkRemovedList(query);
  if(!offline.sample){alert('Journal not found'); return;}
  journalReport.style.display='block';
  infoTitle.textContent=offline.sample['Journal Title']||offline.sample['Journal title']||'—';
  infoIssn.textContent=offline.sample['ISSN']||offline.sample['ISSN']||'—';
  infoPublisher.textContent=offline.sample['Publisher']||'—';
  const indexedIn=Object.keys(offline.flags).filter(k=>offline.flags[k]).join(', ')||'None';
  infoIndexes.textContent=indexedIn;

  // Transformative
  const t=transformativeList.find(t=>normalizeTitle(t['Journal Title']||t['Journal title']||'')===normalizeTitle(infoTitle.textContent));
  if(t) transformativeInfo.innerHTML=`Yes<br><a href="${t.link}" target="_blank">View Agreement</a>`;
  else transformativeInfo.textContent='No';

  // CrossRef
  const issn=offline.sample['ISSN']||offline.sample['eISSN']||'';
  if(issn) await fetchCrossRef(issn);

  // PubMed
  await fetchPubMed(infoTitle.textContent);

  // Status
  let rec='⚠️ Verify'; if(offline.flags.dhet||offline.flags.scopus||offline.flags.wos) rec='✅ Recommended'; if(removedHit) rec='❌ Removed';
  recommendationBadge.textContent=rec;
}

/* ===================== BUTTONS ===================== */
checkBtn.addEventListener('click', runCheck);
journalQuery.addEventListener('keypress', e=>{if(e.key==='Enter') runCheck();});
copyReportBtn.addEventListener('click', ()=>navigator.clipboard.writeText(infoTitle.textContent+'\n'+infoIssn.textContent).then(()=>alert('Report copied')));
downloadReportBtn.addEventListener('click', ()=>{
  const blob=new Blob([infoTitle.textContent+'\n'+infoIssn.textContent], {type:'text/plain'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='journal-report.txt'; a.click(); URL.revokeObjectURL(url);
});
exportJsonBtn.addEventListener('click', ()=>{
  const payload={ exportedAt: new Date().toISOString(), journal: infoTitle.textContent, issn: infoIssn.textContent};
  const blob=new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='journal-report.json'; a.click(); URL.revokeObjectURL(url);
});

/* Removed Journals Modal */
showRemovedBtn.addEventListener('click', ()=>{
  removedTableBody.innerHTML='';
  removedJournals.forEach(j=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${j['Journal Title']||j['Journal title']||''}</td><td>${j['ISSN']||j['issn']||''}</td><td>${j['Year Removed']||j['year_removed']||''}</td><td>${j['Last Review']||j['date_of_last_review']||''}</td>`;
    removedTableBody.appendChild(tr);
  });
  removedModal.style.display='flex'; removedModal.setAttribute('aria-hidden','false');
});
closeRemoved.addEventListener('click', ()=>{removedModal.style.display='none'; removedModal.setAttribute('aria-hidden','true');});
window.addEventListener('click', e=>{if(e.target===removedModal){removedModal.style.display='none'; removedModal.setAttribute('aria-hidden','true');}});
$('copy-removed-btn').addEventListener('click', ()=>navigator.clipboard.writeText(Array.from(removedTableBody.querySelectorAll('tr')).map(tr=>tr.innerText).join('\n')).then(()=>alert('Removed journals copied')));
