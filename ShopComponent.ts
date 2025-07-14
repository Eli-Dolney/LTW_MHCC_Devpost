import * as hz from 'horizon/core';

export const ShopEvents = {
  shopOpened: new hz.NetworkEvent<{player: hz.Player, shopId: string}>('shopOpened'),
  shopClosed: new hz.NetworkEvent<{player: hz.Player, shopId: string}>('shopClosed'),
  itemPurchased: new hz.NetworkEvent<{player: hz.Player, itemSKU: string, quantity: number, cost: number}>('itemPurchased'),
  itemSold: new hz.NetworkEvent<{player: hz.Player, itemSKU: string, quantity: number, price: number}>('itemSold'),
  transactionFailed: new hz.NetworkEvent<{player: hz.Player, reason: string, itemSKU?: string}>('transactionFailed'),
};

export interface ShopItem {
  sku: string;
  name: string;
  description: string;
  buyPrice: number;
  sellPrice: number;
  maxQuantity: number;
  category: string;
  rarity: string;
  isAvailable: boolean;
}

export interface ShopInventory {
  items: Map<string, ShopItem>;
  currencySKU: string;
  maxInventorySize: number;
}

export class ShopComponent extends hz.Component<typeof ShopComponent> {
  static propsDefinition = {
    shopId: { type: hz.PropTypes.String, default: "shop" },
    shopName: { type: hz.PropTypes.String, default: "General Store" },
    currencySKU: { type: hz.PropTypes.String, default: "pve_currency" },
    maxInventorySize: { type: hz.PropTypes.Number, default: 50 },
    debugMode: { type: hz.PropTypes.Boolean, default: false },
    
    // Shop interaction
    interactionRange: { type: hz.PropTypes.Number, default: 3.0 },
    autoOpenOnApproach: { type: hz.PropTypes.Boolean, default: false },
    
    // Visual/audio effects
    openVFX: { type: hz.PropTypes.Entity },
    closeVFX: { type: hz.PropTypes.Entity },
    purchaseVFX: { type: hz.PropTypes.Entity },
    sellVFX: { type: hz.PropTypes.Entity },
    openSFX: { type: hz.PropTypes.Entity },
    closeSFX: { type: hz.PropTypes.Entity },
    purchaseSFX: { type: hz.PropTypes.Entity },
    sellSFX: { type: hz.PropTypes.Entity },
  };

  private inventory: Map<string, ShopItem> = new Map();
  private playersInShop: Set<hz.Player> = new Set();
  private openVFX?: hz.ParticleGizmo;
  private closeVFX?: hz.ParticleGizmo;
  private purchaseVFX?: hz.ParticleGizmo;
  private sellVFX?: hz.ParticleGizmo;
  private openSFX?: hz.AudioGizmo;
  private closeSFX?: hz.AudioGizmo;
  private purchaseSFX?: hz.AudioGizmo;
  private sellSFX?: hz.AudioGizmo;

  preStart() {
    super.preStart();
    
    this.openVFX = this.props.openVFX?.as(hz.ParticleGizmo);
    this.closeVFX = this.props.closeVFX?.as(hz.ParticleGizmo);
    this.purchaseVFX = this.props.purchaseVFX?.as(hz.ParticleGizmo);
    this.sellVFX = this.props.sellVFX?.as(hz.ParticleGizmo);
    this.openSFX = this.props.openSFX?.as(hz.AudioGizmo);
    this.closeSFX = this.props.closeSFX?.as(hz.AudioGizmo);
    this.purchaseSFX = this.props.purchaseSFX?.as(hz.AudioGizmo);
    this.sellSFX = this.props.sellSFX?.as(hz.AudioGizmo);
    
    // Initialize default shop inventory
    this.initializeInventory();
    
    if (this.props.debugMode) {
      console.log(`[ShopComponent] Initialized ${this.props.shopName} with ${this.inventory.size} items`);
    }
  }

  start() {
    // Set up entity properties
    this.entity.tags.add("shop");
    this.entity.tags.add(this.props.shopId);
    this.entity.interactionMode.set(hz.EntityInteractionMode.Grabbable);
    
    if (this.props.debugMode) {
      console.log(`[ShopComponent] ${this.props.shopName} started`);
    }
  }

  dispose() {
    super.dispose();
  }

