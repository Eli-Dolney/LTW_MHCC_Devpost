import * as hz from 'horizon/core';

/**
 * Jetpack control data that gets synchronized across the network
 */
type JetpackControlData = {
  playerId: number;
  isEquipped: boolean;
  fuelLevel: number;
  isFlying: boolean;
  isRecharging: boolean;
  flightAngle: number;
  flightSpeed: number;
  maxFuel: number;
  rechargeDelay: number;
};

/**
 * Manages jetpack control inputs, properties, and network synchronization
 * Integrates with the existing PlayerControllerManager system
 */
export class JetpackControllerManager extends hz.Component<typeof JetpackControllerManager> {
  static propsDefinition = {
    // Jetpack flight properties
    flightAngle: { type: hz.PropTypes.Number, default: 35.0 }, // degrees
    flightSpeed: { type: hz.PropTypes.Number, default: 15.0 },
    maxFuel: { type: hz.PropTypes.Number, default: 5.0 }, // seconds
    rechargeDelay: { type: hz.PropTypes.Number, default: 15.0 }, // seconds
    
    // Double-tap settings
    doubleTapWindow: { type: hz.PropTypes.Number, default: 0.3 }, // seconds
    
    // Visual/audio effects
    jetpackVFX: { type: hz.PropTypes.Entity },
    jetpackSFX: { type: hz.PropTypes.Entity },
    fuelRechargeVFX: { type: hz.PropTypes.Entity },
    fuelRechargeSFX: { type: hz.PropTypes.Entity },
  };

  // Network events for jetpack synchronization
  private static readonly JetpackEvents = {
    // Request jetpack control data from a player
    RequestJetpackData: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('JetpackEvents.RequestJetpackData'),
    
    // Send jetpack control data to a player
    SendJetpackData: new hz.NetworkEvent<{ player: hz.Player, id: string | null, data: JetpackControlData }>('JetpackEvents.SendJetpackData'),
    
    // Broadcast jetpack control data to all players
    BroadcastJetpackData: new hz.NetworkEvent<{ id: string | null, data: JetpackControlData }>('JetpackEvents.BroadcastJetpackData'),
    
    // Jetpack state changes
    JetpackEquipped: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('JetpackEvents.JetpackEquipped'),
    JetpackUnequipped: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('JetpackEvents.JetpackUnequipped'),
    JetpackActivated: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('JetpackEvents.JetpackActivated'),
    JetpackDeactivated: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('JetpackEvents.JetpackDeactivated'),
  };

  // Control pool for managing jetpack inputs per player
  private jetpackCtrlPool: Map<number, hz.PlayerInput> = new Map();
  
  // Event subscriptions
  private playerEnterWorldSub?: hz.EventSubscription;
  private playerExitWorldSub?: hz.EventSubscription;
  private getJetpackDataSub?: hz.EventSubscription;

  /**
   * Initialize the component
   */
  preStart() {
    // Register for player enter/exit world events
    this.playerEnterWorldSub = this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerEnterWorld,
      this.onPlayerEnterWorld.bind(this)
    );

    this.playerExitWorldSub = this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerExitWorld,
      this.onPlayerExitWorld.bind(this)
    );

    // Register for jetpack data requests
    this.getJetpackDataSub = this.connectNetworkBroadcastEvent(
      JetpackControllerManager.JetpackEvents.RequestJetpackData,
      this.onGetJetpackData.bind(this)
    );
  }

  /**
   * Start the component
   */
  start() {
    // Component is ready to handle jetpack controls
    console.log('JetpackControllerManager started');
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.playerEnterWorldSub?.disconnect();
    this.playerExitWorldSub?.disconnect();
    this.getJetpackDataSub?.disconnect();
    
    // Clean up control pool
    this.jetpackCtrlPool.clear();
  }

  /**
   * Handle player entering the world
   */
  private onPlayerEnterWorld(player: hz.Player) {
    console.log(`Player ${player.name.get()} entered world - setting up jetpack controls`);
    
    // Register jetpack controls for this player
    this.registerJetpackControls(player);
  }

  /**
   * Handle player exiting the world
   */
  private onPlayerExitWorld(player: hz.Player) {
    console.log(`Player ${player.name.get()} exited world - cleaning up jetpack controls`);
    
    // Remove jetpack controls for this player
    this.unregisterJetpackControls(player);
  }

  /**
   * Register jetpack controls for a player
   */
  private registerJetpackControls(player: hz.Player) {
    const playerId = player.id;
    
    // Create jetpack input control (double-tap spacebar)
    const jetpackInput = hz.PlayerControls.connectLocalInput(
      hz.PlayerInputAction.Jump,
      hz.ButtonIcon.Jump,
      this
    );

    // Store in control pool
    this.jetpackCtrlPool.set(playerId, jetpackInput);
    
    console.log(`Registered jetpack controls for player ${player.name.get()}`);
  }

  /**
   * Unregister jetpack controls for a player
   */
  private unregisterJetpackControls(player: hz.Player) {
    const playerId = player.id;
    const jetpackInput = this.jetpackCtrlPool.get(playerId);
    
    if (jetpackInput) {
      jetpackInput.disconnect();
      this.jetpackCtrlPool.delete(playerId);
      console.log(`Unregistered jetpack controls for player ${player.name.get()}`);
    }
  }

  /**
   * Handle jetpack data requests
   */
  private onGetJetpackData({ player, id }: { player: hz.Player, id: string | null }) {
    // Create default jetpack control data
    const jetpackData: JetpackControlData = {
      playerId: player.id,
      isEquipped: false,
      fuelLevel: 1.0,
      isFlying: false,
      isRecharging: false,
      flightAngle: this.props.flightAngle,
      flightSpeed: this.props.flightSpeed,
      maxFuel: this.props.maxFuel,
      rechargeDelay: this.props.rechargeDelay,
    };

    // Broadcast the jetpack data
    this.sendNetworkBroadcastEvent(
      JetpackControllerManager.JetpackEvents.SendJetpackData,
      { player, id, data: jetpackData }
    );
  }

  /**
   * Get jetpack properties for a player
   */
  public getJetpackProperties(player: hz.Player) {
    return {
      flightAngle: this.props.flightAngle,
      flightSpeed: this.props.flightSpeed,
      maxFuel: this.props.maxFuel,
      rechargeDelay: this.props.rechargeDelay,
      doubleTapWindow: this.props.doubleTapWindow,
    };
  }

  /**
   * Check if a player has jetpack controls registered
   */
  public hasJetpackControls(player: hz.Player): boolean {
    return this.jetpackCtrlPool.has(player.id);
  }

  /**
   * Get all registered jetpack controls
   */
  public getJetpackControls(): Map<number, hz.PlayerInput> {
    return new Map(this.jetpackCtrlPool);
  }

  /**
   * Force update jetpack controls for all players
   */
  public updateJetpackControls() {
    // This could be used to refresh controls or update properties
    console.log('Updating jetpack controls for all players');
  }
}

// Register the component
hz.Component.register(JetpackControllerManager); 