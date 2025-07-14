import * as hz from 'horizon/core';

/**
 * Jetpack pickup component that allows players to collect jetpacks from the world
 * Features:
 * - Trigger zone for proximity detection
 * - Interaction button for pickup
 * - Grants jetpack to player inventory
 * - Respawn system
 */
export class JetpackPickup extends hz.Component<typeof JetpackPickup> {
  static propsDefinition = {
    // Jetpack configuration
    jetpackSKU: { type: hz.PropTypes.String, default: "jetpack_basic" },
    jetpackQuantity: { type: hz.PropTypes.Number, default: 1 },
    
    // Pickup configuration
    pickupRange: { type: hz.PropTypes.Number, default: 2.0 },
    respawnDelay: { type: hz.PropTypes.Number, default: 30.0 }, // 30 seconds
    
    // Visual/audio effects
    pickupVFX: { type: hz.PropTypes.Entity },
    pickupSFX: { type: hz.PropTypes.Entity },
    idleVFX: { type: hz.PropTypes.Entity },
    idleSFX: { type: hz.PropTypes.Entity },
  };

  // State
  private isAvailable: boolean = true;
  private respawnTimer?: number;
  private playersInRange: Set<hz.Player> = new Set();

  // Event subscriptions
  private triggerEnter?: hz.EventSubscription;
  private triggerExit?: hz.EventSubscription;
  private updateSubscription?: hz.EventSubscription;

  // References
  private triggerZone?: hz.TriggerGizmo;
  private jetpackMesh?: hz.Entity;

  // Add a map to track pickup input per player
  private pickupInputs: Map<number, hz.PlayerInput> = new Map();

  /**
   * Initialize the component
   */
  preStart() {
    // Get trigger zone from children
    const children = this.entity.children.get();
    for (const child of children) {
      try {
        const triggerGizmo = child.as(hz.TriggerGizmo);
        if (triggerGizmo) {
          this.triggerZone = triggerGizmo;
          break;
        }
      } catch {
        // Child doesn't have TriggerGizmo component
      }
    }

    // Get jetpack mesh from children
    for (const child of children) {
      if (child.name.get().toLowerCase().includes('mesh') || 
          child.name.get().toLowerCase().includes('model')) {
        this.jetpackMesh = child;
        break;
      }
    }
  }

  /**
   * Start the component
   */
  start() {
    // Setup trigger events
    if (this.triggerZone) {
      this.triggerEnter = this.connectCodeBlockEvent(
        this.triggerZone,
        hz.CodeBlockEvents.OnPlayerEnterTrigger,
        this.onPlayerEnterTrigger.bind(this)
      );
      
      this.triggerExit = this.connectCodeBlockEvent(
        this.triggerZone,
        hz.CodeBlockEvents.OnPlayerExitTrigger,
        this.onPlayerExitTrigger.bind(this)
      );
    }

    // Setup update loop for interaction button
    this.updateSubscription = this.connectLocalBroadcastEvent(
      hz.World.onUpdate,
      this.onUpdate.bind(this)
    );

    // Start idle effects
    this.startIdleEffects();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.triggerEnter?.disconnect();
    this.triggerExit?.disconnect();
    this.updateSubscription?.disconnect();
    
    if (this.respawnTimer) {
      this.async.clearTimeout(this.respawnTimer);
    }
    
    this.stopIdleEffects();
    // Clean up all pickup inputs
    for (const input of Array.from(this.pickupInputs.values())) {
      input.disconnect();
    }
    this.pickupInputs.clear();
  }

  /**
   * Handle player entering trigger zone
   */
  private onPlayerEnterTrigger(player: hz.Player) {
    if (!this.isAvailable) return;
    
    this.playersInRange.add(player);
    console.log(`Player ${player.name.get()} entered jetpack pickup range`);
  }

  /**
   * Handle player exiting trigger zone
   */
  private onPlayerExitTrigger(player: hz.Player) {
    this.playersInRange.delete(player);
    this.cleanupPickupInput(player);
    console.log(`Player ${player.name.get()} exited jetpack pickup range`);
  }

  /**
   * Update loop for interaction button
   */
  private onUpdate(data: { deltaTime: number }) {
    if (!this.isAvailable || this.playersInRange.size === 0) return;

    // Use Array.from to avoid Set<Player> iteration error
    for (const player of Array.from(this.playersInRange)) {
      if (this.shouldShowInteractionButton(player)) {
        this.showInteractionButton(player);
      } else {
        this.hideInteractionButton(player);
      }
    }
  }

  /**
   * Check if interaction button should be shown for a player
   */
  private shouldShowInteractionButton(player: hz.Player): boolean {
    // Only show for desktop players for now
    if (player.deviceType.get() !== hz.PlayerDeviceType.Desktop) {
      return false;
    }

    // Check if player is close enough
    const distance = this.entity.position.get().distance(
      player.position.get()
    );
    
    return distance <= this.props.pickupRange;
  }