  private initializeInventory() {
    // Add default shop items
    const defaultItems: ShopItem[] = [
      {
        sku: "health_potion",
        name: "Health Potion",
        description: "Restores 50 health points",
        buyPrice: 25,
        sellPrice: 10,
        maxQuantity: 10,
        category: "consumables",
        rarity: "common",
        isAvailable: true
      },
      {
        sku: "mana_potion",
        name: "Mana Potion",
        description: "Restores 50 mana points",
        buyPrice: 30,
        sellPrice: 12,
        maxQuantity: 10,
        category: "consumables",
        rarity: "common",
        isAvailable: true
      },
      {
        sku: "steel_sword",
        name: "Steel Sword",
        description: "A reliable steel sword",
        buyPrice: 150,
        sellPrice: 75,
        maxQuantity: 1,
        category: "weapons",
        rarity: "uncommon",
        isAvailable: true
      },
      {
        sku: "magical_staff",
        name: "Magical Staff",
        description: "A staff imbued with magical power",
        buyPrice: 300,
        sellPrice: 150,
        maxQuantity: 1,
        category: "weapons",
        rarity: "rare",
        isAvailable: true
      },
      {
        sku: "iron_ore",
        name: "Iron Ore",
        description: "Raw iron ore for crafting",
        buyPrice: 15,
        sellPrice: 8,
        maxQuantity: 20,
        category: "materials",
        rarity: "common",
        isAvailable: true
      },
      {
        sku: "gold_ore",
        name: "Gold Ore",
        description: "Raw gold ore for crafting",
        buyPrice: 50,
        sellPrice: 25,
        maxQuantity: 10,
        category: "materials",
        rarity: "uncommon",
        isAvailable: true
      },
      {
        sku: "crystal_shard",
        name: "Crystal Shard",
        description: "A magical crystal shard",
        buyPrice: 100,
        sellPrice: 50,
        maxQuantity: 5,
        category: "materials",
        rarity: "rare",
        isAvailable: true
      }
    ];

    for (const item of defaultItems) {
      this.inventory.set(item.sku, item);
    }
  }

  public canPlayerAccess(player: hz.Player): boolean {
    const playerPosition = player.position.get();
    const shopPosition = this.entity.position.get();
    const distance = playerPosition.sub(shopPosition).magnitude();

    return distance <= this.props.interactionRange;
  }

  public openShop(player: hz.Player): boolean {
    if (!this.canPlayerAccess(player)) {
      return false;
    }

    this.playersInShop.add(player);
    
    // Play open effects
    this.playOpenEffects();
    
    // Send open event
    this.sendNetworkEvent(this.entity, ShopEvents.shopOpened, {
      player: player,
      shopId: this.props.shopId
    });

    if (this.props.debugMode) {
      console.log(`[ShopComponent] ${player.name.get()} opened ${this.props.shopName}`);
    }

    return true;
  }

  public closeShop(player: hz.Player): boolean {
    if (!this.playersInShop.has(player)) {
      return false;
    }

    this.playersInShop.delete(player);
    
    // Play close effects
    this.playCloseEffects();
    
    // Send close event
    this.sendNetworkEvent(this.entity, ShopEvents.shopClosed, {
      player: player,
      shopId: this.props.shopId
    });

    if (this.props.debugMode) {
      console.log(`[ShopComponent] ${player.name.get()} closed ${this.props.shopName}`);
    }

    return true;
  }

  public async purchaseItem(player: hz.Player, itemSKU: string, quantity: number = 1): Promise<boolean> {
    if (!this.playersInShop.has(player)) {
      this.sendTransactionFailed(player, "Player not in shop", itemSKU);
      return false;
    }

    const item = this.inventory.get(itemSKU);
    if (!item || !item.isAvailable) {
      this.sendTransactionFailed(player, "Item not available", itemSKU);
      return false;
    }

    if (quantity > item.maxQuantity) {
      this.sendTransactionFailed(player, "Quantity exceeds maximum", itemSKU);
      return false;
    }

    const totalCost = item.buyPrice * quantity;
    
    // Check if player has enough currency
    try {
      const playerCurrency = await hz.WorldInventory.getPlayerEntitlementQuantity(player, this.props.currencySKU);
      if (playerCurrency < totalCost) {
        this.sendTransactionFailed(player, "Insufficient currency", itemSKU);
        return false;
      }

      // Deduct currency and grant item
      hz.WorldInventory.consumeItemForPlayer(player, this.props.currencySKU, totalCost);
      hz.WorldInventory.grantItemToPlayer(player, itemSKU, quantity);

      // Play purchase effects
      this.playPurchaseEffects();

      // Send purchase event
      this.sendNetworkEvent(this.entity, ShopEvents.itemPurchased, {
        player: player,
        itemSKU: itemSKU,
        quantity: quantity,
        cost: totalCost
      });

      if (this.props.debugMode) {
        console.log(`[ShopComponent] ${player.name.get()} purchased ${quantity}x ${item.name} for ${totalCost} currency`);
      }

      return true;
    } catch (error) {
      if (this.props.debugMode) {
        console.error(`[ShopComponent] Purchase failed:`, error);
      }
      this.sendTransactionFailed(player, "Transaction failed", itemSKU);
      return false;
    }
  }

