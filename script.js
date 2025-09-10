document.addEventListener('DOMContentLoaded', function () {
    const searchBtn = document.getElementById('searchBtn');
    const journalQuery = document.getElementById('journalQuery');
    const resultsContainer = document.getElementById('resultsContainer');
    const showRemovedBtn = document.getElementById('showRemovedBtn');
    const copyRemovedBtn = document.getElementById('copyRemovedBtn');

    // Try direct GitHub raw first, fallback to CORS proxy
    const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
    const RAW_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

    // Accredited lists
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

    // Transformative agreements with SANLiC links
    const TRANSFORMATIVE_FILES = [
        { file: 'WILEY_2025.csv', link: 'https://sanlic.ac.za/wiley/' },
        { file: 'The Company of Biologists_2025.csv', link: 'https://sanlic.ac.za/the-company-of-biologists/' },
        { file: 'Taylor & Francis_2025.csv', link: 'https://sanlic.ac.za/taylor-francis/' },
        { file: 'Springer_2025.csv', link: 'https://sanlic.ac.za/springer/' },
        { file: 'ScienceDirect (Elsevier)_2025.csv', link: 'https://sanlic.ac.za/sciencedirect-elsevier/' },
        { file: 'SAGE Publishing_2025.csv', link: 'https://sanlic.ac.za/sage-publishing/' },
        { file: 'Royal Society_2025.csv', link: 'https://sanlic.ac.za/royal-society/' },
        { file: 'Royal Society of Chemistry Platinum_2025.csv', link: 'https://sanlic.ac.za/royal-society-of-chemistry/' },
        { file: 'Oxford University Press Journals_2025.csv', link: 'https://sanlic.ac.za/oxford-university-press-journals/' },
        { file: 'IOPscienceExtra_2025.csv', link: 'https://sanlic.ac.za/iopscience-extra/' },
        { file: 'Emerald_2025.csv', link: 'https://sanlic.ac.za/emerald/' },
        { file: 'Cambridge University Press (CUP)_2025.csv', link: 'https://sanlic.ac.za/cambridge-university-press/' },
        { file: 'Bentham Science Publishers_2025.csv', link: 'https://sanlic.ac.za/bentham-science-publishers-2/' },
        { file: 'Association for Computing Machinery (ACM)_2025.csv', link: 'https://sanlic.ac.za/association-for-computing-machinery-acm/' },
        { file: 'American Institute of Physics (AIP)_2025.csv', link: 'https://sanlic.ac.za/american-institute-of-physics-2/' },
        { file: 'American Chemical Society (ACS)_2025.csv', link: 'https://sanlic.ac.za/american-chemical-society-acs/' }
    ];

    let journalLists = { dhet: [], dhet2: [], doaj: [], ibss: [], norwegian: [], scielo: [], scopus: [], wos: [], removed: [] };
    let transformativeList = [];
    let isRemovedVisible = false;

    // --- UI Helpers ---
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

    // --- Text Normalization ---
    function normalizeTitle(t) {
        return (t || '').toLowerCase().replace(/\uFEFF/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function normalizeISSN(s) {
        if (!s) return '';
        return s.toString().toUpperCase().replace(/[^0-9X]/g, '');
    }

    function isISSN(s) {
        return /\b\d{4}-?\d{3}[\dXx]\b/i.test(s);
    }

    // --- Fetch with Fallback ---
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

    function rawUrlFor(fname) {
        return RAW_BASE + encodeURIComponent(fname);
    }

    // --- Robust CSV Parser ---
    function parseCSV(text) {
        if (!text) return [];
        text = text.replace(/^\uFEFF/, '');
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
            const hasContent = Object.values(obj).some(v => v);
            if (hasContent) rows.push(obj);
        }
        return rows;
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
                journalLists[key] = parseCSV(text);
                loadedSuccessfully = true;
            } catch (err) {
                console.warn('Failed to load', fname, err);
                journalLists[key] = [];
            } finally {
                loadedCount++;
                document.getElementById('progressText').textContent = `Loading... ${loadedCount}/${totalToLoad}`;
            }
        }

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
                        agreementLink: t.link,
                        publisher: r.publisher || r['publisher name'] || 'Unknown',
                        duration: r['agreement duration'] || r.duration || 'N/A',
                        journalTitle: r['journal title'] || r.title || r.journal || ''
                    });
                });
                loadedSuccessfully = true;
            } catch (err) {
                console.warn('Failed to load transformative file', t.file, err);
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

    // --- Search Logic ---
    function findOffline(query) {
        const qNorm = normalizeTitle(query);
        const issnQuery = isISSN(query) ? normalizeISSN(query) : null;
        const flags = {};

        for (const [key, arr] of Object.entries(journalLists)) {
            if (key === 'removed') continue;
            flags[key] = false;
            for (const row of arr) {
                const title = row.title || row['journal title'] || row['journal'] || row.name || '';
                const titleNorm = normalizeTitle(title);
                const issnField = row.issn || row['issn'] || row.eissn || row['e-issn'] || '';
                const issnNorm = normalizeISSN(issnField);

                if (issnQuery && issnNorm && issnNorm === issnQuery) {
                    flags[key] = true;
                    break;
                }
                if (title && titleNorm.includes(qNorm)) {
                    flags[key] = true;
                    break;
                }
            }
        }
        return { flags };
    }

    function checkRemovedList(query) {
        const qNorm = normalizeTitle(query);
        const removed = journalLists.removed || [];
        for (const row of removed) {
            const title = row.title || row['journal title'] || row['journal'] || row.name || '';
            if (normalizeTitle(title) === qNorm) return row;
        }
        return null;
    }

    // --- Live API Lookups ---
    async function fetchCrossRefInfo(queryOrIssn) {
        try {
            if (isISSN(queryOrIssn)) {
                const issn = normalizeISSN(queryOrIssn);
                const formatted = issn.length === 8 ? `${issn.slice(0,4)}-${issn.slice(4)}` : queryOrIssn;
                const res = await fetch(`https://api.crossref.org/journals/${formatted}`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                const j = data.message;
                return `Title: ${j.title}<br>Publisher: ${j.publisher}`;
            } else {
                const res = await fetch(`https://api.crossref.org/works?query.title=${encodeURIComponent(queryOrIssn)}&rows=1`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                const item = data.message.items[0];
                return `Sample DOI: ${item.DOI || 'N/A'} — Title: ${item.title?.[0] || 'N/A'}`;
            }
        } catch (err) {
            return 'Error fetching CrossRef data';
        }
    }

    async function fetchPubMedInfo(title) {
        try {
            const res = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(title)}[Journal]&format=json`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            return data.hitCount > 0 ? `Approximately ${data.hitCount} articles in Europe PMC.` : 'No articles found.';
        } catch (err) {
            return 'Error fetching PubMed data';
        }
    }

    // --- Display Results ---
    function displayJournalData(query, offlineHit, removedHit, crossrefInfo, pubmedInfo) {
        const f = offlineHit.flags;
        const foundList = Object.keys(f).filter(k => f[k]).join(', ') || 'Not found';

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

        const tm = transformativeList.find(t => normalizeTitle(t.journalTitle) === normalizeTitle(query));
        const transformativeInfo = tm ? `
            <div class="transformative-info">
                <h4>Transformative Agreement Found</h4>
                <div class="transformative-details">
                    <div class="transformative-detail"><strong>Publisher:</strong> ${tm.publisher}</div>
                    <div class="transformative-detail"><strong>Duration:</strong> ${tm.duration}</div>
                    <div class="transformative-detail"><strong>Agreement:</strong> <a href="${tm.agreementLink}" target="_blank">View Agreement</a></div>
                </div>
            </div>
        ` : '<div>No transformative agreement found</div>';

        resultsContainer.innerHTML = `
            <table class="report-table">
                <thead><tr><th colspan="2">Journal Information</th><th>Status</th></tr></thead>
                <tbody>
                    <tr><td class="info-label">Query</td><td>${escapeHtml(query)}</td><td rowspan="3"><span class="status-badge ${statusBadge}">${statusText}</span></td></tr>
                    <tr><td class="info-label">Found In</td><td>${escapeHtml(foundList)}</td></tr>
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

    function displayRemovedJournals() {
        const removed = journalLists.removed || [];
        if (removed.length === 0) {
            resultsContainer.innerHTML = '<p>No removed journals data available.</p>';
            return;
        }

        const cols = Object.keys(removed[0]).filter(col => removed.some(r => r[col]));
        resultsContainer.innerHTML = `
            <h3>Removed from Accredited List</h3>
            <div class="table-container" style="max-height: 500px; overflow-y: auto;">
                <table class="report-table">
                    <thead><tr>${cols.map(c => `<th>${c.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}</tr></thead>
                    <tbody>${removed.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(r[c] || 'N/A')}</td>`).join('')}</tr>`).join('')}</tbody>
                </table>
            </div>
        `;
        showRemovedBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Removed from Accredited List';
        isRemovedVisible = true;
    }

    // --- Event Handlers ---
    searchBtn.addEventListener('click', async function () {
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
        } catch (err) {
            showError('Search failed. Please try again.');
        }
    });

    showRemovedBtn.addEventListener('click', function () {
        if (isRemovedVisible) {
            loadAllLists();
            showRemovedBtn.innerHTML = '<i class="fas fa-eye"></i> Show Removed from Accredited List';
            isRemovedVisible = false;
        } else {
            displayRemovedJournals();
        }
    });

    copyRemovedBtn.addEventListener('click', function () {
        const removed = journalLists.removed || [];
        if (!removed.length) return alert('No removed journals to copy.');

        let csv = Object.keys(removed[0]).join(',') + '\n';
        removed.forEach(r => {
            const row = Object.values(r).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
            csv += row + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'removed_journals.csv';
        a.click();
        URL.revokeObjectURL(url);

        const orig = copyRemovedBtn.innerHTML;
        copyRemovedBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => copyRemovedBtn.innerHTML = orig, 2000);
    });

    journalQuery.addEventListener('keydown', e => {
        if (e.key === 'Enter') searchBtn.click();
    });

    // --- Initialize ---
    loadAllLists();
});
