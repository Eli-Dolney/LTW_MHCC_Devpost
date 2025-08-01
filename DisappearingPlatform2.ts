import { Entity } from 'horizon/core';
import * as hz from 'horizon/core';

class DisappearingPlatform extends hz.Component<typeof DisappearingPlatform> {
  static propsDefinition = {
    platform: { type: hz.PropTypes.Entity }
  };

  private isPlayerOnPlatform = false;
  private timerId: number | null = null;

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
      if (!this.isPlayerOnPlatform) {
        this.isPlayerOnPlatform = true;
        this.timerId = this.async.setTimeout(() => this.disappear(), 2000);
      }
    });

    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitTrigger, (player: hz.Player) => {
      if (this.isPlayerOnPlatform) {
        this.isPlayerOnPlatform = false;
        if (this.timerId !== null) {
          this.async.clearTimeout(this.timerId);
          this.timerId = null;
        }
      }
    });
  }

  disappear() {
    const platform = this.props.platform!.as(hz.PhysicalEntity);
    if (platform) {
      platform.collidable.set(false);
      platform.visible.set(false);
      this.async.setTimeout(() => this.reappear(), 3000);
    }
  }

  reappear() {
    const platform = this.props.platform!.as(hz.PhysicalEntity);
    if (platform) {
      platform.collidable.set(true);
      platform.visible.set(true);
      this.isPlayerOnPlatform = false;
    }
  }
}

hz.Component.register(DisappearingPlatform);