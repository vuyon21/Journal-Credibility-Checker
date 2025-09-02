/* ========================== CONFIG ========================== */
const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

const ACCREDITED_FILES = [
  'DHET_2025.csv','DHET_2_2025.csv','DOAJ_2025.csv','IBSS_2025.csv',
  'NORWEGIAN_2025.csv','SCIELO SA_2025.csv','SCOPUS_2025.csv','WOS_2025.csv'
];

const REMOVED_FILE = 'JOURNALS REMOVED IN PAST YEARS.csv';

const TRANSFORMATIVE_FILES = [
  'WILEY_2025.csv','The Company of Biologists_2025.csv','Taylir & Francis_2025.csv',
  'Springer_2025.csv','ScienceDirect (Elsevier)_2025.csv','SAGE Publishing_2025.csv',
  'Royal Society_2025.csv','Royal Society of Chemistry Platinum_2025.csv','Oxford University Press Journals_2025.csv',
  'IOPscienceExtra_2025.csv','Emerald_2025.csv','Cambridge University Press (CUP)_2025.csv',
  'Bentham Science Publisherst_2025.csv','Association for Computing Machinery (ACM)_2025.csv',
  'American Institute of Physics (AIP)_2025.csv','American Chemicals Society(ACS)_2025.csv'
];

/* =================== DOM ELEMENTS =================== */
const $ = id => document.getElementById(id);
const qInput = $('q');
const btnSearch = $('btn-search');
const btnCopy = $('btn-copy');
const btnShowRemoved = $('btn-show-removed');
const btnCopyRemoved = $('btn-copy-removed');
const loading = $('loading');
const errBox = $('error');
const rec = $('rec');
const removedPanel = $('removed-panel');
const removedTableWrap = $('removed-table-wrap');
const acWrap = $('autocomplete-results');
const reportContainer = $('report-container');
const reportTable = $('report-table');

/* =================== IN-MEMORY DATASETS =================== */
let accredited = [];
let removedList = [];
let transformList = [];

/* =================== UTILITIES =================== */
function normalize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim(); }
function looksISSN(s){ return /\b\d{4}-?\d{3}[\dXx]\b/.test(s||''); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function csvSafe(s){ const t=String(s||''); return (t.includes(',')||t.includes('"')||t.includes('\n'))?`"${t.replace(/"/g,'""')}"`:t; }

function showLoading(msg){ loading.textContent=msg; loading.style.display='block'; }
function hideLoading(){ loading.style.display='none'; }
function showError(msg){ errBox.textContent=msg; errBox.style.display='block'; setTimeout(()=>errBox.style.display='none',7000); }

/* =================== CSV PARSER =================== */
function parseCSV(text) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(l=>l.trim().length>0);
  const rows=[]; let cur=[], inQuotes=false, field='';
  function pushField(){ cur.push(field.trim()); field=''; }
  function pushRow(){ rows.push(cur); cur=[]; }
  for(const rawLine of lines){
    let line=rawLine;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){
        if(inQuotes && line[i+1]==='"'){ field+='"'; i++; } else { inQuotes=!inQuotes; }
      } else if(ch===',' && !inQuotes){ pushField(); } else { field+=ch; }
    }
    if(inQuotes){ field+='\n'; } else { pushField(); pushRow(); }
  }
  return rows;
}

