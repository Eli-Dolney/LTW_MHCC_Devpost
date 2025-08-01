import * as hz from 'horizon/core';

// This component teleports players to different spawn points based on the trigger zone they enter
class TeleportPlayer extends hz.Component<typeof TeleportPlayer> {
  // Define the properties of this component, which includes the TpSpawn and TpEnd spawn point entities
  static propsDefinition = {
    tpSpawn: {type: hz.PropTypes.Entity},
    tpEnd: {type: hz.PropTypes.Entity}
  };

  // Pre-start method called before the component starts
  preStart(): void {
    // Connect to the OnPlayerEnterTrigger event for the TpSpawn trigger zone
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
      if (this.entity.name.get() === 'TpSpawn') {
        this.teleportPlayer(player, this.props.tpSpawn!);
      } else if (this.entity.name.get() === 'TpEnd') {
        this.teleportPlayer(player, this.props.tpEnd!);
      }
    });
  }

  // Start method called when the component starts
  start(): void {

  }

  // Method to teleport a player to a spawn point
  teleportPlayer(player: hz.Player, spawnPoint: hz.Entity): void {
    // Check if the spawn point entity is valid
    if (spawnPoint) {
      // Teleport the player to the spawn point
      spawnPoint.as(hz.SpawnPointGizmo).teleportPlayer(player);
    }
  }
}

// Register the component
hz.Component.register(TeleportPlayer);