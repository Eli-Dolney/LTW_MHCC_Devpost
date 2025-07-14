import * as hz from 'horizon/core';

export const ResourceEvents = {
  resourceCollected: new hz.NetworkEvent<{resourceId: string, player: hz.Player, resourceType: string, quantity: number}>('resourceCollected'),
  resourceRespawned: new hz.NetworkEvent<{resourceId: string, resourceType: string, position: hz.Vec3}>('resourceRespawned'),
  resourceSpawned: new hz.NetworkEvent<{resourceId: string, resourceType: string, position: hz.Vec3}>('resourceSpawned'),
};

export interface ResourceStats {
  resourceType: string;
  quantity: number;
  rarity: string;
  respawnTime: number;
  maxQuantity: number;
}

export class ResourceComponent extends hz.Component<typeof ResourceComponent> {
  static propsDefinition = {
    resourceType: { type: hz.PropTypes.String, default: "resource" },
    quantity: { type: hz.PropTypes.Number, default: 1 },
    rarity: { type: hz.PropTypes.String, default: "common" },
    respawnTime: { type: hz.PropTypes.Number, default: 30000 }, // 30 seconds
    pveZoneManager: { type: hz.PropTypes.Entity },
    debugMode: { type: hz.PropTypes.Boolean, default: false },
    
    // Collection settings
    collectionRange: { type: hz.PropTypes.Number, default: 2.0 },
    collectionTime: { type: hz.PropTypes.Number, default: 1000 }, // 1 second
    
    // Visual/audio effects
    collectVFX: { type: hz.PropTypes.Entity },
    respawnVFX: { type: hz.PropTypes.Entity },
    collectSFX: { type: hz.PropTypes.Entity },
    respawnSFX: { type: hz.PropTypes.Entity },
    idleVFX: { type: hz.PropTypes.Entity },
    idleSFX: { type: hz.PropTypes.Entity },
  };

  private currentQuantity: number = 1;
  private maxQuantity: number = 1;
  private isCollected: boolean = false;
  private isRespawning: boolean = false;
  private respawnTimer?: number;
  private collectionTimer?: number;
  private collectVFX?: hz.ParticleGizmo;
  private respawnVFX?: hz.ParticleGizmo;
  private collectSFX?: hz.AudioGizmo;
  private respawnSFX?: hz.AudioGizmo;
  private idleVFX?: hz.ParticleGizmo;
  private idleSFX?: hz.AudioGizmo;
  private resourceId: string = "";
  private collectingPlayer?: hz.Player;

  preStart() {
    super.preStart();
    this.currentQuantity = this.props.quantity;
    this.maxQuantity = this.props.quantity;
    this.resourceId = `resource_${this.entity.id}_${Date.now()}`;
    
    this.collectVFX = this.props.collectVFX?.as(hz.ParticleGizmo);
    this.respawnVFX = this.props.respawnVFX?.as(hz.ParticleGizmo);
    this.collectSFX = this.props.collectSFX?.as(hz.AudioGizmo);
    this.respawnSFX = this.props.respawnSFX?.as(hz.AudioGizmo);
    this.idleVFX = this.props.idleVFX?.as(hz.ParticleGizmo);
    this.idleSFX = this.props.idleSFX?.as(hz.AudioGizmo);
    
    if (this.props.debugMode) {
      console.log(`[ResourceComponent] Initialized ${this.props.resourceType} with ${this.currentQuantity} quantity`);
    }
  }

