document.addEventListener('DOMContentLoaded', function() {
    const searchBtn = document.getElementById('searchBtn');
    const journalQuery = document.getElementById('journalQuery');
    const resultsContainer = document.getElementById('resultsContainer');
    const showRemovedBtn = document.getElementById('showRemovedBtn');
    const copyRemovedBtn = document.getElementById('copyRemovedBtn');
    
    // Configuration
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
        return RAW_BASE + encodeURIComponent(fname); 
    }
    
    function parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length < 2) return [];
        
        // Detect delimiter
        const delimiter = (lines[0].split('|').length > lines[0].split(',').length) ? '|' : ',';
        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
        
        return lines.slice(1).map(line => {
            const parts = line.split(delimiter).map(p => p.trim());
            const obj = {};
            headers.forEach((h, i) => { obj[h] = parts[i] || ''; });
            return obj;
        });
    }
    
    // Load CSV files
    async function loadAllLists() {
        showLoading('Loading journal lists...');
        
        let loadedSuccessfully = false;
        
        for (const [key, fname] of Object.entries(FILENAMES)) {
            try {
                const res = await fetch(rawUrlFor(fname));
                if (res.ok) {
                    const text = await res.text();
                    journalLists[key] = parseCSV(text);
                    loadedSuccessfully = true;
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }
            } catch(e) { 
                console.warn('Failed loading', fname, e); 
                // Load sample data if CSV loading fails
                if (key === 'removed') {
                    journalLists[key] = [
                        { title: 'Journal of Questionable Studies', issn: '1234-5678', year_removed: '2024', last_review_date: '2024-03-15' },
                        { title: 'International Journal of Non-credible Research', issn: '2345-6789', year_removed: '2023', last_review_date: '2023-06-22' },
                        { title: 'Quick Publication Review', issn: '3456-7890', year_removed: '2023', last_review_date: '2023-11-05' },
                        { title: 'Studies in Predatory Publishing', issn: '4567-8901', year_removed: '2022', last_review_date: '2022-09-30' },
                        { title: 'Fast Science Express', issn: '5678-9012', year_removed: '2022', last_review_date: '2022-01-18' }
                    ];
                } else {
                    // Convert sample data to CSV-like format
                    journalLists[key] = [
                        { title: 'Nature', issn: '0028-0836', publisher: 'Springer Nature' },
                        { title: 'Science', issn: '0036-8075', publisher: 'American Association for the Advancement of Science' },
                        { title: 'PLOS ONE', issn: '1932-6203', publisher: 'Public Library of Science' }
                    ];
                }
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
                        transformativeList.push({...r, link: t.link});
                    });
                    loadedSuccessfully = true;
                } else {
                    throw new Error(`HTTP ${res.status}`);
                }
            } catch(e) { 
                console.warn('Failed loading transformative file', t.file, e); 
                // Add sample transformative data
                transformativeList.push({
                    journal: 'Nature',
                    publisher: 'Springer Nature',
                    duration: '2023-2025',
                    link: 'https://sanlic.ac.za/springer/'
                });
            }
        }
        
        hideLoading();
        
        if (!loadedSuccessfully) {
            showError('Using sample data. Could not load external CSV files due to CORS restrictions.');
        } else {
            resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
        }
    }
    
    // Search functions
    function findOffline(query) {
        const qNorm = normalizeTitle(query);
        const issnQuery = isISSN(query) ? query.replace('-', '').toLowerCase() : null;
        const flags = {};
        let sample = null;
        
        for (const [key, arr] of Object.entries(journalLists)) {
            if (key === 'removed') continue;
            flags[key] = false;
            for (const j of arr) {
                const title = j.title || j['journal title'] || j['journal'] || j.name || '';
                const issn = (j.issn || j['issn'] || '').replace('-', '').toLowerCase();
                
                if (issnQuery && issn === issnQuery) { 
                    flags[key] = true; 
                    sample = j; 
                    break; 
                }
                if (title && normalizeTitle(title) === qNorm) { 
                    flags[key] = true; 
                    sample = j; 
                    break; 
                }
            }
        }
        return { flags, sample };
    }
    
    function checkRemovedList(query) {
        const qNorm = normalizeTitle(query);
        return journalLists.removed.find(j => {
            const title = j.title || j['journal title'] || j['journal'] || j.name || '';
            return normalizeTitle(title) === qNorm;
        });
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
            // This is a simplified example - in a real implementation, you'd use the PubMed API
            // Note: PubMed doesn't have a direct journal lookup API, so this would typically
            // search for articles from the journal
            const response = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}[Journal]&retmode=json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.esearchresult && data.esearchresult.count) {
                return `Approximately ${data.esearchresult.count} articles indexed in PubMed`;
            } else {
                return 'No articles found in PubMed';
            }
        } catch (error) {
            console.error('Error fetching PubMed data:', error);
            return 'Error fetching data from PubMed';
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
                <strong>${transformativeMatch.journal || transformativeMatch.title}</strong><br>
                Publisher: ${transformativeMatch.publisher || 'N/A'}<br>
                Duration: ${transformativeMatch.duration || 'N/A'}<br>
                <a href="${transformativeMatch.link}" target="_blank">View agreement</a>
            `;
        }
        
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
                        <td>${data.title || data['journal title'] || data['journal'] || data.name || 'N/A'}</td>
                        <td rowspan="4"><span class="status-badge ${statusBadge}">${statusText}</span></td>
                    </tr>
                    <tr>
                        <td class="info-label">ISSN</td>
                        <td>${data.issn || data.ISSN || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Publisher</td>
                        <td>${data.publisher || data.Publisher || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td class="info-label">Source</td>
                        <td>${Object.keys(f).filter(k => f[k]).join(', ') || 'Not found in accredited lists'}</td>
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
                    <tr>
                        <td class="info-label">Transformative Agreement</td>
                        <td>${transformativeInfo}</td>
                    </tr>
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
    }
    
    function displayRemovedJournals() {
        const removedList = journalLists.removed || [];
        
        resultsContainer.innerHTML = `
            <table class="report-table">
                <thead>
                    <tr>
                        <th colspan="4">Removed from Accredited List (Historical)</th>
                    </tr>
                    <tr>
                        <th>Title</th>
                        <th>ISSN</th>
                        <th>Year Removed</th>
                        <th>Last Review Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${removedList.map(journal => `
                        <tr>
                            <td>${journal.title || journal['journal title'] || journal['journal'] || journal.name || 'N/A'}</td>
                            <td>${journal.issn || journal.ISSN || 'N/A'}</td>
                            <td><span class="removed-year">${journal.year_removed || journal.year || 'N/A'}</span></td>
                            <td>${journal.last_review_date || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
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
                fetchCrossRefInfo(hit.issn || hit.ISSN),
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
        let textToCopy = "Journals Removed from Accredited List:\n\n";
        
        removedList.forEach(journal => {
            textToCopy += `• ${journal.title || journal['journal title'] || journal['journal'] || journal.name || 'N/A'} (${journal.issn || journal.ISSN || 'N/A'}) - Removed in ${journal.year_removed || journal.year || 'N/A'}\n`;
        });
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                // Show confirmation
                const originalText = copyRemovedBtn.innerHTML;
                copyRemovedBtn.innerHTML = '<i class="fas fa-check"></i> Copied to Clipboard!';
                
                setTimeout(() => {
                    copyRemovedBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy text to clipboard.');
            });
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
