enum BonusType {
  SCORE = "SCORE",
  TIME = "TIME",
  SIMPLE_WORDS = "SIMPLE_WORDS",
}

class GameLogic {
  private score = 0;
  private streak = 0;

  private bonusPending = false;
  private bonusType: BonusType | null = null;

  private scoreBonusLevel = 0;
  private scoreBonusChainActive = false;

  reset(): void {
    this.score = 0;
    this.streak = 0;
    this.bonusPending = false;
    this.bonusType = null;
    this.scoreBonusLevel = 0;
    this.scoreBonusChainActive = false;
  }

  getScore(): number { return this.score; }
  getStreak(): number { return this.streak; }
  isBonusPending(): boolean { return this.bonusPending; }
  getBonusType(): BonusType | null { return this.bonusType; }
  getScoreBonusLevel(): number { return this.scoreBonusLevel; }

  registerCorrect(): void {
    this.score++;
    this.streak++;
  }

  registerIncorrect(): void {
    if (this.score > 0) this.score--;
    if (this.score < 0) this.score = 0;
    this.streak = 0;
    this.cancelBonus();
  }

  maybeCreateBonus(): BonusType | null {
    if (this.bonusPending) return null;
    if (this.scoreBonusChainActive) return null;

    if (this.streak >= 3 && this.streak % 3 === 0) {
      const r = Math.floor(Math.random() * 3);

      if (r === 0) {
        this.scoreBonusChainActive = true;
        this.scoreBonusLevel = 1;
        this.bonusType = BonusType.SCORE;
      } else if (r === 1) {
        this.bonusType = BonusType.TIME;
      } else {
        this.bonusType = BonusType.SIMPLE_WORDS;
      }

      this.bonusPending = true;
      return this.bonusType;
    }
    return null;
  }

  applyScoreBonus(): number {
    if (!this.bonusPending || this.bonusType !== BonusType.SCORE) return 0;

    let extra: number;
    if (this.scoreBonusLevel === 1) extra = 2;
    else if (this.scoreBonusLevel === 2) extra = 4;
    else extra = 6;

    this.score += extra;
    this.bonusPending = false;

    if (this.scoreBonusLevel >= 3) {
      this.scoreBonusChainActive = false;
      this.bonusType = null;
      this.scoreBonusLevel = 0;
    } else {
      this.scoreBonusLevel++;
      this.bonusType = BonusType.SCORE;
      this.bonusPending = true;
    }
    return extra;
  }

  cancelBonus(): void {
    this.bonusPending = false;
    this.bonusType = null;
    this.scoreBonusLevel = 0;
    this.scoreBonusChainActive = false;
  }
}

class BestScore {
  private static readonly KEY = "typinggame.best";
  private value = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(BestScore.KEY);
      if (raw) this.value = parseInt(raw, 10) || 0;
    } catch {
      this.value = 0;
    }
  }

  get(): number { return this.value; }

  update(score: number): boolean {
    if (score <= this.value) return false;
    this.value = score;
    try { localStorage.setItem(BestScore.KEY, String(score)); } catch {}
    return true;
  }
}


class TypingGame {
  private logic = new GameLogic();
  private best = new BestScore();

  private gameRunning = false;
  private simpleWordsMode = false;

  private timeLimit = 30;
  private timeRemaining = 30;
  private currentWord = "";

  private gameTimer = 0;
  private bonusTimer = 0;
  private simpleWordsTimer = 0;

  private el = {
    startScreen: this.$("start-screen"),
    gameScreen: this.$("game-screen"),
    resultScreen: this.$("result-screen"),
    timeSelect: this.$<HTMLSelectElement>("time-select"),
    startBtn: this.$("start-btn"),
    score: this.$("score"),
    best: this.$("best-score"),
    timer: this.$("timer"),
    bonus: this.$("bonus-msg"),
    word: this.$("word"),
    input: this.$<HTMLInputElement>("input"),
    gameQuitBtn: this.$("game-quit-btn"),
    finalScore: this.$("final-score"),
    finalBest: this.$("final-best"),
    newRecord: this.$("new-record"),
    restartBtn: this.$("restart-btn"),
    quitBtn: this.$("quit-btn"),
  };

  constructor() {
    this.bindEvents();
    this.el.best.textContent = String(this.best.get());
    this.showScreen("start");
  }

