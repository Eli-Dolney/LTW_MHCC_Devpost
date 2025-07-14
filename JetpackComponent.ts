import * as hz from 'horizon/core';

/**
 * Jetpack flight state
 */
type JetpackState = {
  isEquipped: boolean;
  isFlying: boolean;
  fuelLevel: number;
  isRecharging: boolean;
  lastSpaceTap: number;
  doubleTapWindow: number;
  flightAngle: number;
  flightSpeed: number;
  maxFuel: number;
  rechargeDelay: number;
};

/**
 * Jetpack component that handles flight mechanics, fuel management, and input detection
 * Features:
 * - Double-tap spacebar activation (desktop only)
 * - 35° upward flight angle
 * - Fuel system with 15-second recharge after landing
 * - Equip/unequip functionality
 */
export class JetpackComponent extends hz.Component<typeof JetpackComponent> {
  static propsDefinition = {
    // Jetpack configuration
    maxFuel: { type: hz.PropTypes.Number, default: 5.0 }, // 5 seconds of flight
    flightSpeed: { type: hz.PropTypes.Number, default: 8.0 }, // 8 m/s flight speed
    flightAngle: { type: hz.PropTypes.Number, default: 35.0 }, // 35 degrees upward
    doubleTapWindow: { type: hz.PropTypes.Number, default: 0.3 }, // 300ms double-tap window
    rechargeDelay: { type: hz.PropTypes.Number, default: 15.0 }, // 15 seconds to recharge
  };

  // State management
  private state: JetpackState = {
    isEquipped: false,
    isFlying: false,
    fuelLevel: 0,
    isRecharging: false,
    lastSpaceTap: 0,
    doubleTapWindow: 0.3,
    flightAngle: 35.0,
    flightSpeed: 8.0,
    maxFuel: 5.0,
    rechargeDelay: 15.0,
  };

  // Event subscriptions
  private updateSubscription?: hz.EventSubscription;
  private inputSubscription?: hz.EventSubscription;
  private rechargeTimer?: number;

  // References
  private player?: hz.Player;
  private jetpackMesh?: hz.Entity;

  /**
   * Initialize the component
   */
  preStart() {
    // Get the player that owns this component
    this.player = this.entity.owner.get();
    
    // Initialize state from props
    this.state.maxFuel = this.props.maxFuel;
    this.state.flightSpeed = this.props.flightSpeed;
    this.state.flightAngle = this.props.flightAngle;
    this.state.doubleTapWindow = this.props.doubleTapWindow;
    this.state.rechargeDelay = this.props.rechargeDelay;
    this.state.fuelLevel = this.state.maxFuel;
  }

  /**
   * Start the component
   */
  start() {
    // Subscribe to world update for flight mechanics
    this.updateSubscription = this.connectLocalBroadcastEvent(hz.World.onUpdate, this.onUpdate.bind(this));
    
    // Subscribe to input events for spacebar detection
    this.setupInputHandling();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.updateSubscription?.disconnect();
    this.inputSubscription?.disconnect();
    
    if (this.rechargeTimer) {
      this.async.clearTimeout(this.rechargeTimer);
    }
    
    // Stop flying if active
    this.stopFlight();
  }

  /**
   * Setup input handling for spacebar detection
   */
  private setupInputHandling() {
    // Only handle input on desktop
    if (this.player?.deviceType.get() !== hz.PlayerDeviceType.Desktop) {
      return;
    }

    // Create a player input for spacebar (Jump action)
    const spaceInput = hz.PlayerControls.connectLocalInput(
      hz.PlayerInputAction.Jump,
      hz.ButtonIcon.Jump,
      this
    );
    
    spaceInput.registerCallback((action: hz.PlayerInputAction, pressed: boolean) => {
      if (pressed && this.state.isEquipped) {
        this.onSpacePressed();
      }
    });
  }

  /**
   * Handle spacebar press for double-tap detection
   */
  private onSpacePressed() {
    const currentTime = Date.now();
    
    // Check if this is a double-tap
    if (currentTime - this.state.lastSpaceTap < this.state.doubleTapWindow * 1000) {
      this.activateJetpack();
    }
    
    this.state.lastSpaceTap = currentTime;
  }

  /**
   * Activate the jetpack flight
   */
  private activateJetpack() {
    if (!this.state.isEquipped || this.state.isFlying || this.state.fuelLevel <= 0) {
      return;
    }

    this.state.isFlying = true;
    console.log("Jetpack activated!");
  }

  /**
   * Stop jetpack flight
   */
  private stopFlight() {
    if (!this.state.isFlying) {
      return;
    }

    this.state.isFlying = false;
    console.log("Jetpack deactivated!");
    
    // Start recharge timer when landing
    this.startRechargeTimer();
  }

