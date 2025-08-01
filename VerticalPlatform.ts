import { Entity } from 'horizon/core';
import * as hz from 'horizon/core';

class VerticalPlatform extends hz.Component<typeof VerticalPlatform> {
  static propsDefinition = {
    bottomPoint: { type: hz.PropTypes.Entity },
    topPoint: { type: hz.PropTypes.Entity },
    speed: { type: hz.PropTypes.Number, default: 1 },
    startTrigger: { type: hz.PropTypes.Entity },
    endTrigger: { type: hz.PropTypes.Entity },
  };

  private isMoving: boolean = false;
  private movingUp: boolean = true;

  start() {
    // Check if required props are set
    if (!this.props.bottomPoint! || !this.props.topPoint! || !this.props.startTrigger! || !this.props.endTrigger!) {
      console.error('Required props are not set');
      return;
    }

    // Initialize the platform at bottom point
    this.isMoving = false;
    this.movingUp = true;
    
    // Set the platform's initial position to bottom point
    this.entity.position.set(this.props.bottomPoint!.position.get());
    console.log('VerticalPlatform: Initialized at bottom point');

    // Connect to the start trigger event
    this.connectCodeBlockEvent(this.props.startTrigger!, hz.CodeBlockEvents.OnPlayerEnterTrigger, () => {
      this.isMoving = true;
      console.log('Start trigger activated - vertical platform starting to move');
    });

    // Connect to the end trigger event
    this.connectCodeBlockEvent(this.props.endTrigger!, hz.CodeBlockEvents.OnPlayerEnterTrigger, () => {
      this.isMoving = false;
      // Reset to bottom when end trigger is activated
      this.entity.position.set(this.props.bottomPoint!.position.get());
      this.movingUp = true;
      console.log('End trigger activated - vertical platform stopping and resetting to bottom');
    });

    // Update the platform position every frame
    this.connectLocalBroadcastEvent(hz.World.onUpdate, (data: { deltaTime: number }) => {
      if (this.isMoving) {
        this.updateMovement(data.deltaTime);
      }
    });
  }

  private updateMovement(deltaTime: number): void {
    const currentPosition = this.entity.position.get();
    const bottomPos = this.props.bottomPoint!.position.get();
    const topPos = this.props.topPoint!.position.get();
    
    let targetPosition: hz.Vec3;
    
    if (this.movingUp) {
      targetPosition = topPos;
    } else {
      targetPosition = bottomPos;
    }

    const direction = targetPosition.sub(currentPosition).normalize();
    const distance = currentPosition.distance(targetPosition);

    // Debug logging
    console.log(`Platform Y: ${currentPosition.y.toFixed(2)}, Target Y: ${targetPosition.y.toFixed(2)}, Distance: ${distance.toFixed(2)}, MovingUp: ${this.movingUp}`);

    // Check if we've reached the target
    if (distance < 0.1) {
      // Switch direction when close enough to target
      if (this.movingUp) {
        this.movingUp = false;
        console.log('Reached top point, now moving down');
      } else {
        this.movingUp = true;
        console.log('Reached bottom point, now moving up');
      }
      return; // Skip movement this frame to prevent overshooting
    }

    // Move towards target
    const movement = direction.mul(this.props.speed! * deltaTime);
    const newPosition = currentPosition.add(movement);
    
    // Clamp position to prevent going past targets and ensure direction switch
    if (this.movingUp) {
      if (newPosition.y >= topPos.y) {
        this.entity.position.set(topPos);
        this.movingUp = false;
        console.log('Clamped to top point, now moving down');
      } else {
        this.entity.position.set(newPosition);
      }
    } else {
      if (newPosition.y <= bottomPos.y) {
        this.entity.position.set(bottomPos);
        this.movingUp = true;
        console.log('Clamped to bottom point, now moving up');
      } else {
        this.entity.position.set(newPosition);
      }
    }
  }
}

hz.Component.register(VerticalPlatform); 