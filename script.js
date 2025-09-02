/* ============ CONFIG ============ */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
const ACCREDITED_FILES = ['DHET_2025.csv','DHET_2_2025.csv','DOAJ_2025.csv','IBSS_2025.csv','NORWEGIAN_2025.csv','SCIELO SA_2025.csv','SCOPUS_2025.csv','WOS_2025.csv'];
const REMOVED_FILE = 'JOURNALS REMOVED IN PAST YEARS.csv';
const TRANSFORMATIVE_FILES = ['WILEY_2025.csv','The Company of Biologists_2025.csv','Taylir & Francis_2025.csv','Springer_2025.csv','ScienceDirect (Elsevier)_2025.csv','SAGE Publishing_2025.csv','Royal Society_2025.csv','Royal Society of Chemistry Platinum_2025.csv','Oxford University Press Journals_2025.csv','IOPscienceExtra_2025.csv','Emerald_2025.csv','Cambridge University Press (CUP)_2025.csv','Bentham Science Publisherst_2025.csv','Association for Computing Machinery (ACM)_2025.csv','American Institute of Physics (AIP)_2025.csv','American Chemicals Society(ACS)_2025.csv'];

/* ============ UI ELEMENTS ============ */
const $ = id => document.getElementById(id);
const qInput = $('q'), btnSearch=$('btn-search'), btnCopy=$('btn-copy'), btnDownload=$('btn-download'),
btnShowRemoved=$('btn-show-removed'), btnCopyRemoved=$('btn-copy-removed'), loading=$('loading'),
errBox=$('error'), report=$('report'), rec=$('rec'), removedPanel=$('removed-panel'),
removedTableWrap=$('removed-table-wrap'), acWrap=$('autocomplete-results');

let accredited=[], removedList=[], transformList=[];

/* ============ CSV PARSER ============ */
function parseCSV(text){
  const cleaned=text.replace(/^\uFEFF/,'');
  const lines=cleaned.split(/\r?\n/).filter(l=>l.trim());
  const rows=[];
  let cur=[], inQuotes=false, field='';
  function pushField(){cur.push(field.trim());field='';}
  function pushRow(){rows.push(cur);cur=[];}
  for(const rawLine of lines){
    let line=rawLine;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch=='"'){
        if(inQuotes&&line[i+1]=='"'){field+='"';i++;}else{inQuotes=!inQuotes;}
      }else if(ch==','&&!inQuotes){pushField();}else{field+=ch;}
    }
    if(inQuotes){field+='\n';}else{pushField();pushRow();}
  }
  return rows;
}

function normalize(s){return (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();}
function looksISSN(s){return /\b\d{4}-?\d{3}[\dXx]\b/.test(s||'');}

/* ============ LOAD DATA ============ */
async function fetchText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return await r.text();}

async function loadAccredited(){
  const all=[];
  for(const f of ACCREDITED_FILES){
    try{
      const txt=await fetchText(RAW_BASE+encodeURIComponent(f));
      const rows=parseCSV(txt);
      if(!rows.length)continue;
      const header=rows[0].map(h=>String(h||'').trim());
      const body=rows.slice(1);
      for(const cols of body){if(!cols.some(x=>x&&String(x).trim()))continue;
        all.push({title:cols[0]||'',titleNorm:normalize(cols[0]||''),issn:cols[1]||'',eissn:cols[2]||'',publisher:cols[3]||'',source:'accredited'});}
    }catch(e){console.warn('Accredited file load failed:',f,e);}
  }
  accredited=all;
}

async function loadRemoved(){
  try{
    const txt=await fetchText(RAW_BASE+encodeURIComponent(REMOVED_FILE));
    const rows=parseCSV(txt);
    if(!rows.length){removedList=[];return;}
    const header=rows[0].map(h=>String(h||'').trim());
    const body=rows.slice(1);
    removedList=body.filter(cols=>cols.some(x=>x&&String(x).trim())).map(cols=>({title:cols[0]||'',titleNorm:normalize(cols[0]||''),issn:cols[1]||'',reason:cols[2]||'',source:'removed'}));
  }catch(e){console.warn('Removed load failed',e);}
}

async function loadTransformative(){
  const all=[];
  for(const f of TRANSFORMATIVE_FILES){
    try{
      const txt=await fetchText(RAW_BASE+encodeURIComponent(f));
      const rows=parseCSV(txt);
      if(!rows.length)continue;
      const header=rows[0].map(h=>String(h||'').trim());
      const body=rows.slice(1);
      for(const cols of body){if(!cols.some(x=>x&&String(x).trim()))continue;
        all.push({title:cols[0]||'',titleNorm:normalize(cols[0]||''),publisher:cols[1]||'',source:'transformative'});}
    }catch(e){console.warn('Transformative file load failed',f,e);}
  }
  transformList=all;
}

