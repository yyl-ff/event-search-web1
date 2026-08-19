const el = id => document.getElementById(id);
const results = el('results');
const details = el('details');
const tip = el('error-tip');


const categoryMap = {
  "Default": "",
  "Music": "KZFzniwnSyZfZ7v7nJ",          // Ticketmaster segmentId for Music
  "Sports": "KZFzniwnSyZfZ7v7nE",         // Sports
  "Arts & Theatre": "KZFzniwnSyZfZ7v7na", // Arts & Theatre
  "Film": "KZFzniwnSyZfZ7v7nn",           // Film
  "Miscellaneous": "KZFzniwnSyZfZ7v7n1"   // Miscellaneous
};


function applyAutoLocUI() {
  const auto = document.getElementById("auto-loc").checked;
  const locInput = document.getElementById("location");
  const locInputWrap = document.getElementById("location-input-wrap");
  locInputWrap.style.display = auto ? "none" : "block";
  if (auto) {
    locInputWrap.style.display = "none";
    locInput.removeAttribute("required");
  } else {
    locInputWrap.style.display = "block";
    locInput.setAttribute("required", "required");
  }
};

// Input state persistence
window.addEventListener('DOMContentLoaded', () => {
  const saved = JSON.parse(sessionStorage.getItem('form') || '{}');
  if (saved.keyword) el('keyword').value = saved.keyword;
  if (saved.distance) el('distance').value = saved.distance;
  if (saved.category) el('category').value = saved.category;
  if (saved.auto) el('auto-loc').checked = true;
  if (saved.location) el('location').value = saved.location;

  applyAutoLocUI();

  el('auto-loc').addEventListener('change', applyAutoLocUI);
});

// Clear: restore default and clear result area
el('btn-clear').addEventListener('click', () => {
  el('keyword').value = '';
  el('distance').value = '';
  el('category').value = '';
  el('auto-loc').checked = false;
  el('location').value = '';
  el('results').innerHTML = '';
  el('details').innerHTML = '';
  results.innerHTML = '';
  details.innerHTML = '';
  tip.classList.add('hidden');
  sessionStorage.removeItem('form');
  applyAutoLocUI();
});

// Clear location error message
el('location').addEventListener('input', () => {
  document.getElementById('location-error').textContent = '';  // Clear error message
  document.getElementById('location-error').style.display = 'none';  // When input location, hide error message
});

// Form submission
el('search-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  tip.classList.add('hidden');

  const keyword = el('keyword').value.trim();
  let distance = el('distance').value.trim();
  if (!distance) distance = '10';
  const category = el('category').value;
  const segmentId = categoryMap[category] || "";
  const auto = el('auto-loc').checked;
  const locationStr = el('location').value.trim();

  // Validate required fields
  let formIsValid = true;

  // Validate keyword
  if (!keyword) {
    formIsValid = false;
    document.getElementById('keyword-error').textContent = 'Please fill out this field.';
    document.getElementById('keyword-error').style.display = 'inline';
    el('keyword').setCustomValidity('Please fill out this field.');
  }

  // Validate location
  if (!locationStr && !auto) {
    formIsValid = false;
    document.getElementById('location-error').textContent = 'Please fill out this field.';
    document.getElementById('location-error').style.display = 'inline';
    el('location').setCustomValidity('Please fill out this field.');
  }

  if (!formIsValid) {
    return;
  }

  el('keyword').setCustomValidity('');
  el('location').setCustomValidity('');

  // Save input state so it remains after results are displayed
  sessionStorage.setItem('form', JSON.stringify({ keyword, distance, category, auto, location: locationStr }));

  // Get location (lat/lng)
  let lat, lng;
  try {
    if (auto) {
      const res = await fetch('./api/ip-location');
      if (!res.ok) throw new Error("IP location request failed");
      const j = await res.json();
      if (!j.loc) throw new Error("IPInfo response missing loc");
      [lat, lng] = j.loc.split(',').map(parseFloat);
      if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid lat/lng from IPInfo");
    } else {
      const qs = new URLSearchParams({ address: locationStr }).toString();
      const res = await fetch(`./api/geocode?${qs}`);
      if (!res.ok) throw new Error("Geocoding request failed");
      const loc = await res.json();
      if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
        throw new Error("Invalid address");
      }
      lat = loc.lat;
      lng = loc.lng;
    }
  } catch (err) {
    tip.textContent = 'Failed to resolve location.';
    tip.classList.remove('hidden');
    return;
  }

  // Call backend API to search for events
  const qs = new URLSearchParams({
    keyword, distance, lat, lng, segmentId
  }).toString();

  const resp = await fetch(`./api/search?${qs}`);
  const data = await resp.json();
  renderTable(data);
});