  start() {
    // Set up entity properties
    this.entity.tags.add("resource");
    this.entity.tags.add(this.props.resourceType);
    this.entity.tags.add(this.props.rarity);
    this.entity.interactionMode.set(hz.EntityInteractionMode.Grabbable);
    
    // Start idle effects
    this.startIdleEffects();
    
    // Send spawn event
    this.sendNetworkEvent(this.entity, ResourceEvents.resourceSpawned, {
      resourceId: this.resourceId,
      resourceType: this.props.resourceType,
      position: this.entity.position.get()
    });

    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${this.props.resourceType} started at position:`, this.entity.position.get());
    }
  }

  dispose() {
    if (this.respawnTimer) {
      this.async.clearTimeout(this.respawnTimer);
    }
    if (this.collectionTimer) {
      this.async.clearTimeout(this.collectionTimer);
    }
    this.stopIdleEffects();
    super.dispose();
  }

  private startIdleEffects() {
    if (this.idleVFX) {
      this.idleVFX.play();
    }
    if (this.idleSFX) {
      this.idleSFX.play();
    }
  }

  private stopIdleEffects() {
    if (this.idleVFX) {
      this.idleVFX.stop();
    }
    if (this.idleSFX) {
      this.idleSFX.stop();
    }
  }

  public canBeCollected(player: hz.Player): boolean {
    if (this.isCollected || this.isRespawning) {
      return false;
    }

    const playerPosition = player.position.get();
    const resourcePosition = this.entity.position.get();
    const distance = playerPosition.sub(resourcePosition).magnitude();

    return distance <= this.props.collectionRange;
  }

  public startCollection(player: hz.Player): boolean {
    if (!this.canBeCollected(player)) {
      return false;
    }

    this.collectingPlayer = player;
    this.isRespawning = true;

    // Start collection timer
    this.collectionTimer = this.async.setTimeout(() => {
      this.completeCollection(player);
    }, this.props.collectionTime);

    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${player.name.get()} started collecting ${this.props.resourceType}`);
    }

    return true;
  }

  public cancelCollection() {
    if (this.collectionTimer) {
      this.async.clearTimeout(this.collectionTimer);
      this.collectionTimer = undefined;
    }
    
    this.collectingPlayer = undefined;
    this.isRespawning = false;

    if (this.props.debugMode) {
      console.log(`[ResourceComponent] Collection of ${this.props.resourceType} cancelled`);
    }
  }

  private completeCollection(player: hz.Player) {
    if (this.isCollected) return;

    this.isCollected = true;
    this.isRespawning = false;
    this.collectingPlayer = undefined;

    // Play collection effects
    this.playCollectionEffects();

    // Hide the resource
    this.entity.visible.set(false);

    // Send collection event
    this.sendNetworkEvent(this.entity, ResourceEvents.resourceCollected, {
      resourceId: this.resourceId,
      player: player,
      resourceType: this.props.resourceType,
      quantity: this.currentQuantity
    });

    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${this.props.resourceType} collected by ${player.name.get()}`);
    }

    // Schedule respawn
    this.scheduleRespawn();
  }

  private scheduleRespawn() {
    this.respawnTimer = this.async.setTimeout(() => {
      this.respawn();
    }, this.props.respawnTime);

    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${this.props.resourceType} will respawn in ${this.props.respawnTime}ms`);
    }
  }

  private respawn() {
    this.isCollected = false;
    this.isRespawning = false;
    this.currentQuantity = this.maxQuantity;

    // Show the resource
    this.entity.visible.set(true);

    // Play respawn effects
    this.playRespawnEffects();

    // Restart idle effects
    this.startIdleEffects();

    // Send respawn event
    this.sendNetworkEvent(this.entity, ResourceEvents.resourceRespawned, {
      resourceId: this.resourceId,
      resourceType: this.props.resourceType,
      position: this.entity.position.get()
    });

    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${this.props.resourceType} respawned`);
    }
  }

  private playCollectionEffects() {
    this.stopIdleEffects();
    
    if (this.collectVFX) {
      this.collectVFX.play();
    }
    if (this.collectSFX) {
      this.collectSFX.play();
    }
  }

  private playRespawnEffects() {
    if (this.respawnVFX) {
      this.respawnVFX.play();
    }
    if (this.respawnSFX) {
      this.respawnSFX.play();
    }
  }

  public forceRespawn() {
    if (this.respawnTimer) {
      this.async.clearTimeout(this.respawnTimer);
    }
    this.respawn();
  }

  public setQuantity(quantity: number) {
    this.currentQuantity = Math.max(0, quantity);
    this.maxQuantity = Math.max(this.maxQuantity, quantity);
    
    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${this.props.resourceType} quantity set to ${this.currentQuantity}`);
    }
  }

  public addQuantity(amount: number) {
    this.setQuantity(this.currentQuantity + amount);
  }

  public removeQuantity(amount: number): boolean {
    if (this.currentQuantity < amount) {
      return false;
    }
    
    this.setQuantity(this.currentQuantity - amount);
    return true;
  }

  // Public methods for external access
  public getResourceId(): string {
    return this.resourceId;
  }

  public getResourceType(): string {
    return this.props.resourceType;
  }

  public getRarity(): string {
    return this.props.rarity;
  }

  public getCurrentQuantity(): number {
    return this.currentQuantity;
  }

  public getMaxQuantity(): number {
    return this.maxQuantity;
  }

  public isAvailable(): boolean {
    return !this.isCollected && !this.isRespawning;
  }

  public isBeingCollected(): boolean {
    return this.isRespawning && this.collectingPlayer !== undefined;
  }

  public getCollectingPlayer(): hz.Player | undefined {
    return this.collectingPlayer;
  }

  public getRespawnTimeRemaining(): number {
    // This would need to be tracked more precisely in a real implementation
    return this.isCollected ? this.props.respawnTime : 0;
  }

  public setStats(stats: Partial<ResourceStats>) {
    if (stats.quantity !== undefined) {
      this.setQuantity(stats.quantity);
    }
    if (stats.maxQuantity !== undefined) {
      this.maxQuantity = stats.maxQuantity;
      this.currentQuantity = Math.min(this.currentQuantity, this.maxQuantity);
    }
    if (stats.respawnTime !== undefined) {
      // Note: respawnTime is a prop, so this would need to be handled differently in a real implementation
    }
    
    if (this.props.debugMode) {
      console.log(`[ResourceComponent] ${this.props.resourceType} stats updated`);
    }
  }

  public getCollectionProgress(): number {
    if (!this.isRespawning || !this.collectingPlayer) {
      return 0;
    }

    // This would need to be tracked more precisely in a real implementation
    // For now, return a simple progress based on time
    return 0.5; // Placeholder
  }
}

hz.Component.register(ResourceComponent); 