import {
  AudioGizmo,
  CodeBlockEvents,
  Color,
  Component,
  Entity,
  EventSubscription,
  LocalEvent,
  ParticleGizmo,
  Player,
  PropTypes,
  TextGizmo,
  Vec3,
  World,
} from 'horizon/core';

export class Target extends Component<typeof Target> {
  static propsDefinition = {
    targetMesh: { type: PropTypes.Entity },
    hitSFX: { type: PropTypes.Entity },
    hitVFX: { type: PropTypes.Entity },
    scoreValue: { type: PropTypes.Number, default: 10 },
    targetColor: { type: PropTypes.Color, default: Color.red },
    hitColor: { type: PropTypes.Color, default: Color.green },
    resetTimeMs: { type: PropTypes.Number, default: 2000 },
  };

  private isHit: boolean = false;
  private isActive: boolean = true;
  private score: number = 10;
  private resetTimestamp: number = 0;
  private originalColor: Color = Color.red;
  private originalScale: Vec3 = new Vec3(1, 1, 1);
  public static TargetHitEvent = new LocalEvent<{targetEntity: Entity, score: number}>('TargetHit');
  private broadcaster: any;

  public start() {
    if (this.props.targetMesh) {
      this.originalColor = this.props.targetMesh.color.get();
      this.originalScale = this.props.targetMesh.scale.get();
    }
    this.score = this.props.scoreValue;
    this.setTargetColor(this.props.targetColor);

    this.connectLocalBroadcastEvent(World.onUpdate, this.onUpdate.bind(this));

    // Get the broadcaster for the event
    this.broadcaster = this.connectLocalBroadcastEvent(Target.TargetHitEvent, () => {});
  }
  
  public hit(position: Vec3) {
    console.log('[TargetScript] hit() function called.');
    if (!this.isActive || this.isHit) {
      console.log(`[TargetScript] Hit ignored: isActive=${this.isActive}, isHit=${this.isHit}`);
      return;
    }

    this.isHit = true;
    this.resetTimestamp = Date.now() + this.props.resetTimeMs;
    this.setTargetColor(this.props.hitColor);
    this.props.targetMesh?.scale.set(this.originalScale.mul(1.2));

    if (this.props.hitSFX) {
      this.props.hitSFX.as(AudioGizmo)?.position.set(position);
      this.props.hitSFX.as(AudioGizmo)?.play();
    }

    if (this.props.hitVFX) {
      this.props.hitVFX.as(ParticleGizmo)?.position.set(position);
      this.props.hitVFX.as(ParticleGizmo)?.play();
    }

    // Use the broadcaster to send the event
    console.log('[TargetScript] Firing TargetHitEvent.');
    this.broadcaster.fire({
      targetEntity: this.entity,
      score: this.score,
    });
  }

  public onUpdate() {
    if (this.isHit && Date.now() >= this.resetTimestamp) {
      this.resetTarget();
    }
  }

  private resetTarget() {
    this.isHit = false;
    this.setTargetColor(this.props.targetColor);
    this.props.targetMesh?.scale.set(this.originalScale);
  }

  private setTargetColor(color: Color) {
    if (this.props.targetMesh) {
      this.props.targetMesh.color.set(color);
    }
  }

  public activate() {
    this.isActive = true;
    this.setTargetColor(this.props.targetColor);
  }

  public deactivate() {
    this.isActive = false;
    this.setTargetColor(new Color(0.5, 0.5, 0.5));
  }

  public setScoreValue(value: number) {
    this.score = value;
  }

  public isTargetHit(): boolean {
    return this.isHit;
  }
}

Component.register(Target); 