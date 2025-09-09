document.addEventListener('DOMContentLoaded', () => {
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
  const exportJsonBtn = $('export-json');
  const removedModal = $('removed-modal');
  const closeRemoved = $('close-removed');
  const removedTableBody = $('removed-table').querySelector('tbody');

  const reportSection = $('report-section');
  const infoTitle = $('info-title');
  const infoIssn = $('info-issn');
  const infoPublisher = $('info-publisher');
  const infoIndexes = $('info-indexes');
  const transformativeInfo = $('transformative-info');
  const realtimeInfo = $('realtime-info');
  const pubmedInfo = $('pubmed-info');
  const statusBadge = $('status-badge');
  const loadingMessage = $('loading-message');
  const errorMessage = $('error-message');

  let journalLists = {};
  let transformativeList = [];

  const showError = msg => { errorMessage.textContent = msg; errorMessage.style.display='inline'; setTimeout(()=>errorMessage.style.display='none',7000); };
  const showLoading = msg => { loadingMessage.textContent = msg; loadingMessage.style.display='inline'; };
  const hideLoading = () => { loadingMessage.style.display='none'; };

  function normalizeTitle(t){ return (t||'').toLowerCase().replace(/[^a-z0-9]/g,' ').trim(); }

  async function fetchCSV(url){
    const res = await fetch(url);
    const txt = await res.text();
    const lines = txt.split(/\r?\n/).filter(l=>l.trim());
    const delim = lines[0].includes(',') ? ',' : '\t';
    const headers = lines[0].split(delim).map(h=>h.trim());
    return lines.slice(1).map(line=>{
      const cols = line.split(delim).map(c=>c.trim());
      const obj = {};
      headers.forEach((h,i)=> obj[h.toLowerCase()] = cols[i]||'');
      return obj;
    });
  }

  async function loadAllLists(){
    showLoading('Loading journal lists…');
    for(const key in FILENAMES){
      try{
        journalLists[key] = await fetchCSV(RAW_BASE + encodeURIComponent(FILENAMES[key]));
      } catch(e){ journalLists[key] = []; console.warn(e); }
    }
    transformativeList = [];
    for(const t of TRANSFORMATIVE_FILES){
      try{
        const rows = await fetchCSV(RAW_BASE + encodeURIComponent(t.file));
        rows.forEach(r=>r.link = t.link);
        transformativeList.push(...rows);
      } catch(e){ console.warn(e); }
    }
    hideLoading();
  }

  loadAllLists();

  // AUTOCOMPLETE
  journalQuery.addEventListener('input',()=>{
    const q = normalizeTitle(journalQuery.value);
    autocompleteResults.innerHTML=''; autocompleteResults.style.display='none';
    if(q.length<2) return;
    let suggestions = new Set();
    for(const arr of Object.values(journalLists)){
      for(const j of arr){
        const title = j['journal title']||j['title']||j['journal']||'';
        if(normalizeTitle(title).includes(q)) suggestions.add(title);
        if(suggestions.size>=8) break;
      }
      if(suggestions.size>=8) break;
    }
    if(suggestions.size){
      suggestions.forEach(t=>{
        const div = document.createElement('div');
        div.textContent = t; div.className='autocomplete-item';
        div.addEventListener('click', ()=>{
          journalQuery.value=t; autocompleteResults.style.display='none'; runCheck();
        });
        autocompleteResults.appendChild(div);
      });
      autocompleteResults.style.display='block';
    }
  });

  document.addEventListener('click', e=>{
    if(!autocompleteResults.contains(e.target) && e.target!==journalQuery) autocompleteResults.style.display='none';
  });

  async function runCheck(){
    const query = journalQuery.value.trim();
    if(!query) return showError('Please enter a journal title or ISSN');
    let found = null;
    for(const key in journalLists){
      if(key==='removed') continue;
      found = journalLists[key].find(j=>{
        return normalizeTitle(j['journal title']||j['title']||j['journal']||'') === normalizeTitle(query) || j['issn'] === query || j['eissn']===query;
      });
      if(found) break;
    }
    if(!found) return showError('Journal not found');

    reportSection.style.display='block';
    infoTitle.textContent = found['journal title']||found['title']||found['journal']||'—';
    infoIssn.textContent = [found['issn'],found['eissn']].filter(Boolean).join(' / ')||'—';
    infoPublisher.textContent = found['publisher']||'—';

    // Indexed in
    let indexedIn = [];
    ['dhet','scopus','wos','doaj','ibss','scielo'].forEach(k=>{
      if(journalLists[k].find(j=>j['journal title']===found['journal title'])) indexedIn.push(k.toUpperCase());
    });
    infoIndexes.textContent = indexedIn.join(', ')||'None';

    // Transformative
    const tMatch = transformativeList.find(t=>normalizeTitle(t['journal title']||t['title']||t['journal'])===normalizeTitle(found['journal title']));
    if(tMatch){
      transformativeInfo.innerHTML = `<div>${tMatch['journal title']||''}</div>
        <div>Publisher: ${tMatch.publisher||''}</div>
        <div>Duration: ${tMatch['agreement duration']||''}</div>
        <div><a href="${tMatch.link||'#'}" target="_blank">View agreement</a></div>`;
    } else transformativeInfo.textContent='None';

    // CrossRef
    realtimeInfo.textContent='Loading...';
    try{
      const issnToQuery = found['issn']||found['eissn']||'';
      if(issnToQuery){
        const res = await fetch(`https://api.crossref.org/journals/${issnToQuery}`);
        const data = await res.json();
        if(data.status==='ok' && data.message.license && data.message.license.length){
          const lic = data.message.license[0];
          realtimeInfo.innerHTML=`<a href="${lic.URL}" target="_blank">${lic['content-version']}</a>`;
        } else realtimeInfo.textContent='No license info';
      } else realtimeInfo.textContent='No ISSN';
    } catch(e){ realtimeInfo.textContent='Error'; console.warn(e); }

    // PubMed
    pubmedInfo.textContent='Loading...';
    try{
      const jTitle = encodeURIComponent(found['journal title']);
      const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${jTitle}[Journal]&retmode=json`);
      const data = await res.json();
      const count = data.esearchresult?.count || 0;
      pubmedInfo.textContent = count + ' articles';
    } catch(e){ pubmedInfo.textContent='Error'; console.warn(e); }

    statusBadge.textContent = 'Checked';
  }

  checkBtn.addEventListener('click', runCheck);
  journalQuery.addEventListener('keypress', e=>{ if(e.key==='Enter') runCheck(); });

  copyReportBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(reportSection.textContent); alert('Copied'); });
  downloadReportBtn.addEventListener('click', ()=>{
    const blob = new Blob([reportSection.textContent], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download='journal-report.txt';
    a.click();
  });
  exportJsonBtn.addEventListener('click', ()=>{
    const payload = { exportedAt:new Date().toISOString(), report:reportSection.textContent };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download='journal-report.json';
    a.click();
  });

  showRemovedBtn.addEventListener('click', ()=>{
    removedModal.style.display='flex';
    removedTableBody.innerHTML='';
    journalLists.removed.forEach(j=>{
      const tr = document.createElement('tr');
      const title = j['journal title']||j['journal']||'';
      tr.innerHTML=`<td>${title}</td><td>${j['issn']||''}</td><td>${j['year removed']||''}</td><td>${j['date of last review or accreditation']||''}</td>`;
      removedTableBody.appendChild(tr);
    });
  });

  closeRemoved.addEventListener('click', ()=>{ removedModal.style.display='none'; });
  window.addEventListener('click', e=>{ if(e.target===removedModal) removedModal.style.display='none'; });

  copyRemovedBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(removedTableBody.textContent); alert('Copied'); });
});
