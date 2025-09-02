const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

const ACCREDITED_FILES = [
  'DHET_2025.csv', 'DHET_2_2025.csv', 'DOAJ_2025.csv',
  'IBSS_2025.csv', 'NORWEGIAN_2025.csv', 'SCIELO SA_2025.csv',
  'SCOPUS_2025.csv', 'WOS_2025.csv'
];
const REMOVED_FILE = 'JOURNALS REMOVED IN PAST YEARS.csv';
const TRANSFORMATIVE_FILES = [
  'WILEY_2025.csv','The Company of Biologists_2025.csv','Taylir & Francis_2025.csv',
  'Springer_2025.csv','ScienceDirect (Elsevier)_2025.csv','SAGE Publishing_2025.csv',
  'Royal Society_2025.csv','Royal Society of Chemistry Platinum_2025.csv',
  'Oxford University Press Journals_2025.csv','IOPscienceExtra_2025.csv',
  'Emerald_2025.csv','Cambridge University Press (CUP)_2025.csv',
  'Bentham Science Publisherst_2025.csv','Association for Computing Machinery (ACM)_2025.csv',
  'American Institute of Physics (AIP)_2025.csv','American Chemicals Society(ACS)_2025.csv'
];

const $ = id => document.getElementById(id);
const qInput = $('q'), btnSearch = $('btn-search'), btnCopy = $('btn-copy'),
      btnDownload = $('btn-download'), btnShowRemoved = $('btn-show-removed'),
      btnCopyRemoved = $('btn-copy-removed'), loading = $('loading'),
      errBox = $('error'), reportTable = $('report-table'),
      removedPanel = $('removed-panel'), removedTableWrap = $('removed-table-wrap'),
      acWrap = $('autocomplete-results');

let accredited=[], removedList=[], transformList=[];

// CSV parser
function parseCSV(text) {
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter(l => l.trim());
  return lines.map(l=>{
    const row = [], parts = l.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    return parts?parts.map(p=>p.replace(/^"|"$/g,'')):row;
  });
}

// Normalize strings
function normalize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

// Load CSVs
async function loadCSVFiles(files) {
  const data=[];
  for(const f of files){
    const res = await fetch(RAW_BASE+f);
    const txt = await res.text();
    data.push(...parseCSV(txt));
  }
  return data;
}

// Load all
async function initData() {
  loading.style.display='block';
  accredited = await loadCSVFiles(ACCREDITED_FILES);
  removedList = await loadCSVFiles([REMOVED_FILE]);
  transformList = await loadCSVFiles(TRANSFORMATIVE_FILES);
  loading.style.display='none';
}
initData();

// Search
btnSearch.addEventListener('click', ()=>doSearch(qInput.value));

async function doSearch(term){
  term = term.trim();
  if(!term) return;

  reportTable.innerHTML='';
  errBox.style.display='none';
  loading.style.display='block';

  const normTerm = normalize(term);

  // Helper to create row
  function rowHTML(name, issn, source, cls){ 
    return `<tr class="${cls}"><td>${name}</td><td>${issn}</td><td>${source}</td></tr>`;
  }

  // Table header
  reportTable.innerHTML = '<tr><th>Journal</th><th>ISSN</th><th>Source</th></tr>';

  // Local checks: Accredited
  accredited.forEach(r=>{
    const [name, issn]=r;
    if(normalize(name).includes(normTerm)||normalize(issn).includes(normTerm))
      reportTable.innerHTML += rowHTML(name, issn, 'Accredited', 'accredited');
  });

  // Transformative
  transformList.forEach(r=>{
    const [name, issn]=r;
    if(normalize(name).includes(normTerm)||normalize(issn).includes(normTerm))
      reportTable.innerHTML += rowHTML(name, issn, 'Transformative', 'transformative');
  });

  // Removed
  removedList.forEach(r=>{
    const [name, issn]=r;
    if(normalize(name).includes(normTerm)||normalize(issn).includes(normTerm))
      reportTable.innerHTML += rowHTML(name, issn, 'Removed', 'removed');
  });

  // Live API calls
  try{
    const cross = await fetch(`https://api.crossref.org/journals?query=${encodeURIComponent(term)}&rows=3`).then(r=>r.json());
    (cross.message.items||[]).forEach(j=>{
      reportTable.innerHTML += rowHTML(j.title, j.ISSN?j.ISSN.join(', '):'', 'CrossRef', 'live');
    });

    const openalex = await fetch(`https://api.openalex.org/journals?search=${encodeURIComponent(term)}&per_page=3`).then(r=>r.json());
    (openalex.results||[]).forEach(j=>{
      reportTable.innerHTML += rowHTML(j.display_name, j.issn||'', 'OpenAlex', 'live');
    });

    const pubmed = await fetch(`https://api.ncbi.nlm.nih.gov/lit/ctxp/v1/journals/?term=${encodeURIComponent(term)}`).then(r=>r.json());
    (pubmed || []).slice(0,3).forEach(j=>{
      reportTable.innerHTML += rowHTML(j.title, j.issn||'', 'PubMed', 'live');
    });
  } catch(e){ errBox.style.display='block'; errBox.textContent='Error fetching live API data'; }

  loading.style.display='none';
}

// Show removed panel
btnShowRemoved.addEventListener('click', ()=>{
  removedPanel.style.display = removedPanel.style.display==='block'?'none':'block';
  removedTableWrap.innerHTML='<table><tr><th>Journal</th><th>ISSN</th></tr>'+
    removedList.map(r=>`<tr><td>${r[0]}</td><td>${r[1]||''}</td></tr>`).join('')+
    '</table>';
});

// Copy report
btnCopy.addEventListener('click', ()=>{
  navigator.clipboard.writeText(reportTable.outerHTML);
  alert('Report copied!');
});

// Download report
btnDownload.addEventListener('click', ()=>{
  const blob = new Blob([reportTable.outerHTML],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='journal_report.html';
  a.click();
});

// Copy removed list
btnCopyRemoved.addEventListener('click', ()=>{
  const text = removedList.map(r=>r.join(', ')).join('\n');
  navigator.clipboard.writeText(text);
  alert('Removed list copied!');
});
