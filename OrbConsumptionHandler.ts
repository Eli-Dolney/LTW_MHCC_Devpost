import * as hz from "horizon/core";
import { InventoryEvents } from "./inventory";
import { ProgressionSystem } from "./ProgressionSystem";

export class OrbConsumptionHandler extends hz.Component<typeof OrbConsumptionHandler> {
  static propsDefinition = {
    xpPerOrb: { type: hz.PropTypes.Number, default: 100 },
    progressionSystem: { type: hz.PropTypes.Entity }, // Reference to progression system
  };

  start() {
    // Listen for orb usage events from the inventory system
    this.connectNetworkBroadcastEvent(InventoryEvents.UseItem, this.onOrbUsed.bind(this));
  }

  private async onOrbUsed({ player, id, item }: { player: hz.Player, id: string | null, item: any }) {
    // Check if this is an orb item
    if (item.sku === "orb2_c95bbf14") {
      console.log(`[OrbConsumptionHandler] Player ${player.name.get()} is using an orb`);
      
      // Get current orb count
      const currentOrbCount = await hz.WorldInventory.getPlayerEntitlementQuantity(player, "orb2_c95bbf14");
      
      if (currentOrbCount > 0) {
        // Consume one orb
        await hz.WorldInventory.grantItemToPlayer(player, "orb2_c95bbf14", -1);
        
        // Grant XP to the player
        this.grantOrbXP(player);
        
        console.log(`[OrbConsumptionHandler] Consumed 1 orb, granted ${this.props.xpPerOrb} XP to ${player.name.get()}`);
        
        // Send acknowledgement back to the inventory UI
        this.sendNetworkBroadcastEvent(InventoryEvents.AcknowledgeUseItem, {
          player: player,
          id: id,
          item: item
        });
      } else {
        console.log(`[OrbConsumptionHandler] Player ${player.name.get()} tried to use an orb but has none`);
        
        // Still send acknowledgement to prevent UI from hanging
        this.sendNetworkBroadcastEvent(InventoryEvents.AcknowledgeUseItem, {
          player: player,
          id: id,
          item: item
        });
      }
    }
  }

  private grantOrbXP(player: hz.Player) {
    // Get the ProgressionSystem from the referenced entity
    if (this.props.progressionSystem) {
      const progressionSystem = this.props.progressionSystem.getComponents(ProgressionSystem)[0];
      if (progressionSystem) {
        progressionSystem.addXP(player, this.props.xpPerOrb, 'orb_consumption');
        console.log(`[OrbConsumptionHandler] Granted ${this.props.xpPerOrb} XP to ${player.name.get()} via ProgressionSystem`);
      } else {
        console.warn("[OrbConsumptionHandler] ProgressionSystem component not found on referenced entity");
      }
    } else {
      console.warn("[OrbConsumptionHandler] No progressionSystem entity referenced");
    }
  }
}

hz.Component.register(OrbConsumptionHandler); 