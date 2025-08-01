import { Entity } from 'horizon/core';
import * as hz from 'horizon/core';

class MovingPlatform extends hz.Component<typeof MovingPlatform> {
  static propsDefinition = {
    pointA: { type: hz.PropTypes.Entity },
    pointB: { type: hz.PropTypes.Entity },
    speed: { type: hz.PropTypes.Number, default: 1 },
    startTrigger: { type: hz.PropTypes.Entity },
    endTrigger: { type: hz.PropTypes.Entity },
  };

  private isMoving!: boolean;
  private currentTarget!: hz.Vec3;
  private movingToPointB!: boolean;

  start() {
    // Check if required props are set
    if (!this.props.pointA! || !this.props.pointB! || !this.props.startTrigger! || !this.props.endTrigger!) {
      console.error('Required props are not set');
      return;
    }

    // Initialize the platform at point A and set it as the current target
    this.isMoving = false;
    this.movingToPointB = true; // Start by moving to point B when triggered
    this.currentTarget = this.props.pointB!.position.get();
    
    // Set the platform's initial position to point A
    this.entity.position.set(this.props.pointA!.position.get());

    // Connect to the start trigger event
    this.connectCodeBlockEvent(this.props.startTrigger!, hz.CodeBlockEvents.OnPlayerEnterTrigger, () => {
      this.isMoving = true;
      console.log('Start trigger activated - platform starting to move');
    });

    // Connect to the end trigger event
    this.connectCodeBlockEvent(this.props.endTrigger!, hz.CodeBlockEvents.OnPlayerEnterTrigger, () => {
      this.isMoving = false;
      // Reset to point A when end trigger is activated
      this.entity.position.set(this.props.pointA!.position.get());
      this.currentTarget = this.props.pointB!.position.get();
      this.movingToPointB = true;
      console.log('End trigger activated - platform stopping and resetting to point A');
    });

    // Update the platform position every frame
    this.connectLocalBroadcastEvent(hz.World.onUpdate, (data: { deltaTime: number }) => {
      if (this.isMoving) {
        const currentPosition = this.entity.position.get();
        const direction = this.currentTarget.sub(currentPosition).normalize();
        const distance = currentPosition.distance(this.currentTarget);

        if (distance < 0.1) {
          // Switch target when close enough
          if (this.movingToPointB) {
            this.currentTarget = this.props.pointA!.position.get();
            this.movingToPointB = false;
            console.log('Reached point B, now moving to point A');
          } else {
            this.currentTarget = this.props.pointB!.position.get();
            this.movingToPointB = true;
            console.log('Reached point A, now moving to point B');
          }
        }

        const newPosition = currentPosition.add(direction.mul(this.props.speed! * data.deltaTime));
        this.entity.position.set(newPosition);
      }
    });
  }
}

hz.Component.register(MovingPlatform);