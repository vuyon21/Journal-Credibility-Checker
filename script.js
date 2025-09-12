document.addEventListener('DOMContentLoaded', function() {
  const searchBtn = document.getElementById('searchBtn');
  const journalQuery = document.getElementById('journalQuery');
  const resultsContainer = document.getElementById('resultsContainer');
  const showRemovedBtn = document.getElementById('showRemovedBtn');
  const copyRemovedBtn = document.getElementById('copyRemovedBtn');
  
  const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
  const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
  
  const FILENAMES = {
    dhet: 'DHET_2025.csv',
    dhet2: 'DHET_2_2025.csv',
    doaj: 'DOAJ_2025.csv',
    ibss: 'IBSS_2025.csv',
    norwegian: 'NORWEGIAN_2025.csv',
    scielo: 'SCIELO SA_2025.csv',
    scopus: 'SCOPUS_2025.csv',
    wos: 'WOS_2025.csv',
    removed: 'JOURNALS REMOVED IN PAST YEARS.csv'
  };
  
  const TRANSFORMATIVE_FILES = [
    {file: 'WILEY_2025.csv', link: 'https://sanlic.ac.za/wiley/'},
    {file: 'The Company of Biologists_2025.csv', link: 'https://sanlic.ac.za/the-company-of-biologists/'},
    {file: 'Taylor & Francis_2025.csv', link: 'https://sanlic.ac.za/taylor-francis/'},
    {file: 'Springer_2025.csv', link: 'https://sanlic.ac.za/springer/'},
    {file: 'ScienceDirect (Elsevier)_2025.csv', link: 'https://sanlic.ac.za/sciencedirect-elsevier/'},
    {file: 'SAGE Publishing_2025.csv', link: 'https://sanlic.ac.za/sage-publishing/'},
    {file: 'Royal Society_2025.csv', link: 'https://sanlic.ac.za/royal-society/'},
    {file: 'Royal Society of Chemistry Platinum_2025.csv', link: 'https://sanlic.ac.za/royal-society-of-chemistry/'},
    {file: 'Oxford University Press Journals_2025.csv', link: 'https://sanlic.ac.za/oxford-university-press-journals/'},
    {file: 'IOPscienceExtra_2025.csv', link: 'https://sanlic.ac.za/iopscience-extra/'},
    {file: 'Emerald_2025.csv', link: 'https://sanlic.ac.za/emerald/'},
    {file: 'Cambridge University Press (CUP)_2025.csv', link: 'https://sanlic.ac.za/cambridge-university-press/'},
    {file: 'Bentham Science Publishers_2025.csv', link: 'https://sanlic.ac.za/bentham-science-publishers-2/'},
    {file: 'Association for Computing Machinery (ACM)_2025.csv', link: 'https://sanlic.ac.za/association-for-computing-machinery-acm/'},
    {file: 'American Institute of Physics (AIP)_2025.csv', link: 'https://sanlic.ac.za/american-institute-of-physics-2/'},
    {file: 'American Chemical Society (ACS)_2025.csv', link: 'https://sanlic.ac.za/american-chemical-society-acs/'}
  ];
  
  let journalLists = {
    dhet: [], dhet2: [], doaj: [], ibss: [], norwegian: [],
    scielo: [], scopus: [], wos: [], removed: []
  };
  
  let transformativeList = [];
  let isRemovedVisible = false;
  let currentReportData = null;

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showLoading(msg) {
    resultsContainer.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>${msg}</p>
        <p id="progressText">Loading...</p>
      </div>
    `;
  }

  function showError(msg) {
    resultsContainer.innerHTML = `
      <div class="loading">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
        <p>${msg}</p>
        <button id="tryAgainBtn" style="margin-top: 15px;">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>
    `;
    
    document.getElementById('tryAgainBtn').addEventListener('click', () => {
      journalQuery.value = '';
      journalQuery.focus();
      loadAllLists();
    });
  }

  function normalizeTitle(t) {
    if (!t) return '';
    t = t.replace(/^\uFEFF/, '');
    t = t.replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
    t = t.replace(/[^a-z0-9\s]/gi, ' ');
    t = t.replace(/\s+/g, ' ').trim().toLowerCase();
    return t;
  }

  function formatISSN(issn) {
    if (!issn || issn === '—') return '—';
    const clean = issn.replace(/[^0-9X]/g, '');
    if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    return issn;
  }

  function normalizeISSN(s) {
    if (!s) return '';
    return s.toString().toUpperCase().replace(/[^0-9X]/g, '');
  }

  function isISSN(s) {
    return /\b\d{4}-?\d{3}[\dXx]\b/i.test(s);
  }

  async function fetchWithFallback(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
      return res;
    } catch (err) {
      const res = await fetch(CORS_PROXY + url);
      if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
      return res;
    }
  }

  function rawUrlFor(fname) {
    return RAW_BASE + encodeURIComponent(fname);
  }

  function parseCSV(text) {
    if (!text) return [];
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    
    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const pipeCount = (headerLine.match(/\|/g) || []).length;
    const delimiter = pipeCount > commaCount ? '|' : ',';
    
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/,$/, ',');
      const parts = line.split(delimiter).map(p => p.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, j) => obj[h] = parts[j] || '');
      if (Object.values(obj).some(v => v)) rows.push(obj);
    }
    
    return rows;
  }

  function getJournalTitle(entry) {
    const fields = ['title', 'journal title', 'journal', 'name', 'journal name', 'journal_title', 'publication title', 'publication_title'];
    for (const field of fields) {
      if (entry[field] && entry[field].toString().trim()) return entry[field].toString().trim();
    }
    return '';
  }

  function getJournalISSN(entry) {
    const fields = ['issn', 'eissn', 'e-issn', 'eissn', 'issn1', 'issn2', 'print issn', 'online issn', 'print_issn', 'online_issn'];
    for (const field of fields) {
      if (entry[field] && entry[field].toString().trim()) return entry[field].toString().trim();
    }
    return '';
  }

  function getJournalPublisher(entry) {
    const fields = [
      'publisher', 'publisher name', 'publisher_name', 'publisher-name',
      'publisher information', 'publisher_info', 'publisher-info',
      'published by', 'publishing company', 'publishing_company',
      'Publisher', 'Publisher Name', 'Publisher_Name', 'Publisher-Name'
    ];
    for (const field of fields) {
      if (entry[field] && entry[field].toString().trim()) return entry[field].toString().trim();
    }
    return '—';
  }

  async function loadAllLists() {
    showLoading('Loading journal lists...');
    let loadedSuccessfully = false;
    let loadedCount = 0;
    const totalToLoad = Object.keys(FILENAMES).length + TRANSFORMATIVE_FILES.length;
    
    for (const [key, fname] of Object.entries(FILENAMES)) {
      try {
        const url = rawUrlFor(fname);
        const res = await fetchWithFallback(url);
        const text = await res.text();
        journalLists[key] = parseCSV(text);
        loadedSuccessfully = true;
      } catch(e) {
        console.warn('Failed to load', fname, e);
        journalLists[key] = [];
      } finally {
        loadedCount++;
        document.getElementById('progressText').textContent = `Loading... ${loadedCount}/${totalToLoad}`;
      }
    }
    
    for (const t of TRANSFORMATIVE_FILES) {
      try {
        const url = rawUrlFor(t.file);
        const res = await fetchWithFallback(url);
        const text = await res.text();
        const rows = parseCSV(text);
        
        rows.forEach(r => {
          const publisher = getJournalPublisher(r);
          const openAccessStatus = r['open access status'] || r['Open Access Status'] || r['open_access_status'] || r['oa_status'] || 'Not specified';
          
          transformativeList.push({
            ...r,
            agreementLink: t.link,
            publisher,
            duration: r['agreement duration'] || r.duration || 'N/A',
            journalTitle: r['journal title'] || r.title || r.journal || '',
            openAccessStatus
          });
        });
        
        loadedSuccessfully = true;
      } catch(e) {
        console.warn('Failed to load transformative file', t.file, e);
      } finally {
        loadedCount++;
        document.getElementById('progressText').textContent = `Loading... ${loadedCount}/${totalToLoad}`;
      }
    }
    
    if (!loadedSuccessfully) {
      showError('Could not load external CSV files. Please click "Try Again" to reload.');
    } else {
      resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
    }
  }

  function findOffline(query) {
    const qNorm = normalizeTitle(query);
    const issnQuery = isISSN(query) ? normalizeISSN(query) : null;
    const flags = {};
    let foundInList = [];
    let foundISSN = null;
    let foundTitle = null;
    let foundPublisher = null;
    
    for (const [key, arr] of Object.entries(journalLists)) {
      if (key === 'removed') continue;
      flags[key] = false;
      
      for (const entry of arr) {
        const title = getJournalTitle(entry);
        const titleNorm = normalizeTitle(title);
        const issn = normalizeISSN(getJournalISSN(entry));
        const publisher = getJournalPublisher(entry);
        
        if (issnQuery && issn === issnQuery) {
          flags[key] = true;
          foundInList.push(key);
          foundISSN = getJournalISSN(entry);
          foundTitle = title;
          foundPublisher = publisher;
          break;
        }
        
        if (title && titleNorm === qNorm) {
          flags[key] = true;
          foundInList.push(key);
          foundISSN = getJournalISSN(entry);
          foundTitle = title;
          foundPublisher = publisher;
          break;
        }
        
        if (title && titleNorm.includes(qNorm) && qNorm.length > 3) {
          flags[key] = true;
          foundInList.push(key);
          foundISSN = getJournalISSN(entry);
          foundTitle = title;
          foundPublisher = publisher;
          break;
        }
      }
    }
    
    const foundIn = foundInList.join(', ') || 'Not found in accredited lists';
    
    return { 
      flags, 
      foundIn, 
      foundISSN: foundISSN || (isISSN(query) ? query : '—'),
      foundTitle: foundTitle || query,
      foundPublisher: foundPublisher || '—'
    };
  }

  function checkRemovedList(query) {
    const qNorm = normalizeTitle(query);
    const removedList = journalLists.removed || [];
    for (const entry of removedList) {
      if (normalizeTitle(getJournalTitle(entry)) === qNorm) return entry;
    }
    return null;
  }

  async function fetchCrossRefInfo(query) {
    if (!query || query === '—') return 'No query available for lookup';
    
    try {
      if (isISSN(query)) {
        const issn = normalizeISSN(query);
        const formatted = issn.length === 8 ? `${issn.slice(0,4)}-${issn.slice(4)}` : query;
        const response = await fetch(`https://api.crossref.org/journals/${formatted}`);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        if (data.status === 'ok' && data.message) {
          const j = data.message;
          let result = '';
          if (j.title) result += `<strong>Title:</strong> ${escapeHtml(j.title)}<br>`;
          if (j.publisher) result += `<strong>Publisher:</strong> ${escapeHtml(j.publisher)}<br>`;
          if (j['issn-type']?.length) result += `<strong>ISSN:</strong> ${j['issn-type'].map(i => i.value).join(', ')}<br>`;
          if (j.license?.length) result += `<strong>License:</strong> <a href="${j.license[0].URL}" target="_blank">${j.license[0]['content-version'] || 'View license'}</a><br>`;
          return result || 'No additional information available';
        }
      }
      
      const response = await fetch(`https://api.crossref.org/journals?query=${encodeURIComponent(query)}&rows=5`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      if (data.status === 'ok' && data.message.items?.length > 0) {
        const j = data.message.items[0];
        let result = '';
        if (j.title) result += `<strong>Title:</strong> ${escapeHtml(j.title)}<br>`;
        if (j.publisher) result += `<strong>Publisher:</strong> ${escapeHtml(j.publisher)}<br>`;
        if (j['issn-type']?.length) result += `<strong>ISSN:</strong> ${j['issn-type'].map(i => i.value).join(', ')}<br>`;
        if (j.license?.length) result += `<strong>License:</strong> <a href="${j.license[0].URL}" target="_blank">${j.license[0]['content-version'] || 'View license'}</a><br>`;
        return result || 'No additional information available';
      }
      return 'Journal not found in CrossRef';
    } catch (error) {
      return 'Error fetching data from CrossRef';
    }
  }

  async function fetchPubMedInfo(title) {
    if (!title || title === '—') return 'No title available for lookup';
    
    try {
      const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(title)}[Journal]&format=json`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      return data.hitCount > 0 
        ? `Approximately ${data.hitCount.toLocaleString()} articles from this journal indexed in Europe PMC (includes PubMed content)` 
        : 'No articles from this journal found in Europe PMC/PubMed';
    } catch (error) {
      return 'Error fetching data from Europe PMC/PubMed';
    }
  }

  function copyReportToClipboard() {
    if (!currentReportData) {
      alert('No report available to copy');
      return;
    }
    
    const { query, offlineHit, removedHit, crossrefInfo, pubmedInfo, transformativeMatch } = currentReportData;
    
    let reportText = `JOURNAL CREDIBILITY REPORT\n`;
    reportText += `================================\n\n`;
    reportText += `Journal Title: ${query}\n`;
    reportText += `ISSN: ${formatISSN(offlineHit.foundISSN)}\n\n`;
    
    reportText += `ACCREDITATION STATUS\n`;
    reportText += `====================\n`;
    
    const f = offlineHit.flags || {};
    const relevantLists = Object.entries(f)
      .filter(([_, v]) => v)
      .map(([k]) => k.toUpperCase());
    
    reportText += relevantLists.length 
      ? `Found in: ${relevantLists.join(', ')}\n` 
      : `Not found in any accredited lists\n`;
    
    if (removedHit) reportText += `WARNING: This journal was removed from the accredited list\n\n`;
    
    if (transformativeMatch) {
      reportText += `TRANSFORMATIVE AGREEMENT\n`;
      reportText += `========================\n`;
      reportText += `Journal: ${transformativeMatch.journalTitle || 'N/A'}\n`;
      reportText += `Publisher: ${transformativeMatch.publisher || 'N/A'}\n`;
      reportText += `Duration: ${transformativeMatch.duration || 'N/A'}\n`;
      reportText += `Open Access Status: ${transformativeMatch.openAccessStatus || 'Not specified'}\n`;
      reportText += `Agreement Link: ${transformativeMatch.agreementLink}\n\n`;
    }
    
    reportText += `LIVE LOOKUP RESULTS\n`;
    reportText += `===================\n`;
    reportText += `CrossRef: ${crossrefInfo.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '')}\n`;
    reportText += `PubMed: ${pubmedInfo}\n`;
    
    navigator.clipboard.writeText(reportText).then(() => {
      const btn = document.getElementById('copyReportTop');
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied to Clipboard!';
        setTimeout(() => btn.innerHTML = original, 2000);
      }
    }).catch(err => {
      alert('Failed to copy report to clipboard');
    });
  }

  function determineCredibilityStatus(offlineHit, transformativeMatch) {
    const dhetAccredited = offlineHit.flags.dhet || offlineHit.flags.dhet2;
    const otherAccredited = offlineHit.flags.doaj || offlineHit.flags.ibss || offlineHit.flags.scielo || offlineHit.flags.norwegian || offlineHit.flags.scopus || offlineHit.flags.wos;
    const isAccredited = dhetAccredited || otherAccredited;
    
    if (transformativeMatch && isAccredited) {
      return { status: 'Credible & Recommended!', class: 'status-verified', message: 'Credible & Recommended!' };
    } else if (transformativeMatch && !isAccredited) {
      return { status: 'Verify with your Librarian!', class: 'status-warning', message: 'Verify with your Librarian!' };
    } else if (isAccredited && !transformativeMatch) {
      return { status: 'Credible & Recommended!', class: 'status-verified', message: 'Credible & Recommended!' };
    } else if (!isAccredited && !transformativeMatch) {
      return { status: 'Questionable: You have been warned!', class: 'status-questionable', message: 'Questionable: You have been warned!' };
    } else {
      return { status: 'Unknown', class: 'status-danger', message: 'Unclear status' };
    }
  }

  function displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo) {
    let transformativeMatch = null;
    for (const t of transformativeList) {
      if (normalizeTitle(t.journalTitle || t.title || t['journal title']) === normalizeTitle(query)) {
        transformativeMatch = t;
        break;
      }
    }
    
    const credibility = determineCredibilityStatus(offlineHit, transformativeMatch);
    const statusClass = credibility.class;
    const statusText = credibility.message;
    
    let transformativeInfo = '<tr><td colspan="2">No transformative agreement found</td></tr>';
    if (transformativeMatch) {
      transformativeInfo = `
        <tr>
          <td class="info-label">Journal</td>
          <td>${escapeHtml(transformativeMatch.journalTitle || transformativeMatch.title || 'N/A')}</td>
        </tr>
        <tr>
          <td class="info-label">Publisher</td>
          <td>${escapeHtml(transformativeMatch.publisher || 'N/A')}</td>
        </tr>
        <tr>
          <td class="info-label">Duration</td>
          <td>${escapeHtml(transformativeMatch.duration || 'N/A')}</td>
        </tr>
        <tr>
          <td class="info-label">Open Access Status</td>
          <td>${escapeHtml(transformativeMatch.openAccessStatus)}</td>
        </tr>
        <tr>
          <td class="info-label">Agreement</td>
          <td><a href="${transformativeMatch.agreementLink}" target="_blank">View agreement details</a></td>
        </tr>
      `;
    }
    
    currentReportData = {
      query,
      offlineHit,
      removedHit,
      crossrefInfo,
      pubmedInfo,
      transformativeMatch
    };
    
    resultsContainer.innerHTML = `
      <div class="card-header">
        <h3>Credibility Results</h3>
        <button id="copyReportTop" class="copy-report-top">
          <i class="fas fa-copy"></i> Copy Report
        </button>
      </div>
      <div class="status-large ${statusClass}">${statusText}</div>
      <table class="report-table">
        <thead>
          <tr>
            <th colspan="2">Journal Information</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="info-label">Journal Title</td>
            <td>${escapeHtml(offlineHit.foundTitle)}</td>
          </tr>
          <tr>
            <td class="info-label">ISSN</td>
            <td>${escapeHtml(formatISSN(offlineHit.foundISSN))}</td>
          </tr>
        </tbody>
      </table>
      <table class="report-table">
        <thead>
          <tr>
            <th colspan="2">Accreditation Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="info-label">Listing/Indexing</td>
            <td>
              ${Object.entries(offlineHit.flags)
                .filter(([_, v]) => v)
                .map(([k]) => `<span class="accreditation-tag">${k.toUpperCase()}</span>`)
                .join(' ') || 'Not found in any accredited lists'}
            </td>
          </tr>
          ${removedHit ? `
          <tr>
            <td class="info-label">Removed Status</td>
            <td class="text-danger">
              <i class="fas fa-exclamation-triangle"></i> This journal was removed from the accredited list
            </td>
          </tr>
          ` : ''}
        </tbody>
      </table>
      <table class="report-table">
        <thead>
          <tr>
            <th colspan="2">Transformative Agreement</th>
          </tr>
        </thead>
        <tbody>
          ${transformativeInfo}
        </tbody>
      </table>
      <table class="report-table">
        <thead>
          <tr>
            <th colspan="2">Live Lookup Results</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="info-label">CrossRef Information</td>
            <td><div class="live-info">${crossrefInfo}</div></td>
          </tr>
          <tr>
            <td class="info-label">PubMed Information</td>
            <td><div class="live-info">${pubmedInfo}</div></td>
          </tr>
        </tbody>
      </table>
    `;
    
    document.getElementById('copyReportTop').addEventListener('click', copyReportToClipboard);
  }

  function displayRemovedJournals() {
    const removedList = journalLists.removed || [];
    if (removedList.length === 0) {
      resultsContainer.innerHTML = '<p>No removed journals data available or failed to load. Please try again.</p>';
      return;
    }
    
    const columns = Object.keys(removedList[0]).filter(col => 
      removedList.some(item => item[col] && item[col].toString().trim())
    );
    
    resultsContainer.innerHTML = `
      <h3>Journals Removed from Accredited List</h3>
      <p>Showing ${removedList.length} journals removed from the accredited list in past years.</p>
      <div class="table-container" style="max-height: 500px; overflow-y: auto;">
        <table class="report-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${removedList.map(journal => `
              <tr>
                ${columns.map(col => `<td>${escapeHtml(journal[col] || 'N/A')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    showRemovedBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Removed from Accredited List';
    isRemovedVisible = true;
  }

  copyRemovedBtn.addEventListener('click', () => {
    const removedList = journalLists.removed || [];
    if (removedList.length === 0) {
      alert('No removed journals data available to copy.');
      return;
    }
    
    const columns = Object.keys(removedList[0]).filter(col => 
      removedList.some(item => item[col] && item[col].toString().trim())
    );
    
    let csvContent = columns.join(',') + '\n';
    removedList.forEach(journal => {
      const row = columns.map(col => `"${journal[col]?.toString().replace(/"/g, '""') || ''}"`).join(',');
      csvContent += row + '\n';
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'removed_journals.csv';
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    const originalText = copyRemovedBtn.innerHTML;
    copyRemovedBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded CSV!';
    setTimeout(() => copyRemovedBtn.innerHTML = originalText, 2000);
  });

  searchBtn.addEventListener('click', async () => {
    const query = journalQuery.value.trim();
    if (!query) {
      alert('Please enter a journal title or ISSN');
      return;
    }
    
    showLoading('Searching for journal...');
    try {
      const offlineHit = findOffline(query);
      const removedHit = checkRemovedList(query);
      const [crossrefInfo, pubmedInfo] = await Promise.all([
        fetchCrossRefInfo(query),
        fetchPubMedInfo(query)
      ]);
      displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo);
    } catch (error) {
      showError('An error occurred during the search. Please try again.');
    }
  });

  showRemovedBtn.addEventListener('click', () => {
    if (isRemovedVisible) {
      resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
      showRemovedBtn.innerHTML = '<i class="fas fa-eye"></i> Show Removed from Accredited List';
      isRemovedVisible = false;
    } else {
      displayRemovedJournals();
    }
  });

  journalQuery.addEventListener('keypress', e => {
    if (e.key === 'Enter') searchBtn.click();
  });

  loadAllLists();
});