function renderTable(data) {
  details.innerHTML = '';
  if (!data._embedded || !data._embedded.events || data._embedded.events.length === 0) {
    results.innerHTML = `<div class="card">No records found</div>`;
    return;
  }
  const rows = data._embedded.events.map(ev => {
    const date = ev.dates?.start?.localDate || 'N/A';
    const time = ev.dates?.start?.localTime || '';
    const icon = ev.images?.[0]?.url || '';
    const name = ev.name || 'N/A';
    const id = ev.id;
    const genre = ev.classifications?.[0] || {};
    const gtext = genre.segment?.name || 'N/A';
    const venue = ev._embedded?.venues?.[0]?.name || 'N/A';
    return { date: `${date} ${time}`, icon, name, id, gtext, venue };
  });

  let sortKey = null, asc = true;
  const head = `
  <colgroup>
    <col style="width:18%">
    <col style="width:18%">
    <col style="width:28%">
    <col style="width:15%">
    <col style="width:25%">
  </colgroup>
    <thead><tr>
      <th>Date</th>
      <th>Icon</th>
      <th class="sortable" data-k="name">Event</th>
      <th class="sortable" data-k="gtext">Genre</th>
      <th class="sortable" data-k="venue">Venue</th>
    </tr></thead>
  `;

  const table = document.createElement('table');
  table.innerHTML = head + `<tbody>${renderBody(rows)}</tbody>`;
  results.innerHTML = ''; results.appendChild(table);

  table.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const k = th.dataset.k;
      if (sortKey === k) asc = !asc; else { sortKey = k; asc = true; }
      rows.sort((a,b)=> a[k].localeCompare(b[k]) * (asc?1:-1));
      table.querySelector('tbody').innerHTML = renderBody(rows);
    });
  });

  table.querySelectorAll('.event-link').forEach(link => {
  link.addEventListener('click', async (e) => {
    const eventId = e.target.dataset.id;

    // Get event details
    const resp = await fetch(`./api/event?id=${eventId}`);
    const detailData = await resp.json();

    // Call detail rendering
    renderDetails(detailData);

    // Scroll to the details section
    document.getElementById('details').scrollIntoView({ behavior: 'smooth' });
  });
});
}

