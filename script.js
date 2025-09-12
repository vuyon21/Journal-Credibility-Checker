document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const searchBtn = document.getElementById('searchBtn');
  const journalQuery = document.getElementById('journalQuery');
  const resultsContainer = document.getElementById('resultsContainer');
  const showRemovedBtn = document.getElementById('showRemovedBtn');
  const copyRemovedBtn = document.getElementById('copyRemovedBtn');
  
  // Configuration for data sources
  const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
  const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
  
  // Accredited journal list file names
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
  
  // Transformative agreements data files
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
  
  // Data storage for loaded journal lists
  let journalLists = {
    dhet: [],
    dhet2: [],
    doaj: [],
    ibss: [],
    norwegian: [],
    scielo: [],
    scopus: [],
    wos: [],
    removed: []
  };
  
  let transformativeList = [];
  let isRemovedVisible = false;
  let currentReportData = null; // Store current report data for copying
  
  // Utility function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Display loading state with message
  function showLoading(msg) {
    resultsContainer.innerHTML = 
      `<div class="loading">
        <div class="spinner"></div>
        <p>${msg}</p>
        <p id="progressText">Loading...</p>
      </div>`;
  }
  
  // Display error message with retry option
  function showError(msg) {
    resultsContainer.innerHTML = 
      `<div class="loading">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
        <p>${msg}</p>
        <button id="tryAgainBtn" style="margin-top: 15px;">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>`;
    
    document.getElementById('tryAgainBtn').addEventListener('click', function() {
      journalQuery.value = '';
      journalQuery.focus();
      loadAllLists();
    });
  }
  
  // Normalize text for comparison
  function normalizeTitle(t) {
    return (t || '').toLowerCase()
      .replace(/\uFEFF/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Format ISSN with hyphen after 4th digit
  function formatISSN(issn) {
    if (!issn || issn === '—') return '—';
    // Remove all non-numeric characters except X
    const cleanIssn = issn.replace(/[^0-9X]/g, '');
    // If we have exactly 8 digits, insert hyphen after 4th digit
    if (cleanIssn.length === 8) {
      return `${cleanIssn.slice(0, 4)}-${cleanIssn.slice(4)}`;
    }
    // Return original if not valid 8-digit format
    return issn;
  }
  
  // Normalize ISSN format (remove hyphens and other non-alphanumeric chars)
  function normalizeISSN(s) {
    if (!s) return '';
    return s.toString().toUpperCase().replace(/[^0-9X]/g, '');
  }
  
  // Check if string is a valid ISSN format
  function isISSN(s) {
    return /\b\d{4}-?\d{3}[\dXx]\b/i.test(s);
  }
  
  // Fetch with fallback (direct first, then CORS proxy)
  async function fetchWithFallback(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
      return res;
    } catch (err) {
      console.warn('Direct fetch failed, trying CORS proxy:', err);
      const res = await fetch(CORS_PROXY + url);
      if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
      return res;
    }
  }
  
  // Generate URL for CSV file
  function rawUrlFor(fname) {
    return RAW_BASE + encodeURIComponent(fname);
  }
  
  // Robust CSV parser
  function parseCSV(text) {
    if (!text) return [];
    text = text.replace(/^\uFEFF/, ''); // Remove BOM
    const lines = text.split(/\r?
/).filter(l => l.trim());
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
      
      // Only add row if it has content
      const hasContent = Object.values(obj).some(v => v);
      if (hasContent) rows.push(obj);
    }
    
    return rows;
  }
  
  // Get journal title from entry using various possible field names
  function getJournalTitle(entry) {
    const possibleTitleFields = [
      'title', 'journal title', 'journal', 'name', 'journal name', 
      'journal_title', 'publication title', 'publication_title'
    ];
    
    for (const field of possibleTitleFields) {
      if (entry[field] && entry[field].trim() !== '') {
        return entry[field].trim();
      }
    }
    
    return '';
  }
  
  // Get ISSN from entry using various possible field names
  function getJournalISSN(entry) {
    const possibleISSNFields = [
      'issn', 'eissn', 'e-issn', 'eissn', 'issn1', 'issn2', 
      'print issn', 'online issn', 'print_issn', 'online_issn'
    ];
    
    for (const field of possibleISSNFields) {
      if (entry[field] && entry[field].trim() !== '') {
        return entry[field].trim();
      }
    }
    
    return '';
  }
  
  // Get publisher from entry using various possible field names
  function getJournalPublisher(entry) {
    const possiblePublisherFields = [
      'publisher', 'publisher name', 'publisher_name', 'publisher-name',
      'publisher information', 'publisher_info', 'publisher-info',
      'published by', 'publishing company', 'publishing_company',
      'publisher information', 'publisher_information'
    ];
    
    for (const field of possiblePublisherFields) {
      if (entry[field] && entry[field].trim() !== '') {
        return entry[field].trim();
      }
    }
    
    return '—';
  }
  
  // Load all CSV files from GitHub
  async function loadAllLists() {
    showLoading('Loading journal lists...');
    let loadedSuccessfully = false;
    let loadedCount = 0;
    const totalToLoad = Object.keys(FILENAMES).length + TRANSFORMATIVE_FILES.length;
    
    // Load accredited journal lists
    for (const [key, fname] of Object.entries(FILENAMES)) {
      try {
        const url = rawUrlFor(fname);
        const res = await fetchWithFallback(url);
        const text = await res.text();
        journalLists[key] = parseCSV(text);
        loadedSuccessfully = true;
        
        // Debug: log first entry to understand CSV structure
        if (journalLists[key].length > 0) {
          console.log(`${key} first entry:`, journalLists[key][0]);
        }
      } catch(e) {
        console.warn('Failed to load', fname, e);
        journalLists[key] = [];
      } finally {
        loadedCount++;
        document.getElementById('progressText').textContent = `Loading... ${loadedCount}/${totalToLoad}`;
      }
    }
    
    // Load transformative agreements data
    transformativeList = [];
    for (const t of TRANSFORMATIVE_FILES) {
      try {
        const url = rawUrlFor(t.file);
        const res = await fetchWithFallback(url);
        const text = await res.text();
        const rows = parseCSV(text);
        
        rows.forEach(r => {
          // Extract publisher from multiple possible fields
          const publisher = r.publisher || r['publisher name'] || r['publisher_name'] || r['publisher-name'] || r['published by'] || 'Unknown';
          
          // Extract open access status from multiple possible fields
          const openAccessStatus = r['open access status'] || r['Open Access Status'] || r['open_access_status'] || r['oa_status'] || 'Not specified';
          
          transformativeList.push({
            ...r,
            agreementLink: t.link,
            publisher: publisher,
            duration: r['agreement duration'] || r.duration || 'N/A',
            journalTitle: r['journal title'] || r.title || r.journal || '',
            openAccessStatus: openAccessStatus
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
  
  // Search for journal across all loaded CSV files
  function findOffline(query) {
    const qNorm = normalizeTitle(query);
    const issnQuery = isISSN(query) ? normalizeISSN(query) : null;
    const flags = {};
    let foundInList = [];
    let foundISSN = null;
    let foundTitle = null;
    let foundPublisher = null;
    
    console.log(`Searching for: "${query}", Normalized: "${qNorm}", ISSN: ${issnQuery}`);
    
    // Search through all lists
    for (const [key, arr] of Object.entries(journalLists)) {
      if (key === 'removed') continue;
      
      flags[key] = false;
      
      for (const entry of arr) {
        const title = getJournalTitle(entry);
        const titleNorm = normalizeTitle(title);
        const issn = normalizeISSN(getJournalISSN(entry));
        const publisher = getJournalPublisher(entry);
        
        // Check for match by ISSN
        if (issnQuery && issn && issn === issnQuery) {
          flags[key] = true;
          foundInList.push(key);
          foundISSN = issn;
          foundTitle = title;
          foundPublisher = publisher;
          console.log(`Found by ISSN in ${key}:`, title, 'Publisher:', publisher);
          break;
        }
        
        // Check for match by exact title
        if (title && titleNorm === qNorm) {
          flags[key] = true;
          foundInList.push(key);
          foundISSN = issn;
          foundTitle = title;
          foundPublisher = publisher;
          console.log(`Found by title in ${key}:`, title, 'Publisher:', publisher);
          break;
        }
        
        // Check for partial title match (for longer queries)
        if (title && titleNorm.includes(qNorm) && qNorm.length > 3) {
          flags[key] = true;
          foundInList.push(key);
          foundISSN = issn;
          foundTitle = title;
          foundPublisher = publisher;
          console.log(`Found by partial title match in ${key}:`, title, 'Publisher:', publisher);
          break;
        }
      }
    }
    
    const foundIn = foundInList.join(', ') || 'Not found in accredited lists';
    console.log('Search results:', { flags, foundIn, foundISSN, foundTitle, foundPublisher });
    
    return { 
      flags, 
      foundIn, 
      foundISSN: foundISSN || (isISSN(query) ? normalizeISSN(query) : '—'),
      foundTitle: foundTitle || query,
      foundPublisher: foundPublisher || '—'
    };
  }
  
  // Check if journal is in removed list
  function checkRemovedList(query) {
    const qNorm = normalizeTitle(query);
    const removedList = journalLists.removed || [];
    
    for (const entry of removedList) {
      const title = getJournalTitle(entry);
      if (normalizeTitle(title) === qNorm) {
        return entry;
      }
    }
    
    return null;
  }
  
  // Fetch journal information from CrossRef API
  async function fetchCrossRefInfo(query) {
    if (!query || query === '—') {
      return 'No query available for lookup';
    }
    
    try {
      // Try to find by ISSN first
      if (isISSN(query)) {
        const issn = normalizeISSN(query);
        const formatted = issn.length === 8 ? `${issn.slice(0,4)}-${issn.slice(4)}` : query;
        
        const response = await fetch(`https://api.crossref.org/journals/${formatted}`);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status === 'ok' && data.message) {
          const journal = data.message;
          let result = '';
          
          if (journal.title) {
            result += `<strong>Title:</strong> ${escapeHtml(journal.title)}<br>`;
          }
          
          if (journal.publisher) {
            result += `<strong>Publisher:</strong> ${escapeHtml(journal.publisher)}<br>`;
          }
          
          if (journal['issn-type'] && journal['issn-type'].length > 0) {
            result += `<strong>ISSN:</strong> ${journal['issn-type'].map(issn => issn.value).join(', ')}<br>`;
          }
          
          if (journal.license && journal.license.length > 0) {
            result += `<strong>License:</strong> <a href="${journal.license[0].URL}" target="_blank">${journal.license[0]['content-version'] || 'View license'}</a><br>`;
          }
          
          return result || 'No additional information available';
        }
      }
      
      // If ISSN search failed or we have a title, try title search
      const response = await fetch(`https://api.crossref.org/journals?query=${encodeURIComponent(query)}&rows=5`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.status === 'ok' && data.message && data.message.items && data.message.items.length > 0) {
        const journal = data.message.items[0];
        let result = '';
        
        if (journal.title) {
          result += `<strong>Title:</strong> ${escapeHtml(journal.title)}<br>`;
        }
        
        if (journal.publisher) {
          result += `<strong>Publisher:</strong> ${escapeHtml(journal.publisher)}<br>`;
        }
        
        if (journal['issn-type'] && journal['issn-type'].length > 0) {
          result += `<strong>ISSN:</strong> ${journal['issn-type'].map(issn => issn.value).join(', ')}<br>`;
        }
        
        if (journal.license && journal.license.length > 0) {
          result += `<strong>License:</strong> <a href="${journal.license[0].URL}" target="_blank">${journal.license[0]['content-version'] || 'View license'}</a><br>`;
        }
        
        return result || 'No additional information available';
      } else {
        return 'Journal not found in CrossRef';
      }
    } catch (error) {
      console.error('Error fetching CrossRef data:', error);
      return 'Error fetching data from CrossRef';
    }
  }
  
  // Fetch journal presence information from Europe PMC (includes PubMed data)
  async function fetchPubMedInfo(title) {
    if (!title || title === '—') {
      return 'No title available for lookup';
    }
    
    try {
      const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(title)}[Journal]&format=json`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.hitCount && data.hitCount > 0) {
        return `Approximately ${data.hitCount.toLocaleString()} articles from this journal indexed in Europe PMC (includes PubMed content)`;
      } else {
        return 'No articles from this journal found in Europe PMC/PubMed';
      }
    } catch (error) {
      console.error('Error fetching Europe PMC data:', error);
      return 'Error fetching data from Europe PMC/PubMed';
    }
  }
  
  // Copy current report to clipboard
  function copyReportToClipboard() {
    if (!currentReportData) {
      alert('No report available to copy');
      return;
    }
    
    const { query, offlineHit, removedHit, crossrefInfo, pubmedInfo, transformativeMatch } = currentReportData;
    
    // Create a text version of the report
    let reportText = `JOURNAL CREDIBILITY REPORT
`;
    reportText += `================================
`;
    reportText += `Journal Title: ${query}
`;
    reportText += `ISSN: ${formatISSN(offlineHit.foundISSN)}
`;
    reportText += `Found In: ${offlineHit.foundIn}
`;
    reportText += `ACCREDITATION STATUS
`;
    reportText += `====================
`;
    
    // Only show relevant accreditation statuses
    const f = offlineHit.flags || {};
    const relevantLists = Object.entries(f)
      .filter(([key, value]) => value)
      .map(([key]) => key.toUpperCase());
    
    if (relevantLists.length > 0) {
      reportText += `Found in: ${relevantLists.join(', ')}
`;
    } else {
      reportText += `Not found in any accredited lists
`;
    }
    
    if (removedHit) {
      reportText += `WARNING: This journal was removed from the accredited list
`;
    }
    
    if (transformativeMatch) {
      reportText += `TRANSFORMATIVE AGREEMENT
`;
      reportText += `========================
`;
      reportText += `Journal: ${transformativeMatch.journalTitle || transformativeMatch.title || 'N/A'}
`;
      reportText += `Publisher: ${transformativeMatch.publisher || 'N/A'}
`;
      reportText += `Duration: ${transformativeMatch.duration || 'N/A'}
`;
      reportText += `Open Access Status: ${transformativeMatch.openAccessStatus || 'Not specified'}
`;
      reportText += `Agreement Link: ${transformativeMatch.agreementLink}
`;
    }
    
    reportText += `LIVE LOOKUP RESULTS
`;
    reportText += `==================
`;
    reportText += `CrossRef: ${crossrefInfo.replace(/<br>/g, '
').replace(/<[^>]*>/g, '')}
`;
    reportText += `PubMed: ${pubmedInfo}
`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(reportText).then(() => {
      // Show confirmation
      const copyBtn = document.getElementById('copyReportTop');
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied to Clipboard!';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('Failed to copy report to clipboard');
    });
  }
  
  // Display journal data and credibility assessment
  function displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo) {
    // Determine credibility status
    let statusClass = '';
    let statusText = '';
    const f = offlineHit.flags || {};
    
    if (removedHit) {
      statusClass = 'status-danger';
      statusText = 'Questionable (Removed)';
    } else if (f.dhet || f.dhet2 || f.scopus || f.wos) {
      statusClass = 'status-verified';
      statusText = 'Credible';
    } else if (f.doaj || f.ibss || f.scielo || f.norwegian) {
      statusClass = 'status-warning';
      statusText = 'Verify Manually';
    } else {
      statusClass = 'status-danger';
      statusText = 'Questionable';
    }
    
    // Check for transformative agreements
    let transformativeMatch = null;
    let transformativeInfo = '<tr><td colspan="2">No transformative agreement found</td></tr>';
    
    for (const t of transformativeList) {
      const tTitle = t.journalTitle || t.title || t['journal title'] || '';
      if (normalizeTitle(tTitle) === normalizeTitle(query)) {
        transformativeMatch = t;
        break;
      }
    }
    
    if (transformativeMatch) {
      transformativeInfo = 
        `<tr>
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
          <td>${escapeHtml(transformativeMatch.openAccessStatus || 'Not specified')}</td>
        </tr>
        <tr>
          <td class="info-label">Agreement</td>
          <td><a href="${transformativeMatch.agreementLink}" target="_blank">View agreement details</a></td>
        </tr>`;
    }
    
    // Store current report data for copying
    currentReportData = {
      query,
      offlineHit,
      removedHit,
      crossrefInfo,
      pubmedInfo,
      transformativeMatch
    };
    
    // Build results HTML
    resultsContainer.innerHTML = 
      `<div class="card-header">
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
          <tr>
            <td class="info-label">Publisher</td>
            <td>${escapeHtml(offlineHit.foundPublisher)}</td>
          </tr>
          <tr>
            <td class="info-label">Found In</td>
            <td>${escapeHtml(offlineHit.foundIn)}</td>
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
              ${Object.entries(f)
                .filter(([key, value]) => value)
                .map(([key]) => `<span class="accreditation-tag">${key.toUpperCase()}</span>`)
                .join(' ') || 'Not found in any accredited lists'}
            </td>
          </tr>
          ${removedHit ? 
          `<tr>
            <td class="info-label">Removed Status</td>
            <td class="text-danger">
              <i class="fas fa-exclamation-triangle"></i> This journal was removed from the accredited list
            </td>
          </tr>`
           : ''}
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
      </table>`;
    
    // Add event listener for the copy report button
    document.getElementById('copyReportTop').addEventListener('click', copyReportToClipboard);
  }
  
  // Display removed journals list
  function displayRemovedJournals() {
    const removedList = journalLists.removed || [];
    
    if (removedList.length === 0) {
      resultsContainer.innerHTML = '<p>No removed journals data available or failed to load. Please try again.</p>';
      return;
    }
    
    // Get column names from first entry
    const columns = Object.keys(removedList[0]).filter(col => 
      removedList.some(item => item[col] && item[col].toString().trim() !== '')
    );
    
    resultsContainer.innerHTML = 
      `<h3>Journals Removed from Accredited List</h3>
      <p>Showing ${removedList.length} journals removed from the accredited list in past years.</p>
      <div class="table-container" style="max-height: 500px; overflow-y: auto;">
        <table class="report-table">
          <thead>
            <tr>
              ${columns.map(col => `<th>${col.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${removedList.map(journal => 
              `<tr>
                ${columns.map(col => `<td>${escapeHtml(journal[col] || 'N/A')}</td>`).join('')}
              </tr>`
            ).join('')}
          </tbody>
        </table>
      </div>`;
    
    showRemovedBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Removed from Accredited List';
    isRemovedVisible = true;
  }
  
  // Copy removed journals list as CSV
  copyRemovedBtn.addEventListener('click', function() {
    const removedList = journalLists.removed || [];
    
    if (removedList.length === 0) {
      alert('No removed journals data available to copy.');
      return;
    }
    
    // Get column names
    const columns = Object.keys(removedList[0]).filter(col => 
      removedList.some(item => item[col] && item[col].toString().trim() !== '')
    );
    
    // Create CSV content
    let csvContent = columns.join(',') + '
';
    
    removedList.forEach(journal => {
      const row = columns.map(col => {
        const value = journal[col] || '';
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',');
      csvContent += row + '
';
    });
    
    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'removed_journals.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show confirmation
    const originalText = copyRemovedBtn.innerHTML;
    copyRemovedBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded CSV!';
    setTimeout(() => {
      copyRemovedBtn.innerHTML = originalText;
    }, 2000);
  });
  
  // Event handlers
  searchBtn.addEventListener('click', async function() {
    const query = journalQuery.value.trim();
    
    if (query === '') {
      alert('Please enter a journal title or ISSN');
      return;
    }
    
    showLoading('Searching for journal...');
    
    try {
      const offlineHit = findOffline(query);
      const removedHit = checkRemovedList(query);
      
      // Fetch live data
      const [crossrefInfo, pubmedInfo] = await Promise.all([
        fetchCrossRefInfo(query),
        fetchPubMedInfo(query)
      ]);
      
      displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo);
    } catch (error) {
      console.error('Error during search:', error);
      showError('An error occurred during the search. Please try again.');
    }
  });
  
  showRemovedBtn.addEventListener('click', function() {
    if (isRemovedVisible) {
      resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
      showRemovedBtn.innerHTML = '<i class="fas fa-eye"></i> Show Removed from Accredited List';
      isRemovedVisible = false;
    } else {
      displayRemovedJournals();
    }
  });
  
  // Allow pressing Enter to search
  journalQuery.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchBtn.click();
    }
  });
  
  // Initialize the application
  loadAllLists();
});
