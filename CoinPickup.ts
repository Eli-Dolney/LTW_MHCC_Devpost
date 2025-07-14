import * as hz from "horizon/core";

class CoinPickup extends hz.Component<typeof CoinPickup> {
  private pickedUp = false;
  private respawnTimer: number | null = null;
  private readonly respawnDelay = 10000; // 10 seconds

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterTrigger, async (player: hz.Player) => {
      if (this.pickedUp) return;
      this.pickedUp = true;

      // Grant the orb to the player using the correct SKU
      // Note: This item should be configured as "consumable" in the Meta Horizon Worlds platform
      // to allow players to use it from their inventory for XP gain
      hz.WorldInventory.grantItemToPlayer(player, "orb2_c95bbf14", 1);

      // Debug: Get the player's current orb count after granting
      const qty = await hz.WorldInventory.getPlayerEntitlementQuantity(player, "orb2_c95bbf14");
      // To debug, set a breakpoint here or use your platform's logging method to check:
      // Player now has qty orbs.
      // Example: log to UI, popup, or use a custom debug function if available.

      // Hide the orb mesh (assumes mesh is a child entity)
      const children = this.entity.children.get();
      for (const child of children) {
        child.visible.set(false);
      }

      // Hide the trigger itself
      this.entity.visible.set(false);

      // Set up respawn timer
      this.respawnTimer = this.async.setTimeout(() => {
        this.respawn();
      }, this.respawnDelay);
    });
  }

  private respawn() {
    this.pickedUp = false;

    // Show the orb mesh again
    const children = this.entity.children.get();
    for (const child of children) {
      child.visible.set(true);
    }

    // Show the trigger again
    this.entity.visible.set(true);

    this.respawnTimer = null;
  }

  dispose() {
    if (this.respawnTimer !== null) {
      this.async.clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
    }
  }
}

hz.Component.register(CoinPickup);