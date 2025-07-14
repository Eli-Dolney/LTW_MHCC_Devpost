import * as hz from 'horizon/core';

/**
 * Local jetpack controller that handles input processing and effects
 * Integrates with the existing PlayerControllerLocal system
 */
export class JetpackControllerLocal extends hz.Component<typeof JetpackControllerLocal> {
  static propsDefinition = {
    // Flight properties
    flightAngle: { type: hz.PropTypes.Number, default: 35.0 },
    flightSpeed: { type: hz.PropTypes.Number, default: 15.0 },
    maxFuel: { type: hz.PropTypes.Number, default: 5.0 },
    rechargeDelay: { type: hz.PropTypes.Number, default: 15.0 },
    doubleTapWindow: { type: hz.PropTypes.Number, default: 0.3 },
    
    // Visual/audio effects
    jetpackVFX: { type: hz.PropTypes.Entity },
    jetpackSFX: { type: hz.PropTypes.Entity },
    fuelRechargeVFX: { type: hz.PropTypes.Entity },
    fuelRechargeSFX: { type: hz.PropTypes.Entity },
  };

  // State tracking
  private lastSpaceTap: number = 0;
  private flightStartTime: number = 0;
  private rechargeStartTime: number = 0;
  private isGrounded: boolean = true;
  private lastGroundCheck: number = 0;

  // Jetpack state (local variables since props are read-only)
  private isEquipped: boolean = false;
  private fuelLevel: number = 1.0;
  private isFlying: boolean = false;
  private isRecharging: boolean = false;

  // Input handling
  private jetpackInput?: hz.PlayerInput;

  // Event subscriptions
  private updateSubscription?: hz.EventSubscription;

  // References
  private player?: hz.Player;
  private jetpackMesh?: hz.Entity;

  /**
   * Initialize the component
   */
  preStart() {
    // Only run on local player (not server)
    if (this.entity.owner.get() === this.world.getServerPlayer()) {
      return;
    }

    this.localPreStart();
  }

  /**
   * Start the component
   */
  start() {
    // Only run on local player (not server)
    if (this.entity.owner.get() === this.world.getServerPlayer()) {
      return;
    }

    this.localStart();
  }

  /**
   * Local pre-start initialization
   */
  private localPreStart() {
    this.player = this.entity.owner.get();
    
    // Connect jetpack inputs
    this.connectJetpackInputs();
    
    // Connect properties for effects
    this.connectEffectProperties();
    
    // Create network event subscriptions
    this.createNetworkSubscriptions();
    
    // Setup update loop
    this.updateSubscription = this.connectLocalBroadcastEvent(
      hz.World.onUpdate,
      this.onUpdate.bind(this)
    );
  }

  /**
   * Local start initialization
   */
  private localStart() {
    console.log('JetpackControllerLocal started for local player');
    
    // Find jetpack mesh in children
    this.findJetpackMesh();
    
    // Initial ground check
    this.checkGroundState();
  }

  /**
   * Connect jetpack input controls
   */
  private connectJetpackInputs() {
    // Create jetpack input (double-tap spacebar)
    this.jetpackInput = hz.PlayerControls.connectLocalInput(
      hz.PlayerInputAction.Jump,
      hz.ButtonIcon.Jump,
      this
    );

    // Register callback for double-tap detection
    this.jetpackInput.registerCallback(
      this.onJetpackInput.bind(this)
    );
  }

  /**
   * Connect effect properties
   */
  private connectEffectProperties() {
    // TODO: Connect VFX/SFX properties when needed
    // This would involve setting up bindings to the effect entities
  }

  /**
   * Create network event subscriptions
   */
  private createNetworkSubscriptions() {
    // TODO: Add network event subscriptions when needed
    // For now, we'll handle local events only
  }

  /**
   * Handle jetpack input (double-tap spacebar)
   */
  private onJetpackInput(action: hz.PlayerInputAction, pressed: boolean) {
    if (!pressed || !this.isEquipped) return;

    const currentTime = Date.now();
    
    // Check for double-tap
    if (currentTime - this.lastSpaceTap < this.props.doubleTapWindow * 1000) {
      this.activateJetpack();
    }
    
    this.lastSpaceTap = currentTime;
  }

