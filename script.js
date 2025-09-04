// ... (previous code remains the same until the mapAccreditedRow function)

/* Map accredited row variants to unified object - FIXED VERSION */
function mapAccreditedRow(cols, header, sourceFileName) {
  // header: array of header strings (may be passed as [] if unknown)
  const h = header.map(x => String(x || '').trim());
  const get = (names) => {
    // return first column that matches any of names (case/space-insensitive)
    const idx = h.findIndex(hname => names.some(n => hname.replace(/\s+/g,'').toLowerCase() === n.replace(/\s+/g,'').toLowerCase()));
    return (idx >= 0 && cols[idx]) ? cols[idx].trim() : '';
  };

  // For SCIELO specifically, we need special handling
  const isScielo = sourceFileName.includes('SCIELO');
  
  // fallback if header not provided (some CSVs may be just columns with standard order)
  const fallbackTitle = cols[0] || '';
  const fallbackISSN = cols[1] || '';
  const fallbackEISSN = cols[2] || '';
  const fallbackPublisher = cols[3] || '';

  const title = get(['Journal title (Previous title if applicable)','Journal title','Journaltitle','Title']) || fallbackTitle;
  const issn = get(['ISSN','PrintISSN','pISSN']) || fallbackISSN;
  const eissn = get(['eISSN','EISSN','OnlineISSN']) || fallbackEISSN;
  const lastReview = get(['DATE OF LAST REVIEW OR ACCREDITATION','Date of Last Review or Accreditation','LastReview','AccreditedDate','Reviewed']) || '';
  const international = get(['International Accreditation','International','Index']) || '';
  const frequency = get(['FREQUENCY','Frequency']) || '';
  
  // Special handling for SCIELO files which have a different structure
  let publisher = get(['Publisher','Publisher details','Publisherdetails','Publisher’sdetails']) || fallbackPublisher;
  
  // If it's SCIELO and the publisher field contains what looks like a date (review info),
  // extract it to the proper field and keep the actual publisher
  if (isScielo && publisher.match(/\b(19|20)\d{2}\b/)) {
    // Extract the review date from the publisher field
    const reviewMatch = publisher.match(/\b(Reviewed|Review|Accredited)?\s*(19|20)\d{2}\b/);
    if (reviewMatch) {
      lastReview = reviewMatch[0];
      // Remove the review info from the publisher field
      publisher = publisher.replace(reviewMatch[0], '').replace(/\s+/g, ' ').trim();
    }
  }

  // Determine the source list type from filename
  let listType = 'Unknown';
  if (sourceFileName.includes('DHET')) listType = 'DHET';
  else if (sourceFileName.includes('DOAJ')) listType = 'DOAJ';
  else if (sourceFileName.includes('IBSS')) listType = 'IBSS';
  else if (sourceFileName.includes('NORWEGIAN')) listType = 'NORWEGIAN';
  else if (sourceFileName.includes('SCIELO')) listType = 'SCIELO';
  else if (sourceFileName.includes('SCOPUS')) listType = 'SCOPUS';
  else if (sourceFileName.includes('WOS')) listType = 'WOS';

  return {
    title: title || '',
    titleNorm: normalize(title || ''),
    issn: (issn || '').replace(/\s+/g,''),
    eissn: (eissn || '').replace(/\s+/g,''),
    publisher: publisher || '',
    lastReview: lastReview || '',
    international: international || '',
    frequency: frequency || '',
    source: 'accredited',
    listType: listType
  };
}

// ... (previous code remains the same until the doSearch function)

