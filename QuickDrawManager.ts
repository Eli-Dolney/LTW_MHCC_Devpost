import * as hz from 'horizon/core';
import { Target, TargetEvents } from './Target';

export class QuickDrawManager extends hz.Component<typeof QuickDrawManager> {
  static propsDefinition = {
    gameAreaTrigger: { type: hz.PropTypes.Entity }, // The trigger zone for the game area
    targets: { type: hz.PropTypes.EntityArray, default: [] }, // All target entities
    roundTimeSec: { type: hz.PropTypes.Number, default: 60 }, // Round duration in seconds
    targetsUp: { type: hz.PropTypes.Number, default: 3 }, // Number of targets up at a time
    scoreUI: { type: hz.PropTypes.Entity }, // Optional: UI entity to show score
    timerUI: { type: hz.PropTypes.Entity }, // Optional: UI entity to show timer
    debugMode: { type: hz.PropTypes.Boolean, default: false },
  };

  private activeTargets: Target[] = [];
  private allTargets: Target[] = [];
  private roundActive: boolean = false;
  private score: number = 0;
  private timer: number = 0;
  private roundTimerId?: number;
  private areaEnterSub?: hz.EventSubscription;
  private targetHitSubs: hz.EventSubscription[] = [];

  preStart() {
    super.preStart();
    // Gather all Target script instances from the provided entities
    this.allTargets = this.props.targets
      .map(e => e.getComponents(Target)[0])
      .filter((t): t is Target => !!t);
    this.setAllTargetsActive(false);
  }

  start() {
    // Listen for player entering the game area
    if (this.props.gameAreaTrigger) {
      this.areaEnterSub = this.connectCodeBlockEvent(
        this.props.gameAreaTrigger,
        hz.CodeBlockEvents.OnPlayerEnterTrigger,
        this.onPlayerEnterArea.bind(this)
      );
    }
    // Listen for target hit events
    this.targetHitSubs = this.allTargets.map(target =>
      this.connectLocalEvent(target.entity, TargetEvents.hit, this.onTargetHit.bind(this))
    );
    this.updateScoreUI();
    this.updateTimerUI(this.props.roundTimeSec);
  }

  dispose() {
    this.areaEnterSub?.disconnect();
    this.targetHitSubs.forEach(sub => sub.disconnect());
    if (this.roundTimerId) this.async.clearTimeout(this.roundTimerId);
    super.dispose();
  }

  private onPlayerEnterArea(player: hz.Player) {
    if (this.roundActive) return;
    if (this.props.debugMode) console.log('[QuickDrawManager] Player entered game area, starting round');
    this.startRound();
  }

  private startRound() {
    this.roundActive = true;
    this.score = 0;
    this.updateScoreUI();
    this.setAllTargetsActive(false);
    this.activeTargets = [];
    this.spawnTargets(this.props.targetsUp);
    this.timer = this.props.roundTimeSec;
    this.updateTimerUI(this.timer);
    this.tickTimer();
  }

  private tickTimer() {
    if (!this.roundActive) return;
    this.timer--;
    this.updateTimerUI(this.timer);
    if (this.timer <= 0) {
      this.endRound();
      return;
    }
    this.roundTimerId = this.async.setTimeout(() => this.tickTimer(), 1000);
  }

  private endRound() {
    this.roundActive = false;
    this.setAllTargetsActive(false);
    this.activeTargets = [];
    this.updateTimerUI(0);
    if (this.props.debugMode) console.log(`[QuickDrawManager] Round ended! Final score: ${this.score}`);
    // Optionally, show a popup or UI with the score here
  }

  private onTargetHit({ target }: { target: hz.Entity }) {
    if (!this.roundActive) return;
    this.score++;
    this.updateScoreUI();
    // Remove from activeTargets
    this.activeTargets = this.activeTargets.filter(t => t.entity !== target);
    // Pop up a new random inactive target (keep 3 up)
    this.spawnTargets(this.props.targetsUp - this.activeTargets.length);
  }

  private spawnTargets(count: number) {
    const inactiveTargets = this.allTargets.filter(t => !t['isActive']);
    for (let i = 0; i < count && inactiveTargets.length > 0; i++) {
      const idx = Math.floor(Math.random() * inactiveTargets.length);
      const target = inactiveTargets.splice(idx, 1)[0];
      target.activate();
      this.activeTargets.push(target);
    }
  }

  private setAllTargetsActive(active: boolean) {
    this.allTargets.forEach(t => t.setActive(active));
  }

  private updateScoreUI() {
    if (this.props.scoreUI) {
      // Example: if using a TextGizmo
      const textGizmo = this.props.scoreUI.as(hz.TextGizmo);
      if (textGizmo) textGizmo.text.set(`Score: ${this.score}`);
    }
  }

  private updateTimerUI(time: number) {
    if (this.props.timerUI) {
      const textGizmo = this.props.timerUI.as(hz.TextGizmo);
      if (textGizmo) textGizmo.text.set(`Time: ${time}`);
    }
  }
}
hz.Component.register(QuickDrawManager); 