/* =================== MAP CSV ROWS =================== */
function mapAccreditedRow(cols, header) {
  const get = names => { const idx=header.findIndex(h=>names.some(n=>h.replace(/\s+/g,'').toLowerCase()===n.replace(/\s+/g,'').toLowerCase())); return (idx>=0 && cols[idx])?cols[idx].trim():''; };
  const title=get(['Journaltitle(Previoustitleifapplicable)','Journaltitle','Title','Journal']);
  const issn1=get(['ISSN','PrintISSN','pISSN']);
  const issn2=get(['eISSN','OnlineISSN']);
  const lastReview=get(['DATEOFLASTREVIEWORACCREDITATION','LastReview','AccreditedDate']);
  const intl=get(['InternationalAccreditation','International','Index']);
  const freq=get(['FREQUENCY','Frequency']);
  const publisher=get(['Publisher','Publisherdetails','Publisher’sdetails','Publisherdetails']);
  let eissn='', pissn='';
  const norm1=(issn1||'').replace(/\s+/g,''), norm2=(issn2||'').replace(/\s+/g,'');
  if(norm1 && norm2){ eissn=norm1; pissn=norm2; } else if(norm1 && !norm2){ pissn=norm1; } else if(!norm1 && norm2){ pissn=norm2; }
  return { title:title||'', titleNorm:normalize(title), issn:pissn||'', eissn:eissn||'', lastReview:lastReview||'', internationalAccreditation:intl||'', frequency:freq||'', publisher:publisher||'', source:'accredited' };
}

function mapRemovedRow(cols, header){
  const get=names=>{ const idx=header.findIndex(h=>names.some(n=>h.replace(/\s+/g,'').toLowerCase()===n.replace(/\s+/g,'').toLowerCase())); return (idx>=0 && cols[idx])?cols[idx].trim():''; };
  const title=get(['JOURNALTITLE(Previoustitleifapplicable)','Journaltitle','Title']);
  const issn=get(['ISSN','ISSN(Online)','eISSN']);
  const reason=get(['Reason','REASON','Comment']);
  const review=get(['DATEOFLASTREVIEWORACCREDITATION','Reviewed','Reviewdate']);
  const publisher=get(['Publisher’sdetails','Publisherdetails','Publisher']);
  return { title:title||'', titleNorm:normalize(title), issn:(issn||'').replace(/\s+/g,''), reason:reason||'', review:review||'', publisher:publisher||'' };
}

function mapTransformRow(cols, header, fileLabel){
  const get=names=>{ const idx=header.findIndex(h=>names.some(n=>h.replace(/\s+/g,'').toLowerCase()===n.replace(/\s+/g,'').toLowerCase())); return (idx>=0 && cols[idx])?cols[idx].trim():''; };
  const title=get(['JournalTitle','Title','Journal']);
  const eissn=get(['eISSN','EISSN','OnlineISSN']);
  const oaStatus=get(['OpenAccessStatus','OpenAccess','OAStatus']);
  const included=get(['IncludedinR&Pagreement','IncludedinRPagreement','Included','IncludedinR&Pagreement']);
  const notIncludedWhy=get(['Explanationifnotincluded','Explanation','Notes']);
  const subject=get(['Subject']);
  const publisher=get(['Publisher']);
  const agreeInfo=get(['AgreementInformation','AgreementInfo']);
  const agreeDuration=get(['AgreementDuration','Duration']);
  return { title:title||'', titleNorm:normalize(title), eissn:(eissn||'').replace(/\s+/g,''), issn:'', publisher:publisher||(fileLabel||''), oaStatus:oaStatus||'', included:(included||'').toLowerCase().startsWith('y')?'Yes':(included||''), notes:notIncludedWhy||'', agreementInfo:agreeInfo||'', agreementDuration:agreeDuration||'', subject:subject||'', source:'transformative' };
}

/* =================== FETCH DATA =================== */
async function fetchText(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return await r.text(); }

async function loadAccredited(){ 
  const all=[]; 
  for(const f of ACCREDITED_FILES){
    try{
      const txt=await fetchText(RAW_BASE+encodeURIComponent(f));
      const rows=parseCSV(txt);
      if(!rows.length) continue;
      const header=rows[0].map(h=>String(h||'').trim());
      const body=rows.slice(1);
      for(const cols of body){ if(!cols.some(x=>x && String(x).trim())) continue; const item=mapAccreditedRow(cols,header); if(item.title) all.push(item);}
    }catch(e){ console.warn('Accredited file load failed:',f,e); }
  } accredited=all; 
}