  /**
   * Show interaction button for a player
   */
  private showInteractionButton(player: hz.Player) {
    // Only setup input if not already present
    if (this.pickupInputs.has(player.id)) return;
    if (player.deviceType.get() !== hz.PlayerDeviceType.Desktop) {
      return;
    }
    // Create input for E key (RightSecondary action)
    const pickupInput = hz.PlayerControls.connectLocalInput(
      hz.PlayerInputAction.RightSecondary,
      hz.ButtonIcon.Interact,
      this
    );
    pickupInput.registerCallback((action: hz.PlayerInputAction, pressed: boolean) => {
      if (pressed && this.playersInRange.has(player)) {
        this.pickupJetpack(player);
      }
    });
    this.pickupInputs.set(player.id, pickupInput);
  }

  /**
   * Hide interaction button for a player
   */
  private hideInteractionButton(player: hz.Player) {
    this.cleanupPickupInput(player);
  }

  /**
   * Setup pickup input for a player
   */
  private setupPickupInput(player: hz.Player) {
    // Only setup for desktop players
    if (player.deviceType.get() !== hz.PlayerDeviceType.Desktop) {
      return;
    }

    // Create input for E key (RightSecondary action)
    const pickupInput = hz.PlayerControls.connectLocalInput(
      hz.PlayerInputAction.RightSecondary,
      hz.ButtonIcon.Interact,
      this
    );

    pickupInput.registerCallback((action: hz.PlayerInputAction, pressed: boolean) => {
      if (pressed && this.playersInRange.has(player)) {
        this.pickupJetpack(player);
      }
    });
  }

  /**
   * Cleanup pickup input for a player
   */
  private cleanupPickupInput(player: hz.Player) {
    const input = this.pickupInputs.get(player.id);
    if (input) {
      input.disconnect();
      this.pickupInputs.delete(player.id);
    }
  }

  /**
   * Handle jetpack pickup
   */
  private pickupJetpack(player: hz.Player) {
    if (!this.isAvailable) return;
    // Clean up input for this player immediately after pickup
    this.cleanupPickupInput(player);

    console.log(`Player ${player.name.get()} picked up jetpack`);

    // Grant jetpack to player
    hz.WorldInventory.grantItemToPlayer(
      player, 
      this.props.jetpackSKU, 
      this.props.jetpackQuantity
    );

    // Play pickup effects
    this.playPickupEffects();

    // Hide the pickup
    this.hidePickup();

    // Start respawn timer
    this.startRespawnTimer();
  }

  /**
   * Play pickup visual and audio effects
   */
  private playPickupEffects() {
    // Play pickup VFX
    if (this.props.pickupVFX) {
      const vfx = this.props.pickupVFX.as(hz.ParticleGizmo);
      vfx?.play();
    }

    // Play pickup SFX
    if (this.props.pickupSFX) {
      const sfx = this.props.pickupSFX.as(hz.AudioGizmo);
      sfx?.play();
    }
  }

  /**
   * Hide the pickup
   */
  private hidePickup() {
    this.isAvailable = false;
    // Clean up all pickup inputs when pickup is hidden
    for (const playerId of Array.from(this.pickupInputs.keys())) {
      const input = this.pickupInputs.get(playerId);
      if (input) input.disconnect();
    }
    this.pickupInputs.clear();
    
    // Hide jetpack mesh
    if (this.jetpackMesh) {
      this.jetpackMesh.visible.set(false);
    }
    
    // Hide trigger zone
    if (this.triggerZone) {
      this.triggerZone.visible.set(false);
    }
  }

  /**
   * Start respawn timer
   */
  private startRespawnTimer() {
    if (this.respawnTimer) {
      this.async.clearTimeout(this.respawnTimer);
    }

    this.respawnTimer = this.async.setTimeout(() => {
      this.respawn();
    }, this.props.respawnDelay * 1000);
  }

  /**
   * Respawn the jetpack pickup
   */
  private respawn() {
    this.isAvailable = true;
    
    // Show jetpack mesh
    if (this.jetpackMesh) {
      this.jetpackMesh.visible.set(true);
    }
    
    // Show trigger zone
    if (this.triggerZone) {
      this.triggerZone.visible.set(true);
    }
    
    this.respawnTimer = undefined;
    console.log("Jetpack pickup respawned");
  }

  /**
   * Start idle effects
   */
  private startIdleEffects() {
    // Start idle VFX
    if (this.props.idleVFX) {
      const vfx = this.props.idleVFX.as(hz.ParticleGizmo);
      vfx?.play();
    }

    // Start idle SFX
    if (this.props.idleSFX) {
      const sfx = this.props.idleSFX.as(hz.AudioGizmo);
      sfx?.play();
    }
  }

  /**
   * Stop idle effects
   */
  private stopIdleEffects() {
    // Stop idle VFX
    if (this.props.idleVFX) {
      const vfx = this.props.idleVFX.as(hz.ParticleGizmo);
      vfx?.stop();
    }

    // Stop idle SFX
    if (this.props.idleSFX) {
      const sfx = this.props.idleSFX.as(hz.AudioGizmo);
      sfx?.stop();
    }
  }

  /**
   * Check if pickup is available
   */
  public isPickupAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Get players currently in pickup range
   */
  public getPlayersInRange(): hz.Player[] {
    return Array.from(this.playersInRange);
  }

  /**
   * Force respawn the pickup (for testing)
   */
  public forceRespawn() {
    if (this.respawnTimer) {
      this.async.clearTimeout(this.respawnTimer);
      this.respawnTimer = undefined;
    }
    this.respawn();
  }
}

// Register the component
hz.Component.register(JetpackPickup); 