  private $<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  private bindEvents(): void {
    this.el.startBtn.addEventListener("click", () => this.startGame());

    this.el.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleInput();
    });

    this.el.gameQuitBtn.addEventListener("click", () => this.quitToStart());

    this.el.restartBtn.addEventListener("click", () => this.startGame());
    this.el.quitBtn.addEventListener("click", () => this.showScreen("start"));
  }

  private quitToStart(): void {
    this.gameRunning = false;
    this.clearAllTimers();
    this.el.bonus.textContent = "";
    this.showScreen("start");
  }

  private showScreen(name: "start" | "game" | "result"): void {
    this.el.startScreen.classList.add("hidden");
    this.el.gameScreen.classList.add("hidden");
    this.el.resultScreen.classList.add("hidden");
    this.$(`${name}-screen`).classList.remove("hidden");
  }

  private nextWord(): string {
    const source = this.simpleWordsMode ? THREE_LETTER_WORDS : WORDS;
    if (source.length === 0) return "";
    return source[Math.floor(Math.random() * source.length)];
  }

  private startGame(): void {
    this.logic.reset();
    this.simpleWordsMode = false;
    this.gameRunning = true;

    this.timeLimit = this.el.timeSelect.value === "60" ? 60 : 30;
    this.timeRemaining = this.timeLimit;

    this.el.timer.textContent = String(this.timeRemaining);
    this.el.score.textContent = "0";
    this.el.best.textContent = String(this.best.get());
    this.el.bonus.textContent = "";

    this.currentWord = this.nextWord();
    this.el.word.textContent = this.currentWord;

    this.showScreen("game");
    this.el.input.value = "";
    this.el.input.focus();

    this.clearAllTimers();

    this.gameTimer = window.setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining < 0) this.timeRemaining = 0;
      this.el.timer.textContent = String(this.timeRemaining);
      if (this.timeRemaining <= 0) {
        this.stopGameTimer();
        this.endGame();
      }
    }, 1000);
  }

  private handleInput(): void {
    if (!this.gameRunning) return;

    const typed = this.el.input.value.trim().toLowerCase();
    if (typed === "") return;

    const target = this.currentWord.toLowerCase();
    const wasBonusPending = this.logic.isBonusPending();
    const currentBonusType = this.logic.getBonusType();

    if (typed === target) {
      if (wasBonusPending && currentBonusType !== null) {
        if (currentBonusType === BonusType.SCORE) {
          const extra = this.logic.applyScoreBonus();
          this.el.bonus.textContent = `Score bonus +${extra}`;
          this.stopBonusTimer();
          if (
            this.logic.isBonusPending() &&
            this.logic.getBonusType() === BonusType.SCORE
          ) {
            this.el.bonus.textContent =
              `Score bonus +${extra} | Next level ready (lv ${this.logic.getScoreBonusLevel()})`;
            this.startBonusTimer();
          }
        } else if (currentBonusType === BonusType.TIME) {
          this.timeRemaining += 7;
          this.el.timer.textContent = String(this.timeRemaining);
          this.el.bonus.textContent = "Time bonus +7s";
          this.logic.cancelBonus();
          this.stopBonusTimer();
        } else if (currentBonusType === BonusType.SIMPLE_WORDS) {
          this.simpleWordsMode = true;
          this.el.bonus.textContent = "3-letter words for 10s";
          this.logic.cancelBonus();
          this.stopBonusTimer();
          this.startSimpleWordsTimer();
        }
      }

      this.logic.registerCorrect();
      this.el.score.textContent = String(this.logic.getScore());
      this.el.input.value = "";

      this.currentWord = this.nextWord();
      this.el.word.textContent = this.currentWord;

      if (!wasBonusPending) {
        const newBonus = this.logic.maybeCreateBonus();
        if (newBonus !== null) {
          const text =
            newBonus === BonusType.SCORE ? "Score bonus ready"
            : newBonus === BonusType.TIME ? "Time bonus ready"
            : "Simple words bonus ready";
          this.el.bonus.textContent = text;
          this.startBonusTimer();
        }
      }
    } else {
      const hadPending = this.logic.isBonusPending();
      this.logic.registerIncorrect();
      this.el.score.textContent = String(this.logic.getScore());
      this.el.input.value = "";
      if (hadPending) {
        this.el.bonus.textContent = "";
        this.stopBonusTimer();
      }
    }
  }

  private endGame(): void {
    this.gameRunning = false;
    this.stopBonusTimer();
    this.stopSimpleWordsTimer();

    const score = this.logic.getScore();
    const isRecord = this.best.update(score);

    this.el.finalScore.textContent = String(score);
    this.el.finalBest.textContent = String(this.best.get());
    this.el.best.textContent = String(this.best.get());
    this.el.newRecord.classList.toggle("hidden", !isRecord);

    this.showScreen("result");
  }

  private startBonusTimer(): void {
    this.stopBonusTimer();
    this.bonusTimer = window.setTimeout(() => {
      this.logic.cancelBonus();
      this.el.bonus.textContent = "";
      this.bonusTimer = 0;
    }, 7000);
  }

  private startSimpleWordsTimer(): void {
    this.stopSimpleWordsTimer();
    this.simpleWordsTimer = window.setTimeout(() => {
      this.simpleWordsMode = false;
      this.el.bonus.textContent = "";
      this.simpleWordsTimer = 0;
    }, 10000);
  }

  private stopGameTimer(): void {
    if (this.gameTimer) { clearInterval(this.gameTimer); this.gameTimer = 0; }
  }
  private stopBonusTimer(): void {
    if (this.bonusTimer) { clearTimeout(this.bonusTimer); this.bonusTimer = 0; }
  }
  private stopSimpleWordsTimer(): void {
    if (this.simpleWordsTimer) { clearTimeout(this.simpleWordsTimer); this.simpleWordsTimer = 0; }
  }
  private clearAllTimers(): void {
    this.stopGameTimer();
    this.stopBonusTimer();
    this.stopSimpleWordsTimer();
  }
}

document.addEventListener("DOMContentLoaded", () => new TypingGame());
