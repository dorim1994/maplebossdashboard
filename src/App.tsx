import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { bosses as initialBosses, characters as initialCharacters, weeklyBossClears as initialWeeklyBossClears } from "./data";
import { Boss, Character, WeeklyBossClear } from "./types";
import { formatWeekRange, getWeekKey } from "./utils/week";

const currency = new Intl.NumberFormat("ko-KR");
const CHARACTER_STORAGE_KEY = "maple-dashboard-characters";
const BOSS_STORAGE_KEY = "maple-dashboard-bosses";
const WEEKLY_CLEARS_STORAGE_KEY = "maple-dashboard-weekly-clears";

type CharacterFormState = { characterName: string; jobName: string; combatPower: string };
type BossFormState = { bossId: string; requiredCombatPower: string; crystalPrice: string };
type BossDifficultyFilter = "ALL" | "EASY" | "NORMAL" | "HARD" | "CHAOS";
type CharacterSummary = { character: Character; clearCount: number; weeklyIncome: number; clearedBosses: Boss[] };

const emptyCharacterForm: CharacterFormState = { characterName: "", jobName: "", combatPower: "" };
const emptyBossForm: BossFormState = { bossId: "", requiredCombatPower: "", crystalPrice: "" };

const formatMeso = (value: number) => `${currency.format(value)} meso`;
const formatCombatPower = (value: number) => (value >= 100_000_000 ? `${(value / 100_000_000).toFixed(1)}e` : value >= 10_000 ? `${Math.round(value / 10_000)}w` : currency.format(value));
const formatRequiredCombatPower = (value: number | null) => (value === null ? "TBD" : formatCombatPower(value));
const getDifficultyLabel = (difficulty: string) => ({ EASY: "Easy", NORMAL: "Normal", HARD: "Hard", CHAOS: "Chaos" }[difficulty] ?? difficulty);
const getDifficultyClassName = (difficulty: string) => `difficulty-${difficulty.toLowerCase()}`;
const sanitizeNumericInput = (value: string) => value.replace(/[^\d,]/g, "");

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try { return JSON.parse(stored) as T; } catch { return fallback; }
}

