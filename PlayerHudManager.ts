import * as hz from 'horizon/core';
import { SimpleLootItemEvents } from './SimpleLootItem';

class PlayerHudManager extends hz.Component<typeof PlayerHudManager> {
  static propsDefinition = {
    playerHud1: {type: hz.PropTypes.Entity},
    playerHud2: {type: hz.PropTypes.Entity},
    playerHud3: {type: hz.PropTypes.Entity},
    playerHud4: {type: hz.PropTypes.Entity},
  };

  private playerHuds: hz.Entity[] = [];
  private playerGems: Map<number, number> = new Map(); // Player index -> gem count

  preStart(): void {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player: hz.Player) => {
      this.onPlayerEnterWorld(player);
    });

    // Listen for loot pickup events
    this.connectNetworkBroadcastEvent(SimpleLootItemEvents.OnPickupLoot, (data: {player: hz.Player, sku: string, count: number}) => {
      this.onLootPickup(data.player, data.sku, data.count);
    });
  }

  start() {
    if (this.props.playerHud1 !== undefined) {
      this.playerHuds.push(this.props.playerHud1);
    }
    if (this.props.playerHud2 !== undefined) {
      this.playerHuds.push(this.props.playerHud2);
    }
    if (this.props.playerHud3 !== undefined) {
      this.playerHuds.push(this.props.playerHud3);
    }
    if (this.props.playerHud4 !== undefined) {
      this.playerHuds.push(this.props.playerHud4);
    }
  }

  onPlayerEnterWorld(player: hz.Player) {
    if (player.name.get() === "Trader") {
      return;
    }
    // Get a player hud
    if (player.index.get() > this.playerHuds.length - 1) {
      console.warn("No player hud for player: " + player.index.get());
      return;
    }
    console.log("Setting player hud for player: " + player.index.get());
    const playerHud = this.playerHuds[player.index.get()];
    playerHud.owner.set(player);

    // Initialize gem count for new player
    this.playerGems.set(player.index.get(), 0);
    console.log(`💎 Player ${player.index.get()} gem count initialized: 0`);

    // Assign the player hud to the player
  }

  // Method to add gems for a player
  addGems(gemValue: number) {
    // For now, add gems to the first player (you can expand this later)
    const playerIndex = 0;
    const currentGems = this.playerGems.get(playerIndex) || 0;
    const newTotal = currentGems + gemValue;
    this.playerGems.set(playerIndex, newTotal);
    
    console.log(`💎 Added ${gemValue} gems! Total: ${newTotal}`);
    
    // Update the HUD display
    this.updateGemDisplay(playerIndex, newTotal);
  }

  // Method to update the gem display in the HUD
  updateGemDisplay(playerIndex: number, gemCount: number) {
    if (playerIndex < this.playerHuds.length) {
      const playerHud = this.playerHuds[playerIndex];
      const hudComponents = playerHud.getComponents();
      
      // Find the PlayerHud component and update it
      for (const component of hudComponents) {
        // Use type assertion to access the method
        const hudComponent = component as any;
        if (hudComponent.updateGemCount) {
          hudComponent.updateGemCount(gemCount);
          break;
        }
      }
    }
  }

  // Method to get gem count for a player
  getGemCount(playerIndex: number): number {
    return this.playerGems.get(playerIndex) || 0;
  }

  // Handle loot pickup events from SimpleLootItem
  onLootPickup(player: hz.Player, sku: string, count: number) {
    // Check if this is a gem pickup (you can customize the SKU name)
    if (sku.toLowerCase().includes('gem') || sku.toLowerCase().includes('credit')) {
      const playerIndex = player.index.get();
      const currentGems = this.playerGems.get(playerIndex) || 0;
      const newTotal = currentGems + count;
      this.playerGems.set(playerIndex, newTotal);
      
      console.log(`💎 Player ${playerIndex} collected ${count} gems! Total: ${newTotal}`);
      
      // Update the HUD display
      this.updateGemDisplay(playerIndex, newTotal);
    }
  }
}
hz.Component.register(PlayerHudManager);
