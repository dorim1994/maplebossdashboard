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
  "도리 아크메이지",
  "도리 나이트로드",
  "링크 팔라딘",
  "농장 소울마스터",
  "버닝 칼리",
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
  return `${currency.format(value)} 메소`;
}

function formatCombatPower(value: number) {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }
  if (value >= 10_000) {
    return `${(value / 10_000).toFixed(0)}만`;
  }
  return currency.format(value);
}

function formatRequiredCombatPower(value: number | null) {
  if (value === null) {
    return "미정";
  }
  return formatCombatPower(value);
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

    return bosses.map((boss) => ({
      boss,
      isCleared: clearedBossIdSet.has(boss.bossId),
      isEligible:
        boss.requiredCombatPower === null ? null : selectedCharacter.combatPower >= boss.requiredCombatPower,
    }));
  }, [clearedBossIdSet, selectedCharacter]);

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
          <h1>메이플 보스 대시보드</h1>
          <div className="hero-meta">
            <span>현재 주차</span>
            <strong>{currentWeekKey}</strong>
            <em>{formatWeekRange(currentDate)}</em>
          </div>
        </div>

        <div className="hero-panel">
          <div className="signal-card">
            <span>전체 이번 주 수익</span>
            <strong>{formatMeso(dashboardStats.totalWeeklyIncome)}</strong>
          </div>
          <div className="signal-grid">
            <article>
              <span>캐릭터 수</span>
              <strong>{dashboardStats.totalCharacterCount}</strong>
            </article>
            <article>
              <span>이번 주 클리어</span>
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
              <h2>캐릭터 목록</h2>
            </div>
            <div className="panel-actions">
              <button
                className={`collapse-button ${isCharacterEditMode ? "is-active" : ""}`}
                type="button"
                onClick={() => setIsCharacterEditMode((current) => !current)}
              >
                {isCharacterEditMode ? "수정모드 ON" : "수정모드"}
              </button>
              <button className="collapse-button add-button" type="button" onClick={openCharacterCreateModal}>
                추가
              </button>
            </div>
          </div>

          {characterSummaries.length === 0 ? (
            <div className="empty-state">
              <strong>등록된 캐릭터가 없습니다.</strong>
              <p>캐릭터를 등록하면 여기서 수정, 삭제, 주간 보스 운영을 시작할 수 있습니다.</p>
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
                          <span>전투력</span>
                          <strong>{formatCombatPower(summary.character.combatPower)}</strong>
                        </div>
                        <div className={`metric-box clear-state ${isComplete ? "is-complete" : "is-incomplete"}`}>
                          <span>이번 주 클리어</span>
                          <strong>{summary.clearCount} / 12</strong>
                          <em>{isComplete ? "완료" : "미완료"}</em>
                        </div>
                        <div className="metric-box metric-box-wide">
                          <span>수익</span>
                          <strong>{formatMeso(summary.weeklyIncome)}</strong>
                        </div>
                      </div>
                    </button>
                    {isCharacterEditMode ? (
                      <div className="card-actions">
                        <button className="secondary-button" type="button" onClick={() => startEditingCharacter(summary.character)}>
                          수정
                        </button>
                        <button className="danger-button" type="button" onClick={() => deleteCharacter(summary.character.characterId)}>
                          삭제
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
              <h2>{selectedCharacter?.characterName ?? "캐릭터 선택 필요"}</h2>
            </div>
          </div>

          {selectedSummary ? (
            <>
              <div className="detail-summary compact-detail">
                <article>
                  <span>직업</span>
                  <strong>{selectedSummary.character.jobName}</strong>
                </article>
                <article>
                  <span>전투력</span>
                  <strong>{formatCombatPower(selectedSummary.character.combatPower)}</strong>
                </article>
                <article>
                  <span>이번 주 수익</span>
                  <strong>{formatMeso(selectedSummary.weeklyIncome)}</strong>
                </article>
                <article>
                  <span>이번 주 클리어</span>
                  <strong>{selectedSummary.clearCount} / 12</strong>
                </article>
              </div>

              <div className="boss-columns compact-columns">
                <div className="boss-column wide">
                  <div className="column-title">
                    <h3>이번 주 잡은 보스</h3>
                    <span>{selectedSummary.clearedBosses.length}마리</span>
                  </div>
                  <div className="boss-chip-list">
                    {selectedSummary.clearedBosses.length === 0 ? (
                      <span className="boss-chip">아직 체크된 보스가 없습니다</span>
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
                      <h2>보스 값 수정</h2>
                    </div>
                  </div>

                  <form className="boss-form" onSubmit={handleBossSubmit}>
                    <div className="boss-form-grid">
                      <label>
                        <span>보스</span>
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
                          <option value="">보스를 선택하세요</option>
                          {bossOptions.map((boss) => (
                            <option key={boss.bossId} value={boss.bossId}>
                              {boss.bossName} / {boss.difficulty}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>요구 전투력</span>
                        <input
                          inputMode="numeric"
                          value={bossForm.requiredCombatPower}
                          onChange={(event) =>
                            setBossForm((current) => ({
                              ...current,
                              requiredCombatPower: event.target.value.replace(/[^\d,]/g, ""),
                            }))
                          }
                          placeholder="예: 180000000"
                        />
                      </label>
                      <label>
                        <span>결정석 금액</span>
                        <input
                          inputMode="numeric"
                          value={bossForm.crystalPrice}
                          onChange={(event) =>
                            setBossForm((current) => ({
                              ...current,
                              crystalPrice: event.target.value.replace(/[^\d,]/g, ""),
                            }))
                          }
                          placeholder="예: 396000000"
                        />
                      </label>
                    </div>
                    <div className="form-actions">
                      <button type="submit">수정 저장</button>
                      <button className="secondary-button" type="button" onClick={resetBossForm}>
                        취소
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}

              {unknownBosses.length > 0 ? (
                <div className="notice-box">
                  <strong>요구 전투력 미정 보스 {unknownBosses.length}개</strong>
                  <p>CSV에서 요구 전투력이 `-`인 보스는 별도로 분리해서 표시합니다.</p>
                </div>
              ) : null}

              <div className="boss-table-wrap">
                <table className="boss-table">
                  <thead>
                    <tr>
                      <th>체크</th>
                      <th>보스</th>
                      <th>난이도</th>
                      <th>요구 전투력</th>
                      <th>부합 여부</th>
                      <th>결정석 금액</th>
                      <th>수정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBossRows.map(({ boss, isEligible, isCleared }) => (
                      <tr key={boss.bossId}>
                        <td>
                          <label className="checkbox-wrap">
                            <input
                              checked={isCleared}
                              onChange={() => toggleBossClear(boss.bossId)}
                              type="checkbox"
                            />
                            <span>{isCleared ? "클리어" : "미클리어"}</span>
                          </label>
                        </td>
                        <td>
                          {boss.bossName}
                        </td>
                        <td><span className="difficulty-badge">{boss.difficulty}</span></td>
                        <td>{formatRequiredCombatPower(boss.requiredCombatPower)}</td>
                        <td>
                          <span
                            className={`eligibility ${
                              isEligible === null ? "unknown" : isEligible ? "good" : "bad"
                            }`}
                          >
                            {isEligible === null ? "요구 전투력 미정" : isEligible ? "도전 가능" : "전투력 부족"}
                          </span>
                        </td>
                        <td>{formatMeso(boss.crystalPrice)}</td>
                        <td>
                          <button className="secondary-button" type="button" onClick={() => startEditingBoss(boss)}>
                            수정
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>선택된 캐릭터가 없습니다.</strong>
              <p>캐릭터를 하나 등록하면 여기서 보스 체크와 수익 집계를 바로 볼 수 있습니다.</p>
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
                <h2 id="character-modal-title">{editingCharacterId ? "캐릭터 수정" : "캐릭터 등록"}</h2>
              </div>
              <button className="collapse-button" type="button" onClick={resetCharacterForm}>
                닫기
              </button>
            </div>

            <form className="setup-form modal-form" onSubmit={handleCharacterSubmit}>
              <div className="form-heading">
                <h3>{editingCharacterId ? "캐릭터 정보 수정" : "신규 캐릭터 추가"}</h3>
                <span>입력값: 캐릭터명, 직업, 전투력</span>
              </div>
              <label>
                <span>캐릭터명</span>
                  <input
                    value={characterForm.characterName}
                    onChange={(event) => setCharacterForm((current) => ({ ...current, characterName: event.target.value }))}
                    placeholder="예: 뵤리도리"
                  />
              </label>
              <label>
                <span>직업</span>
                <input
                  value={characterForm.jobName}
                  onChange={(event) => setCharacterForm((current) => ({ ...current, jobName: event.target.value }))}
                  placeholder="예: 히어로"
                />
              </label>
              <label>
                <span>전투력</span>
                <input
                  inputMode="numeric"
                  value={characterForm.combatPower}
                  onChange={(event) =>
                    setCharacterForm((current) => ({
                      ...current,
                      combatPower: event.target.value.replace(/[^\d,]/g, ""),
                    }))
                  }
                  placeholder="예: 85000000"
                />
              </label>
              <div className="form-actions">
                <button type="submit">{editingCharacterId ? "수정 저장" : "캐릭터 추가"}</button>
                {editingCharacterId ? (
                  <button className="secondary-button" type="button" onClick={resetCharacterForm}>
                    취소
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
