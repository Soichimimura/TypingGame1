"use strict";
var BonusType;
(function (BonusType) {
    BonusType["SCORE"] = "SCORE";
    BonusType["TIME"] = "TIME";
    BonusType["SIMPLE_WORDS"] = "SIMPLE_WORDS";
})(BonusType || (BonusType = {}));
class GameLogic {
    score = 0;
    streak = 0;
    bonusPending = false;
    bonusType = null;
    scoreBonusLevel = 0;
    scoreBonusChainActive = false;
    reset() {
        this.score = 0;
        this.streak = 0;
        this.bonusPending = false;
        this.bonusType = null;
        this.scoreBonusLevel = 0;
        this.scoreBonusChainActive = false;
    }
    getScore() { return this.score; }
    getStreak() { return this.streak; }
    isBonusPending() { return this.bonusPending; }
    getBonusType() { return this.bonusType; }
    getScoreBonusLevel() { return this.scoreBonusLevel; }
    registerCorrect() {
        this.score++;
        this.streak++;
    }
    registerIncorrect() {
        if (this.score > 0)
            this.score--;
        if (this.score < 0)
            this.score = 0;
        this.streak = 0;
        this.cancelBonus();
    }
    maybeCreateBonus() {
        if (this.bonusPending)
            return null;
        if (this.scoreBonusChainActive)
            return null;
        if (this.streak >= 3 && this.streak % 3 === 0) {
            const r = Math.floor(Math.random() * 3);
            if (r === 0) {
                this.scoreBonusChainActive = true;
                this.scoreBonusLevel = 1;
                this.bonusType = BonusType.SCORE;
            }
            else if (r === 1) {
                this.bonusType = BonusType.TIME;
            }
            else {
                this.bonusType = BonusType.SIMPLE_WORDS;
            }
            this.bonusPending = true;
            return this.bonusType;
        }
        return null;
    }
    applyScoreBonus() {
        if (!this.bonusPending || this.bonusType !== BonusType.SCORE)
            return 0;
        let extra;
        if (this.scoreBonusLevel === 1)
            extra = 2;
        else if (this.scoreBonusLevel === 2)
            extra = 4;
        else
            extra = 6;
        this.score += extra;
        this.bonusPending = false;
        if (this.scoreBonusLevel >= 3) {
            this.scoreBonusChainActive = false;
            this.bonusType = null;
            this.scoreBonusLevel = 0;
        }
        else {
            this.scoreBonusLevel++;
            this.bonusType = BonusType.SCORE;
            this.bonusPending = true;
        }
        return extra;
    }
    cancelBonus() {
        this.bonusPending = false;
        this.bonusType = null;
        this.scoreBonusLevel = 0;
        this.scoreBonusChainActive = false;
    }
}
class BestScore {
    static KEY = "typinggame.best";
    value = 0;
    constructor() {
        try {
            const raw = localStorage.getItem(BestScore.KEY);
            if (raw)
                this.value = parseInt(raw, 10) || 0;
        }
        catch {
            this.value = 0;
        }
    }
    get() { return this.value; }
    update(score) {
        if (score <= this.value)
            return false;
        this.value = score;
        try {
            localStorage.setItem(BestScore.KEY, String(score));
        }
        catch { }
        return true;
    }
}
class TypingGame {
    logic = new GameLogic();
    best = new BestScore();
    gameRunning = false;
    simpleWordsMode = false;
    timeLimit = 30;
    timeRemaining = 30;
    currentWord = "";
    gameTimer = 0;
    bonusTimer = 0;
    simpleWordsTimer = 0;
    el = {
        startScreen: this.$("start-screen"),
        gameScreen: this.$("game-screen"),
        resultScreen: this.$("result-screen"),
        timeSelect: this.$("time-select"),
        startBtn: this.$("start-btn"),
        score: this.$("score"),
        best: this.$("best-score"),
        timer: this.$("timer"),
        bonus: this.$("bonus-msg"),
        word: this.$("word"),
        input: this.$("input"),
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
    $(id) {
        return document.getElementById(id);
    }
    bindEvents() {
        this.el.startBtn.addEventListener("click", () => this.startGame());
        this.el.input.addEventListener("keydown", (e) => {
            if (e.key === "Enter")
                this.handleInput();
        });
        this.el.gameQuitBtn.addEventListener("click", () => this.quitToStart());
        this.el.restartBtn.addEventListener("click", () => this.startGame());
        this.el.quitBtn.addEventListener("click", () => this.showScreen("start"));
    }
    quitToStart() {
        this.gameRunning = false;
        this.clearAllTimers();
        this.el.bonus.textContent = "";
        this.showScreen("start");
    }
    showScreen(name) {
        this.el.startScreen.classList.add("hidden");
        this.el.gameScreen.classList.add("hidden");
        this.el.resultScreen.classList.add("hidden");
        this.$(`${name}-screen`).classList.remove("hidden");
    }
    nextWord() {
        const source = this.simpleWordsMode ? THREE_LETTER_WORDS : WORDS;
        if (source.length === 0)
            return "";
        return source[Math.floor(Math.random() * source.length)];
    }
    startGame() {
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
            if (this.timeRemaining < 0)
                this.timeRemaining = 0;
            this.el.timer.textContent = String(this.timeRemaining);
            if (this.timeRemaining <= 0) {
                this.stopGameTimer();
                this.endGame();
            }
        }, 1000);
    }
    handleInput() {
        if (!this.gameRunning)
            return;
        const typed = this.el.input.value.trim().toLowerCase();
        if (typed === "")
            return;
        const target = this.currentWord.toLowerCase();
        const wasBonusPending = this.logic.isBonusPending();
        const currentBonusType = this.logic.getBonusType();
        if (typed === target) {
            if (wasBonusPending && currentBonusType !== null) {
                if (currentBonusType === BonusType.SCORE) {
                    const extra = this.logic.applyScoreBonus();
                    this.el.bonus.textContent = `Score bonus +${extra}`;
                    this.stopBonusTimer();
                    if (this.logic.isBonusPending() &&
                        this.logic.getBonusType() === BonusType.SCORE) {
                        this.el.bonus.textContent =
                            `Score bonus +${extra} | Next level ready (lv ${this.logic.getScoreBonusLevel()})`;
                        this.startBonusTimer();
                    }
                }
                else if (currentBonusType === BonusType.TIME) {
                    this.timeRemaining += 7;
                    this.el.timer.textContent = String(this.timeRemaining);
                    this.el.bonus.textContent = "Time bonus +7s";
                    this.logic.cancelBonus();
                    this.stopBonusTimer();
                }
                else if (currentBonusType === BonusType.SIMPLE_WORDS) {
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
                    const text = newBonus === BonusType.SCORE ? "Score bonus ready"
                        : newBonus === BonusType.TIME ? "Time bonus ready"
                            : "Simple words bonus ready";
                    this.el.bonus.textContent = text;
                    this.startBonusTimer();
                }
            }
        }
        else {
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
    endGame() {
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
    startBonusTimer() {
        this.stopBonusTimer();
        this.bonusTimer = window.setTimeout(() => {
            this.logic.cancelBonus();
            this.el.bonus.textContent = "";
            this.bonusTimer = 0;
        }, 7000);
    }
    startSimpleWordsTimer() {
        this.stopSimpleWordsTimer();
        this.simpleWordsTimer = window.setTimeout(() => {
            this.simpleWordsMode = false;
            this.el.bonus.textContent = "";
            this.simpleWordsTimer = 0;
        }, 10000);
    }
    stopGameTimer() {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = 0;
        }
    }
    stopBonusTimer() {
        if (this.bonusTimer) {
            clearTimeout(this.bonusTimer);
            this.bonusTimer = 0;
        }
    }
    stopSimpleWordsTimer() {
        if (this.simpleWordsTimer) {
            clearTimeout(this.simpleWordsTimer);
            this.simpleWordsTimer = 0;
        }
    }
    clearAllTimers() {
        this.stopGameTimer();
        this.stopBonusTimer();
        this.stopSimpleWordsTimer();
    }
}
document.addEventListener("DOMContentLoaded", () => new TypingGame());
