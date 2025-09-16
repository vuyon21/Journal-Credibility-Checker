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

    // Full source names with acronyms
    const fullSourceNames = {
        dhet: 'Department of Higher Education and Training (South African Journal List / DHET)',
        dhet2: 'Department of Higher Education and Training (South African Journal List / DHET)',
        doaj: 'Directory of Open Access Journals (DOAJ)',
        ibss: 'International Bibliography of the Social Sciences (IBSS)',
        norwegian: 'Norwegian Register for Scientific Journals, Series and Publishers (Norwegian)',
        scielo: 'Scientific Electronic Library Online – South Africa / SciELO SA)',
        scopus: 'Scopus (Elsevier\'s abstract and citation database / Scopus)',
        wos: 'Web of Science (Clarivate Analytics / WOS)'
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

    // --- Utility Functions ---
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
        t = t.replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        return t;
    }

    function formatISSN(issn) {
        if (!issn || issn === '—') return '—';
        const clean = issn.toString().replace(/[^0-9X]/g, '');
        if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
        return issn;
    }

    function normalizeISSN(s) {
        if (!s) return '';
        return s.toString().toUpperCase().replace(/[^0-9X]/g, '');
    }

    function isISSN(s) {
        return /^\d{4}-?\d{3}[\dXx]$/.test(s);
    }

    async function fetchWithFallback(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Direct fetch failed: ${res.status}`);
            return res;
        } catch (err) {
            console.warn('Trying CORS proxy:', err);
            const res = await fetch(CORS_PROXY + url);
            if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
            return res;
        }
    }

    function rawUrlFor(fname) {
        return RAW_BASE + encodeURIComponent(fname);
    }

    // --- ROBUST CSV PARSER THAT HANDLES QUOTED FIELDS ---
    function parseCSV(text, filename) {
        if (!text) return [];

        text = text.replace(/^\uFEFF/, ''); // Remove BOM
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return [];

        // Special handling for removed journals
        if (filename === 'JOURNALS REMOVED IN PAST YEARS.csv') {
            return parseRemovedJournals(text);
        }

        // Detect delimiter
        const headerLine = lines[0];
        const commaCount = (headerLine.match(/,/g) || []).length;
        const pipeCount = (headerLine.match(/\|/g) || []).length;
        const tabCount = (headerLine.match(/\t/g) || []).length;
        const delimiter = tabCount > commaCount ? '\t' : (pipeCount > commaCount ? '|' : ',');

        // Parse headers
        const headers = splitCSVLine(headerLine, delimiter).map(h => h.trim().toLowerCase());

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = splitCSVLine(line, delimiter);
            const obj = {};

            // Assign to headers
            headers.forEach((h, j) => {
                obj[h] = parts[j] || '';
            });

            // Auto-detect ISSN from any field using regex
            const validISSNMatch = Object.values(obj)
                .find(v => /^\d{4}-?\d{3}[\dXx]$/i.test(v));
            if (validISSNMatch) {
                const clean = validISSNMatch.replace(/[^0-9X]/g, '');
                if (clean.length === 8 || (clean.length === 9 && clean.endsWith('X'))) {
                    obj.issn = clean.length === 8 ? `${clean.slice(0,4)}-${clean.slice(4)}` : validISSNMatch;
                }
            }

            if (Object.values(obj).some(v => v)) rows.push(obj);
        }

        return rows;
    }

    // Splits CSV respecting quotes and escaped quotes
    function splitCSVLine(line, delimiter = ',') {
        const parts = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === '"') {
                if (inQuotes && line[i+1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === delimiter && !inQuotes) {
                parts.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        parts.push(current);
        return parts.map(p => p.trim().replace(/^"|"$/g, ''));
    }

    // Custom parser for removed journals file
    function parseRemovedJournals(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const result = [];
        let currentSection = '';

        for (const line of lines) {
            if (line.startsWith('JOURNALS REMOVED IN')) {
                currentSection = line;
            } else if (line.includes('JOURNAL TITLE') || line.includes('EDITOR\'S DETAILS') || !line) {
                continue;
            } else {
                const parts = line.split(/\s{4,}/);
                if (parts.length >= 1) {
                    result.push({
                        section: currentSection,
                        journal_title: parts[0].trim(),
                        editor_details: parts[1] ? parts[1].trim() : ''
                    });
                }
            }
        }
        return result;
    }

    // Extract best guess for key fields
    function getJournalTitle(entry) {
        const fields = ['title', 'journal title', 'journal', 'name', 'publication title'];
        for (const f of fields) {
            if (entry[f] && entry[f].toString().trim()) return entry[f].toString().trim();
        }
        return '';
    }

    function getJournalISSN(entry) {
        // Use pre-normalized 'issn' if available
        if (entry.issn && isISSN(entry.issn)) return entry.issn;

        // Otherwise scan all fields for ISSN pattern
        for (const [key, val] of Object.entries(entry)) {
            if (isISSN(val)) return formatISSN(val);
        }
        return '—';
    }

    function getJournalPublisher(entry) {
        const fields = ['publisher', 'published by', 'publishing company'];
        for (const f of fields) {
            if (entry[f] && entry[f].toString().trim()) return entry[f].toString().trim();
        }
        return '—';
    }

    // --- Load All Lists ---
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
                journalLists[key] = parseCSV(text, fname);
                loadedSuccessfully = true;
            } catch (e) {
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
                const rows = parseCSV(text, t.file);
                rows.forEach(r => {
                    transformativeList.push({
                        ...r,
                        agreementLink: t.link,
                        publisher: getJournalPublisher(r),
                        duration: r['agreement duration'] || r.duration || 'N/A',
                        journalTitle: getJournalTitle(r),
                        openAccessStatus: r['open access status'] || 'Not specified'
                    });
                });
                loadedSuccessfully = true;
            } catch (e) {
                console.warn('Failed to load transformative file', t.file, e);
            } finally {
                loadedCount++;
                document.getElementById('progressText').textContent = `Loading... ${loadedCount}/${totalToLoad}`;
            }
        }

        if (!loadedSuccessfully) {
            showError('Could not load external CSV files.');
        } else {
            resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
        }
    }

    // --- Search Logic ---
    function findOffline(query) {
        const qNorm = normalizeTitle(query);
        const issnQuery = isISSN(query) ? normalizeISSN(query) : null;
        const flags = {};
        let foundISSN = '—';
        let foundTitle = query;
        let foundPublisher = '—';

        for (const [key, arr] of Object.entries(journalLists)) {
            if (key === 'removed') continue;
            flags[key] = false;

            for (const entry of arr) {
                const title = getJournalTitle(entry);
                const titleNorm = normalizeTitle(title);
                const issn = normalizeISSN(getJournalISSN(entry));

                // Match by ISSN
                if (issnQuery && issn === issnQuery) {
                    flags[key] = true;
                    foundISSN = getJournalISSN(entry);
                    foundTitle = title;
                    foundPublisher = getJournalPublisher(entry);
                    break;
                }

                // Exact match
                if (title && titleNorm === qNorm) {
                    flags[key] = true;
                    foundISSN = getJournalISSN(entry);
                    foundTitle = title;
                    foundPublisher = getJournalPublisher(entry);
                    break;
                }

                // Partial match
                if (title && titleNorm.includes(qNorm) && qNorm.length > 3) {
                    flags[key] = true;
                    foundISSN = getJournalISSN(entry);
                    foundTitle = title;
                    foundPublisher = getJournalPublisher(entry);
                    break;
                }
            }
        }

        const foundIn = Object.keys(flags).filter(k => flags[k])
            .map(k => fullSourceNames[k] || k.toUpperCase())
            .join(', ') || 'Not found in accredited lists';

        return { flags, foundIn, foundISSN, foundTitle, foundPublisher };
    }

    function checkRemovedList(query) {
        const qNorm = normalizeTitle(query);
        const removed = journalLists.removed || [];
        for (const r of removed) {
            if (normalizeTitle(r.journal_title) === qNorm) return r;
        }
        return null;
    }

    // --- Live API Lookups ---
    async function fetchCrossRefInfo(query) {
        if (!query || query === '—') return 'No query available for lookup';
        try {
            if (isISSN(query)) {
                const formatted = normalizeISSN(query).replace(/(.{4})$/, '-$1');
                const res = await fetch(`https://api.crossref.org/journals/${formatted}`);
                if (res.ok) {
                    const data = await res.json();
                    const j = data.message;
                    return `<strong>Title:</strong> ${j.title}<br><strong>Publisher:</strong> ${j.publisher}`;
                }
            }
            const res = await fetch(`https://api.crossref.org/journals?query=${encodeURIComponent(query)}&rows=1`);
            if (res.ok) {
                const data = await res.json();
                if (data.message.items?.length) {
                    const j = data.message.items[0];
                    return `<strong>Title:</strong> ${j.title}<br><strong>Publisher:</strong> ${j.publisher}`;
                }
            }
            return 'Not found in CrossRef';
        } catch (e) {
            return 'Error fetching CrossRef data';
        }
    }

    async function fetchPubMedInfo(title) {
        if (!title || title === '—') return 'No title available for lookup';
        try {
            const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(title)}[Journal]&format=json`);
            const data = await res.json();
            return data.hitCount > 0 
                ? `Approximately ${data.hitCount.toLocaleString()} articles indexed in Europe PMC (includes PubMed)` 
                : 'No articles found';
        } catch (e) {
            return 'Error fetching PubMed data';
        }
    }

    // --- Display Results ---
    function determineCredibilityStatus(offlineHit, transformativeMatch) {
        const dhetAccredited = offlineHit.flags.dhet || offlineHit.flags.dhet2;
        const otherAccredited = Object.values(offlineHit.flags).some(v => v);
        const isAccredited = dhetAccredited || otherAccredited;

        if (transformativeMatch && isAccredited) {
            return { status: 'Credible & Recommended!', class: 'status-verified' };
        } else if (transformativeMatch && !isAccredited) {
            return { status: 'Verify with your Librarian!', class: 'status-warning' };
        } else if (isAccredited) {
            return { status: 'Credible & Recommended!', class: 'status-verified' };
        } else {
            return { status: 'Questionable: You have been warned!', class: 'status-questionable' };
        }
    }

    function displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo) {
        let transformativeMatch = null;
        for (const t of transformativeList) {
            if (normalizeTitle(t.journalTitle) === normalizeTitle(query)) {
                transformativeMatch = t;
                break;
            }
        }

        const credibility = determineCredibilityStatus(offlineHit, transformativeMatch);
        const accreditationList = Object.entries(offlineHit.flags)
            .filter(([_, v]) => v)
            .map(([k]) => `<li>${fullSourceNames[k] || k.toUpperCase()}</li>`)
            .join('');

        currentReportData = { query, offlineHit, removedHit, crossrefInfo, pubmedInfo, transformativeMatch };

        resultsContainer.innerHTML = `
            <div class="card-header">
                <h3>Credibility Results</h3>
                <button id="copyReportTop" class="copy-report-top"><i class="fas fa-copy"></i> Copy Report</button>
            </div>
            <div class="status-large ${credibility.class}">${credibility.status}</div>
            <table class="report-table">
                <thead><tr><th colspan="2">Journal Information</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">Journal Title</td><td>${escapeHtml(offlineHit.foundTitle)}</td></tr>
                    <tr><td class="info-label">ISSN</td><td>${escapeHtml(offlineHit.foundISSN)}</td></tr>
                </tbody>
            </table>
            <table class="report-table">
                <thead><tr><th colspan="2">DHET-Accredited Indexing Sources</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">Listing/Indexing</td><td>${accreditationList ? `<ul class="accreditation-list">${accreditationList}</ul>` : 'Not found'}</td></tr>
                    ${removedHit ? `<tr><td class="info-label">Removed Status</td><td class="text-danger"><i class="fas fa-exclamation-triangle"></i> Removed from accredited list</td></tr>` : ''}
                </tbody>
            </table>
            <table class="report-table">
                <thead><tr><th colspan="2">Transformative Agreement</th></tr></thead>
                <tbody>
                    ${transformativeMatch ? `
                    <tr><td class="info-label">Journal</td><td>${escapeHtml(transformativeMatch.journalTitle || 'N/A')}</td></tr>
                    <tr><td class="info-label">Publisher</td><td>${escapeHtml(transformativeMatch.publisher || 'N/A')}</td></tr>
                    <tr><td class="info-label">Duration</td><td>${escapeHtml(transformativeMatch.duration || 'N/A')}</td></tr>
                    <tr><td class="info-label">Open Access Status</td><td>${escapeHtml(transformativeMatch.openAccessStatus)}</td></tr>
                    <tr><td class="info-label">Agreement</td><td><a href="${transformativeMatch.agreementLink}" target="_blank">View agreement details</a></td></tr>
                    ` : '<tr><td colspan="2">No transformative agreement found</td></tr>'}
                </tbody>
            </table>
            <table class="report-table">
                <thead><tr><th colspan="2">Live Lookup Results</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">CrossRef Information</td><td><div class="live-info">${crossrefInfo}</div></td></tr>
                    <tr><td class="info-label">PubMed Information</td><td><div class="live-info">${pubmedInfo}</div></td></tr>
                </tbody>
            </table>
        `;

        document.getElementById('copyReportTop').addEventListener('click', copyReportToClipboard);
    }

    // --- Removed Journals UI ---
    function displayRemovedJournals() {
        const removed = journalLists.removed || [];
        if (removed.length === 0) {
            resultsContainer.innerHTML = '<p>No removed journals data available.</p>';
            return;
        }

        const grouped = {};
        removed.forEach(j => {
            (grouped[j.section] = grouped[j.section] || []).push(j);
        });

        resultsContainer.innerHTML = `
            <h3>Journals Removed from Accredited List</h3>
            <p>Showing ${removed.length} journals removed in past years.</p>
            <div class="removed-table-controls">
                <button id="scrollToTopBtn"><i class="fas fa-arrow-up"></i> Top</button>
                <span class="table-info">${removed.length} journals</span>
                <button id="scrollToBottomBtn"><i class="fas fa-arrow-down"></i> Bottom</button>
            </div>
            <div class="removed-table-wrapper">
                ${Object.entries(grouped).map(([section, journals]) => `
                    <div class="removed-journal-section">
                        <h4>${escapeHtml(section)}</h4>
                        <table class="removed-table">
                            <thead><tr><th>Journal Title</th><th>Editor's Details</th></tr></thead>
                            <tbody>
                                ${journals.map(j => `
                                    <tr><td>${escapeHtml(j.journal_title)}</td><td>${escapeHtml(j.editor_details)}</td></tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('scrollToTopBtn').addEventListener('click', () =>
            document.querySelector('.removed-table-wrapper').scrollTo({ top: 0, behavior: 'smooth' })
        );
        document.getElementById('scrollToBottomBtn').addEventListener('click', () =>
            document.querySelector('.removed-table-wrapper').scrollTo({ top: 99999, behavior: 'smooth' })
        );

        showRemovedBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Removed from Accredited List';
        isRemovedVisible = true;
    }

    // --- Event Handlers ---
    searchBtn.addEventListener('click', async () => {
        const query = journalQuery.value.trim();
        if (!query) return alert('Please enter a journal title or ISSN');
        showLoading('Searching...');
        try {
            const offlineHit = findOffline(query);
            const removedHit = checkRemovedList(query);
            const [crossrefInfo, pubmedInfo] = await Promise.all([
                fetchCrossRefInfo(query),
                fetchPubMedInfo(query)
            ]);
            displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo);
        } catch (e) {
            showError('Search failed. Please try again.');
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

    copyRemovedBtn.addEventListener('click', () => {
        const removed = journalLists.removed || [];
        if (removed.length === 0) return alert('No data to copy.');

        let csv = 'Section,Journal Title,"Editor\'s Details"\n';
        removed.forEach(r => {
            csv += `"${r.section || ''}","${r.journal_title || ''}","${r.editor_details || ''}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'removed_journals.csv';
        a.click();
        URL.revokeObjectURL(url);

        const orig = copyRemovedBtn.innerHTML;
        copyRemovedBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded!';
        setTimeout(() => copyRemovedBtn.innerHTML = orig, 2000);
    });

    journalQuery.addEventListener('keypress', e => {
        if (e.key === 'Enter') searchBtn.click();
    });

    // --- Initialize ---
    loadAllLists();
});
