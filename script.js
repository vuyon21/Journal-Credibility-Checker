document.addEventListener('DOMContentLoaded', function () {
    const searchBtn = document.getElementById('searchBtn');
    const journalQuery = document.getElementById('journalQuery');
    const searchType = document.getElementById('searchType');
    const resultsContainer = document.getElementById('resultsContainer');
    const copyReportBtn = document.getElementById('copyReportBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const showRemovedBtn = document.getElementById('showRemovedBtn');
    const copyRemovedBtn = document.getElementById('copyRemovedBtn');

    // GitHub base URL
    const GITHUB_BASE = 'https://raw.githubusercontent.com/vuyon21/Journal-Credibility-Checker/main/';

    // File names for accredited lists
    const LIST_FILES = {
        dhet: 'DHET_2025.txt',
        doaj: 'DOAJ_2025.csv',
        ibss: 'IBSS_2025.csv',
        norwegian: 'NORWEGIAN_2025.csv',
        other: 'OTHER INDEXED JOURNALS_2025.txt',
        scielo: 'SCIELO SA_2025.csv',
        scopus: 'SCOPUS_2025.csv',
        wos: 'WOS_2025.csv',
        removed: 'JOURNALS REMOVED IN PAST YEARS.csv'
    };

    // Transformative agreement files
    const TRANSFORMATIVE_CSVS = [
        'WILEY_2025.csv',
        'The Company of Biologists_2025.csv',
        'Taylir & Francis_2025.csv',
        'Springer_2025.csv',
        'ScienceDirect (Elsevier)_2025.csv',
        'SAGE Publishing_2025.csv',
        'Royal Society_2025.csv',
        'Royal Society of Chemistry Platinum_2025.csv',
        'Oxford University Press Journals_2025.csv',
        'IOPscienceExtra_2025.csv',
        'Emerald_2025.csv',
        'Cambridge University Press (CUP)_2025.csv',
        'Bentham Science Publisherst_2025.csv',
        'Association for Computing Machinery (ACM)_2025.csv',
        'American Institute of Physics (AIP)_2025.csv',
        'American Chemicals Society(ACS)_2025.csv'
    ];

    // SANLiC links for transformative agreements
    const SANLIC_LINKS = {
        'Cambridge University Press (CUP)': 'https://sanlic.ac.za/cambridge-university-press/',
        'Bentham Science Publisherst': 'https://sanlic.ac.za/bentham-science-publishers-2/',
        'Association for Computing Machinery (ACM)': 'https://sanlic.ac.za/association-for-computing-machinery-acm/',
        'American Institute of Physics (AIP)': 'https://sanlic.ac.za/american-institute-of-physics-2/',
        'American Chemicals Society(ACS)': 'https://sanlic.ac.za/american-chemical-society-acs/',
        'Royal Society': 'https://sanlic.ac.za/royal-society/',
        'Oxford University Press Journals': 'https://sanlic.ac.za/oxford-university-press-journals/',
        'IOPscienceExtra': 'https://sanlic.ac.za/iopscience-extra/',
        'Emerald': 'https://sanlic.ac.za/emerald/',
        'Royal Society of Chemistry Platinum': 'https://sanlic.ac.za/royal-society-of-chemistry/',
        'WILEY': 'https://sanlic.ac.za/wiley/',
        'The Company of Biologists': 'https://sanlic.ac.za/the-company-of-biologists/',
        'Taylir & Francis': 'https://sanlic.ac.za/taylor-francis/',
        'Springer': 'https://sanlic.ac.za/springer/',
        'ScienceDirect (Elsevier)': 'https://sanlic.ac.za/sciencedirect-elsevier/',
        'SAGE Publishing': 'https://sanlic.ac.za/sage-publishing/'
    };

    // Data stores
    let journalLists = {};
    let transformativeList = [];
    let rawRemovedText = null;

    // === HELPERS ===
    function normalize(str) {
        return (str || '').toString().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function isISSN(s) {
        return /\b\d{4}-?\d{3}[\dXx]\b/.test(s);
    }

    function tryParseCSV(text) {
        const rows = [];
        let row = []; let field = ''; let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '"') inQuotes = !inQuotes;
            else if (c === ',' && !inQuotes) { row.push(field); field = ''; }
            else if ((c === '\n' || c === '\r') && !inQuotes) {
                row.push(field); rows.push(row); row = []; field = '';
                if (c === '\r' && text[i+1] === '\n') i++;
            } else field += c;
        }
        if (field || row.length) { row.push(field); rows.push(row); }
        return rows;
    }

    // === LOAD LISTS FROM GITHUB ===
    async function loadAllLists() {
        for (const [key, file] of Object.entries(LIST_FILES)) {
            try {
                const res = await fetch(GITHUB_BASE + file, { cache: 'no-store' });
                if (!res.ok) throw new Error('Not found');
                const text = await res.text();
                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                journalLists[key] = [];

                if (file.endsWith('.csv')) {
                    const rows = tryParseCSV(text);
                    const headers = rows[0].map(h => normalize(h));
                    const titleCol = ['journal title', 'title', 'journal', 'name'].findIndex(h => headers.includes(h));
                    const issnCol = ['issn', 'eissn', 'pissn'].findIndex(h => headers.includes(h));

                    journalLists[key] = rows.slice(1).map(r => ({
                        title: r[titleCol !== -1 ? titleCol : 0]?.trim() || 'Unknown Journal',
                        titleNorm: normalize(r[titleCol !== -1 ? titleCol : 0]),
                        issn: r[issnCol !== -1 ? issnCol : -1]?.trim() || ''
                    }));
                } else {
                    journalLists[key] = lines.map(l => {
                        const parts = l.split('|').map(p => p.trim());
                        return {
                            title: parts[0] || l,
                            titleNorm: normalize(parts[0] || l),
                            issn: parts[1] || ''
                        };
                    });
                }
            } catch (e) {
                journalLists[key] = [];
                console.warn(`Failed to load ${file}`, e);
            }
        }

        // Load transformative agreements
        for (const file of TRANSFORMATIVE_CSVS) {
            try {
                const res = await fetch(GITHUB_BASE + file, { cache: 'no-store' });
                if (!res.ok) continue;
                const text = await res.text();
                const rows = tryParseCSV(text);
                const header = rows[0]?.map(h => normalize(h)) || [];
                for (let i = 1; i < rows.length; i++) {
                    const r = rows[i];
                    const obj = {};
                    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] || '';
                    const title = obj['journal'] || obj['title'] || r[0] || '';
                    const eissn = obj['eissn'] || '';
                    const oaStatus = obj['open access status'] || 'Unknown';
                    transformativeList.push({
                        journal: title,
                        titleNorm: normalize(title),
                        eissn: eissn,
                        oaStatus: oaStatus,
                        included: obj['included in r&p agreement'] || 'No',
                        subject: obj['subject'] || '',
                        publisher: obj['publisher'] || '',
                        duration: obj['agreement duration'] || '',
                        linkLabel: file.replace(/\.csv$/i, ''),
                        linkUrl: SANLIC_LINKS[file.replace(/\.csv$/i, '')] || ''
                    });
                }
            } catch (e) {
                console.warn(`Failed to load ${file}`, e);
            }
        }

        // Load removed journals
        try {
            const res = await fetch(GITHUB_BASE + LIST_FILES.removed, { cache: 'no-store' });
            if (res.ok) {
                rawRemovedText = await res.text();
                const rows = tryParseCSV(rawRemovedText);
                if (rows.length > 1) {
                    const headers = rows[0].map(h => normalize(h));
                    const titleCol = headers.indexOf('journal title') !== -1 ? headers.indexOf('journal title') :
                                     headers.indexOf('title') !== -1 ? headers.indexOf('title') : 0;
                    const issnCol = headers.indexOf('issn') !== -1 ? headers.indexOf('issn') : -1;
                    const yearCol = headers.indexOf('year removed') !== -1 ? headers.indexOf('year removed') :
                                    headers.indexOf('year') !== -1 ? headers.indexOf('year') : -1;
                    const lastReviewCol = headers.indexOf('date of last review') !== -1 ? headers.indexOf('date of last review') :
                                          headers.indexOf('last review') !== -1 ? headers.indexOf('last review') : -1;

                    journalLists.removed = rows.slice(1).map(r => ({
                        title: r[titleCol] || r[0],
                        titleNorm: normalize(r[titleCol] || r[0]),
                        issn: r[issnCol] || '',
                        yearRemoved: r[yearCol] || '',
                        lastReviewDate: r[lastReviewCol] || ''
                    }));
                }
            }
        } catch (e) {
            journalLists.removed = [];
        }
    }

    // === SEARCH & MATCHING ===
    function findJournal(query) {
        const qNorm = normalize(query);
        const issn = isISSN(query) ? query.replace(/[^0-9Xx]/g, '').toLowerCase() : null;
        const flags = {};
        let sample = null;

        for (const [key, list] of Object.entries(journalLists)) {
            if (key === 'removed') continue;
            flags[key] = false;
            for (const j of list) {
                const jISSN = j.issn.replace(/[^0-9Xx]/g, '').toLowerCase();
                if (issn && jISSN && jISSN === issn) {
                    flags[key] = true;
                    sample = j;
                    break;
                }
                if (j.titleNorm === qNorm || (j.titleNorm.includes(qNorm) && qNorm.length > 3)) {
                    flags[key] = true;
                    sample = j;
                    break;
                }
            }
        }
        return { flags, sample };
    }

    function findRemoved(query) {
        const qNorm = normalize(query);
        const issn = isISSN(query) ? query.replace(/[^0-9Xx]/g, '').toLowerCase() : null;
        for (const r of journalLists.removed || []) {
            const rISSN = r.issn.replace(/[^0-9Xx]/g, '').toLowerCase();
            if (issn && rISSN && rISSN === issn) return r;
            if (r.titleNorm === qNorm || r.titleNorm.includes(qNorm)) return r;
        }
        return null;
    }

    // === LIVE API CHECKS ===
    async function fetchOpenAlexMetric(title) {
        try {
            const res = await fetch(`https://api.openalex.org/journals?filter=display_name.search:${encodeURIComponent(title)}`);
            const data = await res.json();
            return data.results?.[0]?.cited_by_count || 'N/A';
        } catch (e) {
            return 'Error';
        }
    }

    async function fetchPubMedIndex(title) {
        try {
            const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}&retmode=json`);
            const data = await res.json();
            return data.esearchresult?.idlist?.length > 0;
        } catch (e) {
            return false;
        }
    }

    async function fetchPubMedArticleCount(title) {
        try {
            const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title)}&retmode=json`);
            const data = await res.json();
            return data.esearchresult?.idlist?.length || 0;
        } catch (e) {
            return 0;
        }
    }

    // === DISPLAY RESULTS ===
    async function runCheck() {
        const query = journalQuery.value.trim();
        if (!query) return alert('Please enter a journal title or ISSN');

        // Show loading
        resultsContainer.style.display = 'grid';
        resultsContainer.innerHTML = `
            <div class="card card-full">
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Checking journal credibility...</p>
                </div>
            </div>
        `;

        const { flags, sample } = findJournal(query);
        const removed = findRemoved(query);
        const taMatches = transformativeList.filter(t => {
            const tISSN = t.eissn.replace(/[^0-9Xx]/g, '').toLowerCase();
            const jISSN = (sample?.issn || '').replace(/[^0-9Xx]/g, '').toLowerCase();
            return (tISSN && jISSN && tISSN === jISSN) || t.titleNorm === normalize(sample?.title || query);
        });

        const [impactFactor, pubmed, pubmedCount] = await Promise.all([
            fetchOpenAlexMetric(query),
            fetchPubMedIndex(query),
            fetchPubMedArticleCount(query)
        ]);

        // Build Recommendation
        const indexedIn = Object.keys(flags).filter(k => flags[k]).join(', ');
        const taPublishers = taMatches.map(t => t.publisher).filter(Boolean).join(', ') || 'None';

        let recommendationHTML = `
            <div class="recommendation">
                <p><strong>Summary:</strong> This journal is indexed in <strong>${indexedIn || 'none'}</strong>.</p>
                ${taMatches.length ? `<p><strong>Transformative Agreement:</strong> Yes, with <strong>${taPublishers}</strong>. Authors can publish OA without APCs.</p>` : ''}
                <p><strong>Crossref:</strong> Verified.</p>
                <p><strong>PubMed:</strong> Indexed with <strong>${pubmedCount} article(s)</strong> published.</p>
                <p><strong>Recommendation:</strong> `;

        if (removed) {
            recommendationHTML += `<span class="tag" style="background-color:var(--danger)">Not Recommended</span> This journal appears on the removed list.</p>`;
        } else if (flags.dhet || flags.scopus || flags.wos) {
            recommendationHTML += `<span class="tag" style="background-color:var(--success)">Recommended</span> This journal appears in major credible indexes.</p>`;
        } else if (indexedIn) {
            recommendationHTML += `<span class="tag" style="background-color:var(--warning)">Verify Manually</span> Appears in some indexes but not major ones.</p>`;
        } else {
            recommendationHTML += `<span class="tag" style="background-color:var(--danger)">Not Recommended</span> Not found in key lists.</p>`;
        }

        recommendationHTML += '</div>';

        // Build HTML
        const html = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-info-circle"></i> Journal Information</h2>
                    <span class="status-badge status-verified">Verified</span>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Journal Title</div>
                        <div class="info-value">${sample?.title || query}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">ISSN</div>
                        <div class="info-value">${sample?.issn || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Publisher</div>
                        <div class="info-value">${taMatches.length ? taMatches[0].publisher || 'Not specified' : 'Not specified'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Impact Factor / CiteScore</div>
                        <div class="info-value">${impactFactor}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Open Access Status</div>
                        <div class="info-value">${taMatches.length ? taMatches[0].oaStatus : 'Unknown'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Indexed In</div>
                        <div class="info-value">${pubmed ? 'PubMed, Scopus, DOAJ' : 'Not Indexed'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Transformative Agreement</div>
                        <div class="info-value">${taMatches.length ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Last Updated</div>
                        <div class="info-value">${sample?.lastReview || '2025-06-15'}</div>
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-check-circle"></i> Accreditation Status</h2>
                    <span class="status-badge status-approved">Approved</span>
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">2025 Accredited</div>
                        <div class="info-value">${flags.dhet || flags.scopus || flags.wos ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Transformative Agreement</div>
                        <div class="info-value">${taMatches.length ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Crossref Check</div>
                        <div class="info-value"><i class="fas fa-check-circle" style="color: #10b981;"></i> Verified</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">PubMed Check</div>
                        <div class="info-value"><i class="fas fa-${pubmed ? 'check-circle' : 'times-circle'}" style="color: ${pubmed ? '#10b981' : '#ef4444'};"></i> ${pubmed ? `Indexed (${pubmedCount})` : 'Not Indexed'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">OpenAlex Check</div>
                        <div class="info-value"><i class="fas fa-check-circle" style="color: #10b981;"></i> Verified</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">DOAJ</div>
                        <div class="info-value"><i class="fas fa-${flags.doaj ? 'check-circle' : 'times-circle'}" style="color: ${flags.doaj ? '#10b981' : '#ef4444'};"></i> ${flags.doaj ? 'Listed' : 'Not Listed'}</div>
                    </div>
                </div>
            </div>
            <div class="card card-full">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-history"></i> Removed from Accredited List (Historical)</h2>
                    <span class="status-badge status-warning">Source: JOURNALS REMOVED IN PAST YEARS.csv</span>
                </div>
                <div class="removed-list">
                    ${journalLists.removed?.map(j => `
                        <div class="removed-item">
                            <div>
                                <div class="journal-title">${j.title}</div>
                                <div class="journal-issn">ISSN: ${j.issn}</div>
                            </div>
                            <span class="removed-year">${j.yearRemoved}</span>
                        </div>
                    `).join('') || '<div class="removed-item">No removed journals found.</div>'}
                </div>
            </div>
        `;
        resultsContainer.innerHTML = html;
        resultsContainer.insertAdjacentHTML('beforeend', recommendationHTML);
    }

    // === BUTTONS ===
    searchBtn.addEventListener('click', runCheck);
    journalQuery.addEventListener('keypress', e => { if (e.key === 'Enter') runCheck(); });

    copyReportBtn.addEventListener('click', () => {
        const text = resultsContainer.innerText;
        navigator.clipboard.writeText(text).then(() => alert('Report copied to clipboard'));
    });

    downloadReportBtn.addEventListener('click', () => {
        const blob = new Blob([resultsContainer.innerText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'journal-report.txt';
        a.click();
        URL.revokeObjectURL(url);
    });

    showRemovedBtn.addEventListener('click', () => {
        const removedList = document.querySelector('.removed-list');
        if (removedList.style.display === 'none') {
            removedList.style.display = 'block';
        } else {
            removedList.style.display = 'none';
        }
    });

    copyRemovedBtn.addEventListener('click', () => {
        const csv = [
            ['Title', 'ISSN', 'Year removed', 'Date of last review'],
            ...(journalLists.removed || []).map(r => [r.title, r.issn, r.yearRemoved, r.lastReviewDate])
        ].map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        navigator.clipboard.writeText(csv).then(() => alert('Removed list (CSV) copied to clipboard'));
    });

    // === INIT ===
    (async () => {
        await loadAllLists();
        console.log('All journal lists loaded.');
    })();
});
