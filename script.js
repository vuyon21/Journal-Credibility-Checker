// Update the doSearch function to fix the mapping issues and improve the report

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
