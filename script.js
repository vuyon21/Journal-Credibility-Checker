/* ================= CONFIG ================= */
const RAW_BASE='https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
const FILENAMES={
  dhet:'DHET_2025.csv',
  dhet2:'DHET_2_2025.csv',
  doaj:'DOAJ_2025.csv',
  ibss:'IBSS_2025.csv',
  norwegian:'NORWEGIAN_2025.csv',
  other:'OTHER INDEXED JOURNALS_2025.csv',
  scielo:'SCIELO SA_2025.csv',
  scopus:'SCOPUS_2025.csv',
  wos:'WOS_2025.csv',
  removed:'JOURNALS REMOVED IN PAST YEARS.csv'
};

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

/* DOM */
const $=id=>document.getElementById(id);
const journalQuery=$('journal-query');
const checkBtn=$('check-btn');
const autocompleteResults=$('autocomplete-results');
const journalReport=$('journal-report');
const loadingMessage=$('loading-message');
const errorMessage=$('error-message');
const infoTitle=$('info-title');
const infoIssn=$('info-issn');
const infoPublisher=$('info-publisher');
const infoIndexes=$('info-indexes');
const sDHET=$('s-dhet'); const sScopus=$('s-scopus'); const sWos=$('s-wos'); const sDoaj=$('s-doaj'); const sIbss=$('s-ibss'); const sScielo=$('s-scielo');
const transformativeInfo=$('transformative-info'); const realtimeInfo=$('realtime-info'); const pubmedInfo=$('pubmed-info'); const recommendationBadge=$('status-badge');
const copyReportBtn=$('copy-report-btn'); const downloadReportBtn=$('download-report-btn'); const showRemovedBtn=$('show-removed-btn'); const copyRemovedBtn=$('copy-removed-btn');
const removedModal=$('removed-modal'); const closeRemoved=$('close-removed'); const removedTableBody=$('removed-table').querySelector('tbody');
const exportJsonBtn=$('export-json');

let journalLists={}; let removedJournals=[]; let transformativeList=[];

