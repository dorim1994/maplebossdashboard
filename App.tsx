import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  bosses as initialBosses,
  characters as initialCharacters,
  weeklyBossClears as initialWeeklyBossClears,
} from "./data";
import { Boss, Character, WeeklyBossClear } from "./types";
import { formatWeekRange, getWeekKey } from "./utils/week";

const currency = new Intl.NumberFormat("ko-KR");
const currentDate = new Date("2026-03-26T12:00:00+09:00");
const currentWeekKey = getWeekKey(currentDate);
const CHARACTER_STORAGE_KEY = "maple-dashboard-characters";
const BOSS_STORAGE_KEY = "maple-dashboard-bosses";
const WEEKLY_CLEARS_STORAGE_KEY = "maple-dashboard-weekly-clears";
const LEGACY_SAMPLE_NAMES = new Set([
  "?꾨━ ?꾪겕硫붿씠吏",
  "?꾨━ ?섏씠?몃줈??,
  "留곹겕 ?붾씪??,
  "?띿옣 ?뚯슱留덉뒪??,
  "踰꾨떇 移쇰━",
]);

type CharacterSummary = {
  character: Character;
  clearCount: number;
  weeklyIncome: number;
  eligibleBossCount: number;
  ineligibleBossCount: number;
  unknownBossCount: number;
  clearedBosses: Boss[];
};

type CharacterFormState = {
  characterName: string;
  jobName: string;
  combatPower: string;
};

type BossFormState = {
  bossId: string;
  requiredCombatPower: string;
  crystalPrice: string;
};

const emptyCharacterForm: CharacterFormState = {
  characterName: "",
  jobName: "",
  combatPower: "",
};

const emptyBossForm: BossFormState = {
  bossId: "",
  requiredCombatPower: "",
  crystalPrice: "",
};

function formatMeso(value: number) {
  return `${currency.format(value)} 硫붿냼`;
}

function formatCombatPower(value: number) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}??;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(0)}留?;
  }
  return currency.format(value);
}

function formatRequiredCombatPower(value: number | null) {
  if (value === null) {
    return "誘몄젙";
  }
  return formatCombatPower(value);
}

function getDifficultyLabel(difficulty: string) {
  switch (difficulty) {
    case "EASY":
      return "\uC774\uC9C0";
    case "NORMAL":
      return "\uB178\uB9D0";
    case "HARD":
      return "\uD558\uB4DC";
    case "CHAOS":
      return "\uCE74\uC624\uC2A4";
    default:
      return difficulty;
  }
}

