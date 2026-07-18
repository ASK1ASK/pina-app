// Shared trip data store used by Journey and Today.
// Single source of truth for stops/categories/items, persisted to localStorage
// so edits made on one screen (e.g. starring an item, renaming it) show up on the other.

export const STORAGE_KEY = 'pina-trip-stops';

// Shared crew — same set used by Checklist and the Design System avatar palette.
// TODO: once onboarding persists the participants a user actually enters when
// creating a trip, swap this for that stored list. For now it's the fixed crew
// every screen already assumes.
export const people = {
  A: { name: 'Andrea', color: '#ff8a5b' },
  L: { name: 'Luca', color: '#3ddbc5' },
  M: { name: 'Marco', color: '#7a9d54' },
  S: { name: 'Sara', color: '#ff5f96' },
  G: { name: 'Giulia', color: '#ffb627' },
};
export const personOrder = ['A', 'L', 'M', 'S', 'G'];
export const currentUser = 'A';

// ---- Expenses (Spese) ----------------------------------------------------
export const EXPENSES_STORAGE_KEY = 'pina-trip-expenses';

export const defaultExpensesData = {
  expenses: [
    { id: 'e1', title: 'Aperitivo sulla spiaggia', icon: '🍹', amount: 38, paidBy: 'A', splitAmong: ['A', 'L', 'M', 'S', 'G'], dateLabel: 'Oggi · Barcellona', note: '' },
    { id: 'e2', title: 'Spesa Mercadona', icon: '🛒', amount: 54, paidBy: 'G', splitAmong: ['A', 'L', 'M', 'S', 'G'], dateLabel: 'Oggi · Barcellona', note: '' },
    { id: 'e3', title: 'Pieno carburante', icon: '⛽', amount: 83, paidBy: 'M', splitAmong: ['A', 'L', 'M', 'S', 'G'], dateLabel: 'Ieri · Girona', note: '' },
    { id: 'e4', title: 'Camping Girona', icon: '🏕️', amount: 64, paidBy: 'A', splitAmong: ['A', 'L', 'M', 'S', 'G'], dateLabel: 'Ieri · Girona', note: '' },
  ],
  settlements: [],
  cassaContributions: [
    { id: 'c1', person: 'A', amount: 50 },
    { id: 'c2', person: 'L', amount: 50 },
    { id: 'c3', person: 'M', amount: 50 },
    { id: 'c4', person: 'S', amount: 50 },
    { id: 'c5', person: 'G', amount: 50 },
  ],
};

export function loadExpensesData() {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.expenses)) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultExpensesData));
}