/* ================= UTILS ================= */
function normalizeTitle(t){return (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').trim();}
function showError(msg){errorMessage.textContent=msg; errorMessage.style.display='block'; setTimeout(()=>errorMessage.style.display='none',7000);}
function showLoading(msg){loadingMessage.textContent=msg; loadingMessage.style.display='block';}
function hideLoading(){loadingMessage.style.display='none';}
function isISSN(s){return /\b\d{4}-?\d{3}[\dXx]\b/.test(s);}
function rawUrlFor(fname){return RAW_BASE + encodeURIComponent(fname);}

function parseCSV(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(lines.length<1) return [];
  const delim=(lines[0].includes('|') && lines[0].split('|').length>1)?'|':',';
  const headers=lines[0].split(delim).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line=>{const parts=line.split(delim).map(p=>p.trim()); const row={}; headers.forEach((h,i)=>row[h]=parts[i]||''); return row; });
}

/* ================= LOAD CSVs ================= */
journalQuery.disabled=true;
async function loadAllLists(){
  showLoading('Loading journal lists…');
  for(const [key,fname] of Object.entries(FILENAMES)){
    try{
      const res=await fetch(rawUrlFor(fname));
      if(!res.ok) throw new Error(res.statusText);
      const txt=await res.text();
      journalLists[key]=parseCSV(txt);
      if(key==='removed') removedJournals=journalLists[key];
    }catch(e){
      journalLists[key]=[];
      console.warn('Failed loading', fname, e);
      showError(`Warning: Could not load ${fname}`);
    }
  }
  transformativeList=[];
  for(const t of TRANSFORMATIVE_FILES){
    try{
      const res=await fetch(rawUrlFor(t.file));
      if(!res.ok) throw new Error(res.statusText);
      const txt=await res.text();
      const rows=parseCSV(txt);
      rows.forEach(r=>transformativeList.push({...r, link:t.link}));
    }catch(e){console.warn('Failed loading', t.file);}
  }
  hideLoading();
  journalQuery.disabled=false;
}
loadAllLists();

/* ================= AUTOCOMPLETE ================= */
journalQuery.addEventListener('input',()=>{
  const val=normalizeTitle(journalQuery.value); autocompleteResults.innerHTML=''; autocompleteResults.style.display='none';
  if(!val) return;
  const suggestions=new Set();
  Object.values(journalLists).forEach(arr=>{
    arr.forEach(j=>{
      const title=j.title||j['journal title']||j['journal']||'';
      if(title && normalizeTitle(title).includes(val)) suggestions.add(title);
      if(suggestions.size>=8) return;
    });
  });
  suggestions.forEach(t=>{
    const div=document.createElement('div');
    div.className='autocomplete-item';
    div.textContent=t;
    div.addEventListener('click',()=>{journalQuery.value=t; autocompleteResults.style.display='none'; runCheck();});
    autocompleteResults.appendChild(div);
  });
  autocompleteResults.style.display=suggestions.size?'block':'none';
});
document.addEventListener('click', e=>{if(!autocompleteResults.contains(e.target)&&e.target!==journalQuery) autocompleteResults.style.display='none';});

/* ================= SEARCH & REPORT ================= */
async function runCheck(){
  const query=journalQuery.value.trim();
  if(!query){showError('Enter journal title or ISSN'); return;}

  const qNorm=normalizeTitle(query);
  const issnQuery=isISSN(query)?query.replace('-',''):'';
  let found=null;
  const flags={dhet:false,dhet2:false,scopus:false,wos:false,doaj:false,ibss:false,scielo:false};

  Object.entries(journalLists).forEach(([key,list])=>{
    if(key==='removed') return;
    for(const j of list){
      const title=j.title||j['journal title']||j['journal']||'';
      const issn=j.issn||j['issn']||'';
      if((normalizeTitle(title)===qNorm)||(issn.replace('-','')===issnQuery)){ found=j; flags[key]=true; break; }
    }
  });

  if(!found){showError('Journal not found'); return;}

  infoTitle.textContent=found.title||found['journal title']||found['journal']||'—';
  infoIssn.textContent=found.issn||found.eissn||'—';
  infoPublisher.textContent=found.publisher||found['publisher details']||'—';

  const indexedIn=[];
  if(flags.dhet||flags.dhet2) indexedIn.push('DHET');
  if(flags.scopus) indexedIn.push('SCOPUS');
  if(flags.wos) indexedIn.push('WOS');
  if(flags.doaj) indexedIn.push('DOAJ');
  if(flags.ibss) indexedIn.push('IBSS');
  if(flags.scielo) indexedIn.push('SCIELO');
  infoIndexes.textContent=indexedIn.join(', ')||'None';

  // Transformative
  const tMatch=transformativeList.find(t=>{
    const tTitle=t.title||t['journal title']||t['journal']||'';
    const tIssn=t.issn||t.eissn||'';
    return normalizeTitle(tTitle)===normalizeTitle(found.title||found['journal title'])||(tIssn===found.issn||tIssn===found.eissn);
  });
  if(tMatch){
    transformativeInfo.innerHTML=`Yes<br>Publisher: ${tMatch.publisher||''}<br>Duration: ${tMatch['agreement duration']||tMatch.duration||''}<br><a href="${tMatch.link||'#'}" target="_blank">View Agreement</a>`;
  } else transformativeInfo.textContent='No transformative agreement found';

  // CrossRef
  realtimeInfo.innerHTML='Fetching license…';
  pubmedInfo.innerHTML='Fetching PubMed count…';
  try{
    const crIssn=found.issn||found.eissn||'';
    if(crIssn){
      const resp=await fetch(`https://api.crossref.org/journals/${crIssn}`);
      const data=await resp.json();
      if(data.status==='ok'){
        const j=data.message;
        if(j.license && j.license.length){
          const lic=j.license[0].URL||'';
          realtimeInfo.innerHTML=`${j['title']}<br>License: ${j.license[0]['content-version'] || j.license[0].type}<br><a href="${lic}" target="_blank">${lic}</a>`;
        } else realtimeInfo.textContent='License not found';
      } else realtimeInfo.textContent='CrossRef journal not found';
    } else realtimeInfo.textContent='No ISSN to check';
  }catch(e){realtimeInfo.textContent='CrossRef fetch failed';}

  // PubMed
  try{
    const pubQuery=encodeURIComponent(found.title||found['journal title']);
    const resp=await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${pubQuery}&retmode=json`);
    const data=await resp.json();
    pubmedInfo.textContent=data.esearchresult?.count||0;
  }catch(e){pubmedInfo.textContent='PubMed fetch failed';}

  // Recommendation
  if(indexedIn.length && tMatch) recommendationBadge.textContent='Recommended'; recommendationBadge.className='badge good';
}

/* ================= BUTTONS ================= */
checkBtn.addEventListener('click', runCheck);
journalQuery.addEventListener('keydown',e=>{if(e.key==='Enter') runCheck();});

showRemovedBtn.addEventListener('click',()=>{
  removedModal.classList.remove('hidden'); removedModal.setAttribute('aria-hidden','false');
  removedTableBody.innerHTML='';
  removedJournals.forEach(r=>{
    const row=document.createElement('tr');
    Object.values(r).forEach((v,i)=>{
      const td=document.createElement('td'); td.textContent=v; row.appendChild(td);
    });
    removedTableBody.appendChild(row);
  });
});

closeRemoved.addEventListener('click',()=>{
  removedModal.classList.add('hidden'); removedModal.setAttribute('aria-hidden','true');
});

copyReportBtn.addEventListener('click',()=>{navigator.clipboard.writeText(JSON.stringify({
  title:infoTitle.textContent,
  issn:infoIssn.textContent,
  publisher:infoPublisher.textContent,
  indexedIn:infoIndexes.textContent,
  transformative:transformativeInfo.textContent,
  crossRef:realtimeInfo.textContent,
  pubmed:pubmedInfo.textContent
},null,2)); alert('Report copied');});

exportJsonBtn.addEventListener('click',()=>{
  const data={
    title:infoTitle.textContent,
    issn:infoIssn.textContent,
    publisher:infoPublisher.textContent,
    indexedIn:infoIndexes.textContent,
    transformative:transformativeInfo.textContent,
    crossRef:realtimeInfo.textContent,
    pubmed:pubmedInfo.textContent
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='journal-report.json'; a.click(); URL.revokeObjectURL(url);
});

copyRemovedBtn.addEventListener('click',()=>{
  const arr=removedJournals.map(r=>Object.values(r).join('\t')).join('\n');
  navigator.clipboard.writeText(arr); alert('Removed journals copied');
});
