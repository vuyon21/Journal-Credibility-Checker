// JavaScript for the Journal Credibility Checker
document.addEventListener('DOMContentLoaded', function() {
    const searchBtn = document.getElementById('searchBtn');
    const journalQuery = document.getElementById('journalQuery');
    const resultsContainer = document.getElementById('resultsContainer');
    const copyReportBtn = document.getElementById('copyReportBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    const showRemovedBtn = document.getElementById('showRemovedBtn');
    const copyRemovedBtn = document.getElementById('copyRemovedBtn');
    
    // Sample data for demonstration
    const sampleJournalData = {
        'Nature Communications': {
            title: 'Nature Communications',
            issn: '2041-1723',
            publisher: 'Springer Nature',
            impactFactor: '17.694',
            openAccess: 'Hybrid',
            indexedIn: 'PubMed, Scopus, DOAJ',
            accredited: 'Yes',
            transformativeAgreement: 'Yes',
            crossref: true,
            pubmed: true,
            openAlex: true,
            lastUpdated: '2025-06-15'
        },
        'Science': {
            title: 'Science',
            issn: '0036-8075',
            publisher: 'American Association for the Advancement of Science',
            impactFactor: '63.714',
            openAccess: 'Hybrid',
            indexedIn: 'PubMed, Scopus, Web of Science',
            accredited: 'Yes',
            transformativeAgreement: 'No',
            crossref: true,
            pubmed: true,
            openAlex: true,
            lastUpdated: '2025-06-10'
        },
        'PLOS ONE': {
            title: 'PLOS ONE',
            issn: '1932-6203',
            publisher: 'Public Library of Science',
            impactFactor: '3.240',
            openAccess: 'Full',
            indexedIn: 'PubMed, Scopus, DOAJ',
            accredited: 'Yes',
            transformativeAgreement: 'Yes',
            crossref: true,
            pubmed: true,
            openAlex: true,
            lastUpdated: '2025-06-12'
        }
    };
    
    // Sample removed journals list
    const removedJournals = [
        { title: 'Journal of Questionable Studies', issn: '1234-5678', year: '2024' },
        { title: 'International Journal of Non-credible Research', issn: '2345-6789', year: '2023' },
        { title: 'Quick Publication Review', issn: '3456-7890', year: '2023' },
        { title: 'Studies in Predatory Publishing', issn: '4567-8901', year: '2022' },
        { title: 'Fast Science Express', issn: '5678-9012', year: '2022' }
    ];
    
    // Search button event listener
    searchBtn.addEventListener('click', function() {
        const query = journalQuery.value.trim();
        if (query === '') {
            alert('Please enter a journal title or ISSN');
            return;
        }
        
        // Show loading state
        showLoading();
        
        // Simulate API call delay
        setTimeout(() => {
            // Find journal data (in a real app, this would be an API call)
            let journalData = null;
            
            // Check if query matches any known journal
            for (const key in sampleJournalData) {
                if (key.toLowerCase().includes(query.toLowerCase()) || 
                    sampleJournalData[key].issn === query) {
                    journalData = sampleJournalData[key];
                    break;
                }
            }
            
            // If no journal found, show error
            if (!journalData) {
                showError('Journal not found in database');
                return;
            }
            
            // Display journal data
            displayJournalData(journalData);
        }, 1500);
    });
    
    // Copy report button event listener
    copyReportBtn.addEventListener('click', function() {
        // In a real application, this would copy the report data
        alert('Report copied to clipboard');
    });
    
    // Download report button event listener
    downloadReportBtn.addEventListener('click', function() {
        // In a real application, this would download the report
        alert('Report downloaded as PDF');
    });
    
    // Show removed journals button event listener
    showRemovedBtn.addEventListener('click', function() {
        // This already visible in the UI, but could be expanded
        alert('Showing removed journals list');
    });
    
    // Copy removed list button event listener
    copyRemovedBtn.addEventListener('click', function() {
        // In a real application, this would copy the removed journals list
        alert('Removed journals list copied to clipboard');
    });
    
    // Show loading state
    function showLoading() {
        resultsContainer.innerHTML = `
            <div class="card card-full">
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Loading journal data...</p>
                </div>
            </div>
        `;
    }
    
    // Show error state
    function showError(message) {
        resultsContainer.innerHTML = `
            <div class="card card-full">
                <div class="loading">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger);"></i>
                    <p>${message}</p>
                    <button id="tryAgainBtn" style="margin-top: 15px;">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            </div>
        `;
        
        // Add event listener to try again button
        document.getElementById('tryAgainBtn').addEventListener('click', function() {
            journalQuery.value = '';
            journalQuery.focus();
            
            // Reset to initial state
            displaySampleData();
        });
    }
    
    // Display journal data in the UI
    function displayJournalData(data) {
        resultsContainer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-info-circle"></i> Journal Information</h2>
                    <span class="status-badge status-verified">Verified</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Journal Title</div>
                        <div class="info-value">${data.title}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">ISSN</div>
                        <div class="info-value">${data.issn}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Publisher</div>
                        <div class="info-value">${data.publisher}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Impact Factor</div>
                        <div class="info-value">${data.impactFactor}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Open Access</div>
                        <div class="info-value">${data.openAccess}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Indexed in</div>
                        <div class="info-value">${data.indexedIn}</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-check-circle"></i> Accreditation Status</h2>
                    <span class="status-badge status-verified">Approved</span>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">2025 Accredited</div>
                        <div class="info-value">${data.accredited}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Transformative Agreement</div>
                        <div class="info-value">${data.transformativeAgreement}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Crossref Check</div>
                        <div class="info-value"><i class="fas fa-${data.crossref ? 'check-circle' : 'times-circle'}" style="color: ${data.crossref ? 'var(--success)' : 'var(--danger)'};"></i> ${data.crossref ? 'Verified' : 'Not Verified'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">PubMed Check</div>
                        <div class="info-value"><i class="fas fa-${data.pubmed ? 'check-circle' : 'times-circle'}" style="color: ${data.pubmed ? 'var(--success)' : 'var(--danger)'};"></i> ${data.pubmed ? 'Indexed' : 'Not Indexed'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">OpenAlex Check</div>
                        <div class="info-value"><i class="fas fa-${data.openAlex ? 'check-circle' : 'times-circle'}" style="color: ${data.openAlex ? 'var(--success)' : 'var(--danger)'};"></i> ${data.openAlex ? 'Verified' : 'Not Verified'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Last Updated</div>
                        <div class="info-value">${data.lastUpdated}</div>
                    </div>
                </div>
            </div>
            
            <div class="card card-full">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-history"></i> Removed from Accredited List (Historical)</h2>
                    <span class="status-badge status-warning">Source: JOURNALS REMOVED IN PAST YEARS.csv</span>
                </div>
                
                <div class="removed-list">
                    ${removedJournals.map(journal => `
                        <div class="removed-item">
                            <div>
                                <div class="journal-title">${journal.title}</div>
                                <div class="journal-issn">ISSN: ${journal.issn}</div>
                            </div>
                            <span class="removed-year">${journal.year}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Display sample data on initial load
    function displaySampleData() {
        displayJournalData(sampleJournalData['Nature Communications']);
    }
    
    // Initialize with sample data
    displaySampleData();
});