async function loadRemoved(){ 
  try{
    const txt=await fetchText(RAW_BASE+encodeURIComponent(REMOVED_FILE));
    const rows=parseCSV(txt);
    if(!rows.length){ removedList=[]; return; }
    const header=rows[0].map(h=>String(h||'').trim());
    const body=rows.slice(1);
    removedList=body.filter(cols=>cols && cols.some(x=>x && String(x).trim())).map(cols=>mapRemovedRow(cols,header));
  }catch(e){ console.warn('Removed file load failed',e); removedList=[]; }
}

async function loadTransformative(){ 
  const all=[]; 
  for(const f of TRANSFORMATIVE_FILES){
    try{
      const txt=await fetchText(RAW_BASE+encodeURIComponent(f));
      const rows=parseCSV(txt);
      if(!rows.length) continue;
      const header=rows[0].map(h=>String(h||'').trim());
      const body=rows.slice(1);
      for(const cols of body){ if(!cols.some(x=>x && String(x).trim())) continue; const item=mapTransformRow(cols,header,f.replace(/_2025\.csv$/,'').trim()); if(item.title) all.push(item); }
    }catch(e){ console.warn('Transformative file load failed:',f,e);}
  } transformList=all;
}

async function init(){ showLoading('Loading journal datasets…'); await Promise.all([loadAccredited(),loadRemoved(),loadTransformative()]); hideLoading(); setupAutocomplete(); }
init();

/* =================== AUTOCOMPLETE =================== */
function setupAutocomplete(){
  qInput.addEventListener('input',()=>{
    const val=normalize(qInput.value);
    acWrap.innerHTML=''; acWrap.style.display='none';
    if(val.length<2) return;
    const seen=new Set(); const suggestions=[];
    function addSuggest(arr,field='title'){
      for(const j of arr){
        const t=j[field]||''; if(!t) continue;
        if(normalize(t).includes(val) && !seen.has(t)){ seen.add(t); suggestions.push(t); if(suggestions.length>=10) break; }
      }
    }
    addSuggest(accredited); if(suggestions.length<10) addSuggest(transformList);
    if(suggestions.length){
      acWrap.style.display='block';
      suggestions.forEach(s=>{
        const div=document.createElement('div');
        div.className='autocomplete-item'; div.textContent=s;
        div.onclick=()=>{ qInput.value=s; acWrap.innerHTML=''; acWrap.style.display='none'; };
        acWrap.appendChild(div);
      });
    }
  });
}

/* =================== SEARCH =================== */
btnSearch.addEventListener('click',()=>doSearch(qInput.value));

