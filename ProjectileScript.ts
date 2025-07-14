// MAKE THIS SCRIPT RUN LOCAL

import {
  AudioGizmo,
  CodeBlockEvents,
  Component,
  Entity,
  EventSubscription,
  LocalEvent,
  ParticleGizmo,
  Player,
  PhysicalEntity,
  PhysicsForceMode,
  PropTypes,
  TextGizmo,
  Vec3,
  World,
} from 'horizon/core';
import { Target } from './TargetScript';

class Projectile extends Component<typeof Projectile> {
  static propsDefinition = {
    projectileLauncher: { type: PropTypes.Entity },
    objHitForceMultipler: { type: PropTypes.Number, default: 100 },
    objHitSFX: { type: PropTypes.Entity },
    objHitVFX: { type: PropTypes.Entity },
  };

  start() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnProjectileHitObject, this.onProjectileHitObject.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnProjectileHitWorld, this.onProjectileHitWorld.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnProjectileHitPlayer, this.onProjectileHitPlayer.bind(this));
  }

  private onProjectileHitObject(objectHit: Entity, position: Vec3, normal: Vec3) {
    console.log(`Projectile hit: ${(objectHit as any).name.get()}`);
    let target = (objectHit as any).get(Target);

    // If the hit object doesn't have the script, check its parent
    if (!target && (objectHit as any).parent) {
      console.log('No Target script on hit object, checking parent...');
      const parentEntity = (objectHit as any).parent;
      target = (parentEntity as any).get(Target);
    }

    if (target) {
      console.log('Target component found! Calling hit().');
      target.hit(position);
    } else {
      console.log('No Target component found on hit object or its parent.');
    }

    this.onHitGeneric(position, normal);
    this.disableProjectile();
  }

  private onProjectileHitWorld(position: Vec3, normal: Vec3) {
    console.log('projectile hit world');
    this.onHitGeneric(position, normal);
    this.disableProjectile();
  }

  private onProjectileHitPlayer(
    player: Player,
    position: Vec3,
    normal: Vec3,
    headshot: boolean
  ) {
    console.log('projectile hit player');
    this.onHitGeneric(position, normal);
    this.disableProjectile();
  }

  private onHitGeneric(position: Vec3, normal: Vec3) {
    var hitSound = this.props.objHitSFX?.as(AudioGizmo);
    var hitParticles = this.props.objHitVFX?.as(ParticleGizmo);

    if (hitSound) {
      hitSound.position.set(position);
      hitSound.play();
    }

    if (hitParticles) {
      hitParticles.position.set(position);
      hitParticles.play();
    }
  }

  private disableProjectile() {
    (this.entity as any).visible.set(false);
    // Stop it from moving
    const physicalEntity = this.entity.as(PhysicalEntity);
    if (physicalEntity) {
      (physicalEntity as any).velocity = Vec3.zero;
    }
  }
}

Component.register(Projectile);