export function saveExpensesData(data) {
  try { localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// ---- Emergency contacts (shared across the whole crew) -------------------
export const EMERGENCY_STORAGE_KEY = 'pina-trip-emergency';

export const defaultEmergencyContacts = [
  { id: 'em1', title: 'Emergenza UE', subtitle: '112', href: 'tel:112' },
  { id: 'em2', title: 'Ambasciata italiana Madrid', subtitle: '+34 913 402 500', href: 'tel:+34913402500' },
  { id: 'em3', title: 'Assistenza stradale', subtitle: '+34 900 100 100', href: 'tel:+34900100100' },
  { id: 'em4', title: 'Ospedale più vicino', subtitle: 'Hospital Josep Trueta, Girona', href: '' },
];

export function loadEmergencyContacts() {
  try {
    const raw = localStorage.getItem(EMERGENCY_STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultEmergencyContacts));
}
export function saveEmergencyContacts(list) {
  try { localStorage.setItem(EMERGENCY_STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
}

// ---- Useful links (trip-wide, shared) -------------------------------------
export const LINKS_STORAGE_KEY = 'pina-trip-links';

export const defaultLinks = [
  { id: 'l1', emoji: '🏨', label: 'Booking.com', subtitle: 'Prenotazione Hotel Valencia', url: 'https://booking.com' },
  { id: 'l2', emoji: '🏠', label: 'Airbnb', subtitle: 'Appartamento Barcellona', url: 'https://airbnb.com' },
  { id: 'l3', emoji: '🗺', label: 'Google Maps', subtitle: 'Percorso del viaggio', url: 'https://maps.google.com' },
  { id: 'l4', emoji: '🏕', label: 'Camping Girona', subtitle: 'Sito ufficiale', url: 'https://example.com' },
  { id: 'l5', emoji: '🎶', label: 'Rototom Sunsplash', subtitle: 'Sito festival', url: 'https://rototomsunsplash.com' },
  { id: 'l6', emoji: '🅿️', label: 'App parcheggi', subtitle: 'Parclick', url: 'https://parclick.com' },
];

export function loadLinks() {
  try {
    const raw = localStorage.getItem(LINKS_STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultLinks));
}
export function saveLinks(list) {
  try { localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
}

// ---- Memories (shared photo/video log) ------------------------------------
export const MEMORIES_STORAGE_KEY = 'pina-trip-memories';

export const defaultMemoriesData = {
  days: [
    { id: 'girona', label: 'Girona', dateLabel: '14-15 ago', cover: 'https://picsum.photos/seed/mem-girona-cover/200/200', isToday: false },
    { id: 'bcn', label: 'Barcellona', dateLabel: '16-17 ago', cover: 'https://picsum.photos/seed/mem-bcn-cover/200/200', isToday: true },
  ],
  items: [
    { id: 'i1', dayId: 'bcn', url: 'https://picsum.photos/seed/mem-bcn-1/400/400', isVideo: false, isFavorite: true, caption: 'Tramonto alla Barceloneta', author: 'Sara' },
    { id: 'i2', dayId: 'bcn', url: 'https://picsum.photos/seed/mem-bcn-2/400/400', isVideo: true, isFavorite: false, caption: "Sangria all'aperitivo", author: 'Andrea' },
    { id: 'i3', dayId: 'bcn', url: 'https://picsum.photos/seed/mem-bcn-3/400/400', isVideo: false, isFavorite: false, caption: 'Sagrada Familia', author: 'Luca' },
    { id: 'i4', dayId: 'bcn', url: 'https://picsum.photos/seed/mem-bcn-4/400/400', isVideo: false, isFavorite: true, caption: 'Aperitivo sulla spiaggia', author: 'Giulia' },
    { id: 'i5', dayId: 'bcn', url: 'https://picsum.photos/seed/mem-bcn-5/400/400', isVideo: false, isFavorite: false, caption: 'Passeggiata serale', author: 'Marco' },
    { id: 'i6', dayId: 'bcn', url: 'https://picsum.photos/seed/mem-bcn-6/400/400', isVideo: true, isFavorite: false, caption: 'Musica dal vivo in piazza', author: 'Sara' },
    { id: 'i7', dayId: 'girona', url: 'https://picsum.photos/seed/mem-girona-1/400/400', isVideo: false, isFavorite: true, caption: "Il fiume Onyar", author: 'Luca' },
    { id: 'i8', dayId: 'girona', url: 'https://picsum.photos/seed/mem-girona-2/400/400', isVideo: false, isFavorite: false, caption: 'Cena al camping', author: 'Marco' },
    { id: 'i9', dayId: 'girona', url: 'https://picsum.photos/seed/mem-girona-3/400/400', isVideo: false, isFavorite: false, caption: 'Case colorate', author: 'Andrea' },
    { id: 'i10', dayId: 'girona', url: 'https://picsum.photos/seed/mem-girona-4/400/400', isVideo: false, isFavorite: false, caption: 'Cattedrale di Girona', author: 'Giulia' },
  ],
};

export function loadMemories() {
  try {
    const raw = localStorage.getItem(MEMORIES_STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed && Array.isArray(parsed.items)) return parsed; }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultMemoriesData));
}
export function saveMemories(data) {
  try { localStorage.setItem(MEMORIES_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// ---- Essentials (documents, stays, transport, bookings — shared, trip-wide) ------
export const ESSENTIALS_STORAGE_KEY = 'pina-trip-essentials';

export const defaultEssentialsData = {
  categories: [
    { id: 'doc', emoji: '🪪', name: 'Documenti', gradient: 'linear-gradient(135deg,#ff8a5b,#d9481f)',
      entries: [
        { id: 'd1', title: 'Passaporto', subtitle: 'IT1234567AB · scad. 03/2031', tag: '', href: '' },
        { id: 'd2', title: 'Assicurazione di viaggio', subtitle: 'Europe Assistance · #EU-88213', tag: 'PDF', href: '#' },
        { id: 'd3', title: "Carta d'identità", subtitle: 'AX998877 · scad. 11/2029', tag: '', href: '' },
        { id: 'd4', title: 'Patente', subtitle: 'cat. B · scad. 2028', tag: '', href: '' },
      ] },
    { id: 'stay', emoji: '🏕', name: 'Alloggi', gradient: 'linear-gradient(135deg,#ffb627,#d9481f)',
      entries: [
        { id: 's1', title: 'Camping Girona', subtitle: 'Check-in 14 ago 15:00 · Carrer del Camping 12 · +34 972 123 456', tag: '', href: '' },
        { id: 's2', title: 'Airbnb Barcellona', subtitle: 'Host Marta · Check-in 16 ago 16:00 · Carrer de Mallorca 401', tag: '', href: '' },
        { id: 's3', title: 'Hotel Valencia', subtitle: 'Check-in 18 ago · Gran Vía 22', tag: '', href: '' },
        { id: 's4', title: 'Alloggio Rototom', subtitle: 'Da confermare · zona camping festival', tag: '', href: '' },
      ] },
    { id: 'transport', emoji: '🚐', name: 'Trasporti', gradient: 'linear-gradient(135deg,#8fbf6b,#4f7a3a)',
      entries: [
        { id: 't1', title: 'Volo andata', subtitle: 'FR 3821 · Bergamo → Girona · 14 ago 06:20', tag: '', href: '' },
        { id: 't2', title: 'Volo ritorno', subtitle: 'FR 3822 · Girona → Bergamo · 26 ago 21:40', tag: '', href: '' },
        { id: 't3', title: 'Noleggio auto', subtitle: 'Europcar · targa 4521-KLM · assicurazione full', tag: '', href: '' },
        { id: 't4', title: 'Biglietti Rototom', subtitle: '4x pass intero · QR nella email', tag: 'QR', href: '' },
      ] },
    { id: 'bookings', emoji: '🎟', name: 'Prenotazioni', gradient: 'linear-gradient(135deg,#ffb627,#ff5f6d)',
      entries: [
        { id: 'b1', title: 'Rototom Sunsplash', subtitle: 'Festival · 21-22 ago · Benicàssim', tag: 'QR', href: '' },
        { id: 'b2', title: 'Museo Picasso', subtitle: 'Museo · 17 ago 10:00 · Barcellona', tag: 'PDF', href: '' },
        { id: 'b3', title: 'FC Barcelona vs Real Madrid', subtitle: 'Partita · 19 ago 21:00 · Camp Nou', tag: 'QR', href: '' },
        { id: 'b4', title: 'Tour guidato Sagrada Familia', subtitle: 'Tour guidato · 16 ago 15:00', tag: 'PDF', href: '' },
        { id: 'b5', title: 'PortAventura', subtitle: 'Parco divertimenti · 23 ago · Salou', tag: 'QR', href: '' },
      ] },
  ],
};

export function loadEssentialsData() {
  try {
    const raw = localStorage.getItem(ESSENTIALS_STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed && Array.isArray(parsed.categories)) return parsed; }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultEssentialsData));
}
export function saveEssentialsData(data) {
  try { localStorage.setItem(ESSENTIALS_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// ---- Checklist (persisted so it can be read elsewhere, e.g. the read-only Recap) --
export const CHECKLIST_STORAGE_KEY = 'pina-trip-checklist';

export function loadChecklistData() {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (raw) { const parsed = JSON.parse(raw); if (parsed && Array.isArray(parsed.categories)) return parsed; }
  } catch (e) {}
  return null;
}
export function saveChecklistData(data) {
  try { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

// Net balance per person: positive = is owed money by the group, negative = owes the group.
export function computeBalances(expenses, settlements) {
  const bal = {};
  personOrder.forEach(c => { bal[c] = 0; });
  expenses.forEach(e => {
    const among = (e.splitAmong && e.splitAmong.length) ? e.splitAmong : personOrder;
    const share = e.amount / among.length;
    if (e.paidBy && e.paidBy !== 'cassa' && bal[e.paidBy] !== undefined) bal[e.paidBy] += e.amount;
    among.forEach(p => { if (bal[p] !== undefined) bal[p] -= share; });
  });
  (settlements || []).forEach(s => {
    if (bal[s.from] !== undefined) bal[s.from] += s.amount;
    if (bal[s.to] !== undefined) bal[s.to] -= s.amount;
  });
  return bal;
}

export const defaultStops = [
  { id: 'girona', name: 'Girona', kind: 'done', startDay: 14, endDay: 15, moodId: 'culture', moodLine: '🏛 Culture', dates: '14-15 ago', photo: 'https://picsum.photos/seed/pina-girona/120/120',
    stays: [{ id: 'st-girona', name: '', link: '', days: [14] }],
    categories: [
      { id: 'food', icon: '🍽', label: 'Dove mangiare', items: [] },
      { id: 'nightlife', icon: '🍻', label: 'Bar & Nightlife', items: [] },
      { id: 'places', icon: '📍', label: 'Luoghi da visitare', items: [] },
      { id: 'activities', icon: '🎫', label: 'Attività & Esperienze', items: [] },
    ] },
  { id: 'barcelona', name: 'Barcellona', kind: 'today', startDay: 16, endDay: 17, moodId: 'fiesta', moodLine: '🎉 Fiesta', dates: '16 → 17 agosto', photo: 'https://picsum.photos/seed/pina-barcelona2/700/500',
    stays: [{ id: 'st-bcn', name: 'Hotel Casa Fuster', link: 'https://maps.google.com/?q=Hotel+Casa+Fuster+Barcelona', days: [16] }],
    categories: [
      { id: 'food', icon: '🍽', label: 'Dove mangiare', items: [{ id: 'i1', label: 'La Boqueria', link: 'https://maps.google.com/?q=La+Boqueria', starred: true, days: [],
        checklist: [{ id: 'ac1', label: 'Andare a stomaco vuoto', done: false }, { id: 'ac2', label: 'Contanti per il mercato', done: true }] }] },
      { id: 'nightlife', icon: '🍻', label: 'Bar & Nightlife', items: [{ id: 'i2', label: 'Razzmatazz', link: '', starred: false, days: [] }] },
      { id: 'places', icon: '📍', label: 'Luoghi da visitare', items: [{ id: 'i3', label: 'Sagrada Familia', link: 'https://maps.google.com/?q=Sagrada+Familia', starred: true, days: [],
        checklist: [{ id: 'ac3', label: 'Biglietti prenotati online', done: true }, { id: 'ac4', label: 'Scarpe comode', done: false }] }] },
      { id: 'activities', icon: '🎫', label: 'Attività & Esperienze', items: [] },
    ] },
  { id: 'valencia', name: 'Valencia', kind: 'future', startDay: 18, endDay: 19, moodId: 'beach', moodLine: '🌊 Beach vibes', dates: '18-19 agosto', photo: 'https://picsum.photos/seed/pina-valencia2/140/140', highlight: false,
    stays: [{ id: 'st-val', name: '', link: '', days: [18] }],
    categories: [
      { id: 'food', icon: '🍽', label: 'Dove mangiare', items: [{ id: 'i4', label: 'Mercado Central', link: '', starred: false }] },
      { id: 'nightlife', icon: '🍻', label: 'Bar & Nightlife', items: [] },
      { id: 'places', icon: '📍', label: 'Luoghi da visitare', items: [{ id: 'i5', label: 'Malvarrosa', link: '', starred: false }] },
      { id: 'activities', icon: '🎫', label: 'Attività & Esperienze', items: [] },
    ] },
  { id: 'rototom', name: 'Rototom Sunsplash', kind: 'future', startDay: 21, endDay: 22, moodId: 'fiesta', moodLine: '🎶 Festival', dates: '21-22 agosto', photo: 'https://picsum.photos/seed/pina-rototom2/140/140', highlight: true,
    stays: [{ id: 'st-roto', name: '', link: '', days: [21] }],
    categories: [
      { id: 'food', icon: '🍽', label: 'Dove mangiare', items: [{ id: 'i6', label: 'Food Trucks', link: '', starred: false }] },
      { id: 'nightlife', icon: '🍻', label: 'Bar & Nightlife', items: [] },
      { id: 'places', icon: '📍', label: 'Luoghi da visitare', items: [] },
      { id: 'activities', icon: '🎫', label: 'Attività & Esperienze', items: [{ id: 'i7', label: 'Main Stage', link: '', starred: true }] },
    ] },
  { id: 'malaga', name: 'Malaga', kind: 'future', startDay: 24, endDay: 25, moodId: 'relax', moodLine: '🌅 Sunset', dates: '24-25 agosto', photo: 'https://picsum.photos/seed/pina-malaga2/140/140', highlight: false,
    stays: [{ id: 'st-mlg', name: '', link: '', days: [24] }],
    categories: [
      { id: 'food', icon: '🍽', label: 'Dove mangiare', items: [{ id: 'i8', label: 'El Pimpi', link: '', starred: false }] },
      { id: 'nightlife', icon: '🍻', label: 'Bar & Nightlife', items: [] },
      { id: 'places', icon: '📍', label: 'Luoghi da visitare', items: [{ id: 'i9', label: 'Balcón de Europa', link: '', starred: false }] },
      { id: 'activities', icon: '🎫', label: 'Attività & Esperienze', items: [] },
    ] },
];

export function loadStops() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(defaultStops));
}

export function saveStops(stops) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stops)); } catch (e) {}
}

export function stopDayRange(stop) {
  const start = stop.startDay || 1;
  const end = stop.endDay || start;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function stopNights(stop) {
  const range = stopDayRange(stop);
  return range.length > 1 ? range.slice(0, -1) : range;
}

// Returns every starred item across all stops/categories that applies to the given
// calendar day-of-month (matches the stop's date range, and an item-level `day` if set).
export function starredItemsForDay(stops, dayOfMonth) {
  const out = [];
  stops.forEach(stop => {
    const start = stop.startDay || 1;
    const end = stop.endDay || start;
    if (dayOfMonth < start || dayOfMonth > end) return;
    (stop.categories || []).forEach(cat => {
      (cat.items || []).forEach(item => {
        if (!item.starred) return;
        if (item.day && item.day !== dayOfMonth) return;
        out.push({
          id: item.id,
          stopId: stop.id,
          stopName: stop.name,
          catId: cat.id,
          catIcon: cat.icon,
          catLabel: cat.label,
          label: item.label,
          icon: item.icon || null,
          link: item.link || '',
          usefulLink: item.usefulLink || '',
          booking: item.booking || '',
          notes: item.notes || '',
          time: item.time || '',
        });
      });
    });
  });
  return out;
}

// Mutates (immutably) a single item across the stops tree and returns the new stops array.
export function updateItem(stops, stopId, catId, itemId, patch) {
  return stops.map(st => {
    if (st.id !== stopId) return st;
    return {
      ...st,
      categories: (st.categories || []).map(c => {
        if (c.id !== catId) return c;
        return { ...c, items: c.items.map(it => it.id !== itemId ? it : { ...it, ...patch }) };
      }),
    };
  });
}