  /**
   * Activate jetpack flight
   */
  private activateJetpack() {
    if (this.isFlying || this.fuelLevel <= 0) return;

    console.log('Activating jetpack flight');
    
    // Set flying state
    this.isFlying = true;
    this.fuelLevel = Math.max(0, this.fuelLevel - 0.2); // Consume fuel
    this.flightStartTime = Date.now();
    
    // Apply flight velocity
    this.applyFlightVelocity();
    
    // Play activation effects
    this.playJetpackEffects();
    
    // TODO: Send network event when PlayerEvents is available
    console.log('Jetpack activated');
  }

  /**
   * Apply flight velocity to player
   */
  private applyFlightVelocity() {
    if (!this.player) return;

    // Calculate flight direction (35° upward angle)
    const angleRadians = (this.props.flightAngle * Math.PI) / 180;
    const forward = this.player.forward.get();
    const up = hz.Vec3.up;
    
    // Create flight vector: forward + upward component
    const flightDirection = hz.Vec3.add(
      forward,
      hz.Vec3.mul(up, Math.sin(angleRadians))
    ).normalize();
    
    // Apply velocity
    const flightVelocity = hz.Vec3.mul(flightDirection, this.props.flightSpeed);
    this.player.velocity.set(flightVelocity);
  }

  /**
   * Play jetpack visual and audio effects
   */
  private playJetpackEffects() {
    // Play jetpack VFX
    if (this.props.jetpackVFX) {
      const vfx = this.props.jetpackVFX.as(hz.ParticleGizmo);
      vfx?.play();
    }

    // Play jetpack SFX
    if (this.props.jetpackSFX) {
      const sfx = this.props.jetpackSFX.as(hz.AudioGizmo);
      sfx?.play();
    }
  }

  /**
   * Update loop for continuous flight and ground checking
   */
  private onUpdate(data: { deltaTime: number }) {
    if (!this.player) return;

    // Check ground state periodically
    if (Date.now() - this.lastGroundCheck > 100) { // Check every 100ms
      this.checkGroundState();
      this.lastGroundCheck = Date.now();
    }

    // Update flight state
    if (this.isFlying) {
      this.updateFlight(data.deltaTime);
    }

    // Update recharge state
    if (this.isRecharging) {
      this.updateRecharge();
    }
  }

  /**
   * Check if player is on the ground
   */
  private checkGroundState() {
    if (!this.player) return;

    // Simple ground check using raycast
    const playerPos = this.player.position.get();
    const groundCheckPos = hz.Vec3.add(playerPos, hz.Vec3.mul(hz.Vec3.down, 0.1));
    
    // TODO: Implement proper ground detection using raycast
    // For now, use a simple height-based check
    const wasGrounded = this.isGrounded;
    this.isGrounded = playerPos.y < 1.0; // Simple ground threshold
    
    // If player just landed and was flying
    if (this.isGrounded && !wasGrounded && this.isFlying) {
      this.onPlayerLanded();
    }
  }

  /**
   * Handle player landing
   */
  private onPlayerLanded() {
    console.log('Player landed - stopping jetpack flight');
    
    // Stop flight
    this.isFlying = false;
    
    // Start recharge timer
    this.startRechargeTimer();
    
    // TODO: Send network event when PlayerEvents is available
    console.log('Jetpack deactivated');
  }

  /**
   * Update flight state
   */
  private updateFlight(deltaTime: number) {
    // Consume fuel over time
    const fuelConsumption = deltaTime / this.props.maxFuel;
    this.fuelLevel = Math.max(0, this.fuelLevel - fuelConsumption);
    
    // Stop flight if out of fuel
    if (this.fuelLevel <= 0) {
      this.isFlying = false;
      console.log('Jetpack out of fuel');
    }
  }

  /**
   * Start recharge timer
   */
  private startRechargeTimer() {
    this.isRecharging = true;
    this.rechargeStartTime = Date.now();
    
    // Play recharge effects
    this.playRechargeEffects();
  }