/* ============ AUTOCOMPLETE ============ */
qInput.addEventListener('input',()=>{
  const val=qInput.value.trim().toLowerCase();
  if(!val){acWrap.style.display='none';return;}
  const options=[...accredited,...transformList].filter(j=>j.titleNorm.includes(normalize(val))).slice(0,6);
  acWrap.innerHTML=options.map(o=>`<div class="autocomplete-item">${o.title} (${o.issn||''})</div>`).join('');
  acWrap.style.display=options.length?'block':'none';
});
acWrap.addEventListener('click',e=>{
  if(e.target.classList.contains('autocomplete-item')){
    qInput.value=e.target.textContent.replace(/\(\d*.*\)/,'').trim();
    acWrap.style.display='none';
  }
});

/* ============ SEARCH ============ */
btnSearch.addEventListener('click',()=>searchJournal(qInput.value.trim()));

async function searchJournal(term){
  if(!term){return;}
  loading.style.display='block';
  errBox.style.display='none';
  rec.style.display='none';
  report.innerHTML='';
  try{
    const normTerm=normalize(term);
    const accreditedHit=accredited.find(j=>j.titleNorm===normTerm||j.issn===term||j.eissn===term);
    const removedHit=removedList.find(j=>j.titleNorm===normTerm||j.issn===term);
    const transformativeHit=transformList.find(j=>j.titleNorm===normTerm);

    const rows=[];
    if(accreditedHit){rows.push({...accreditedHit,status:'✅ Accredited'});}
    if(transformativeHit){rows.push({...transformativeHit,status:'🟢 Transformative'});}
    if(removedHit){rows.push({...removedHit,status:'🚨 Removed'});}

    // Live API lookups
    const crossRef=await fetchCrossRef(term);
    const openAlex=await fetchOpenAlex(term);
    const pubmed=await fetchPubMed(term);

    rows.push(...crossRef,...openAlex,...pubmed);

    renderReport(rows);
  }catch(e){errBox.style.display='block';errBox.textContent=e.message;}
  finally{loading.style.display='none';}
}

/* ============ RENDER REPORT ============ */
function renderReport(rows){
  if(!rows.length){report.innerHTML='<p>No matches found.</p>';return;}
  let html=`<table><thead><tr><th>Journal/Title</th><th>ISSN</th><th>Publisher/Source</th><th>Status/Remarks</th></tr></thead><tbody>`;
  for(const r of rows){
    html+=`<tr>
      <td>${r.title||r.name||r.journal_title||''}</td>
      <td>${r.issn||r.id||''}</td>
      <td>${r.publisher||r.source||''}</td>
      <td>${r.status||r.note||''}</td>
    </tr>`;
  }
  html+='</tbody></table>';
  report.innerHTML=html;
}

/* ============ COPY / DOWNLOAD ============ */
btnCopy.addEventListener('click',()=>{navigator.clipboard.writeText(report.innerText).then(()=>alert('Report copied to clipboard'));});
btnDownload.addEventListener('click',()=>{
  const blob=new Blob([report.innerText],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='journal_report.txt';a.click();
});

/* ============ REMOVED PANEL ============ */
btnShowRemoved.addEventListener('click',()=>{removedPanel.style.display=removedPanel.style.display==='block'?'none':'block';});
btnCopyRemoved.addEventListener('click',()=>{
  const text=removedList.map(j=>`${j.title} | ${j.issn} | ${j.reason}`).join('\n');
  navigator.clipboard.writeText(text).then(()=>alert('Removed list copied'));
});

/* ============ LIVE API FUNCTIONS ============ */
async function fetchCrossRef(term){
  try{
    const url=`https://api.crossref.org/journals?query=${encodeURIComponent(term)}&rows=3`;
    const r=await fetch(url);
    const data=await r.json();
    if(!data.message.items) return [];
    return data.message.items.map(j=>({title:j.title,issn:j.ISSN?j.ISSN[0]:'' ,publisher:j.publisher,note:'CrossRef API'}));
  }catch(e){return [];}
}

async function fetchOpenAlex(term){
  try{
    const url=`https://api.openalex.org/journals?filter=display_name.search:${encodeURIComponent(term)}&per_page=3`;
    const r=await fetch(url);
    const data=await r.json();
    if(!data.results) return [];
    return data.results.map(j=>({title:j.display_name,issn:j.issn_l[0]||'',publisher:j.publisher,note:'OpenAlex API'}));
  }catch(e){return [];}
}

async function fetchPubMed(term){
  try{
    const url=`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmode=json&retmax=3`;
    const r=await fetch(url);
    const data=await r.json();
    if(!data.esearchresult?.idlist) return [];
    return data.esearchresult.idlist.map(id=>({title:term,issn:id,publisher:'PubMed',note:'PubMed API'}));
  }catch(e){return [];}
}

/* ============ INITIAL LOAD ============ */
(async function init(){loading.style.display='block';await loadAccredited();await loadRemoved();await loadTransformative();loading.style.display='none';})();
