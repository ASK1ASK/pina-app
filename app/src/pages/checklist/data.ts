import type { ChecklistCategory, PersonalSection } from '../../lib/tripData'

export const defaultCategories: ChecklistCategory[] = [
  { id: 'doc', emoji: '📄', name: 'Documenti', items: [
    { id: 'd1', label: "Passaporti e carte d'identità", done: true, assignee: 'A' },
    { id: 'd2', label: 'Assicurazione di viaggio', done: true, assignee: 'A' },
    { id: 'd3', label: 'Documenti noleggio auto', done: false, assignee: 'A' },
  ] },
  { id: 'stay', emoji: '🏕', name: 'Alloggi', items: [
    { id: 's1', label: 'Camping Girona', done: true, assignee: 'L' },
    { id: 's2', label: 'Airbnb Barcellona', done: true, assignee: 'L' },
    { id: 's3', label: 'Hotel Valencia', done: false, assignee: 'L' },
    { id: 's4', label: 'Alloggio Rototom', done: false, assignee: 'M' },
  ] },
  { id: 'transport', emoji: '🚐', name: 'Trasporti', items: [
    { id: 't1', label: 'Voli andata/ritorno', done: true, assignee: 'M' },
    { id: 't2', label: 'Ritiro noleggio auto', done: false, assignee: 'M' },
    { id: 't3', label: 'Biglietti Rototom', done: true, assignee: 'M' },
  ] },
  { id: 'pack', emoji: '🎒', name: 'Packing condiviso', items: [
    { id: 'p1', label: 'Power bank e adattatori', done: false, assignee: 'S' },
    { id: 'p2', label: 'Kit primo soccorso', done: false, assignee: 'G' },
    { id: 'p3', label: 'Altoparlante bluetooth', done: true, assignee: 'S' },
  ] },
]

export const defaultPersonalSections: PersonalSection[] = [
  { id: 'abb', emoji: '👕', name: 'Abbigliamento', items: [
    { id: 'pa1', label: 'Costumi da bagno', done: false },
    { id: 'pa2', label: 'Vestiti per il festival', done: false },
    { id: 'pa3', label: 'Scarpe comode', done: true },
  ] },
  { id: 'elet', emoji: '🔌', name: 'Elettronica', items: [
    { id: 'pe1', label: 'Caricabatterie', done: true },
    { id: 'pe2', label: 'Cuffie', done: false },
  ] },
  { id: 'igiene', emoji: '🧴', name: 'Igiene personale', items: [
    { id: 'pi1', label: 'Spazzolino e dentifricio', done: false },
    { id: 'pi2', label: 'Crema solare', done: false },
  ] },
]