  /**
   * Update recharge state
   */
  private updateRecharge() {
    const rechargeTimeElapsed = (Date.now() - this.rechargeStartTime) / 1000;
    
    if (rechargeTimeElapsed >= this.props.rechargeDelay) {
      this.rechargeFuel();
    }
  }

  /**
   * Recharge fuel
   */
  private rechargeFuel() {
    console.log('Jetpack fuel recharged');
    
    this.fuelLevel = 1.0;
    this.isRecharging = false;
    
    // Stop recharge effects
    this.stopRechargeEffects();
  }

  /**
   * Play recharge effects
   */
  private playRechargeEffects() {
    // Play recharge VFX
    if (this.props.fuelRechargeVFX) {
      const vfx = this.props.fuelRechargeVFX.as(hz.ParticleGizmo);
      vfx?.play();
    }

    // Play recharge SFX
    if (this.props.fuelRechargeSFX) {
      const sfx = this.props.fuelRechargeSFX.as(hz.AudioGizmo);
      sfx?.play();
    }
  }

  /**
   * Stop recharge effects
   */
  private stopRechargeEffects() {
    // Stop recharge VFX
    if (this.props.fuelRechargeVFX) {
      const vfx = this.props.fuelRechargeVFX.as(hz.ParticleGizmo);
      vfx?.stop();
    }

    // Stop recharge SFX
    if (this.props.fuelRechargeSFX) {
      const sfx = this.props.fuelRechargeSFX.as(hz.AudioGizmo);
      sfx?.stop();
    }
  }

  /**
   * Find jetpack mesh in children
   */
  private findJetpackMesh() {
    const children = this.entity.children.get();
    for (const child of children) {
      if (child.name.get().toLowerCase().includes('jetpack') || 
          child.name.get().toLowerCase().includes('mesh')) {
        this.jetpackMesh = child;
        break;
      }
    }
  }

  /**
   * Show jetpack mesh
   */
  private showJetpackMesh() {
    if (this.jetpackMesh) {
      this.jetpackMesh.visible.set(true);
    }
  }

  /**
   * Hide jetpack mesh
   */
  private hideJetpackMesh() {
    if (this.jetpackMesh) {
      this.jetpackMesh.visible.set(false);
    }
  }

  /**
   * Handle player getting boost (from rings)
   */
  private onPlayerGotBoost(data: { player: hz.Player }) {
    // TODO: Implement boost integration with jetpack
    console.log('Player got boost - could integrate with jetpack');
  }

  /**
   * Handle jump control data updates
   */
  private onSetJumpCtrlData(data: { player: hz.Player, data: any }) {
    // TODO: Integrate with existing jump control system
    console.log('Jump control data updated');
  }

  /**
   * Handle player out of bounds
   */
  private onPlayerOOB(data: { player: hz.Player }) {
    // Stop jetpack flight if player goes out of bounds
    if (this.isFlying) {
      this.isFlying = false;
      console.log('Jetpack flight stopped - player out of bounds');
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.updateSubscription?.disconnect();
    this.jetpackInput?.disconnect();
  }

  /**
   * Equip jetpack
   */
  public equipJetpack() {
    this.isEquipped = true;
    this.showJetpackMesh();
    console.log('Jetpack equipped');
  }

  /**
   * Unequip jetpack
   */
  public unequipJetpack() {
    this.isEquipped = false;
    this.isFlying = false;
    this.hideJetpackMesh();
    console.log('Jetpack unequipped');
  }

  /**
   * Get current fuel level
   */
  public getFuelLevel(): number {
    return this.fuelLevel;
  }

  /**
   * Check if jetpack is equipped
   */
  public isJetpackEquipped(): boolean {
    return this.isEquipped;
  }

  /**
   * Check if currently flying
   */
  public getIsFlying(): boolean {
    return this.isFlying;
  }

  /**
   * Check if recharging
   */
  public getIsRecharging(): boolean {
    return this.isRecharging;
  }
}

// Register the component
hz.Component.register(JetpackControllerLocal); 