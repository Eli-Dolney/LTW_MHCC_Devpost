import * as hz from 'horizon/core';
import { ParkourUI } from './ParkourUI';
import { ParkourHUD } from './ParkourHUD';

class ParkourGameMode extends hz.Component {
  static propsDefinition = {
    startTrigger: { type: hz.PropTypes.Entity },
    endTrigger: { type: hz.PropTypes.Entity },
    uiComponent: { type: hz.PropTypes.Entity },
    hudComponent: { type: hz.PropTypes.Entity },
  };

  private gameActive: boolean = false;
  private startTime: number = 0;
  private currentTime: number = 0;
  private bestTime: number = 0;
  private updateSubscription?: hz.EventSubscription;
  private uiComponent?: any;
  private hudComponent?: any;
  private lastHUDUpdate: number = 0;

  start() {
    // Connect to start trigger (door trigger)
    if (this.props.startTrigger) {
      this.connectCodeBlockEvent(this.props.startTrigger, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
        this.startGame(player);
      });
    }

    // Connect to end trigger (will be added later)
    if (this.props.endTrigger) {
      this.connectCodeBlockEvent(this.props.endTrigger, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
        this.endGame(player);
      });
    }

    // Initialize UI component
    if (this.props.uiComponent) {
      const uiEntity = this.props.uiComponent as hz.Entity;
      // Get the ParkourUI component specifically
      const uiComponents = uiEntity.getComponents(ParkourUI);
      if (uiComponents.length > 0) {
        this.uiComponent = uiComponents[0];
      }
    }

    // Initialize HUD component
    if (this.props.hudComponent) {
      const hudEntity = this.props.hudComponent as hz.Entity;
      // Get the ParkourHUD component specifically
      const hudComponents = hudEntity.getComponents(ParkourHUD);
      if (hudComponents.length > 0) {
        this.hudComponent = hudComponents[0];
      }
    }
    
    this.updateUI();
  }

  startGame(player: hz.Player) {
    if (!this.gameActive) {
      this.gameActive = true;
      this.startTime = Date.now();
      this.currentTime = 0;
      this.lastHUDUpdate = 0;
      
      console.log(`Parkour started by player!`);
      
      // Notify UI component
      if (this.uiComponent && this.uiComponent.showUI) {
        this.uiComponent.showUI();
      }

      // Notify HUD component
      if (this.hudComponent && this.hudComponent.showHUD) {
        this.hudComponent.showHUD();
      }
      
      // Start timer update
      this.updateSubscription = this.connectLocalBroadcastEvent(hz.World.onUpdate, (data: {deltaTime: number}) => {
        if (this.gameActive) {
          this.currentTime = (Date.now() - this.startTime) / 1000;
          
          // Only update HUD every 0.1 seconds to save performance
          if (this.currentTime - this.lastHUDUpdate >= 0.1) {
            this.updateUI();
            this.lastHUDUpdate = this.currentTime;
          }
        }
      });
    }
  }

  endGame(player: hz.Player) {
    if (this.gameActive) {
      this.gameActive = false;
      const finalTime = this.currentTime;
      
      // Update best time if this is faster
      const isNewBest = this.bestTime === 0 || finalTime < this.bestTime;
      if (isNewBest) {
        this.bestTime = finalTime;
      }
      
      console.log(`Parkour completed by player! Time: ${finalTime.toFixed(2)}s`);
      if (isNewBest) {
        console.log(`New best time! 🎉`);
      }
      
      // Notify UI component
      if (this.uiComponent && this.uiComponent.completeParkour) {
        this.uiComponent.completeParkour(finalTime, isNewBest);
      }

      // Notify HUD component
      if (this.hudComponent && this.hudComponent.completeParkour) {
        this.hudComponent.completeParkour(finalTime, isNewBest);
      }
      
      // Stop timer update
      if (this.updateSubscription) {
        this.updateSubscription.disconnect();
      }
      
      this.updateUI();
    }
  }

  updateUI() {
    // Update UI component with current time
    if (this.uiComponent && this.uiComponent.setCurrentTime) {
      this.uiComponent.setCurrentTime(this.currentTime);
    }

    // Update HUD component with current time
    if (this.hudComponent && this.hudComponent.setCurrentTime) {
      this.hudComponent.setCurrentTime(this.currentTime);
    }
    
    // Log current status
    if (this.gameActive) {
      console.log(`⏱️  Current Time: ${this.currentTime.toFixed(2)}s`);
    } else {
      console.log(`🏆 Best Time: ${this.bestTime.toFixed(2)}s`);
    }
  }

  // Method to manually reset the game
  resetGame() {
    this.gameActive = false;
    this.currentTime = 0;
    if (this.updateSubscription) {
      this.updateSubscription.disconnect();
    }
    this.updateUI();
  }
}

hz.Component.register(ParkourGameMode); 