function doSearch(query){
  if(!query || !query.trim()){ showError('Please enter a journal title or ISSN'); return; }
  const qNorm=normalize(query);
  const byISSN=looksISSN(query);
  let results=[];
  // Check accredited
  results=accredited.filter(j=> (byISSN?j.issn.replace(/\D/g,'')===query.replace(/\D/g,''):j.titleNorm===qNorm || j.titleNorm.includes(qNorm)));
  // Check removed
  const removedMatches=removedList.filter(j=>(byISSN?j.issn.replace(/\D/g,'')===query.replace(/\D/g,''):j.titleNorm.includes(qNorm)));
  // Check transformative
  const transformMatches=transformList.filter(j=>(byISSN?j.eissn.replace(/\D/g,'')===query.replace(/\D/g,''):j.titleNorm.includes(qNorm)));

  // Generate structured data
  const sections=[];

  if(results.length){
    const rows={};
    const j=results[0];
    rows['Journal Title']=j.title;
    rows['ISSN / eISSN']=[j.issn,j.eissn].filter(Boolean).join(' / ');
    rows['Publisher']=j.publisher;
    rows['International Accreditation']=j.internationalAccreditation;
    rows['Frequency']=j.frequency;
    rows['Date of Last Review']=j.lastReview;
    sections.push({ title:'✅ Accredited Journal', rows });
    rec.textContent='✅ Recommended: Appears in credible indexes';
    rec.className='rec recommended'; rec.style.display='block';
  } else if(transformMatches.length){
    const j=transformMatches[0];
    const rows={};
    rows['Journal Title']=j.title;
    rows['Publisher']=j.publisher;
    rows['ISSN / eISSN']=j.eissn||'';
    rows['Open Access Status']=j.oaStatus;
    rows['Transformative Agreement Included']=j.included;
    rows['Agreement Info']=j.agreementInfo;
    rows['Agreement Duration']=j.agreementDuration;
    sections.push({ title:'⚠ Transformative Agreement', rows });
    rec.textContent='⚠ Transformative Agreement: Journal included in a Transformative Agreement';
    rec.className='rec verify'; rec.style.display='block';
  } else if(removedMatches.length){
    const j=removedMatches[0];
    const rows={};
    rows['Journal Title']=j.title;
    rows['ISSN / eISSN']=j.issn;
    rows['Publisher']=j.publisher;
    rows['Reason for Removal']=j.reason;
    rows['Last Review Date']=j.review;
    sections.push({ title:'🚨 Removed / Delisted Journal', rows });
    rec.textContent='🚨 Not Recommended: Journal removed from accredited list';
    rec.className='rec not-recommended'; rec.style.display='block';
  } else {
    sections.push({ title:'ℹ No Data Found', rows:{ 'Message':'No matching journal found in any list.' } });
    rec.textContent='ℹ No matching data found';
    rec.className='rec verify'; rec.style.display='block';
  }

  showReportTable(sections);
}

/* =================== REPORT TABLE RENDER =================== */
function showReportTable(data){
  reportTable.innerHTML='';
  for(const section of data){
    const trHeader=document.createElement('tr');
    const th=document.createElement('th'); th.colSpan=2; th.textContent=section.title;
    trHeader.appendChild(th); reportTable.appendChild(trHeader);
    for(const [key,value] of Object.entries(section.rows)){
      const tr=document.createElement('tr');
      const tdKey=document.createElement('td'); tdKey.textContent=key;
      const tdVal=document.createElement('td'); tdVal.textContent=value;
      tr.appendChild(tdKey); tr.appendChild(tdVal);
      reportTable.appendChild(tr);
    }
  }
  reportContainer.style.display='block';
}

/* =================== COPY REPORT =================== */
btnCopy.addEventListener('click',()=>{
  let txt='';
  for(const row of reportTable.rows){
    txt+=Array.from(row.cells).map(c=>c.textContent).join('\t')+'\n';
  }
  navigator.clipboard.writeText(txt).then(()=>alert('Report copied to clipboard'));
});

/* =================== REMOVED PANEL =================== */
btnShowRemoved.addEventListener('click',()=>{
  if(removedPanel.style.display==='block'){ removedPanel.style.display='none'; return; }
  removedTableWrap.innerHTML='';
  const table=document.createElement('table');
  const trHead=document.createElement('tr');
  ['Journal Title','ISSN','Publisher','Reason for Removal','Last Review Date'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trHead.appendChild(th); });
  table.appendChild(trHead);
  removedList.forEach(j=>{
    const tr=document.createElement('tr');
    [j.title,j.issn,j.publisher,j.reason,j.review].forEach(v=>{ const td=document.createElement('td'); td.textContent=v; tr.appendChild(td); });
    table.appendChild(tr);
  });
  removedTableWrap.appendChild(table);
  removedPanel.style.display='block';
});

btnCopyRemoved.addEventListener('click',()=>{
  const table=removedTableWrap.querySelector('table'); if(!table) return;
  let txt='';
  for(const row of table.rows){ txt+=Array.from(row.cells).map(c=>c.textContent).join('\t')+'\n'; }
  navigator.clipboard.writeText(txt).then(()=>alert('Removed journals copied to clipboard'));
});