function getDifficultyClassName(difficulty: string) {
  return `difficulty-${difficulty.toLowerCase()}`;
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const stored = window.localStorage.getItem(key);
  if (!stored) {
    return fallback;
  }

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function sanitizeCharacters(characters: Character[]) {
  return characters.filter((character) => !LEGACY_SAMPLE_NAMES.has(character.characterName));
}

function App() {
  const [bosses, setBosses] = useState<Boss[]>(() => readStorage(BOSS_STORAGE_KEY, initialBosses));
  const [characters, setCharacters] = useState<Character[]>(() =>
    sanitizeCharacters(readStorage(CHARACTER_STORAGE_KEY, initialCharacters)),
  );
  const [weeklyBossClears, setWeeklyBossClears] = useState<WeeklyBossClear[]>(() =>
    readStorage(WEEKLY_CLEARS_STORAGE_KEY, initialWeeklyBossClears),
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [editingBossId, setEditingBossId] = useState<string | null>(null);
  const [isCharacterFormOpen, setIsCharacterFormOpen] = useState(false);
  const [isCharacterEditMode, setIsCharacterEditMode] = useState(false);
  const [characterForm, setCharacterForm] = useState<CharacterFormState>(emptyCharacterForm);
  const [bossForm, setBossForm] = useState<BossFormState>(emptyBossForm);
  const [bossSearch, setBossSearch] = useState("");
  const [bossDifficultyFilter, setBossDifficultyFilter] = useState<string>("ALL");

  useEffect(() => {
    window.localStorage.setItem(BOSS_STORAGE_KEY, JSON.stringify(bosses));
  }, [bosses]);

  useEffect(() => {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters));
  }, [characters]);

  useEffect(() => {
    window.localStorage.setItem(WEEKLY_CLEARS_STORAGE_KEY, JSON.stringify(weeklyBossClears));
  }, [weeklyBossClears]);

  useEffect(() => {
    if (selectedCharacterId && characters.some((character) => character.characterId === selectedCharacterId)) {
      return;
    }

    setSelectedCharacterId(characters[0]?.characterId ?? "");
  }, [characters, selectedCharacterId]);

  useEffect(() => {
    if (!editingCharacterId) {
      return;
    }

    const editingCharacter = characters.find((character) => character.characterId === editingCharacterId);
    if (!editingCharacter) {
      setEditingCharacterId(null);
      setCharacterForm(emptyCharacterForm);
    }
  }, [characters, editingCharacterId]);

  useEffect(() => {
    if (!editingBossId) {
      return;
    }

    const editingBoss = bosses.find((boss) => boss.bossId === editingBossId);
    if (!editingBoss) {
      setEditingBossId(null);
      setBossForm(emptyBossForm);
    }
  }, [bosses, editingBossId]);

  const bossMap = useMemo(() => new Map(bosses.map((boss) => [boss.bossId, boss])), [bosses]);

  const clearsForWeek = useMemo(
    () => weeklyBossClears.filter((item) => item.weekKey === currentWeekKey && item.isCleared),
    [weeklyBossClears],
  );

  const characterSummaries = useMemo<CharacterSummary[]>(() => {
    return [...characters]
      .sort((a, b) => b.combatPower - a.combatPower)
      .map((character) => {
        const clears = clearsForWeek.filter((item) => item.characterId === character.characterId);
        const clearedBosses = clears
          .map((item) => bossMap.get(item.bossId))
          .filter((boss): boss is Boss => Boolean(boss));

        return {
          character,
          clearCount: clearedBosses.length,
          weeklyIncome: clearedBosses.reduce((sum, boss) => sum + boss.crystalPrice, 0),
          eligibleBossCount: bosses.filter(
            (boss) => boss.requiredCombatPower !== null && character.combatPower >= boss.requiredCombatPower,
          ).length,
          ineligibleBossCount: bosses.filter(
            (boss) => boss.requiredCombatPower !== null && character.combatPower < boss.requiredCombatPower,
          ).length,
          unknownBossCount: bosses.filter((boss) => boss.requiredCombatPower === null).length,
          clearedBosses,
        };
      });
  }, [bossMap, characters, clearsForWeek]);

  const selectedSummary = characterSummaries.find(
    (summary) => summary.character.characterId === selectedCharacterId,
  );
  const selectedCharacter = selectedSummary?.character;

  const selectedClears = useMemo(
    () => clearsForWeek.filter((item) => item.characterId === selectedCharacterId),
    [clearsForWeek, selectedCharacterId],
  );

  const clearedBossIdSet = useMemo(() => new Set(selectedClears.map((item) => item.bossId)), [selectedClears]);

  const selectedBossRows = useMemo(() => {
    if (!selectedCharacter) {
      return [];
    }

    const normalizedSearch = bossSearch.trim().toLowerCase();

    return bosses
      .filter((boss) => {
        const matchesDifficulty =
          bossDifficultyFilter === "ALL" || boss.difficulty === bossDifficultyFilter;
        const matchesSearch =
          normalizedSearch === "" ||
          boss.bossName.toLowerCase().includes(normalizedSearch) ||
          getDifficultyLabel(boss.difficulty).toLowerCase().includes(normalizedSearch);

        return matchesDifficulty && matchesSearch;
      })
      .map((boss) => ({
        boss,
        isCleared: clearedBossIdSet.has(boss.bossId),
        isEligible:
          boss.requiredCombatPower === null ? null : selectedCharacter.combatPower >= boss.requiredCombatPower,
      }));
  }, [bossDifficultyFilter, bossSearch, bosses, clearedBossIdSet, selectedCharacter]);

  const dashboardStats = useMemo(
    () => ({
      totalWeeklyIncome: characterSummaries.reduce((sum, item) => sum + item.weeklyIncome, 0),
      totalWeeklyClearCount: characterSummaries.reduce((sum, item) => sum + item.clearCount, 0),
      totalCharacterCount: characters.length,
    }),
    [characterSummaries, characters.length],
  );

  const unknownBosses = selectedBossRows.filter((item) => item.isEligible === null);

  function resetCharacterForm() {
    setEditingCharacterId(null);
    setCharacterForm(emptyCharacterForm);
    setIsCharacterFormOpen(false);
  }

  function openCharacterCreateModal() {
    setEditingCharacterId(null);
    setCharacterForm(emptyCharacterForm);
    setIsCharacterFormOpen(true);
  }

  function resetBossForm() {
    setEditingBossId(null);
    setBossForm(emptyBossForm);
  }

  function handleCharacterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const characterName = characterForm.characterName.trim();
    const jobName = characterForm.jobName.trim();
    const combatPower = Number(characterForm.combatPower.replace(/,/g, "").trim());

    if (!characterName || !jobName || Number.isNaN(combatPower) || combatPower <= 0) {
      return;
    }

    if (editingCharacterId) {
      setCharacters((current) =>
        current.map((character) =>
          character.characterId === editingCharacterId
            ? {
                ...character,
                characterName,
                jobName,
                combatPower,
              }
            : character,
        ),
      );
      resetCharacterForm();
      return;
    }

    const newCharacter: Character = {
      characterId: makeId("char"),
      characterName,
      jobName,
      combatPower,
    };

    setCharacters((current) => [...current, newCharacter]);
    setSelectedCharacterId(newCharacter.characterId);
    setCharacterForm(emptyCharacterForm);
    setIsCharacterFormOpen(false);
  }

  function startEditingCharacter(character: Character) {
    setEditingCharacterId(character.characterId);
    setSelectedCharacterId(character.characterId);
    setIsCharacterFormOpen(true);
    setCharacterForm({
      characterName: character.characterName,
      jobName: character.jobName,
      combatPower: String(character.combatPower),
    });
  }

  function deleteCharacter(characterId: string) {
    setCharacters((current) => current.filter((character) => character.characterId !== characterId));
    setWeeklyBossClears((current) => current.filter((clear) => clear.characterId !== characterId));

    if (editingCharacterId === characterId) {
      resetCharacterForm();
    }
  }

  function handleBossSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const bossId = bossForm.bossId;
    const requiredCombatPower = bossForm.requiredCombatPower.trim();
    const crystalPrice = Number(bossForm.crystalPrice.replace(/,/g, "").trim());

    if (!bossId || Number.isNaN(crystalPrice) || crystalPrice <= 0) {
      return;
    }

    const parsedRequiredCombatPower =
      requiredCombatPower === ""
        ? null
        : Number(requiredCombatPower.replace(/,/g, "").trim());

    if (parsedRequiredCombatPower !== null && (Number.isNaN(parsedRequiredCombatPower) || parsedRequiredCombatPower < 0)) {
      return;
    }

    setBosses((current) =>
      current.map((boss) =>
        boss.bossId === bossId
          ? {
              ...boss,
              requiredCombatPower: parsedRequiredCombatPower,
              crystalPrice,
            }
          : boss,
      ),
    );
    resetBossForm();
  }

  function startEditingBoss(boss: Boss) {
    setEditingBossId(boss.bossId);
    setBossForm({
      bossId: boss.bossId,
      requiredCombatPower: boss.requiredCombatPower === null ? "" : String(boss.requiredCombatPower),
      crystalPrice: String(boss.crystalPrice),
    });
  }

  function toggleBossClear(bossId: string) {
    if (!selectedCharacter) {
      return;
    }

    setWeeklyBossClears((current) => {
      const targetBoss = bossMap.get(bossId);
      if (!targetBoss) {
        return current;
      }

      const existing = current.find(
        (item) =>
          item.weekKey === currentWeekKey &&
          item.characterId === selectedCharacter.characterId &&
          item.bossId === bossId,
      );

      if (existing) {
        return current.map((item) =>
          item.weeklyBossClearId === existing.weeklyBossClearId
            ? {
                ...item,
                isCleared: !item.isCleared,
                clearedAt: new Date().toISOString(),
              }
            : item,
        );
      }

      const conflictingIds = new Set(
        current
          .filter((item) => item.weekKey === currentWeekKey && item.characterId === selectedCharacter.characterId)
          .filter((item) => bossMap.get(item.bossId)?.bossName === targetBoss.bossName)
          .map((item) => item.weeklyBossClearId),
      );

      const next = current.map((item) =>
        conflictingIds.has(item.weeklyBossClearId)
          ? {
              ...item,
              isCleared: false,
              clearedAt: new Date().toISOString(),
            }
          : item,
      );

      return [
        ...next,
        {
          weeklyBossClearId: makeId("clear"),
          weekKey: currentWeekKey,
          characterId: selectedCharacter.characterId,
          bossId,
          clearedAt: new Date().toISOString(),
          isCleared: true,
        },
      ];
    });
  }

  const bossOptions = useMemo(
    () =>
      [...bosses].sort((a, b) => {
        if (a.bossName === b.bossName) {
          return a.difficulty.localeCompare(b.difficulty, "ko");
        }
        return a.bossName.localeCompare(b.bossName, "ko");
      }),
    [bosses],
  );

  return (
    <div className="app-shell">
      <div className="aurora aurora-left" />
      <div className="aurora aurora-right" />

      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Maple Weekly Operations</p>
          <h1>硫붿씠??蹂댁뒪 ??쒕낫??/h1>
          <div className="hero-meta">
            <span>?꾩옱 二쇱감</span>
            <strong>{currentWeekKey}</strong>
            <em>{formatWeekRange(currentDate)}</em>
          </div>
        </div>

        <div className="hero-panel">
          <div className="signal-card">
            <span>?꾩껜 ?대쾲 二??섏씡</span>
            <strong>{formatMeso(dashboardStats.totalWeeklyIncome)}</strong>
          </div>
          <div className="signal-grid">
            <article>
              <span>罹먮┃????/span>
              <strong>{dashboardStats.totalCharacterCount}</strong>
            </article>
            <article>
              <span>?대쾲 二??대━??/span>
              <strong>{dashboardStats.totalWeeklyClearCount}</strong>
            </article>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="panel roster-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Roster</p>
              <h2>罹먮┃??紐⑸줉</h2>
            </div>
            <div className="panel-actions">
              <button
                className={`collapse-button ${isCharacterEditMode ? "is-active" : ""}`}
                type="button"
                onClick={() => setIsCharacterEditMode((current) => !current)}
              >
                {isCharacterEditMode ? "?섏젙紐⑤뱶 ON" : "?섏젙紐⑤뱶"}
              </button>
              <button className="collapse-button add-button" type="button" onClick={openCharacterCreateModal}>
                異붽?
              </button>
            </div>
          </div>

          {characterSummaries.length === 0 ? (
            <div className="empty-state">
              <strong>?깅줉??罹먮┃?곌? ?놁뒿?덈떎.</strong>
              <p>罹먮┃?곕? ?깅줉?섎㈃ ?ш린???섏젙, ??젣, 二쇨컙 蹂댁뒪 ?댁쁺???쒖옉?????덉뒿?덈떎.</p>
            </div>
          ) : (
            <div className="roster-strip">
              {characterSummaries.map((summary) => {
                const isSelected = summary.character.characterId === selectedCharacterId;
                const isComplete = summary.clearCount === 12;
                return (
                  <div key={summary.character.characterId} className={`roster-card ${isSelected ? "selected" : ""}`}>
                    <button className="roster-main" onClick={() => setSelectedCharacterId(summary.character.characterId)} type="button">
                      <div className="roster-title">
                        <div>
                          <strong>{summary.character.characterName}/{summary.character.jobName}</strong>
                        </div>
                      </div>
                      <div className="roster-metrics-grid compact">
                        <div className="metric-box">
                          <span>?꾪닾??/span>
                          <strong>{formatCombatPower(summary.character.combatPower)}</strong>
                        </div>
                        <div className={`metric-box clear-state ${isComplete ? "is-complete" : "is-incomplete"}`}>
                          <span>?대쾲 二??대━??/span>
                          <strong>{summary.clearCount} / 12</strong>
                          <em>{isComplete ? "?꾨즺" : "誘몄셿猷?}</em>
                        </div>
                        <div className="metric-box metric-box-wide">
                          <span>?섏씡</span>
                          <strong>{formatMeso(summary.weeklyIncome)}</strong>
                        </div>
                      </div>
                    </button>
                    {isCharacterEditMode ? (
                      <div className="card-actions">
                        <button className="secondary-button" type="button" onClick={() => startEditingCharacter(summary.character)}>
                          ?섏젙
                        </button>
                        <button className="danger-button" type="button" onClick={() => deleteCharacter(summary.character.characterId)}>
                          ??젣
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel detail-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Character Detail</p>
              <h2>{selectedCharacter?.characterName ?? "罹먮┃???좏깮 ?꾩슂"}</h2>
            </div>
          </div>

          {selectedSummary ? (
            <>
              <div className="detail-summary compact-detail">
                <article>
                  <span>吏곸뾽</span>
                  <strong>{selectedSummary.character.jobName}</strong>
                </article>
                <article>
                  <span>?꾪닾??/span>
                  <strong>{formatCombatPower(selectedSummary.character.combatPower)}</strong>
                </article>
                <article>
                  <span>?대쾲 二??섏씡</span>
                  <strong>{formatMeso(selectedSummary.weeklyIncome)}</strong>
                </article>
                <article>
                  <span>?대쾲 二??대━??/span>
                  <strong>{selectedSummary.clearCount} / 12</strong>
                </article>
              </div>

              <div className="boss-columns compact-columns">
                <div className="boss-column wide">
                  <div className="column-title">
                    <h3>?대쾲 二??≪? 蹂댁뒪</h3>
                    <span>{selectedSummary.clearedBosses.length}留덈━</span>
                  </div>
                  <div className="boss-chip-list">
                    {selectedSummary.clearedBosses.length === 0 ? (
                      <span className="boss-chip">?꾩쭅 泥댄겕??蹂댁뒪媛 ?놁뒿?덈떎</span>
                    ) : (
                      selectedSummary.clearedBosses.map((boss) => (
                        <span key={boss.bossId} className="boss-chip cleared">
                          {boss.bossName}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {editingBossId ? (
                <section className="boss-admin">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">Boss Admin</p>
                      <h2>蹂댁뒪 媛??섏젙</h2>
                    </div>
                  </div>

                  <form className="boss-form" onSubmit={handleBossSubmit}>
                    <div className="boss-form-grid">
                      <label>
                        <span>蹂댁뒪</span>
                        <select
                          value={bossForm.bossId}
                          onChange={(event) => {
                            const nextBoss = bosses.find((boss) => boss.bossId === event.target.value);
                            setBossForm({
                              bossId: event.target.value,
                              requiredCombatPower:
                                nextBoss?.requiredCombatPower === null
                                  ? ""
                                  : String(nextBoss?.requiredCombatPower ?? ""),
                              crystalPrice: nextBoss ? String(nextBoss.crystalPrice) : "",
                            });
                          }}
                        >
                          <option value="">蹂댁뒪瑜??좏깮?섏꽭??/option>
                          {bossOptions.map((boss) => (
                            <option key={boss.bossId} value={boss.bossId}>
                              {boss.bossName} / {boss.difficulty}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>?붽뎄 ?꾪닾??/span>
                        <input
                          inputMode="numeric"
                          value={bossForm.requiredCombatPower}
                          onChange={(event) =>
                            setBossForm((current) => ({
                              ...current,
                              requiredCombatPower: event.target.value.replace(/[^\d,]/g, ""),
                            }))
                          }
                          placeholder="?? 180000000"
                        />
                      </label>
                      <label>
                        <span>寃곗젙??湲덉븸</span>
                        <input
                          inputMode="numeric"
                          value={bossForm.crystalPrice}
                          onChange={(event) =>
                            setBossForm((current) => ({
                              ...current,
                              crystalPrice: event.target.value.replace(/[^\d,]/g, ""),
                            }))
                          }
                          placeholder="?? 396000000"
                        />
                      </label>
                    </div>
                    <div className="form-actions">
                      <button type="submit">?섏젙 ???/button>
                      <button className="secondary-button" type="button" onClick={resetBossForm}>
                        痍⑥냼
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {unknownBosses.length > 0 ? (
                <div className="notice-box">
                  <strong>?붽뎄 ?꾪닾??誘몄젙 蹂댁뒪 {unknownBosses.length}媛?/strong>
                  <p>CSV?먯꽌 ?붽뎄 ?꾪닾?μ씠 `-`??蹂댁뒪??蹂꾨룄濡?遺꾨━?댁꽌 ?쒖떆?⑸땲??</p>
                </div>
              ) : null}

              <div className="boss-toolbar">
                <label className="boss-search">
                  <span>{"\uBCF4\uC2A4 \uAC80\uC0C9"}</span>
                  <input
                    value={bossSearch}
                    onChange={(event) => setBossSearch(event.target.value)}
                    placeholder={"\uBCF4\uC2A4 \uC774\uB984 \uB610\uB294 \uB09C\uC774\uB3C4 \uAC80\uC0C9"}
                  />
                </label>
                <div
                  className="boss-filter-group"
                  role="group"
                  aria-label={"\uBCF4\uC2A4 \uB09C\uC774\uB3C4 \uD035\uD544\uD130"}
                >
                  {[
                    { value: "ALL", label: "\uC804\uCCB4" },
                    { value: "EASY", label: "\uC774\uC9C0" },
                    { value: "NORMAL", label: "\uB178\uB9D0" },
                    { value: "HARD", label: "\uD558\uB4DC" },
                    { value: "CHAOS", label: "\uCE74\uC624\uC2A4" },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      className={`filter-chip ${bossDifficultyFilter === filter.value ? "is-active" : ""}`}
                      type="button"
                      onClick={() => setBossDifficultyFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="boss-table-wrap">
                <table className="boss-table">
                  <thead>
                    <tr>
                      <th>泥댄겕</th>
                      <th>蹂댁뒪</th>
                      <th>?쒖씠??/th>
                      <th>?붽뎄 ?꾪닾??/th>
                      <th>遺???щ?</th>
                      <th>寃곗젙??湲덉븸</th>
                      <th>?섏젙</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBossRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="boss-table-empty">
                          {"\uC870\uAC74\uC5D0 \uB9DE\uB294 \uBCF4\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}
                        </td>
                      </tr>
                    ) : (
                      selectedBossRows.map(({ boss, isEligible, isCleared }) => (
                      <tr key={boss.bossId}>
                        <td>
                          <label className="checkbox-wrap">
                            <input
                              checked={isCleared}
                              onChange={() => toggleBossClear(boss.bossId)}
                              type="checkbox"
                            />
                            <span>{isCleared ? "?대━?? : "誘명겢由ъ뼱"}</span>
                          </label>
                        </td>
                        <td>
                          {boss.bossName}
                        </td>
                        <td>
                          <span className={`difficulty-badge ${getDifficultyClassName(boss.difficulty)}`}>
                            {getDifficultyLabel(boss.difficulty)}
                          </span>
                        </td>
                        <td>{formatRequiredCombatPower(boss.requiredCombatPower)}</td>
                        <td>
                          <span
                            className={`eligibility ${
                              isEligible === null ? "unknown" : isEligible ? "good" : "bad"
                            }`}
                          >
                            {isEligible === null ? "?붽뎄 ?꾪닾??誘몄젙" : isEligible ? "?꾩쟾 媛?? : "?꾪닾??遺議?}
                          </span>
                        </td>
                        <td>{formatMeso(boss.crystalPrice)}</td>
                        <td>
                          <button className="secondary-button" type="button" onClick={() => startEditingBoss(boss)}>
                            ?섏젙
                          </button>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>?좏깮??罹먮┃?곌? ?놁뒿?덈떎.</strong>
              <p>罹먮┃?곕? ?섎굹 ?깅줉?섎㈃ ?ш린??蹂댁뒪 泥댄겕? ?섏씡 吏묎퀎瑜?諛붾줈 蹂????덉뒿?덈떎.</p>
            </div>
          )}
        </section>
      </main>

      {isCharacterFormOpen ? (
        <div className="modal-overlay" role="presentation" onClick={resetCharacterForm}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="character-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Character Setup</p>
                <h2 id="character-modal-title">{editingCharacterId ? "罹먮┃???섏젙" : "罹먮┃???깅줉"}</h2>
              </div>
              <button className="collapse-button" type="button" onClick={resetCharacterForm}>
                ?リ린
              </button>
            </div>

            <form className="setup-form modal-form" onSubmit={handleCharacterSubmit}>
              <div className="form-heading">
                <h3>{editingCharacterId ? "罹먮┃???뺣낫 ?섏젙" : "?좉퇋 罹먮┃??異붽?"}</h3>
                <span>?낅젰媛? 罹먮┃?곕챸, 吏곸뾽, ?꾪닾??/span>
              </div>
              <label>
                <span>罹먮┃?곕챸</span>
                  <input
                    value={characterForm.characterName}
                    onChange={(event) => setCharacterForm((current) => ({ ...current, characterName: event.target.value }))}
                    placeholder="?? 逾ㅻ━?꾨━"
                  />
              </label>
              <label>
                <span>吏곸뾽</span>
                <input
                  value={characterForm.jobName}
                  onChange={(event) => setCharacterForm((current) => ({ ...current, jobName: event.target.value }))}
                  placeholder="?? ?덉뼱濡?
                />
              </label>
              <label>
                <span>?꾪닾??/span>
                <input
                  inputMode="numeric"
                  value={characterForm.combatPower}
                  onChange={(event) =>
                    setCharacterForm((current) => ({
                      ...current,
                      combatPower: event.target.value.replace(/[^\d,]/g, ""),
                    }))
                  }
                  placeholder="?? 85000000"
                />
              </label>
              <div className="form-actions">
                <button type="submit">{editingCharacterId ? "?섏젙 ??? : "罹먮┃??異붽?"}</button>
                {editingCharacterId ? (
                  <button className="secondary-button" type="button" onClick={resetCharacterForm}>
                    痍⑥냼
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
