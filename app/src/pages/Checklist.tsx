import { useEffect, useRef, useState } from 'react'
import { EditableText } from '../components/EditableText'
import {
  loadChecklistData,
  loadEssentialsData,
  loadStops,
  saveChecklistData,
  saveEssentialsData,
  saveStops,
  updateItem,
  people,
  personOrder,
  currentUser,
  type ChecklistCategory,
  type EssentialsCategory,
  type PersonalSection,
  type Stop,
} from '../lib/tripData'
import { ChecklistRow } from './checklist/ChecklistRow'
import { defaultCategories, defaultPersonalSections } from './checklist/data'
import { EssentialsPanel } from './checklist/EssentialsPanel'

type Tab = 'condivisa' | 'valigia'
type ViewMode = 'categoria' | 'persona'

export function Checklist() {
  const [tab, setTab] = useState<Tab>('condivisa')
  const [viewMode, setViewMode] = useState<ViewMode>('categoria')
  const [categories, setCategories] = useState<ChecklistCategory[]>(defaultCategories)
  const [personalSections, setPersonalSections] = useState<PersonalSection[]>(defaultPersonalSections)
  const [stops, setStops] = useState<Stop[]>([])
  const [essentialsCategories, setEssentialsCategories] = useState<EssentialsCategory[]>([])
  const [activeEssentialId, setActiveEssentialId] = useState<string | null>(null)
  const [focusItemId, setFocusItemId] = useState<string | null>(null)
  const loaded = useRef(false)
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const saved = loadChecklistData()
    if (saved) {
      setCategories(saved.categories)
      setPersonalSections(saved.personalSections)
    }
    setStops(loadStops())
    setEssentialsCategories(loadEssentialsData().categories)
    loaded.current = true
  }, [])

  useEffect(() => {
    if (loaded.current) saveChecklistData({ categories, personalSections })
  }, [categories, personalSections])

  useEffect(() => {
    if (!focusItemId) return
    const el = itemRefs.current[focusItemId]
    if (el) {
      el.focus()
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    setFocusItemId(null)
  }, [focusItemId])

  function persistStops(next: Stop[]) {
    setStops(next)
    saveStops(next)
  }

  function persistEssentials(next: EssentialsCategory[]) {
    setEssentialsCategories(next)
    saveEssentialsData({ categories: next })
  }

  // ---- shared checklist mutations ----
  function toggleItem(catId: string, itemId: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, done: !it.done })) })))
  }
  function deleteItem(catId: string, itemId: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) })))
  }
  function updateItemLabel(catId: string, itemId: string, label: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, label: label || it.label })) })))
  }
  function cycleAssignee(catId: string, itemId: string) {
    setCategories((cs) =>
      cs.map((c) =>
        c.id !== catId
          ? c
          : {
              ...c,
              items: c.items.map((it) => {
                if (it.id !== itemId) return it
                const idx = personOrder.indexOf(it.assignee || currentUser)
                const next = personOrder[(idx + 1) % personOrder.length]
                return { ...it, assignee: next }
              }),
            },
      ),
    )
  }
  function addItemToCategory(catId: string) {
    const id = 'i' + Date.now()
    setFocusItemId(id)
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, items: [...c.items, { id, label: 'Nuova voce', done: false, assignee: currentUser }] })))
  }
  function addCategory() {
    const id = 'c' + Date.now()
    setFocusItemId(id)
    setCategories((cs) => [...cs, { id, emoji: '📌', name: 'Nuova sezione', items: [] }])
  }
  function updateCategoryName(catId: string, name: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, name: name || c.name })))
  }
  function updateCategoryEmoji(catId: string, emoji: string) {
    setCategories((cs) => cs.map((c) => (c.id !== catId ? c : { ...c, emoji: emoji || c.emoji })))
  }

  // ---- personal checklist mutations ----
  function togglePersonalItem(sectionId: string, itemId: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: s.items.map((it) => (it.id !== itemId ? it : { ...it, done: !it.done })) })))
  }
  function deletePersonalItem(sectionId: string, itemId: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: s.items.filter((it) => it.id !== itemId) })))
  }
  function updatePersonalItemLabel(sectionId: string, itemId: string, label: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: s.items.map((it) => (it.id !== itemId ? it : { ...it, label: label || it.label })) })))
  }
  function addPersonalItem(sectionId: string) {
    const id = 'pi' + Date.now()
    setFocusItemId(id)
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, items: [...s.items, { id, label: 'Nuova voce', done: false }] })))
  }
  function addPersonalSection() {
    const id = 'ps' + Date.now()
    setFocusItemId(id)
    setPersonalSections((ss) => [...ss, { id, emoji: '📦', name: 'Nuova sezione', items: [] }])
  }
  function updatePersonalSectionName(sectionId: string, name: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, name: name || s.name })))
  }
  function updatePersonalSectionEmoji(sectionId: string, emoji: string) {
    setPersonalSections((ss) => ss.map((s) => (s.id !== sectionId ? s : { ...s, emoji: emoji || s.emoji })))
  }

  // ---- essentials mutations ----
  function saveEssentialField(catId: string, entryId: string, field: 'title' | 'subtitle' | 'href', text: string) {
    persistEssentials(
      essentialsCategories.map((c) =>
        c.id !== catId ? c : { ...c, entries: c.entries.map((e) => (e.id !== entryId ? e : { ...e, [field]: text || (e as unknown as Record<string, string>)[field] })) },
      ),
    )
  }
  function attachEssential(catId: string, entryId: string, file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: c.entries.map((e) => (e.id !== entryId ? e : { ...e, attachment: reader.result as string })) })))
    }
    reader.readAsDataURL(file)
  }
  function removeEssentialAttachment(catId: string, entryId: string) {
    persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: c.entries.map((e) => (e.id !== entryId ? e : { ...e, attachment: null })) })))
  }
  function deleteEssentialEntry(catId: string, entryId: string) {
    persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: c.entries.filter((e) => e.id !== entryId) })))
  }
  function addEssentialEntry(catId: string) {
    persistEssentials(essentialsCategories.map((c) => (c.id !== catId ? c : { ...c, entries: [...c.entries, { id: 'ee' + Date.now(), title: 'Nuova voce', subtitle: 'Aggiungi dettagli', tag: '', href: '' }] })))
  }

  // ---- activity (Journey starred-item sub-checklist) mutations ----
  function toggleActivityChecklistItem(stopId: string, catId: string, itemId: string, checklistId: string) {
    const stop = stops.find((s) => s.id === stopId)
    const cat = stop?.categories.find((c) => c.id === catId)
    const item = cat?.items.find((i) => i.id === itemId)
    if (!item) return
    const list = (item.checklist || []).map((c) => (c.id !== checklistId ? c : { ...c, done: !c.done }))
    persistStops(updateItem(stops, stopId, catId, itemId, { checklist: list }))
  }
  function updateActivityChecklistLabel(stopId: string, catId: string, itemId: string, checklistId: string, label: string) {
    const stop = stops.find((s) => s.id === stopId)
    const cat = stop?.categories.find((c) => c.id === catId)
    const item = cat?.items.find((i) => i.id === itemId)
    if (!item) return
    const list = (item.checklist || []).map((c) => (c.id !== checklistId ? c : { ...c, label: label || c.label }))
    persistStops(updateItem(stops, stopId, catId, itemId, { checklist: list }))
  }

  // ---- derived data ----
  const activityGroups = stops.flatMap((stop) =>
    stop.categories.flatMap((cat) =>
      cat.items
        .filter((item) => item.checklist && item.checklist.length > 0)
        .map((item) => {
          const done = (item.checklist || []).filter((c) => c.done).length
          return {
            key: `${stop.id}:${cat.id}:${item.id}`,
            icon: cat.icon,
            title: `${item.label} · ${stop.name}`,
            countLabel: `${done}/${item.checklist!.length}`,
            items: (item.checklist || []).map((c) => ({
              ...c,
              toggle: () => toggleActivityChecklistItem(stop.id, cat.id, item.id, c.id),
              save: (text: string) => updateActivityChecklistLabel(stop.id, cat.id, item.id, c.id, text),
            })),
          }
        }),
    ),
  )

  const flat = categories.flatMap((c) => c.items.map((it) => ({ ...it, catEmoji: c.emoji, catName: c.name, catId: c.id })))
  const totalItems = flat.length
  const doneItems = flat.filter((i) => i.done).length
  const percent = totalItems ? Math.round((doneItems / totalItems) * 100) : 0
  const assignedToYou = flat.filter((i) => i.assignee === currentUser).length

  const personGroups = personOrder
    .map((code) => {
      const person = people[code]
      const items = flat.filter((i) => i.assignee === code)
      const done = items.filter((i) => i.done).length
      return { code, name: person.name, color: person.color, countLabel: `${done}/${items.length}`, items }
    })
    .filter((g) => g.items.length > 0)

  const mySharedItems = flat.filter((i) => i.assignee === currentUser)
  const mySharedDone = mySharedItems.filter((i) => i.done).length

  const personalTotal = mySharedItems.length + personalSections.reduce((a, s) => a + s.items.length, 0)
  const personalDone = mySharedDone + personalSections.reduce((a, s) => a + s.items.filter((i) => i.done).length, 0)
  const personalPercent = personalTotal ? Math.round((personalDone / personalTotal) * 100) : 0

  const showCelebrateCondivisa = totalItems > 0 && doneItems === totalItems
  const showCelebrateValigia = personalTotal > 0 && personalDone === personalTotal

  const tabBtnClass = (active: boolean) =>
    `flex-1 rounded-[11px] py-2.25 text-center text-[12.5px] font-bold ${active ? 'bg-white text-[var(--color-text)] shadow-[0_4px_10px_-6px_rgba(120,90,40,.4)]' : 'text-[var(--color-text-secondary)]'}`
  const viewBtnClass = (active: boolean) =>
    `flex-1 rounded-[10px] py-2 text-center text-xs font-bold ${active ? 'bg-white text-[var(--color-text)] shadow-[0_3px_8px_-5px_rgba(120,90,40,.4)]' : 'text-[var(--color-text-secondary)]'}`

  return (
    <div className="mx-auto min-h-svh max-w-md bg-[var(--color-cream)] px-4.5 pb-24 pt-8 text-[var(--color-text)]">
      <div className="mb-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-1.5 font-display text-[19px] font-semibold italic text-[var(--color-coral)]">🦩 Piña</a>
        <a href="/" className="whitespace-nowrap rounded-xl border border-[var(--color-card-border)] bg-white px-3.5 py-1.75 text-xs font-bold text-[var(--color-text)]">🏠 Home</a>
      </div>

      <div className="mb-4 font-display text-2xl font-semibold">Checklist</div>

      <div className="mb-4.5 flex gap-1 rounded-[13px] bg-[#f0e5d1] p-1">
        <button type="button" className={tabBtnClass(tab === 'condivisa')} onClick={() => setTab('condivisa')}>Condivisa</button>
        <button type="button" className={tabBtnClass(tab === 'valigia')} onClick={() => setTab('valigia')}>La mia valigia</button>
      </div>

      {tab === 'condivisa' ? (
        <div>
          <div className="mb-3.5 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(217,72,31,.45)]" style={{ background: 'linear-gradient(135deg,#ff8a5b,#d9481f)' }}>
            <div className="mb-1 text-xs font-bold text-white/85">🧳 Si parte tra 12 giorni</div>
            <div className="mb-2.5 font-display text-xl font-bold leading-tight">Essentials del viaggio</div>
            <div className="text-xs font-bold">{percent}% completato · {assignedToYou} assegnate a te</div>
          </div>

          <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">📎 Riferimenti</div>
          <EssentialsPanel
            categories={essentialsCategories}
            activeId={activeEssentialId}
            onSetActive={(id) => setActiveEssentialId((cur) => (cur === id ? null : id))}
            onSaveField={saveEssentialField}
            onAttach={attachEssential}
            onRemoveAttachment={removeEssentialAttachment}
            onDeleteEntry={deleteEssentialEntry}
            onAddEntry={addEssentialEntry}
          />

          {activityGroups.length > 0 && (
            <div className="mb-4">
              <div className="mx-0.5 mb-2.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Attività</div>
              {activityGroups.map((ag) => (
                <div key={ag.key} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                  <div className="flex items-center gap-2.5 px-3.5 py-3.25">
                    <span className="text-lg">{ag.icon}</span>
                    <span className="flex-1 text-[14.5px] font-bold">{ag.title}</span>
                    <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{ag.countLabel}</span>
                  </div>
                  <div className="border-t border-dashed border-[var(--color-card-border)]">
                    {ag.items.map((it) => (
                      <ChecklistRow key={it.id} done={it.done} label={it.label} onToggle={it.toggle} onSaveLabel={it.save} doneColor="#2a8fd8" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mb-4 flex gap-1 rounded-[13px] bg-[#f0e5d1] p-1">
            <button type="button" className={viewBtnClass(viewMode === 'categoria')} onClick={() => setViewMode('categoria')}>Per categoria</button>
            <button type="button" className={viewBtnClass(viewMode === 'persona')} onClick={() => setViewMode('persona')}>Per persona</button>
          </div>

          <div className="mx-0.5 mb-2.5 mt-4.5 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">✅ Da fare</div>

          {viewMode === 'categoria' ? (
            <div>
              {categories.map((cat) => {
                const done = cat.items.filter((i) => i.done).length
                return (
                  <div key={cat.id} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                    <div className="flex items-center gap-2.5 px-3.5 py-3.25">
                      <EditableText
                        key={'emoji-' + cat.emoji}
                        initialText={cat.emoji}
                        className="text-lg"
                        onBlurText={(text) => updateCategoryEmoji(cat.id, text)}
                      />
                      <EditableText
                        ref={(el) => { itemRefs.current[cat.id] = el }}
                        key={'name-' + cat.name}
                        initialText={cat.name}
                        className="flex-1 text-[14.5px] font-bold"
                        onBlurText={(text) => updateCategoryName(cat.id, text)}
                      />
                      <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{done}/{cat.items.length}</span>
                      <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fdeee0] text-[15px] font-bold text-[var(--color-coral)]" onClick={() => addItemToCategory(cat.id)}>+</button>
                    </div>
                    <div className="border-t border-dashed border-[var(--color-card-border)]">
                      {cat.items.map((it) => (
                        <ChecklistRow
                          key={it.id}
                          itemRef={(el) => { itemRefs.current[it.id] = el }}
                          done={it.done}
                          label={it.label}
                          onToggle={() => toggleItem(cat.id, it.id)}
                          onSaveLabel={(text) => updateItemLabel(cat.id, it.id, text)}
                          onDelete={() => deleteItem(cat.id, it.id)}
                          avatarColor={people[it.assignee || currentUser].color}
                          assigneeCode={it.assignee || currentUser}
                          onCycleAssignee={() => cycleAssignee(cat.id, it.id)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
              <button type="button" className="mb-3 w-full rounded-2xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-3 text-center text-[12.5px] font-bold text-[var(--color-add-text)]" onClick={addCategory}>
                + Aggiungi sezione
              </button>
            </div>
          ) : (
            <div>
              {personGroups.map((grp) => (
                <div key={grp.code} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                  <div className="flex items-center gap-2.5 bg-[var(--color-bg)] px-3.5 py-3.25">
                    <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: grp.color }}>{grp.code}</div>
                    <span className="flex-1 text-[14.5px] font-bold">{grp.name}</span>
                    <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{grp.countLabel}</span>
                  </div>
                  <div>
                    {grp.items.map((it) => (
                      <ChecklistRow
                        key={it.id}
                        itemRef={(el) => { itemRefs.current[it.id] = el }}
                        done={it.done}
                        label={it.label}
                        onToggle={() => toggleItem(it.catId, it.id)}
                        onSaveLabel={(text) => updateItemLabel(it.catId, it.id, text)}
                        onDelete={() => deleteItem(it.catId, it.id)}
                        catTag={`${it.catEmoji} ${it.catName}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showCelebrateCondivisa && (
            <div className="mt-1.5 rounded-[20px] border-[1.5px] border-[var(--color-add-border)] bg-[#fffaf0] p-5 text-center">
              <div
                className="mx-auto mb-2.5 flex h-21 w-21 items-center justify-center rounded-full text-center font-mono text-[8.5px] font-semibold text-[var(--color-add-text)]"
                style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }}
              >
                fenicottero con zaino
              </div>
              <div className="mb-0.75 font-display text-base font-semibold">Tutto pronto!</div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Si parte 🎉</div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4.5 rounded-[26px] p-5 text-white shadow-[0_18px_36px_-18px_rgba(40,150,180,.45)]" style={{ background: 'linear-gradient(135deg,#2fbfae,#2a8fd8)' }}>
            <div className="mb-1 text-xs font-bold text-white/85">🎒 La tua valigia</div>
            <div className="mb-3.5 font-display text-[22px] font-bold leading-tight">{personalDone} di {personalTotal} pronte</div>
            <div className="mb-1.75 h-2 overflow-hidden rounded-full bg-white/28">
              <div className="h-full rounded-full bg-white" style={{ width: `${personalPercent}%` }} />
            </div>
            <div className="text-xs font-bold">{personalPercent}% completato</div>
          </div>

          <div className="mx-0.5 mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">Il tuo condiviso</div>
          <div className="mb-4.5 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
            <div className="flex items-center gap-2.5 px-3.5 py-3.25">
              <span className="text-lg">🔗</span>
              <span className="flex-1 text-[14.5px] font-bold">Dalla checklist condivisa</span>
              <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{mySharedDone}/{mySharedItems.length}</span>
            </div>
            <div className="border-t border-dashed border-[var(--color-card-border)]">
              {mySharedItems.map((it) => (
                <ChecklistRow
                  key={it.id}
                  done={it.done}
                  label={it.label}
                  onToggle={() => toggleItem(it.catId, it.id)}
                  onSaveLabel={(text) => updateItemLabel(it.catId, it.id, text)}
                  onDelete={() => deleteItem(it.catId, it.id)}
                  catTag={`${it.catEmoji} ${it.catName}`}
                />
              ))}
            </div>
          </div>

          <div className="mx-0.5 mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-[var(--color-eyebrow)]">La tua valigia</div>
          {personalSections.map((sec) => {
            const done = sec.items.filter((i) => i.done).length
            return (
              <div key={sec.id} className="mb-3 overflow-hidden rounded-[20px] border border-[var(--color-card-border)] bg-white shadow-[0_8px_18px_-14px_rgba(120,90,40,.25)]">
                <div className="flex items-center gap-2.5 px-3.5 py-3.25">
                  <EditableText key={'e' + sec.emoji} initialText={sec.emoji} className="text-lg" onBlurText={(text) => updatePersonalSectionEmoji(sec.id, text)} />
                  <EditableText
                    ref={(el) => { itemRefs.current[sec.id] = el }}
                    key={'n' + sec.name}
                    initialText={sec.name}
                    className="flex-1 text-[14.5px] font-bold"
                    onBlurText={(text) => updatePersonalSectionName(sec.id, text)}
                  />
                  <span className="text-[11.5px] font-bold text-[var(--color-eyebrow)]">{done}/{sec.items.length}</span>
                  <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full bg-[#fdeee0] text-[15px] font-bold text-[var(--color-coral)]" onClick={() => addPersonalItem(sec.id)}>+</button>
                </div>
                <div className="border-t border-dashed border-[var(--color-card-border)]">
                  {sec.items.map((it) => (
                    <ChecklistRow
                      key={it.id}
                      itemRef={(el) => { itemRefs.current[it.id] = el }}
                      done={it.done}
                      label={it.label}
                      onToggle={() => togglePersonalItem(sec.id, it.id)}
                      onSaveLabel={(text) => updatePersonalItemLabel(sec.id, it.id, text)}
                      onDelete={() => deletePersonalItem(sec.id, it.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          <button type="button" className="mb-3 w-full rounded-2xl border-[1.5px] border-dashed border-[var(--color-add-border)] py-3 text-center text-[12.5px] font-bold text-[var(--color-add-text)]" onClick={addPersonalSection}>
            + Aggiungi sezione
          </button>

          {showCelebrateValigia && (
            <div className="mt-1.5 rounded-[20px] border-[1.5px] border-[var(--color-add-border)] bg-[#fffaf0] p-5 text-center">
              <div
                className="mx-auto mb-2.5 flex h-21 w-21 items-center justify-center rounded-full text-center font-mono text-[8.5px] font-semibold text-[var(--color-add-text)]"
                style={{ background: 'repeating-linear-gradient(45deg,#ffe6cf,#ffe6cf 6px,#fff1e0 6px,#fff1e0 12px)' }}
              >
                fenicottero con valigia
              </div>
              <div className="mb-0.75 font-display text-base font-semibold">Valigia pronta!</div>
              <div className="text-xs font-semibold text-[var(--color-text-secondary)]">Non manca niente 🎒</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
