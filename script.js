document.addEventListener('DOMContentLoaded', function() {
    const searchBtn = document.getElementById('searchBtn');
    const journalQuery = document.getElementById('journalQuery');
    const resultsContainer = document.getElementById('resultsContainer');
    const showRemovedBtn = document.getElementById('showRemovedBtn');
    const copyRemovedBtn = document.getElementById('copyRemovedBtn');
    
    // Configuration - using CORS proxy to bypass restrictions
    const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
    const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';
    
    // Accredited file names
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
    
    // Transformative agreements
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
    
    let journalLists = { dhet: [], dhet2: [], doaj: [], ibss: [], norwegian: [], scielo: [], scopus: [], wos: [], removed: [] };
    let transformativeList = [];
    
    // Utility functions
    function showLoading(msg) { 
        resultsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${msg}</p>
            </div>
        `;
    }
    
    function hideLoading() { 
        // Loading will be hidden when content is displayed
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
        
        // Add event listener to try again button
        document.getElementById('tryAgainBtn').addEventListener('click', function() {
            journalQuery.value = '';
            journalQuery.focus();
            loadAllLists();
        });
    }
    
    function normalizeTitle(t) { 
        return (t || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim(); 
    }
    
    function isISSN(s) { 
        return /\b\d{4}-?\d{3}[\dXx]\b/.test(s); 
    }
    
    function rawUrlFor(fname) { 
        return CORS_PROXY + RAW_BASE + encodeURIComponent(fname); 
    }
    
    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];
        
        // Detect delimiter (try comma first, then pipe)
        let delimiter = ',';
        if (lines[0].split('|').length > lines[0].split(',').length) {
            delimiter = '|';
        }
        
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
        
        return lines.slice(1).map(line => {
            // Handle quoted fields that might contain commas
            const parts = [];
            let inQuotes = false;
            let currentPart = '';
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === delimiter && !inQuotes) {
                    parts.push(currentPart.trim());
                    currentPart = '';
                } else {
                    currentPart += char;
                }
            }
            parts.push(currentPart.trim());
            
            const obj = {};
            headers.forEach((h, i) => { 
                // Remove quotes from field values
                obj[h] = (parts[i] || '').replace(/^"|"$/g, ''); 
            });
            return obj;
        });
    }
    
    // Smart field extraction based on header names
    function extractField(data, possibleFieldNames) {
        for (const field of possibleFieldNames) {
            if (data[field] !== undefined && data[field] !== '') {
                return data[field];
            }
        }
        return 'N/A';
    }
    
    // Load CSV files
    async function loadAllLists() {
        showLoading('Loading journal lists...');
        
        let loadedSuccessfully = false;
        let loadedCount = 0;
        const totalToLoad = Object.keys(FILENAMES).length + TRANSFORMATIVE_FILES.length;
        
        for (const [key, fname] of Object.entries(FILENAMES)) {
            try {
                const res = await fetch(rawUrlFor(fname));
                if (res.ok) {
                    const text = await res.text();
                    journalLists[key] = parseCSV(text);
                    loadedSuccessfully = true;
                    loadedCount++;
                    updateProgress(loadedCount, totalToLoad);
                    console.log(`Loaded ${key} with ${journalLists[key].length} entries`);
                    
                    // Special handling for removed journals file
                    if (key === 'removed' && journalLists[key].length > 0) {
                        console.log('Removed journals sample:', journalLists[key][0]);
                    }
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }
            } catch(e) { 
                console.warn('Failed loading', fname, e); 
                // Don't load sample data - just leave the array empty
                journalLists[key] = [];
                loadedCount++;
                updateProgress(loadedCount, totalToLoad);
            }
        }
        
        transformativeList = [];
        for (const t of TRANSFORMATIVE_FILES) {
            try {
                const res = await fetch(rawUrlFor(t.file));
                if (res.ok) {
                    const text = await res.text();
                    const rows = parseCSV(text);
                    rows.forEach(r => {
                        transformativeList.push({
                            ...r, 
                            link: t.link,
                            // Extract publisher information
                            publisher: extractField(r, ['publisher', 'publishers', 'publisher name', 'publisher_name']),
                            // Extract duration information
                            duration: extractField(r, ['agreement duration', 'duration', 'agreement_duration', 'agreement period', 'agreement_period']),
                            // Extract journal title
                            journal: extractField(r, ['journal title', 'journal', 'journal_title', 'title', 'journal name', 'journal_name'])
                        });
                    });
                    loadedSuccessfully = true;
                    console.log(`Loaded transformative file ${t.file} with ${rows.length} entries`);
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }
            } catch(e) { 
                console.warn('Failed loading transformative file', t.file, e); 
                // Don't add sample transformative data
            }
            loadedCount++;
            updateProgress(loadedCount, totalToLoad);
        }
        
        hideLoading();
        
        if (!loadedSuccessfully) {
            showError('Could not load external CSV files due to CORS restrictions. Please click "Try Again" to attempt reloading.');
        } else {
            resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
        }
    }
    
    function updateProgress(current, total) {
        const progressElement = document.getElementById('progressText');
        if (progressElement) {
            progressElement.textContent = `Loading... ${current}/${total} files`;
        }
    }
    
    // Enhanced search function to find journals across all CSV files
    function findOffline(query) {
        const qNorm = normalizeTitle(query);
        const issnQuery = isISSN(query) ? query.replace('-', '').toLowerCase() : null;
        const flags = {};
        let sample = null;
        let foundIn = '';
        
        console.log(`Searching for: ${query}, Normalized: ${qNorm}, ISSN: ${issnQuery}`);
        
        for (const [key, arr] of Object.entries(journalLists)) {
            if (key === 'removed') continue;
            
            flags[key] = false;
            
            for (const j of arr) {
                // Try multiple possible field names for title
                const title = j.title || j['journal title'] || j['journal'] || j.name || j['journal name'] || '';
                const titleNorm = normalizeTitle(title);
                
                // Try multiple possible field names for ISSN
                const issn = (j.issn || j['issn'] || j.eissn || j['e-issn'] || j['eissn'] || '').replace('-', '').toLowerCase();
                
                // Check if we have a match by ISSN
                if (issnQuery && issn === issnQuery) { 
                    flags[key] = true; 
                    sample = j;
                    foundIn = key;
                    console.log(`Found by ISSN in ${key}:`, j);
                    break; 
                }
                
                // Check if we have a match by title
                if (title && titleNorm === qNorm) { 
                    flags[key] = true; 
                    sample = j;
                    foundIn = key;
                    console.log(`Found by title in ${key}:`, j);
                    break; 
                }
                
                // Additional check: partial match for titles
                if (title && titleNorm.includes(qNorm) && qNorm.length > 3) {
                    flags[key] = true; 
                    if (!sample) { // Only set sample if not already found
                        sample = j;
                        foundIn = key;
                        console.log(`Found by partial title match in ${key}:`, j);
                    }
                }
            }
            
            // If we found a match in this list, break early for efficiency
            if (flags[key] && sample) {
                break;
            }
        }
        
        console.log('Search results:', { flags, sample, foundIn });
        return { flags, sample, foundIn };
    }
    
    function checkRemovedList(query) {
        const qNorm = normalizeTitle(query);
        const removedList = journalLists.removed || [];
        
        for (const j of removedList) {
            const title = j.title || j['journal title'] || j['journal'] || j.name || '';
            if (normalizeTitle(title) === qNorm) {
                return j;
            }
        }
        return null;
    }
    
    // Live API lookups
    async function fetchCrossRefInfo(issn) {
        if (!issn || issn === '—') {
            return 'No ISSN available for lookup';
        }
        
        try {
            const response = await fetch(`https://api.crossref.org/journals/${issn}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.status === 'ok' && data.message) {
                const journal = data.message;
                let result = '';
                
                if (journal.title) {
                    result += `Title: ${journal.title}<br>`;
                }
                
                if (journal.publisher) {
                    result += `Publisher: ${journal.publisher}<br>`;
                }
                
                if (journal.license && journal.license.length > 0) {
                    result += `License: <a href="${journal.license[0].URL}" target="_blank">${journal.license[0]['content-version'] || 'View license'}</a><br>`;
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
    
    async function fetchPubMedInfo(title) {
        if (!title || title === '—') {
            return 'No title available for lookup';
        }
        
        try {
            // Using a more reliable approach for PubMed data
            // Note: PubMed doesn't have a direct journal API, so we search for articles from the journal
            const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(title)}[Journal]&format=json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.hitCount && data.hitCount > 0) {
                return `Approximately ${data.hitCount} articles indexed in Europe PMC (including PubMed)`;
            } else {
                return 'No articles found in Europe PMC/PubMed';
            }
        } catch (error) {
            console.error('Error fetching PubMed data:', error);
            return 'Error fetching data from Europe PMC/PubMed';
        }
    }
    
    // Display functions
    function displayJournalData(data, offlineHit, removedHit, crossrefInfo, pubmedInfo) {
        // Determine status badge
        let statusBadge = '';
        let statusText = '';
        const f = offlineHit.flags || {};
        
        if (removedHit) {
            statusBadge = 'status-danger';
            statusText = 'Not Recommended (Removed)';
        } else if (f.dhet || f.dhet2 || f.scopus || f.wos) {
            statusBadge = 'status-verified';
            statusText = 'Recommended';
        } else if (f.doaj || f.ibss || f.scielo || f.norwegian) {
            statusBadge = 'status-warning';
            statusText = 'Verify Manually';
        } else {
            statusBadge = 'status-danger';
            statusText = 'Not Recommended';
        }
        
        // Check transformative agreements
        let transformativeInfo = 'No transformative agreement found';
        const transformativeMatch = transformativeList.find(t => {
            const tTitle = t.journal || t.title || t['journal title'] || '';
            return normalizeTitle(tTitle) === normalizeTitle(data.title || '');
        });
        
        if (transformativeMatch) {
            transformativeInfo = `
                <div class="transformative-info">
                    <h4>Transformative Agreement Found</h4>
                    <div class="transformative-details">
                        <div class="transformative-detail">
                            <strong>Journal:</strong> ${transformativeMatch.journal || transformativeMatch.title || 'N/A'}
                        </div>
                        <div class="transformative-detail">
                            <strong>Publisher:</strong> ${transformativeMatch.publisher || 'N/A'}
                        </div>
                        <div class="transformative-detail">
                            <strong>Duration:</strong> ${transformativeMatch.duration || 'N/A'}
                        </div>
                        <div class="transformative-detail">
                            <strong>Agreement:</strong> <a href="${transformativeMatch.link}" target="_blank">View agreement details</a>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Extract title from various possible field names
        const journalTitle = data.title || data['journal title'] || data['journal'] || data.name || 'N/A';
        const journalISSN = data.issn || data.ISSN || data.eissn || data['e-issn'] || 'N/A';
        const journalPublisher = data.publisher || data.Publisher || 'N/A';
        
        resultsContainer.innerHTML = `
            <table class="report-table">
                <thead>
                    <tr>
                        <th colspan="2">Journal Information</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="info-label">Journal Title</td>
                        <td>${journalTitle}</td>
                        <td rowspan="4"><span class="status-badge ${statusBadge}">${statusText}</span></td>
                    </tr>
                    <tr>
                        <td class="info-label">ISSN</td>
                        <td>${journalISSN}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Publisher</td>
                        <td>${journalPublisher}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Found In</td>
                        <td>${offlineHit.foundIn || Object.keys(f).filter(k => f[k]).join(', ') || 'Not found in accredited lists'}</td>
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
                        <td class="info-label">DHET</td>
                        <td><i class="fas fa-${f.dhet || f.dhet2 ? 'check-circle' : 'times-circle'}" style="color: ${f.dhet || f.dhet2 ? 'var(--success)' : 'var(--danger)'};"></i> ${f.dhet || f.dhet2 ? 'Found' : 'Not found'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Scopus</td>
                        <td><i class="fas fa-${f.scopus ? 'check-circle' : 'times-circle'}" style="color: ${f.scopus ? 'var(--success)' : 'var(--danger)'};"></i> ${f.scopus ? 'Found' : 'Not found'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Web of Science</td>
                        <td><i class="fas fa-${f.wos ? 'check-circle' : 'times-circle'}" style="color: ${f.wos ? 'var(--success)' : 'var(--danger)'};"></i> ${f.wos ? 'Found' : 'Not found'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">DOAJ</td>
                        <td><i class="fas fa-${f.doaj ? 'check-circle' : 'times-circle'}" style="color: ${f.doaj ? 'var(--success)' : 'var(--danger)'};"></i> ${f.doaj ? 'Found' : 'Not found'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">IBSS</td>
                        <td><i class="fas fa-${f.ibss ? 'check-circle' : 'times-circle'}" style="color: ${f.ibss ? 'var(--success)' : 'var(--danger)'};"></i> ${f.ibss ? 'Found' : 'Not found'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">SciELO</td>
                        <td><i class="fas fa-${f.scielo ? 'check-circle' : 'times-circle'}" style="color: ${f.scielo ? 'var(--success)' : 'var(--danger)'};"></i> ${f.scielo ? 'Found' : 'Not found'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Norwegian List</td>
                        <td><i class="fas fa-${f.norwegian ? 'check-circle' : 'times-circle'}" style="color: ${f.norwegian ? 'var(--success)' : 'var(--danger)'};"></i> ${f.norwegian ? 'Found' : 'Not found'}</td>
                    </tr>
                </tbody>
            </table>
            
            ${transformativeInfo}
            
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
    }
    
    function displayRemovedJournals() {
        const removedList = journalLists.removed || [];
        
        if (removedList.length === 0) {
            resultsContainer.innerHTML = '<p>No removed journals data available or failed to load. Please try again.</p>';
            return;
        }
        
        // Get all possible column names from the first item
        const firstItem = removedList[0];
        const columns = Object.keys(firstItem);
        
        // Filter out empty columns
        const nonEmptyColumns = columns.filter(col => {
            return removedList.some(item => item[col] && item[col].trim() !== '');
        });
        
        resultsContainer.innerHTML = `
            <h3>Journals Removed from Accredited List</h3>
            <p>Showing ${removedList.length} journals removed from the accredited list in past years.</p>
            <div class="table-container">
                <table class="report-table">
                    <thead>
                        <tr>
                            ${nonEmptyColumns.map(col => `<th>${col.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${removedList.map(journal => `
                            <tr>
                                ${nonEmptyColumns.map(col => `<td>${journal[col] || 'N/A'}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
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
            const hit = offlineHit.sample || { title: query };
            
            // Fetch live data
            const [crossrefInfo, pubmedInfo] = await Promise.all([
                fetchCrossRefInfo(hit.issn || hit.ISSN || hit.eissn),
                fetchPubMedInfo(hit.title || hit['journal title'] || hit['journal'] || hit.name || query)
            ]);
            
            hideLoading();
            displayJournalData(hit, offlineHit, removedHit, crossrefInfo, pubmedInfo);
        } catch (error) {
            console.error('Error during search:', error);
            showError('An error occurred during the search. Please try again.');
        }
    });
    
    showRemovedBtn.addEventListener('click', function() {
        displayRemovedJournals();
    });
    
    copyRemovedBtn.addEventListener('click', function() {
        const removedList = journalLists.removed || [];
        
        if (removedList.length === 0) {
            alert('No removed journals data available to copy.');
            return;
        }
        
        // Get all possible column names from the first item
        const firstItem = removedList[0];
        const columns = Object.keys(firstItem);
        
        // Filter out empty columns
        const nonEmptyColumns = columns.filter(col => {
            return removedList.some(item => item[col] && item[col].trim() !== '');
        });
        
        // Create CSV content
        let csvContent = nonEmptyColumns.join(',') + '\n';
        removedList.forEach(journal => {
            const row = nonEmptyColumns.map(col => {
                const value = journal[col] || '';
                // Handle values that might contain commas
                return `"${value.replace(/"/g, '""')}"`;
            }).join(',');
            csvContent += row + '\n';
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
    
    // Allow pressing Enter to search
    journalQuery.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchBtn.click();
        }
    });
    
    // Initialize the application
    loadAllLists();
});