  public async sellItem(player: hz.Player, itemSKU: string, quantity: number = 1): Promise<boolean> {
    if (!this.playersInShop.has(player)) {
      this.sendTransactionFailed(player, "Player not in shop", itemSKU);
      return false;
    }

    const item = this.inventory.get(itemSKU);
    if (!item) {
      this.sendTransactionFailed(player, "Item not available for sale", itemSKU);
      return false;
    }

    // Check if player has the item
    try {
      const playerItemQuantity = await hz.WorldInventory.getPlayerEntitlementQuantity(player, itemSKU);
      if (playerItemQuantity < quantity) {
        this.sendTransactionFailed(player, "Insufficient items", itemSKU);
        return false;
      }

      const totalPrice = item.sellPrice * quantity;

      // Consume item and grant currency
      hz.WorldInventory.consumeItemForPlayer(player, itemSKU, quantity);
      hz.WorldInventory.grantItemToPlayer(player, this.props.currencySKU, totalPrice);

      // Play sell effects
      this.playSellEffects();

      // Send sell event
      this.sendNetworkEvent(this.entity, ShopEvents.itemSold, {
        player: player,
        itemSKU: itemSKU,
        quantity: quantity,
        price: totalPrice
      });

      if (this.props.debugMode) {
        console.log(`[ShopComponent] ${player.name.get()} sold ${quantity}x ${item.name} for ${totalPrice} currency`);
      }

      return true;
    } catch (error) {
      if (this.props.debugMode) {
        console.error(`[ShopComponent] Sale failed:`, error);
      }
      this.sendTransactionFailed(player, "Transaction failed", itemSKU);
      return false;
    }
  }

  private sendTransactionFailed(player: hz.Player, reason: string, itemSKU?: string) {
    this.sendNetworkEvent(this.entity, ShopEvents.transactionFailed, {
      player: player,
      reason: reason,
      itemSKU: itemSKU
    });

    if (this.props.debugMode) {
      console.log(`[ShopComponent] Transaction failed for ${player.name.get()}: ${reason}`);
    }
  }

  private playOpenEffects() {
    if (this.openVFX) {
      this.openVFX.play();
    }
    if (this.openSFX) {
      this.openSFX.play();
    }
  }

  private playCloseEffects() {
    if (this.closeVFX) {
      this.closeVFX.play();
    }
    if (this.closeSFX) {
      this.closeSFX.play();
    }
  }

  private playPurchaseEffects() {
    if (this.purchaseVFX) {
      this.purchaseVFX.play();
    }
    if (this.purchaseSFX) {
      this.purchaseSFX.play();
    }
  }

  private playSellEffects() {
    if (this.sellVFX) {
      this.sellVFX.play();
    }
    if (this.sellSFX) {
      this.sellSFX.play();
    }
  }

  // Public methods for external access
  public getShopId(): string {
    return this.props.shopId;
  }

  public getShopName(): string {
    return this.props.shopName;
  }

  public getInventory(): ShopItem[] {
    return Array.from(this.inventory.values());
  }

  public getItem(itemSKU: string): ShopItem | undefined {
    return this.inventory.get(itemSKU);
  }

  public getItemsByCategory(category: string): ShopItem[] {
    return Array.from(this.inventory.values()).filter(item => item.category === category);
  }

  public getItemsByRarity(rarity: string): ShopItem[] {
    return Array.from(this.inventory.values()).filter(item => item.rarity === rarity);
  }

  public getPlayersInShop(): hz.Player[] {
    return Array.from(this.playersInShop);
  }

  public addItem(item: ShopItem): boolean {
    if (this.inventory.size >= this.props.maxInventorySize) {
      return false;
    }

    this.inventory.set(item.sku, item);
    
    if (this.props.debugMode) {
      console.log(`[ShopComponent] Added ${item.name} to inventory`);
    }

    return true;
  }

  public removeItem(itemSKU: string): boolean {
    const removed = this.inventory.delete(itemSKU);
    
    if (removed && this.props.debugMode) {
      console.log(`[ShopComponent] Removed ${itemSKU} from inventory`);
    }

    return removed;
  }

  public updateItem(itemSKU: string, updates: Partial<ShopItem>): boolean {
    const item = this.inventory.get(itemSKU);
    if (!item) {
      return false;
    }

    Object.assign(item, updates);
    
    if (this.props.debugMode) {
      console.log(`[ShopComponent] Updated ${itemSKU} in inventory`);
    }

    return true;
  }

  public setItemAvailability(itemSKU: string, isAvailable: boolean): boolean {
    return this.updateItem(itemSKU, { isAvailable });
  }

  public setItemPrice(itemSKU: string, buyPrice: number, sellPrice: number): boolean {
    return this.updateItem(itemSKU, { buyPrice, sellPrice });
  }

  public getCurrencySKU(): string {
    return this.props.currencySKU;
  }

  public async getPlayerCurrency(player: hz.Player): Promise<number> {
    try {
      return await hz.WorldInventory.getPlayerEntitlementQuantity(player, this.props.currencySKU);
    } catch (error) {
      if (this.props.debugMode) {
        console.error(`[ShopComponent] Failed to get player currency:`, error);
      }
      return 0;
    }
  }

  public async getPlayerItemQuantity(player: hz.Player, itemSKU: string): Promise<number> {
    try {
      return await hz.WorldInventory.getPlayerEntitlementQuantity(player, itemSKU);
    } catch (error) {
      if (this.props.debugMode) {
        console.error(`[ShopComponent] Failed to get player item quantity:`, error);
      }
      return 0;
    }
  }
}

hz.Component.register(ShopComponent); 