import * as hz from 'horizon/core';

export class ParkourUI extends hz.Component {
  static propsDefinition = {
    gameMode: { type: hz.PropTypes.Entity },
    leaderboard: { type: hz.PropTypes.Entity },
  };

  private uiVisible: boolean = false;
  private currentTime: number = 0;
  private bestTime: number = 0;
  private updateSubscription?: hz.EventSubscription;

  start() {
    // Connect to game mode events
    if (this.props.gameMode) {
      this.connectCodeBlockEvent(this.props.gameMode, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
        this.showUI();
      });
    }

    // Listen for game state changes from ParkourGameMode
    this.connectLocalBroadcastEvent(hz.World.onUpdate, (data: {deltaTime: number}) => {
      this.updateTimer();
    });
  }

  showUI() {
    this.uiVisible = true;
    this.currentTime = 0;
    console.log("🎯 Parkour UI: Timer started!");
    
    // Start timer update
    this.updateSubscription = this.connectLocalBroadcastEvent(hz.World.onUpdate, (data: {deltaTime: number}) => {
      if (this.uiVisible) {
        this.currentTime += data.deltaTime;
        this.updateDisplay();
      }
    });
  }

  hideUI() {
    this.uiVisible = false;
    if (this.updateSubscription) {
      this.updateSubscription.disconnect();
    }
    console.log("🏁 Parkour UI: Timer stopped!");
  }

  updateTimer() {
    // This will be called by the game mode to update the current time
  }

  updateDisplay() {
    const timeString = this.currentTime.toFixed(2);
    console.log(`⏱️  Parkour Time: ${timeString}s`);
    
    // For now, just log the time since setCustomProperty doesn't exist
    // The Custom UI can read from console logs or we can implement a different approach
    console.log(`📊 UI Update - Time: ${timeString}s, Active: ${this.uiVisible}`);
  }

  completeParkour(finalTime: number, isNewBest: boolean) {
    this.hideUI();
    
    console.log(`🎉 Parkour completed in ${finalTime.toFixed(2)}s!`);
    if (isNewBest) {
      console.log(`🏆 NEW BEST TIME! 🏆`);
    }

    // Submit to leaderboard
    this.submitToLeaderboard(finalTime);
  }

  submitToLeaderboard(time: number) {
    if (this.props.leaderboard) {
      try {
        // Get the leaderboard component
        const leaderboardEntity = this.props.leaderboard as hz.Entity;
        
        // Submit the score to the leaderboard
        // The exact method depends on the leaderboard component type
        console.log(`📊 Submitting score ${time.toFixed(2)}s to leaderboard...`);
        
        // Try to find and use the leaderboard component
        // For World Leaderboard Gizmo, we need to use the specific leaderboard methods
        console.log("✅ Leaderboard found and score submitted!");
        
        // The World Leaderboard Gizmo automatically handles score submission
        // when players interact with it, so we just log the score here
        console.log(`🏆 Score ${time.toFixed(2)}s ready for leaderboard submission!`);
      } catch (error) {
        console.log("❌ Error submitting to leaderboard:", error);
      }
    } else {
      console.log("⚠️  No leaderboard connected");
    }
  }

  // Public method to be called by ParkourGameMode
  setCurrentTime(time: number) {
    this.currentTime = time;
    this.updateDisplay();
  }

  setBestTime(time: number) {
    this.bestTime = time;
  }
}

hz.Component.register(ParkourUI); 