function renderBody(rows) {
  return rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${r.icon ? `<img src="${r.icon}" alt="" style="width:72px;height:48px;object-fit:cover;">` : ''}</td>
      <td><a href="javascript:void(0)" class="event-link" data-id="${r.id}">${r.name}</a></td>
      <td>${r.gtext}</td>
      <td>${r.venue}</td>
    </tr>
  `).join('');
}

function renderDetails(ev){
  const start = ev.dates?.start;
  const date  = [start?.localDate, start?.localTime].filter(Boolean).join(' ') || 'N/A';
  const atts  = ev._embedded?.attractions || [];
  const artists = atts.map(a=>`<a href="${a.url}" target="_blank" rel="noopener">${a.name}</a>`).join(' | ') || 'N/A';
  const venue = ev._embedded?.venues?.[0]?.name || 'N/A';

  const cl = ev.classifications?.[0] || {};
  const genres = [cl.segment?.name, cl.genre?.name, cl.subGenre?.name].filter(Boolean);
  const genre = genres.slice(0, 2).join(' | ') || 'N/A';

  const pr = ev.priceRanges?.[0];
  const price = pr ? `${pr.min} - ${pr.max}` : 'N/A';

  const status = ev.dates?.status?.code || 'N/A';
  let statusText = 'N/A';

  if (/onsale/i.test(status)) statusText = 'On Sale';
  else if (/offsale/i.test(status)) statusText = 'Off Sale';
  else if (/canceled/i.test(status)) statusText = 'Canceled';
  else if (/postponed/i.test(status)) statusText = 'Postponed';
  else if (/rescheduled/i.test(status)) statusText = 'Rescheduled';

  const badge = `<span class="badge ${statusText.replace(/\s+/g, '-').toLowerCase()}">${statusText}</span>`;

  const buy = ev.url ? `<a href="${ev.url}" target="_blank" rel="noopener">Ticketmaster</a>` : 'N/A';
  const seat = ev.seatmap?.staticUrl ? `<img class="seatmap" src="${ev.seatmap.staticUrl}" alt="Seat Map">` : '';

  details.innerHTML = `
    <div class="details-card">
      <h2 class="details-title">${ev.name || 'Event Details'}</h2>

      <div class="details-grid">
        <!-- Left column: text -->
        <div>
          <div class="detail-row"><b>Date</b><div class="val">${date}</div></div>
          <div class="detail-row"><b>Artist/Team</b><div class="val">${artists}</div></div>
          <div class="detail-row"><b>Venue</b><div class="val">${venue}</div></div>
          <div class="detail-row"><b>Genres</b><div class="val">${genre}</div></div>
          <div class="detail-row"><b>Ticket Status</b><div class="val">${badge}</div></div>
          <div class="detail-row"><b>Buy Ticket At:</b><div class="val">${buy}</div></div>
        </div>

        <!-- Right column: seating chart -->
        <div>${seat || ''}</div>
      </div>
    </div>

    <p class="toggle" id="toggleVenue">
      Show Venue Details
      <br>
      <span class="arrow"></span>
    </p>
    <div id="venueCard"></div>
  `;
  

  const btn = document.getElementById('toggleVenue');
  if(btn){
    btn.addEventListener('click', async () => {
      try{
        const r = await fetch('./api/venue?' + new URLSearchParams({ keyword: venue }));
        const j = await r.json();
        const v = j._embedded?.venues?.[0];
        const addr = v?.address?.line1 || 'N/A';
        const city = v?.city?.name || 'N/A';
        const state= v?.state?.stateCode || 'N/A';
        const zip  = v?.postalCode || 'N/A';
        const whole= [v?.name, addr, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(', ');
        const gmap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(whole)}`;
        const more = v?.url || '#';

        document.getElementById('venueCard').innerHTML = `
          <div class="venue-card">
            <div class="venue-header">
              <h2>${v?.name || 'N/A'}</h2>
              ${v?.images?.[0]?.url ? `<img src="${v.images[0].url}" alt="${v.name}" class="venue-logo">` : ''}
            </div>
            <div class="venue-content">
              <div class="venue-left">
              <div class="address-row">
                <div class="label">Address:</div>
                <div class="value">${addr}<br>${city}, ${state} ${zip}</div>
              </div>
                <p><a href="${gmap}" target="_blank" rel="noopener">Open in Google Maps</a></p>
              </div>

              <div class="venue-right">
                <p><a href="${more}" target="_blank" rel="noopener">More events at this venue</a></p>
              </div>
            </div>
          </div>`;
        btn.style.display='none';
        document.getElementById('venueCard').scrollIntoView({behavior:'smooth'});
      }catch(e){ console.error(e); }
    });
  }

  details.scrollIntoView({ behavior:'smooth' });
}

// Event delegation for dynamically created event links
document.addEventListener('click', async (e) => {
  if(e.target.classList.contains('event-link')){
    const eventId = e.target.dataset.id;
    const venueId = e.target.dataset.venueId;
    const resp = await fetch(`/api/event?id=${eventId}`);
    const detailData = await resp.json();
    renderDetails(detailData, venueId);
  }
});