  /**
   * Start the recharge timer
   */
  private startRechargeTimer() {
    // Clear any existing timer
    if (this.rechargeTimer) {
      this.async.clearTimeout(this.rechargeTimer);
    }

    this.state.isRecharging = true;
    
    // Set timer for recharge delay
    this.rechargeTimer = this.async.setTimeout(() => {
      this.rechargeFuel();
    }, this.state.rechargeDelay * 1000);
  }

  /**
   * Recharge the fuel
   */
  private rechargeFuel() {
    this.state.fuelLevel = this.state.maxFuel;
    this.state.isRecharging = false;
    this.rechargeTimer = undefined;
    console.log("Jetpack fuel recharged!");
  }

  /**
   * Update method called every frame
   */
  private onUpdate(data: { deltaTime: number }) {
    if (!this.player || !this.state.isEquipped) {
      return;
    }

    // Handle flight mechanics
    if (this.state.isFlying) {
      this.updateFlight(data.deltaTime);
    }

    // Check if player landed (stopped flying)
    if (this.state.isFlying && this.player.isGrounded.get()) {
      this.stopFlight();
    }
  }

  /**
   * Update flight mechanics
   */
  private updateFlight(deltaTime: number) {
    if (!this.player || this.state.fuelLevel <= 0) {
      this.stopFlight();
      return;
    }

    // Calculate flight direction at 35° angle
    const angleRadians = (this.state.flightAngle * Math.PI) / 180;
    const forward = this.player.forward.get();
    const up = this.player.up.get();
    
    // Create flight vector: forward + upward component
    const flightDirection = hz.Vec3.add(
      forward,
      hz.Vec3.mul(up, Math.sin(angleRadians))
    ).normalize();

    // Apply flight velocity
    const flightVelocity = hz.Vec3.mul(flightDirection, this.state.flightSpeed);
    this.player.velocity.set(flightVelocity);

    // Consume fuel
    this.state.fuelLevel -= deltaTime;
    
    // Stop if out of fuel
    if (this.state.fuelLevel <= 0) {
      this.state.fuelLevel = 0;
      this.stopFlight();
    }
  }

  /**
   * Equip the jetpack to a player
   */
  public equip(player: hz.Player) {
    if (this.state.isEquipped) {
      console.log("Jetpack already equipped!");
      return;
    }

    this.player = player;
    this.state.isEquipped = true;
    this.state.fuelLevel = this.state.maxFuel;
    this.state.isRecharging = false;
    
    // Show jetpack mesh
    this.showJetpackMesh();
    
    // Setup input handling for the new player
    this.setupInputHandling();
    
    console.log("Jetpack equipped!");
  }

  /**
   * Unequip the jetpack
   */
  public unequip() {
    if (!this.state.isEquipped) {
      return;
    }

    // Stop flying if active
    this.stopFlight();
    
    // Hide jetpack mesh
    this.hideJetpackMesh();
    
    this.state.isEquipped = false;
    this.player = undefined;
    
    console.log("Jetpack unequipped!");
  }

  /**
   * Show the jetpack mesh on the player
   */
  private showJetpackMesh() {
    // TODO: Implement mesh attachment
    // This would typically involve:
    // 1. Creating a jetpack mesh entity
    // 2. Attaching it to the player's back
    // 3. Making it visible
    console.log("Jetpack mesh should be visible");
  }

  /**
   * Hide the jetpack mesh
   */
  private hideJetpackMesh() {
    // TODO: Implement mesh hiding
    // This would typically involve:
    // 1. Making the jetpack mesh invisible
    // 2. Or detaching it from the player
    console.log("Jetpack mesh should be hidden");
  }

  /**
   * Get current fuel level (0-1)
   */
  public getFuelLevel(): number {
    return this.state.fuelLevel / this.state.maxFuel;
  }

  /**
   * Get current fuel amount in seconds
   */
  public getFuelAmount(): number {
    return this.state.fuelLevel;
  }

  /**
   * Check if jetpack is equipped
   */
  public isEquipped(): boolean {
    return this.state.isEquipped;
  }

  /**
   * Check if currently flying
   */
  public isFlying(): boolean {
    return this.state.isFlying;
  }

  /**
   * Check if fuel is recharging
   */
  public isRecharging(): boolean {
    return this.state.isRecharging;
  }

  /**
   * Get time until fuel recharges (in seconds)
   */
  public getRechargeTimeRemaining(): number {
    if (!this.state.isRecharging || !this.rechargeTimer) {
      return 0;
    }
    
    // This is a simplified calculation - in a real implementation,
    // you'd track the actual recharge start time
    return this.state.rechargeDelay;
  }
}

// Register the component
hz.Component.register(JetpackComponent); 