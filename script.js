/* ================= CONFIG ================= */
const RAW_BASE='https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
const FILENAMES={dhet:'DHET_2025.csv',dhet2:'DHET_2_2025.csv',doaj:'DOAJ_2025.csv',ibss:'IBSS_2025.csv',norwegian:'NORWEGIAN_2025.csv',scielo:'SCIELO SA_2025.csv',scopus:'SCOPUS_2025.csv',wos:'WOS_2025.csv',removed:'JOURNALS REMOVED IN PAST YEARS.csv'};
const TRANSFORMATIVE_FILES=[
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

/* ================= DOM ================= */
const $ = id => document.getElementById(id);
const journalQuery=$('journal-query'),checkBtn=$('check-btn'),autocompleteResults=$('autocomplete-results');
const journalReport=$('journal-report'),loadingMessage=$('loading-message'),errorMessage=$('error-message');
const infoTitle=$('info-title'),infoIssn=$('info-issn'),infoPublisher=$('info-publisher'),infoIndexes=$('info-indexes');
const transformativeInfo=$('transformative-info'),crossRefInfo=$('crossref-info'),pubMedInfo=$('pubmed-info'),statusBadge=$('status-badge');
const copyReportBtn=$('copy-report-btn'),downloadReportBtn=$('download-report-btn'),exportJsonBtn=$('export-json');
const showRemovedBtn=$('show-removed-btn'),removedModal=$('removed-modal'),closeRemoved=$('close-removed'),removedTableBody=$('removed-table').querySelector('tbody');
let journalLists={},transformativeList=[],removedJournals=[];

/* ================== UTILITIES ================== */
function normalizeTitle(t){return(t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();}
function showError(msg){errorMessage.textContent=msg; errorMessage.style.display='block'; setTimeout(()=>errorMessage.style.display='none',7000);}
function showLoading(msg){loadingMessage.textContent=msg; loadingMessage.style.display='block';}
function hideLoading(){loadingMessage.style.display='none';}
function rawUrlFor(fname){return RAW_BASE+encodeURIComponent(fname);}
function parseCSV(txt){
  const lines=txt.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length<1) return [];
  const delim=(lines[0].includes('|') && lines[0].split('|').length>1)?'|':',';
  const headers=lines[0].split(delim).map(h=>h.trim());
  return lines.slice(1).map(l=>{
    const parts=l.split(delim).map(p=>p.trim());
    const row={}; headers.forEach((h,i)=>row[h]=parts[i]||''); return row;
  });
}

/* ================== LOAD CSV ================== */
async function loadAllLists(){
  showLoading('Loading journal lists...');
  for(const [key,fname] of Object.entries(FILENAMES)){
    try{
      const res=await fetch(rawUrlFor(fname));
      if(!res.ok) throw new Error(res.statusText);
      const txt=await res.text();
      journalLists[key]=parseCSV(txt);
    }catch(e){journalLists[key]=[]; showError(`Could not load ${fname}`);}
  }
  transformativeList=[];
  for(const t of TRANSFORMATIVE_FILES){
    try{
      const res=await fetch(rawUrlFor(t.file));
      if(!res.ok) throw new Error(res.statusText);
      const rows=parseCSV(await res.text());
      rows.forEach(r=>transformativeList.push({...r,link:t.link}));
    }catch(e){console.warn('Failed transformative',t.file);}
  }
  hideLoading();
}
loadAllLists();

/* ================== AUTOCOMPLETE ================== */
journalQuery.addEventListener('input',function(){
  const q=normalizeTitle(this.value),suggestions=new Set();
  autocompleteResults.innerHTML=''; autocompleteResults.style.display='none';
  if(q.length<2) return;
  for(const arr of Object.values(journalLists)){
    for(const j of arr){
      const title=j['Journal Title']||j['Journal title']||j['Title']||'';
      if(!title) continue; if(normalizeTitle(title).includes(q)) suggestions.add(title);
      if(suggestions.size>=8) break;
    } if(suggestions.size>=8) break;
  }
  if(suggestions.size){
    suggestions.forEach(t=>{
      const div=document.createElement('div'); div.className='autocomplete-item'; div.textContent=t;
      div.addEventListener('click',()=>{journalQuery.value=t; autocompleteResults.style.display='none'; runCheck();});
      autocompleteResults.appendChild(div);
    });
    autocompleteResults.style.display='block';
  }
});
document.addEventListener('click',e=>{if(!autocompleteResults.contains(e.target)&&e.target!==journalQuery) autocompleteResults.style.display='none';});

/* ================== SEARCH ================== */
function findOffline(query){
  const qNorm=normalizeTitle(query); let sample=null,flags={};
  for(const [key,arr] of Object.entries(journalLists)){
    if(key==='removed') continue; flags[key]=false;
    for(const j of arr){
      const title=j['Journal Title']||j['Journal title']||j['Title']||'';
      const issn=(j.ISSN||j.ISSN||'').replace('-','').toLowerCase();
      if(normalizeTitle(title)===qNorm||issn.replace('-','')===query.replace('-','').toLowerCase()){flags[key]=true; sample=j; break;}
    }
  } return {flags,sample};
}
function checkRemoved(query){const q=normalizeTitle(query); return journalLists.removed.find(j=>normalizeTitle(j['Journal Title']||j['Journal title']||'')===q);}

/* ================== FETCH CrossRef ================== */
async function fetchCrossRef(issn,eissn,title){
  crossRefInfo.textContent='Fetching...';
  let url=''; if(issn) url=`https://api.crossref.org/journals/${issn}`; else if(eissn) url=`https://api.crossref.org/journals/${eissn}`; else return crossRefInfo.textContent='No ISSN to query';
  try{
    const res=await fetch(url); const data=await res.json();
    if(data.status==='ok'){const journal=data.message; if(journal.license&&journal.license.length){const lic=journal.license[0]; crossRefInfo.innerHTML=`<a href="${lic.URL}" target="_blank">${lic['content-version']}</a>`;} else crossRefInfo.textContent='No license info';}
    else crossRefInfo.textContent='No CrossRef data';
  }catch(e){crossRefInfo.textContent='Error fetching CrossRef';}
}

/* ================== FETCH PubMed ================== */
async function fetchPubMed(title){
  pubMedInfo.textContent='Fetching...';
  if(!title) return pubMedInfo.textContent='No title';
  try{
    const url=`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}[Journal]&retmode=json`;
    const res=await fetch(url); const data=await res.json();
    pubMedInfo.textContent=`${data.esearchresult.count} articles`;
  }catch(e){pubMedInfo.textContent='Error fetching PubMed';}
}

/* ================== BUILD REPORT ================== */
async function runCheck(){
  const query=journalQuery.value.trim();
  if(!query) return showError('Enter a journal title or ISSN');
  const offline=findOffline(query),removed=checkRemoved(query);
  const hit=offline.sample||{ 'Journal Title':query, ISSN:'—', Publisher:'—' };
  infoTitle.textContent=hit['Journal Title']||hit['Journal title']||'—';
  infoIssn.textContent=hit.ISSN||hit.ISSN||'—';
  infoPublisher.textContent=hit.Publisher||hit.Publisher||'—';
  infoIndexes.textContent=Object.keys(offline.flags).filter(k=>offline.flags[k]).map(k=>k.toUpperCase()).join(', ')||'None';

  /* Transformative */
  const tMatch=transformativeList.find(t=>normalizeTitle(t['Journal Title']||t.title||'')===normalizeTitle(hit['Journal Title']||hit.title||''));
  if(tMatch) transformativeInfo.innerHTML=`<div>${tMatch['Journal Title']||tMatch.title}</div><div>Publisher: ${tMatch.Publisher||''}</div><div>Duration: ${tMatch['Agreement Duration']||tMatch.Duration||''}</div><div><a href="${tMatch.link}" target="_blank">View agreement</a></div>`; 
  else transformativeInfo.textContent='No transformative agreement';

  /* CrossRef */
  await fetchCrossRef(hit.ISSN||hit.ISSN,'',hit['Journal Title']||hit.title||'');

  /* PubMed */
  await fetchPubMed(hit['Journal Title']||hit.title||'');

  /* Status Badge */
  let rec='⚠️ Not recommended'; let cls='bad';
  if(offline.flags.dhet||offline.flags.scopus||offline.flags.wos){rec='✅ Recommended'; cls='good';}
  else if(offline.flags.doaj||offline.flags.ibss||offline.flags.scielo||offline.flags.norwegian){rec='⚠️ Check'; cls='warn';}
  statusBadge.textContent=rec; statusBadge.className='badge '+cls;

  journalReport.style.display='table';
}

/* ================== BUTTONS ================== */
copyReportBtn.addEventListener('click',()=>{navigator.clipboard.writeText(generateReportText()); alert('Report copied');});
downloadReportBtn.addEventListener('click',()=>{downloadReport(generateReportText(),'report.txt');});
exportJsonBtn.addEventListener('click',()=>{downloadReport(JSON.stringify(generateReportJSON(),null,2),'report.json');});

function generateReportText(){
  return `Journal Title: ${infoTitle.textContent}
ISSN / eISSN: ${infoIssn.textContent}
Publisher: ${infoPublisher.textContent}
Indexed In: ${infoIndexes.textContent}
Transformative Agreement: ${transformativeInfo.textContent}
CrossRef License: ${crossRefInfo.textContent}
PubMed Articles: ${pubMedInfo.textContent}
Status: ${statusBadge.textContent}`;
}
function generateReportJSON(){
  return {title:infoTitle.textContent,issn:infoIssn.textContent,publisher:infoPublisher.textContent,indexedIn:infoIndexes.textContent,transformative:transformativeInfo.textContent,crossRef:crossRefInfo.textContent,pubmed:pubMedInfo.textContent,status:statusBadge.textContent};
}
function downloadReport(text,filename){const blob=new Blob([text],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();}

/* ================== REMOVED MODAL ================== */
showRemovedBtn.addEventListener('click',()=>{
  removedTableBody.innerHTML='';
  let sorted=journalLists.removed.sort((a,b)=>b['Year Removed']-a['Year Removed']);
  for(const j of sorted){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${j['Journal Title']||j['Journal title']||''}</td>
                    <td>${j.ISSN||''}</td>
                    <td><b>${j['Year Removed']||''}</b></td>
                    <td>${j['Date of last review']||j['Last Review']||''}</td>`;
    removedTableBody.appendChild(tr);
  }
  removedModal.setAttribute('aria-hidden','false');
});
closeRemoved.addEventListener('click',()=>removedModal.setAttribute('aria-hidden','true'));
window.addEventListener('click',e=>{if(e.target===removedModal) removedModal.setAttribute('aria-hidden','true');});