function parseWeekKey(weekKey: string) {
  const [year, month, day] = weekKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function App() {
  const [bosses, setBosses] = useState<Boss[]>(() => readStorage(BOSS_STORAGE_KEY, initialBosses));
  const [characters, setCharacters] = useState<Character[]>(() => readStorage(CHARACTER_STORAGE_KEY, initialCharacters));
  const [weeklyBossClears, setWeeklyBossClears] = useState<WeeklyBossClear[]>(() => readStorage(WEEKLY_CLEARS_STORAGE_KEY, initialWeeklyBossClears));
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingBossId, setEditingBossId] = useState<string | null>(null);
  const [isCharacterFormOpen, setIsCharacterFormOpen] = useState(false);
  const [isCharacterEditMode, setIsCharacterEditMode] = useState(false);
  const [characterForm, setCharacterForm] = useState(emptyCharacterForm);
  const [bossForm, setBossForm] = useState(emptyBossForm);
  const [bossSearch, setBossSearch] = useState("");
  const [bossDifficultyFilter, setBossDifficultyFilter] = useState<BossDifficultyFilter>("ALL");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const currentWeekKey = useMemo(() => getWeekKey(currentDate), [currentDate]);
  const [selectedWeekKey, setSelectedWeekKey] = useState(currentWeekKey);
  const previousCurrentWeekKeyRef = useRef(currentWeekKey);

  const isCurrentWeekSelected = selectedWeekKey === currentWeekKey;
  const selectedWeekDate = useMemo(() => parseWeekKey(selectedWeekKey), [selectedWeekKey]);

  useEffect(() => window.localStorage.setItem(BOSS_STORAGE_KEY, JSON.stringify(bosses)), [bosses]);
  useEffect(() => window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters)), [characters]);
  useEffect(() => window.localStorage.setItem(WEEKLY_CLEARS_STORAGE_KEY, JSON.stringify(weeklyBossClears)), [weeklyBossClears]);
  useEffect(() => { if (!selectedCharacterId || !characters.some((it) => it.characterId === selectedCharacterId)) setSelectedCharacterId(characters[0]?.characterId ?? ""); }, [characters, selectedCharacterId]);
  useEffect(() => { const timer = window.setInterval(() => setCurrentDate(new Date()), 60 * 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setSelectedWeekKey((current) => current === previousCurrentWeekKeyRef.current ? currentWeekKey : weeklyBossClears.some((it) => it.weekKey === current) ? current : currentWeekKey); previousCurrentWeekKeyRef.current = currentWeekKey; }, [currentWeekKey, weeklyBossClears]);

  const bossMap = useMemo(() => new Map(bosses.map((boss) => [boss.bossId, boss])), [bosses]);
  const availableWeekKeys = useMemo(() => [...new Set([...weeklyBossClears.map((it) => it.weekKey), currentWeekKey])].sort((a, b) => b.localeCompare(a)), [currentWeekKey, weeklyBossClears]);
  const clearsForWeek = useMemo(() => weeklyBossClears.filter((it) => it.weekKey === selectedWeekKey && it.isCleared), [selectedWeekKey, weeklyBossClears]);
  const characterSummaries = useMemo<CharacterSummary[]>(() => [...characters].sort((a, b) => b.combatPower - a.combatPower).map((character) => {
    const clearedBosses = clearsForWeek.filter((it) => it.characterId === character.characterId).map((it) => bossMap.get(it.bossId)).filter((boss): boss is Boss => Boolean(boss));
    return { character, clearCount: clearedBosses.length, weeklyIncome: clearedBosses.reduce((sum, boss) => sum + boss.crystalPrice, 0), clearedBosses };
  }), [bossMap, characters, clearsForWeek]);
  const selectedSummary = characterSummaries.find((summary) => summary.character.characterId === selectedCharacterId);
  const selectedCharacter = selectedSummary?.character;
  const selectedClears = useMemo(() => clearsForWeek.filter((it) => it.characterId === selectedCharacterId), [clearsForWeek, selectedCharacterId]);
  const clearedBossIdSet = useMemo(() => new Set(selectedClears.map((it) => it.bossId)), [selectedClears]);
  const selectedBossRows = useMemo(() => {
    if (!selectedCharacter) return [];
    const q = bossSearch.trim().toLowerCase();
    return bosses.filter((boss) => (bossDifficultyFilter === "ALL" || boss.difficulty === bossDifficultyFilter) && (q === "" || boss.bossName.toLowerCase().includes(q) || getDifficultyLabel(boss.difficulty).toLowerCase().includes(q))).map((boss) => ({ boss, isCleared: clearedBossIdSet.has(boss.bossId), isEligible: boss.requiredCombatPower === null ? null : selectedCharacter.combatPower >= boss.requiredCombatPower }));
  }, [bossDifficultyFilter, bossSearch, bosses, clearedBossIdSet, selectedCharacter]);
  const dashboardStats = useMemo(() => ({ totalWeeklyIncome: characterSummaries.reduce((sum, item) => sum + item.weeklyIncome, 0), totalWeeklyClearCount: characterSummaries.reduce((sum, item) => sum + item.clearCount, 0), totalCharacterCount: characters.length }), [characterSummaries, characters.length]);
  const unknownBosses = selectedBossRows.filter((item) => item.isEligible === null);
  const bossOptions = useMemo(() => [...bosses].sort((a, b) => a.bossName === b.bossName ? a.difficulty.localeCompare(b.difficulty, "ko") : a.bossName.localeCompare(b.bossName, "ko")), [bosses]);

  function resetCharacterForm() { setEditingCharacterId(null); setCharacterForm(emptyCharacterForm); setIsCharacterFormOpen(false); }
  function openCharacterCreateModal() { setEditingCharacterId(null); setCharacterForm(emptyCharacterForm); setIsCharacterFormOpen(true); }
  function resetBossForm() { setEditingBossId(null); setBossForm(emptyBossForm); }

  function handleCharacterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const characterName = characterForm.characterName.trim();
    const jobName = characterForm.jobName.trim();
    const combatPower = Number(characterForm.combatPower.replace(/,/g, "").trim());
    if (!characterName || !jobName || Number.isNaN(combatPower) || combatPower <= 0) return;
    if (editingCharacterId) { setCharacters((current) => current.map((character) => character.characterId === editingCharacterId ? { ...character, characterName, jobName, combatPower } : character)); resetCharacterForm(); return; }
    const newCharacter: Character = { characterId: makeId("char"), characterName, jobName, combatPower };
    setCharacters((current) => [...current, newCharacter]); setSelectedCharacterId(newCharacter.characterId); resetCharacterForm();
  }

  function startEditingCharacter(character: Character) { setEditingCharacterId(character.characterId); setSelectedCharacterId(character.characterId); setIsCharacterFormOpen(true); setCharacterForm({ characterName: character.characterName, jobName: character.jobName, combatPower: String(character.combatPower) }); }
  function deleteCharacter(characterId: string) { setCharacters((current) => current.filter((character) => character.characterId !== characterId)); setWeeklyBossClears((current) => current.filter((clear) => clear.characterId !== characterId)); if (editingCharacterId === characterId) resetCharacterForm(); }

  function handleBossSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bossId = bossForm.bossId;
    const crystalPrice = Number(bossForm.crystalPrice.replace(/,/g, "").trim());
    const parsedRequiredCombatPower = bossForm.requiredCombatPower.trim() === "" ? null : Number(bossForm.requiredCombatPower.replace(/,/g, "").trim());
    if (!bossId || Number.isNaN(crystalPrice) || crystalPrice <= 0) return;
    if (parsedRequiredCombatPower !== null && (Number.isNaN(parsedRequiredCombatPower) || parsedRequiredCombatPower < 0)) return;
    setBosses((current) => current.map((boss) => boss.bossId === bossId ? { ...boss, requiredCombatPower: parsedRequiredCombatPower, crystalPrice } : boss));
    resetBossForm();
  }

  function startEditingBoss(boss: Boss) { setEditingBossId(boss.bossId); setBossForm({ bossId: boss.bossId, requiredCombatPower: boss.requiredCombatPower === null ? "" : String(boss.requiredCombatPower), crystalPrice: String(boss.crystalPrice) }); }

  function toggleBossClear(bossId: string) {
    if (!selectedCharacter || !isCurrentWeekSelected) return;
    setWeeklyBossClears((current) => {
      const targetBoss = bossMap.get(bossId); if (!targetBoss) return current;
      const existing = current.find((it) => it.weekKey === selectedWeekKey && it.characterId === selectedCharacter.characterId && it.bossId === bossId);
      if (existing) return current.map((it) => it.weeklyBossClearId === existing.weeklyBossClearId ? { ...it, isCleared: !it.isCleared, clearedAt: new Date().toISOString() } : it);
      const conflictingIds = new Set(current.filter((it) => it.weekKey === selectedWeekKey && it.characterId === selectedCharacter.characterId).filter((it) => bossMap.get(it.bossId)?.bossName === targetBoss.bossName).map((it) => it.weeklyBossClearId));
      const next = current.map((it) => conflictingIds.has(it.weeklyBossClearId) ? { ...it, isCleared: false, clearedAt: new Date().toISOString() } : it);
      return [...next, { weeklyBossClearId: makeId("clear"), weekKey: selectedWeekKey, characterId: selectedCharacter.characterId, bossId, clearedAt: new Date().toISOString(), isCleared: true }];
    });
  }

  return <div className="app-shell"><div className="aurora aurora-left" /><div className="aurora aurora-right" /><header className="hero"><div className="hero-copy"><p className="eyebrow">Maple Weekly Operations</p><h1>Maple Boss Dashboard</h1><div className="hero-meta"><span>{isCurrentWeekSelected ? "Current Week" : "Viewed Week"}</span><strong>{selectedWeekKey}</strong><em>{formatWeekRange(selectedWeekDate)}</em></div></div><div className="hero-panel"><label className="week-selector"><span>Week Select</span><select value={selectedWeekKey} onChange={(event) => setSelectedWeekKey(event.target.value)}>{availableWeekKeys.map((weekKey) => <option key={weekKey} value={weekKey}>{weekKey === currentWeekKey ? `${weekKey} (Current)` : weekKey}</option>)}</select></label><div className="signal-card"><span>Total Weekly Income</span><strong>{formatMeso(dashboardStats.totalWeeklyIncome)}</strong></div><div className="signal-grid"><article><span>Characters</span><strong>{dashboardStats.totalCharacterCount}</strong></article><article><span>Weekly Clears</span><strong>{dashboardStats.totalWeeklyClearCount}</strong></article></div></div></header><main className="dashboard-grid"><section className="panel roster-panel"><div className="panel-heading"><div><p className="eyebrow">Roster</p><h2>Character List</h2></div><div className="panel-actions"><button className={`collapse-button ${isCharacterEditMode ? "is-active" : ""}`} type="button" onClick={() => setIsCharacterEditMode((current) => !current)}>{isCharacterEditMode ? "Edit Mode ON" : "Edit Mode"}</button><button className="collapse-button add-button" type="button" onClick={openCharacterCreateModal}>Add</button></div></div>{characterSummaries.length === 0 ? <div className="empty-state"><strong>No characters registered.</strong><p>Add a character to start tracking weekly boss clears and income.</p></div> : <div className="roster-strip">{characterSummaries.map((summary) => { const isSelected = summary.character.characterId === selectedCharacterId; const isComplete = summary.clearCount === 12; return <div key={summary.character.characterId} className={`roster-card ${isSelected ? "selected" : ""}`}><button className="roster-main" onClick={() => setSelectedCharacterId(summary.character.characterId)} type="button"><div className="roster-title"><div><strong>{summary.character.characterName} / {summary.character.jobName}</strong></div></div><div className="roster-metrics-grid compact"><div className="metric-box"><span>Combat Power</span><strong>{formatCombatPower(summary.character.combatPower)}</strong></div><div className={`metric-box clear-state ${isComplete ? "is-complete" : "is-incomplete"}`}><span>Clear Status</span><strong>{summary.clearCount} / 12</strong><em>{isComplete ? "Done" : "In Progress"}</em></div><div className="metric-box metric-box-wide"><span>Income</span><strong>{formatMeso(summary.weeklyIncome)}</strong></div></div></button>{isCharacterEditMode ? <div className="card-actions"><button className="secondary-button" type="button" onClick={() => startEditingCharacter(summary.character)}>Edit</button><button className="danger-button" type="button" onClick={() => deleteCharacter(summary.character.characterId)}>Delete</button></div> : null}</div>; })}</div>}</section><section className="panel detail-panel"><div className="panel-heading"><div><p className="eyebrow">Character Detail</p><h2>{selectedCharacter?.characterName ?? "Select a character"}</h2></div></div>{selectedSummary ? <><div className="detail-summary compact-detail"><article><span>Job</span><strong>{selectedSummary.character.jobName}</strong></article><article><span>Combat Power</span><strong>{formatCombatPower(selectedSummary.character.combatPower)}</strong></article><article><span>Weekly Income</span><strong>{formatMeso(selectedSummary.weeklyIncome)}</strong></article><article><span>Weekly Clear</span><strong>{selectedSummary.clearCount} / 12</strong></article></div><div className="boss-columns compact-columns"><div className="boss-column wide"><div className="column-title"><h3>Cleared Bosses</h3><span>{selectedSummary.clearedBosses.length} clears</span></div><div className="boss-chip-list">{selectedSummary.clearedBosses.length === 0 ? <span className="boss-chip">No boss has been cleared yet.</span> : selectedSummary.clearedBosses.map((boss) => <span key={boss.bossId} className="boss-chip cleared">{boss.bossName}</span>)}</div></div></div>{editingBossId ? <section className="boss-admin"><div className="panel-heading"><div><p className="eyebrow">Boss Admin</p><h2>Edit Boss Info</h2></div></div><form className="boss-form" onSubmit={handleBossSubmit}><div className="boss-form-grid"><label><span>Boss</span><select value={bossForm.bossId} onChange={(event) => { const nextBoss = bosses.find((boss) => boss.bossId === event.target.value); setBossForm({ bossId: event.target.value, requiredCombatPower: nextBoss?.requiredCombatPower === null ? "" : String(nextBoss?.requiredCombatPower ?? ""), crystalPrice: nextBoss ? String(nextBoss.crystalPrice) : "" }); }}><option value="">Select a boss</option>{bossOptions.map((boss) => <option key={boss.bossId} value={boss.bossId}>{boss.bossName} / {getDifficultyLabel(boss.difficulty)}</option>)}</select></label><label><span>Required Power</span><input inputMode="numeric" value={bossForm.requiredCombatPower} onChange={(event) => setBossForm((current) => ({ ...current, requiredCombatPower: sanitizeNumericInput(event.target.value) }))} placeholder="Example: 180000000" /></label><label><span>Crystal Price</span><input inputMode="numeric" value={bossForm.crystalPrice} onChange={(event) => setBossForm((current) => ({ ...current, crystalPrice: sanitizeNumericInput(event.target.value) }))} placeholder="Example: 396000000" /></label></div><div className="form-actions"><button type="submit">Save Boss</button><button className="secondary-button" type="button" onClick={resetBossForm}>Cancel</button></div></form></section> : null}{unknownBosses.length > 0 ? <div className="notice-box"><strong>{unknownBosses.length} boss entries have no power requirement.</strong><p>Eligibility is not calculated for bosses with no required combat power.</p></div> : null}{!isCurrentWeekSelected ? <div className="notice-box"><strong>Past week view</strong><p>Past records are read-only. Only the current week can be edited.</p></div> : null}<div className="boss-toolbar"><label className="boss-search"><span>Search Boss</span><input value={bossSearch} onChange={(event) => setBossSearch(event.target.value)} placeholder="Search by boss name or difficulty" /></label><div className="boss-filter-group" role="group" aria-label="Boss difficulty filter">{[{ value: "ALL", label: "All" }, { value: "EASY", label: "Easy" }, { value: "NORMAL", label: "Normal" }, { value: "HARD", label: "Hard" }, { value: "CHAOS", label: "Chaos" }].map((filter) => <button key={filter.value} className={`filter-chip ${bossDifficultyFilter === filter.value ? "is-active" : ""}`} type="button" onClick={() => setBossDifficultyFilter(filter.value as BossDifficultyFilter)}>{filter.label}</button>)}</div></div><div className="boss-table-wrap"><table className="boss-table"><thead><tr><th>Check</th><th>Boss</th><th>Difficulty</th><th>Required Power</th><th>Eligible</th><th>Crystal Price</th><th>Edit</th></tr></thead><tbody>{selectedBossRows.length === 0 ? <tr><td colSpan={7} className="boss-table-empty">No boss matches the current filter.</td></tr> : selectedBossRows.map(({ boss, isEligible, isCleared }) => <tr key={boss.bossId}><td><label className="checkbox-wrap"><input checked={isCleared} disabled={!isCurrentWeekSelected} onChange={() => toggleBossClear(boss.bossId)} type="checkbox" /><span>{isCleared ? "Cleared" : "Not Cleared"}</span></label></td><td>{boss.bossName}</td><td><span className={`difficulty-badge ${getDifficultyClassName(boss.difficulty)}`}>{getDifficultyLabel(boss.difficulty)}</span></td><td>{formatRequiredCombatPower(boss.requiredCombatPower)}</td><td><span className={`eligibility ${isEligible === null ? "unknown" : isEligible ? "good" : "bad"}`}>{isEligible === null ? "TBD" : isEligible ? "Ready" : "Low"}</span></td><td>{formatMeso(boss.crystalPrice)}</td><td><button className="secondary-button" type="button" onClick={() => startEditingBoss(boss)}>Edit</button></td></tr>)}</tbody></table></div></> : <div className="empty-state"><strong>No character selected.</strong><p>Add a character or select one from the list.</p></div>}</section></main>{isCharacterFormOpen ? <div className="modal-overlay" role="presentation" onClick={resetCharacterForm}><div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="character-modal-title" onClick={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">Character Setup</p><h2 id="character-modal-title">{editingCharacterId ? "Edit Character" : "Create Character"}</h2></div><button className="collapse-button" type="button" onClick={resetCharacterForm}>Close</button></div><form className="setup-form modal-form" onSubmit={handleCharacterSubmit}><div className="form-heading"><h3>{editingCharacterId ? "Update character info" : "Add a new character"}</h3><span>Enter name, job, and combat power.</span></div><label><span>Character Name</span><input value={characterForm.characterName} onChange={(event) => setCharacterForm((current) => ({ ...current, characterName: event.target.value }))} placeholder="Example: Mercedes" /></label><label><span>Job</span><input value={characterForm.jobName} onChange={(event) => setCharacterForm((current) => ({ ...current, jobName: event.target.value }))} placeholder="Example: Hero" /></label><label><span>Combat Power</span><input inputMode="numeric" value={characterForm.combatPower} onChange={(event) => setCharacterForm((current) => ({ ...current, combatPower: sanitizeNumericInput(event.target.value) }))} placeholder="Example: 85000000" /></label><div className="form-actions"><button type="submit">{editingCharacterId ? "Save Character" : "Add Character"}</button>{editingCharacterId ? <button className="secondary-button" type="button" onClick={resetCharacterForm}>Cancel</button> : null}</div></form></div></div> : null}</div>;
}

export default App;
