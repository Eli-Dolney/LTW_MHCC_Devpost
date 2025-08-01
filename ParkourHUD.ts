import * as hz from 'horizon/core';
import {
  UIComponent,
  View,
  Text,
  Binding,
} from "horizon/ui";

export class ParkourHUD extends UIComponent<typeof ParkourHUD> {
  static propsDefinition = {
    gameMode: { type: hz.PropTypes.Entity },
  };

  private hudVisible: boolean = false;
  private currentTime: number = 0;
  private bestTime: number = 0;
  private updateSubscription?: hz.EventSubscription;

  // Define bindings for the custom UI
  strCurrentTime = new Binding<string>('0.00');
  strBestTime = new Binding<string>('0.00');
  strDisplay = new Binding<string>('none');
  strCompletionMessage = new Binding<string>('');
  strIsNewBest = new Binding<boolean>(false);

  // Define the custom UI
  initializeUI() {
    return View({
      children: [
        Text({ 
          text: this.strCurrentTime, 
          style: {
            fontFamily: "Roboto",
            color: "white",
            fontWeight: "600",
            fontSize: 48,
            textAlign: "center",
          } 
        }),
        Text({ 
          text: this.strBestTime, 
          style: {
            fontFamily: "Roboto",
            color: "yellow",
            fontWeight: "400",
            fontSize: 24,
            textAlign: "center",
            marginTop: 8,
          } 
        }),
        Text({ 
          text: this.strCompletionMessage, 
          style: {
            fontFamily: "Roboto",
            color: this.strIsNewBest ? "gold" : "white",
            fontWeight: "600",
            fontSize: 32,
            textAlign: "center",
            marginTop: 16,
          } 
        }),
      ],
      // These style elements apply to the entire custom UI panel
      style: {
        position: "absolute", // IMPORTANT: This must be "absolute" for screen overlays
        display: this.strDisplay,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        left: 400, // Center horizontally (assuming ~800px screen width)
        top: 80, // Position it up near the top buttons
        backgroundColor: new hz.Color(0, 0, 0), // Black background
        borderColor: "white",
        borderWidth: 2,
        borderRadius: 10,
        minWidth: 200,
      },
    });
  }

  start() {
    // No need for update loop - we only update when setCurrentTime is called
  }

  showHUD() {
    this.hudVisible = true;
    this.currentTime = 0;
    this.strDisplay.set('flex');
    console.log("🎯 Parkour HUD: Timer started!");
  }

  hideHUD() {
    this.hudVisible = false;
    this.strDisplay.set('none');
    console.log("🏁 Parkour HUD: Timer stopped!");
  }

  updateHUD() {
    const timeString = this.currentTime.toFixed(2);
    
    // Update the bindings for the Custom UI
    if (this.hudVisible) {
      this.strCurrentTime.set(`⏱️ ${timeString}s`);
      this.strBestTime.set(`🏆 Best: ${this.bestTime.toFixed(2)}s`);
    }
  }

  completeParkour(finalTime: number, isNewBest: boolean) {
    if (isNewBest) {
      this.bestTime = finalTime;
    }
    
    console.log(`🎉 HUD: Parkour completed in ${finalTime.toFixed(2)}s!`);
    if (isNewBest) {
      console.log(`🏆 HUD: NEW BEST TIME! 🏆`);
    }
    
    // Show completion message briefly
    this.strDisplay.set('flex');
    this.strCompletionMessage.set(`🎉 Completed in ${finalTime.toFixed(2)}s!`);
    this.strIsNewBest.set(isNewBest);
    
    // Clear completion message after 5 seconds (longer display)
    this.async.setTimeout(() => {
      this.strCompletionMessage.set('');
      this.strIsNewBest.set(false);
      this.strDisplay.set('none');
    }, 5000);
  }

  // Public method to be called by ParkourGameMode
  setCurrentTime(time: number) {
    this.currentTime = time;
    this.updateHUD();
  }

  setBestTime(time: number) {
    this.bestTime = time;
  }
}

UIComponent.register(ParkourHUD); 