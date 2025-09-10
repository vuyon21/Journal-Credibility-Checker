document.addEventListener('DOMContentLoaded', function() {
    // DOM references
    const searchBtn = document.getElementById('searchBtn');
    const journalQuery = document.getElementById('journalQuery');
    const resultsContainer = document.getElementById('resultsContainer');
    const showRemovedBtn = document.getElementById('showRemovedBtn');
    const copyRemovedBtn = document.getElementById('copyRemovedBtn');

    // NOTE: GitHub raw supports CORS; we try direct first, then a proxy fallback.
    const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/'; // fallback only
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

    let journalLists = { dhet: [], dhet2: [], doaj: [], ibss: [], norwegian: [], scielo: [], scopus: [], wos: [], removed: [] };
    let transformativeList = [];

    // --- UI helpers ---
    function showLoading(msg) {
        resultsContainer.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>${msg}</p>
                <p id="progressText"></p>
            </div>
        `;
    }

    function hideLoading() {
        // no-op; display functions replace content
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
        const btn = document.getElementById('tryAgainBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                journalQuery.value = '';
                journalQuery.focus();
                loadAllLists();
            });
        }
    }

    // Normalize text for comparisons
    function normalizeTitle(t) {
        return (t || '').toLowerCase()
            .replace(/\uFEFF/g, '')          // remove BOM
            .replace(/[^a-z0-9\s]/g, ' ')    // keep letters, numbers, spaces
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Normalize ISSN: remove non-alphanumeric, keep final X if present
    function normalizeISSN(s) {
        if (!s) return '';
        return s.toString().toUpperCase().replace(/[^0-9X]/g, ''); // e.g. 12345678 or 1234X678? usually digits + X
    }

    // Simple ISSN pattern check (with optional hyphen)
    function isISSN(s) {
        if (!s) return false;
        return /\b\d{4}-?\d{3}[\dXx]\b/.test(s);
    }

    // Build raw URL (direct first)
    function rawUrlFor(fname) {
        // encodeURI preserves slashes, but here fname is just the filename
        return RAW_BASE + encodeURIComponent(fname);
    }

    // try direct fetch then fallback to CORS proxy
    async function fetchWithFallback(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Direct fetch failed: ' + res.status);
            return res;
        } catch (err) {
            console.warn('Direct fetch failed, trying CORS proxy:', err);
            // fallback
            const proxied = CORS_PROXY + url;
            const res2 = await fetch(proxied);
            if (!res2.ok) throw new Error('Proxy fetch failed: ' + res2.status);
            return res2;
        }
    }

    // Parse CSV text robustly (handles BOM, quoted fields, comma or pipe)
    function parseCSV(text) {
        if (!text) return [];
        // remove BOM
        text = text.replace(/^\uFEFF/, '');
        // Normalize line endings
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) return [];

        // Determine delimiter: prefer comma, but if there are more pipes than commas in header choose pipe
        let headerLine = lines[0];
        const commaCount = (headerLine.match(/,/g) || []).length;
        const pipeCount = (headerLine.match(/\|/g) || []).length;
        const delimiter = pipeCount > commaCount ? '|' : ',';

        // parse header into columns (trim and lower)
        const headers = splitCSVLine(headerLine, delimiter).map(h => h.trim().toLowerCase());

        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const raw = lines[i];
            const parts = splitCSVLine(raw, delimiter);
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                const h = headers[j] || ('col' + j);
                obj[h] = (parts[j] || '').trim().replace(/^"|"$/g, '');
            }
            // ignore fully empty rows
            const hasContent = Object.values(obj).some(v => v && v.trim() !== '');
            if (hasContent) rows.push(obj);
        }
        return rows;
    }

    // Helper splitting that respects quoted fields
    function splitCSVLine(line, delimiter=',') {
        const parts = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                // if double quote inside quoted field, consume next quote as escaped
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
        return parts;
    }

    // Utility to extract a field from an object with possible variant names
    function extractField(data, possibleNames) {
        for (const n of possibleNames) {
            if (data[n] !== undefined && data[n] !== null && String(data[n]).trim() !== '') {
                return String(data[n]).trim();
            }
        }
        return 'N/A';
    }

    // Load all files (accredited lists + transformative files)
    async function loadAllLists() {
        showLoading('Loading journal lists...');
        let loadedSuccessfully = false;
        let loadedCount = 0;
        const totalToLoad = Object.keys(FILENAMES).length + TRANSFORMATIVE_FILES.length;

        // Accredited lists
        for (const [key, fname] of Object.entries(FILENAMES)) {
            try {
                const url = rawUrlFor(fname);
                const res = await fetchWithFallback(url);
                const text = await res.text();
                const parsed = parseCSV(text);
                journalLists[key] = parsed;
                loadedCount++;
                updateProgress(loadedCount, totalToLoad);
                loadedSuccessfully = true;
                console.log(`Loaded ${key} (${fname}) - ${parsed.length} rows`);
            } catch (err) {
                console.warn('Failed to load', fname, err);
                journalLists[key] = [];
                loadedCount++;
                updateProgress(loadedCount, totalToLoad);
            }
        }

        // Transformative agreements
        transformativeList = [];
        for (const t of TRANSFORMATIVE_FILES) {
            try {
                const url = rawUrlFor(t.file);
                const res = await fetchWithFallback(url);
                const text = await res.text();
                const rows = parseCSV(text);
                rows.forEach(r => {
                    transformativeList.push({
                        ...r,
                        link: t.link,
                        publisher: extractField(r, ['publisher', 'publishers', 'publisher name', 'publisher_name']),
                        duration: extractField(r, ['agreement duration', 'duration', 'agreement_duration', 'agreement period', 'agreement_period']),
                        journal: extractField(r, ['journal title', 'journal', 'journal_title', 'title', 'journal name', 'journal_name'])
                    });
                });
                console.log(`Loaded transformative file ${t.file} (${rows.length} rows)`);
                loadedSuccessfully = true;
            } catch (err) {
                console.warn('Failed to load transformative file', t.file, err);
            }
            loadedCount++;
            updateProgress(loadedCount, totalToLoad);
        }

        hideLoading();

        if (!loadedSuccessfully) {
            showError('Could not load external CSV files. Please click "Try Again" to reload.');
        } else {
            resultsContainer.innerHTML = '<p>Enter a journal name or ISSN to check its credibility.</p>';
        }
    }

    function updateProgress(current, total) {
        const progressElement = document.getElementById('progressText');
        if (progressElement) progressElement.textContent = `Loading... ${current}/${total} files`;
    }

    // Offline search across loaded CSVs
    function findOffline(query) {
        const qNorm = normalizeTitle(query);
        const issnQueryRaw = isISSN(query) ? normalizeISSN(query) : null;
        const flags = {};
        let foundIn = null;

        // iterate lists (skip 'removed' for accreditation)
        for (const [key, arr] of Object.entries(journalLists)) {
            if (key === 'removed') continue;
            flags[key] = false;
            for (const row of arr) {
                // possible title fields
                const title = row.title || row['journal title'] || row['journal'] || row.name || row['journal name'] || '';
                const titleNorm = normalizeTitle(title);
                // possible issn fields
                const issnField = (row.issn || row['issn'] || row.eissn || row['e-issn'] || row['eissn'] || '');
                const issnNorm = normalizeISSN(issnField);

                // By ISSN exact match (normalized)
                if (issnQueryRaw && issnNorm && issnNorm === issnQueryRaw) {
                    flags[key] = true;
                    foundIn = key;
                    break;
                }

                // Exact title match
                if (title && titleNorm === qNorm) {
                    flags[key] = true;
                    foundIn = key;
                    break;
                }

                // Partial match (only when query is >3 chars)
                if (title && qNorm.length > 3 && titleNorm.includes(qNorm)) {
                    flags[key] = true;
                    foundIn = key;
                    break;
                }
            }
        }

        return { flags, foundIn };
    }

    // Check removed list specifically
    function checkRemovedList(query) {
        const qNorm = normalizeTitle(query);
        const removed = journalLists.removed || [];
        for (const row of removed) {
            const title = row.title || row['journal title'] || row['journal'] || row.name || '';
            if (normalizeTitle(title) === qNorm) {
                return row;
            }
        }
        return null;
    }

    // CrossRef lookup: if an ISSN is provided use the journals endpoint; otherwise try works search by journal title
    async function fetchCrossRefInfo(queryOrIssn) {
        try {
            if (isISSN(queryOrIssn)) {
                // Normalize to format accepted by CrossRef (1234-5678)
                const rawDigits = normalizeISSN(queryOrIssn);
                const issnFormatted = rawDigits.length === 8 ? rawDigits.slice(0,4) + '-' + rawDigits.slice(4) : queryOrIssn;
                const url = `https://api.crossref.org/journals/${issnFormatted}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('CrossRef journal lookup failed: ' + res.status);
                const data = await res.json();
                if (data && data.message) {
                    const j = data.message;
                    let out = '';
                    if (j.title) out += `Title: ${j.title}<br>`;
                    if (j.publisher) out += `Publisher: ${j.publisher}<br>`;
                    if (j['counts'] || j['total-dois']) {
                        if (j['total-dois']) out += `Total DOIs (approx): ${j['total-dois']}<br>`;
                    }
                    if (j.license && j.license.length) {
                        out += `License: <a href="${j.license[0].URL}" target="_blank">${j.license[0]['content-version'] || 'View license'}</a><br>`;
                    }
                    return out || 'No additional details from CrossRef';
                } else {
                    return 'Not found on CrossRef';
                }
            } else {
                // Try works search filtered by journal title
                const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(queryOrIssn)}&rows=1`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('CrossRef works search failed: ' + res.status);
                const data = await res.json();
                if (data && data.message && data.message.items && data.message.items.length > 0) {
                    const item = data.message.items[0];
                    return `Sample DOI: ${item.DOI || 'N/A'} — Title sample: ${item.title ? item.title[0] : 'N/A'}`;
                }
                return 'No CrossRef works found for that title';
            }
        } catch (err) {
            console.error('CrossRef error:', err);
            return 'Error fetching data from CrossRef';
        }
    }

    // Europe PMC (PubMed-like) lookup for approximate article count
    async function fetchPubMedInfo(title) {
        if (!title) return 'No title available for lookup';
        try {
            const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(title)}[Journal]&format=json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Europe PMC fetch failed: ' + res.status);
            const data = await res.json();
            if (data && data.hitCount && data.hitCount > 0) {
                return `Approximately ${data.hitCount} articles in Europe PMC (includes PubMed content).`;
            }
            return 'No articles found in Europe PMC for this journal name';
        } catch (err) {
            console.error('Europe PMC error:', err);
            return 'Error fetching data from Europe PMC';
        }
    }

    // Render results
    function displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo) {
        const f = offlineHit.flags || {};
        const foundList = Object.keys(f).filter(k => f[k]);
        const foundText = foundList.length ? foundList.join(', ') : (offlineHit.foundIn || 'Not found in accredited lists');

        let statusBadge = 'status-danger';
        let statusText = 'Not Recommended';

        if (removedHit) {
            statusBadge = 'status-danger';
            statusText = 'Not Recommended (Removed)';
        } else if (f.dhet || f.dhet2 || f.scopus || f.wos) {
            statusBadge = 'status-verified';
            statusText = 'Recommended';
        } else if (f.doaj || f.ibss || f.scielo || f.norwegian) {
            statusBadge = 'status-warning';
            statusText = 'Verify Manually';
        }

        // Transformative match (exact normalized title)
        let transformativeInfo = '<div>No transformative agreement found</div>';
        const tm = transformativeList.find(t => {
            const tTitle = (t.journal || t.title || t['journal title'] || '');
            return normalizeTitle(tTitle) === normalizeTitle(query);
        });
        if (tm) {
            transformativeInfo = `
                <div class="transformative-info">
                    <h4>Transformative Agreement Found</h4>
                    <div class="transformative-details">
                        <div class="transformative-detail"><strong>Journal:</strong> ${tm.journal || tm.title || 'N/A'}</div>
                        <div class="transformative-detail"><strong>Publisher:</strong> ${tm.publisher || 'N/A'}</div>
                        <div class="transformative-detail"><strong>Duration:</strong> ${tm.duration || 'N/A'}</div>
                        <div class="transformative-detail"><strong>Agreement:</strong> <a href="${tm.link}" target="_blank">View agreement</a></div>
                    </div>
                </div>
            `;
        }

        resultsContainer.innerHTML = `
            <table class="report-table">
                <thead><tr><th colspan="2">Journal Information</th><th>Status</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">Journal Title / Query</td><td>${escapeHtml(query)}</td><td rowspan="3"><span class="status-badge ${statusBadge}">${statusText}</span></td></tr>
                    <tr><td class="info-label">Found In</td><td>${escapeHtml(foundText)}</td></tr>
                </tbody>
            </table>

            <table class="report-table">
                <thead><tr><th colspan="2">Accreditation Status</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">DHET</td><td>${f.dhet ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">DHET 2</td><td>${f.dhet2 ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">Scopus</td><td>${f.scopus ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">Web of Science</td><td>${f.wos ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">DOAJ</td><td>${f.doaj ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">IBSS</td><td>${f.ibss ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">SciELO</td><td>${f.scielo ? 'Found' : 'Not found'}</td></tr>
                    <tr><td class="info-label">Norwegian</td><td>${f.norwegian ? 'Found' : 'Not found'}</td></tr>
                </tbody>
            </table>

            ${transformativeInfo}

            <table class="report-table">
                <thead><tr><th colspan="2">Live Lookup Results</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">CrossRef</td><td><div class="live-info">${crossrefInfo}</div></td></tr>
                    <tr><td class="info-label">Europe PMC / PubMed</td><td><div class="live-info">${pubmedInfo}</div></td></tr>
                </tbody>
            </table>
        `;
    }

    // Simple HTML escape to avoid trivial injection in displayed results
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Show removed journals table
    function displayRemovedJournals() {
        const removedList = journalLists.removed || [];
        if (removedList.length === 0) {
            resultsContainer.innerHTML = '<p>No removed journals data available or failed to load. Please try again.</p>';
            return;
        }

        const firstItem = removedList[0];
        const columns = Object.keys(firstItem);
        const nonEmptyColumns = columns.filter(col => removedList.some(item => item[col] && String(item[col]).trim() !== ''));

        resultsContainer.innerHTML = `
            <h3>Journals Removed from Accredited List</h3>
            <p>Showing ${removedList.length} journals removed from the accredited list in past years.</p>
            <div class="table-container">
                <table class="report-table">
                    <thead>
                        <tr>${nonEmptyColumns.map(col => `<th>${escapeHtml(col.replace(/_/g, ' ').toUpperCase())}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${removedList.map(j => `<tr>${nonEmptyColumns.map(col => `<td>${escapeHtml(j[col] || 'N/A')}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Download removed journals as CSV
    copyRemovedBtn.addEventListener('click', function() {
        const removedList = journalLists.removed || [];
        if (!removedList.length) {
            alert('No removed journals data available to copy.');
            return;
        }
        const first = removedList[0];
        const cols = Object.keys(first).filter(col => removedList.some(r => r[col] && String(r[col]).trim() !== ''));
        let csv = cols.join(',') + '\n';
        for (const r of removedList) {
            const row = cols.map(c => {
                const v = r[c] || '';
                return `"${String(v).replace(/"/g, '""')}"`;
            }).join(',');
            csv += row + '\n';
        }
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'removed_journals.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // feedback
        const orig = copyRemovedBtn.innerHTML;
        copyRemovedBtn.innerHTML = '<i class="fas fa-check"></i> Downloaded CSV!';
        setTimeout(()=> copyRemovedBtn.innerHTML = orig, 2000);
    });

    // Event: Search
    searchBtn.addEventListener('click', async function() {
        const query = journalQuery.value.trim();
        if (!query) {
            alert('Please enter a journal title or ISSN');
            return;
        }
        showLoading('Searching for journal...');
        try {
            const offlineHit = findOffline(query);
            const removedHit = checkRemovedList(query);

            // Decide what to pass to CrossRef: ISSN when available, else query/title
            const crossRefInput = isISSN(query) ? query : (offlineHit && offlineHit.foundIn ? query : query);

            const [crossrefInfo, pubmedInfo] = await Promise.all([
                fetchCrossRefInfo(crossRefInput),
                fetchPubMedInfo(query)
            ]);

            hideLoading();
            displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo);
        } catch (err) {
            console.error('Search error:', err);
            showError('An error occurred during the search. Please try again.');
        }
    });

    // Show removed button
    showRemovedBtn.addEventListener('click', displayRemovedJournals);

    // Enter key to search
    journalQuery.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') searchBtn.click();
    });

    // Initialize
    loadAllLists();
});
