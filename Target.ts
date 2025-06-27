import * as hz from 'horizon/core';

export const TargetEvents = {
  hit: new hz.LocalEvent<{target: hz.Entity, player?: hz.Player}>('targetHit'),
};

export class Target extends hz.Component<typeof Target> {
  static propsDefinition = {
    hitSFX: { type: hz.PropTypes.Entity }, // Optional sound effect
    resetTimeMs: { type: hz.PropTypes.Number, default: 1000 }, // Time before target can be reactivated
  };

  private isActive: boolean = false;
  private resetTimer?: number;
  private hitSFX?: hz.AudioGizmo;

  preStart() {
    super.preStart();
    this.hitSFX = this.props.hitSFX?.as(hz.AudioGizmo);
    this.setActive(false);
  }

  // Call this to pop up the target
  public setActive(active: boolean) {
    this.isActive = active;
    this.entity.visible.set(active);
    this.entity.collidable.set(active);
  }

  // Called by the game manager to pop up the target
  public activate() {
    this.setActive(true);
  }

  // Called when hit or by manager to hide the target
  public deactivate() {
    this.setActive(false);
  }

  // This should be called by your gun/projectile script when the target is hit
  public onHit(player?: hz.Player) {
    if (!this.isActive) return;
    this.setActive(false);
    if (this.hitSFX) this.hitSFX.play();
    this.sendLocalEvent(this.entity, TargetEvents.hit, { target: this.entity, player });
    // Optionally, auto-reactivate after a delay (comment out if you want manager to control)
    // this.resetTimer = this.async.setTimeout(() => this.setActive(true), this.props.resetTimeMs);
  }

  // The gun/projectile script should call target.onHit(player) when this target is hit.
  start() {
    // No built-in OnHit event; see above.
  }

  dispose() {
    if (this.resetTimer) this.async.clearTimeout(this.resetTimer);
    super.dispose();
  }
}
hz.Component.register(Target); 