async function doSearch(rawQuery){
  const query = (typeof rawQuery === 'string' && rawQuery.trim()) ? rawQuery.trim() : qInput.value.trim();
  if(!query) { errBox.style.display='block'; errBox.textContent = 'Enter a journal title or ISSN'; setTimeout(()=>errBox.style.display='none',4000); return; }

  // UI reset
  loadingEl.style.display = 'block';
  reportContainer.innerHTML = '';

  // offline matches
  const norm = normalize(query);
  const issnQuery = looksISSN(query) ? query.replace(/-/g,'') : null;

  // find accredited
  const accreditedHits = accredited.filter(j => {
    const p = (j.issn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    const e = (j.eissn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    return (issnQuery && (p === issnQuery || e === issnQuery)) || j.titleNorm === norm || (j.titleNorm.includes(norm) && norm.length > 2);
  });

  // Get unique list types from accredited hits
  const foundInLists = [...new Set(accreditedHits.map(hit => hit.listType))].filter(Boolean);

  // transformative
  const taHits = transformList.filter(t => {
    const e = (t.eissn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    return (issnQuery && e === issnQuery) || t.titleNorm === norm || (t.titleNorm.includes(norm) && norm.length > 2);
  });

  // removed
  const removedMatch = removedList.some(r => {
    const p = (r.issn || '').replace(/[^0-9Xx]/g,'').toLowerCase();
    return (issnQuery && p === issnQuery) || r.titleNorm === norm || (r.titleNorm.includes(norm) && norm.length > 2);
  });

  // Live API lookups (best-effort)
  const live = { crossref: null, openalex: null, pubmedCount: null };
  try{
    const [cr, oa, pm] = await Promise.all([
      fetchCrossRef( accreditedHits[0]?.eissn || accreditedHits[0]?.issn || taHits[0]?.eissn || taHits[0]?.issn || query ),
      fetchOpenAlex( accreditedHits[0]?.eissn || accreditedHits[0]?.issn || taHits[0]?.eissn || taHits[0]?.issn || query ),
      fetchPubMedCount(accreditedHits[0]?.title || taHits[0]?.title || query)
    ]);
    live.crossref = cr;
    live.openalex = oa;
    live.pubmedCount = pm;
  }catch(e){
    console.warn('Live lookups partially failed', e);
  }

  // Recommendation logic
  let recText = '';
  let recClass = '';
  if(removedMatch){
    recText = '❌ Not recommended: Appears on the "Removed 4rm Previous Accredited List".';
    recClass = 'removed';
  } else if(accreditedHits.length && taHits.length){
    recText = '✅ Recommended: Appears in credible indexes and is included in a Transformative Agreement.';
    recClass = 'accredited';
  } else if(accreditedHits.length){
    recText = '✅ Recommended: Appears in credible indexes.';
    recClass = 'accredited';
  } else if(taHits.length){
    recText = '⚠️ Verify: Not in 2025 accredited lists, but appears in a Transformative Agreement.';
    recClass = 'transformative';
  } else {
    recText = '⚠️ Not found in key lists — please verify with your Faculty Librarian.';
    recClass = 'live';
  }

  // Build report sections as separate tables
  const parts = [];

  // Journal Identification - FIXED: Use proper publisher info
  const idTitle = accreditedHits[0]?.title || taHits[0]?.title || qInput.value || query;
  const idPublisher = accreditedHits[0]?.publisher || taHits[0]?.publisher || live.crossref?.publisher || live.openalex?.publisher || '';
  const idISSN = [accreditedHits[0]?.issn, accreditedHits[0]?.eissn, taHits[0]?.eissn].filter(Boolean).join(' | ');
  const identificationRows = [
    ['Journal Title', idTitle],
    ['ISSN', idISSN || 'N/A'],
    ['Publisher', idPublisher || 'Unknown']
  ];
  
  // Add Last Review field if available
  if (accreditedHits[0]?.lastReview) {
    identificationRows.push(['Last Review', accreditedHits[0].lastReview]);
  }
  
  parts.push({ title: 'Journal Identification', rows: identificationRows });

  // Accreditation Checks - FIXED: Show which lists journal was found in
  const accRows = [
    ['Found in 2025 Accredited Lists', accreditedHits.length ? `Yes (${foundInLists.join(', ')})` : 'No'],
    ['Removed 4rm Previous Accredited List', removedMatch ? 'Yes (historical)' : 'No']
  ];
  parts.push({ title: 'Accreditation Checks', rows: accRows });

  // Transformative Agreements
  const taRows = [];
  if(taHits.length){
    const t = taHits[0];
    taRows.push(['Transformative', t.included || 'Yes']);
    if(t.duration) taRows.push(['Duration', t.duration]);
    if(t.oaStatus) taRows.push(['Open Access Status', t.oaStatus]);
    if(t.publisher) taRows.push(['Publisher', t.publisher]);
    if(t.notes) taRows.push(['Notes', t.notes]);
  } else {
    taRows.push(['Transformative', 'No match found']);
  }
  parts.push({ title: 'Transformative Agreements', rows: taRows });

  // Live Lookups
  const liveRows = [];
  liveRows.push(['CrossRef', live.crossref ? `Found | ${live.crossref.issn ? 'ISSN(s): ' + live.crossref.issn : ''} ${live.crossref?.license ? '| License: ' + live.crossref.license : ''}` : 'No/Unavailable']);
  liveRows.push(['OpenAlex', live.openalex ? `Found | ${live.openalex.issn_l ? 'ISSN-L: ' + live.openalex.issn_l : ''} ${live.openalex?.oa_status ? '| OA: ' + live.openalex.oa_status : ''}` : 'No/Unavailable']);
  liveRows.push(['PubMed (indexed article count)', Number.isFinite(live.pubmedCount) ? String(live.pubmedCount) : 'Not available']);
  parts.push({ title: 'Live Lookups', rows: liveRows });

  // Render parts to DOM
  reportContainer.innerHTML = '';
  for(const part of parts){
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th colspan="2">${escapeHtml(part.title)}</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for(const r of part.rows){
      const tr = document.createElement('tr');
      const tdKey = document.createElement('td');
      tdKey.style.width = '30%';
      tdKey.textContent = r[0];
      const tdVal = document.createElement('td');
      tdVal.innerHTML = r[1] || '';
      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    reportContainer.appendChild(table);
  }

  // Add Recommendation as a special section (not in a table)
  const recContainer = document.createElement('div');
  recContainer.className = `rec ${recClass}`;
  recContainer.style.display = 'block';
  recContainer.style.marginTop = '20px';
  recContainer.style.padding = '15px';
  recContainer.style.borderRadius = '8px';
  recContainer.style.fontWeight = 'bold';
  recContainer.style.border = '1px solid transparent';
  recContainer.innerHTML = `<h3 style="margin:0 0 10px 0;">Recommendation</h3><p style="margin:0; font-size:16px;">${recText}</p>`;
  
  // Add to the end of the report container
  reportContainer.appendChild(recContainer);

  loadingEl.style.display = 'none';
}

// ... (rest of the code remains the same)
