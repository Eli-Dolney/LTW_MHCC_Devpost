/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 */

// @generated version: QMDDWJ

import * as hz from 'horizon/core';
import { Component } from 'horizon/core';
import { ImageSource } from 'horizon/ui';

/**
 * Metadata for the Daily Rewards UI display
 * @property title - The title to display in the rewards UI
 * @property titleIconId - The ID of the icon to display with the title
 * @property titleIconVersionId - The version ID of the title icon
 */
type DailyRewardsMetadata = {
  title: string,
  titleIconId: bigint,
  titleIconVersionId: bigint,
}

/**
 * Represents a single reward collection event
 * @property date - Timestamp when the reward was collected
 * @property index - The day index of the collected reward in the rewards sequence
 */
type DailyRewardsGiftCollection = {
  date: number;
  index: number;
}

/**
 * Persistent data stored for tracking a player's daily rewards progress
 * @property startDate - Timestamp when the player started the daily rewards sequence
 * @property lastCollection - Information about the player's most recent reward collection, or null if none
 */
type DailyRewardsPersistentData = {
  startDate: number;
  lastCollection: DailyRewardsGiftCollection | null;
};

/**
 * Current state of the daily rewards event for a player
 * @property currentDay - The current day in the rewards sequence (1-indexed)
 * @property expired - Whether the rewards event has expired
 * @property hasCollectedToday - Whether the player has already collected today's reward
 * @property nextCollectionDate - Timestamp when the next reward will be available, or null if not applicable
 */
type DailyRewardsEventState = {
  currentDay: number;
  expired: boolean;
  hasCollectedToday: boolean;
  nextCollectionDate: number | null;
}

/**
 * Basic information about a reward item
 * @property sku - The unique identifier for the reward item
 * @property quantity - The amount of the item to give
 * @property thumbnailId - The ID of the thumbnail image for the reward
 * @property thumbnailVersionId - The version ID of the thumbnail image
 */
type RewardData = {
  sku: string,
  quantity: number,
  thumbnailId: bigint,
  thumbnailVersionId: bigint
}

/**
 * Extended reward data with additional display information
 * @property name - The display name of the reward
 * @property description - A description of the reward
 * @property day - The day in the sequence when this reward is given
 */
type RewardEnrichedData = RewardData & {
  name: string,
  description: string,
  day: number
}

/**
 * Configuration for the Daily Rewards system
 * @property persistentObjectVariableKey - Key used to store player progress in the persistent storage
 * @property activation - Whether the daily rewards system is active
 * @property autoRepeat - Whether the rewards sequence should automatically restart after completion
 * @property resetStreakIfDayIsMissed - Whether missing a day resets the player's streak
 * @property rewards - Array of rewards to be given in sequence
 */
type DailyRewardsConfig = {
  persistentObjectVariableKey: string;
  activation: boolean;
  autoRepeat: boolean;
  resetStreakIfDayIsMissed: boolean;
  rewards: RewardData[];
}

/**
 * Result of a daily rewards operation
 * @property success - Whether the operation was successful
 * @property message - Optional message providing details about the result
 */
type DailyRewardsOperationResult = {
  success: boolean;
  message?: string;
}

type DailyRewardsClaimResult = DailyRewardsOperationResult & {
  reward: RewardEnrichedData | null;
}

/**
 * Network events for the Daily Rewards system
 * These events handle communication between client and server for the daily rewards functionality
 */
const DailyRewardsEvents = {
  // Client requests the list of available rewards
  RequestRewardsList: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('DailyRewardsEvents.RequestRewardsList'),

  // Client requests the current state of the daily rewards event
  RequestEventState: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('DailyRewardsEvents.RequestEventState'),

  // Server sends the rewards list to a specific player
  SendRewardsList: new hz.NetworkEvent<{ player: hz.Player, id: string | null, metadata: DailyRewardsMetadata, rewards: RewardEnrichedData[] }>('DailyRewardsEvents.SendRewardsList'),

  // Server broadcasts the rewards list to all players
  BroadcastRewardsList: new hz.NetworkEvent<{ id: string | null, metadata: DailyRewardsMetadata, rewards: RewardEnrichedData[] }>('DailyRewardsEvents.BroadcastRewardsList'),

  // Server sends the current event state to a player
  SendEventState: new hz.NetworkEvent<{ player: hz.Player, id: string | null, eventState: DailyRewardsEventState | null }>('DailyRewardsEvents.SendEventState'),

  // Client requests to claim the current day's reward
  ClaimReward: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('DailyRewardsEvents.ClaimReward'),

  // Server responds to a claim request with the result and updated state
  ClaimRewardResponse: new hz.NetworkEvent<{ player: hz.Player, id: string | null, eventState: DailyRewardsEventState | null, result: DailyRewardsClaimResult }>('DailyRewardsEvents.ClaimRewardResponse'),

  // Client notifies the server of a player login (to update daily rewards state)
  RecordLogin: new hz.NetworkEvent<{ player: hz.Player, id: string | null }>('DailyRewardsEvents.RecordLogin')
}

/**
 * Manages the daily rewards system for players.
 * This class handles the logic for daily rewards including:
 * - Tracking player login streaks
 * - Managing reward claims
 * - Determining event state (active, expired)
 * - Handling reward distribution
 */
class DailyRewardsLogic {
  private owner: Component | undefined;

  /** Configuration settings for the daily rewards system */
  private readonly config: DailyRewardsConfig;

  /** Reference to the game world */
  private readonly world: hz.World;

  /** Cached data about rewards with additional display information */
  private enrichedRewardsData: RewardEnrichedData[] = [];

  /**
   * Creates a new instance of the daily rewards system.
   * @param world - The game world instance
   * @param config - Configuration settings for the daily rewards
   */
  constructor(owner: Component | undefined, world: hz.World, config: DailyRewardsConfig) {
    this.owner = owner;
    this.config = config;
    this.world = world;

    // Automatically activate the daily rewards if specified in config
    if (this.config.activation) {
      this.isActive = true;
    }
  }

  /**
   * Whether or not the Daily Rewards event is active.
   * @remarks if the DailyRewards.ACTIVATION_KEY prop is true, the event will be activated on initialization.
   */
  public isActive: boolean = false;

  /**
   * Claims the reward of the current day for the player.
   * Validates eligibility, grants the reward, and updates player data.
   *
   * @param player - The player claiming the reward
   * @returns Operation result indicating success or failure with a message
   */
  public async claimReward(player: hz.Player): Promise<DailyRewardsClaimResult> {
    // Get player's reward data from persistent storage
    const rewardsData = this.getPlayerData(player);
    if (!rewardsData) {
      return {
        success: false,
        message: 'No rewards data found.',
        reward: null
      };
    }

    // Check event state to determine if player can claim reward
    const eventState = this.getEventState(rewardsData);

    // Prevent claiming if event has expired
    if (eventState.expired) {
      return { success: false, message: 'Event has expired.', reward: null };
    }

    // Prevent claiming if player already claimed today's reward
    if (eventState.hasCollectedToday) {
      return { success: false, message: 'Reward has already been claimed.', reward: null };
    }

    // Get the reward for the current day
    const reward = this.enrichedRewardsData.find(reward => reward.day == eventState.currentDay);
    if (!reward) {
      return { success: false, message: 'No reward found for the current day.', reward: null };
    }

    // Grant the reward to the player
    const result = await this.grantReward(player, reward)

    if (result.success) {
      // Update player's reward data with the new collection
      this.savePlayerData(player, {
        startDate: rewardsData.startDate,
        lastCollection: {
          date: this.getDate(),
          index: eventState.currentDay
        }
      });
    }

    return result;
  }

  /**
   * Records the login of the player for the current day.
   * Initializes or updates the player's reward streak.
   *
   * @param player - The player who logged in
   * @remarks If the DailyRewards.BEGIN_ON_PLAYER_JOIN_KEY prop is true, this method will be called when the player joins the world.
   * @returns Operation result indicating success or failure with a message
   */
  public recordLogin(player: hz.Player): DailyRewardsOperationResult {
    // Check if daily rewards are active
    if (!this.isActive) {
      return { success: false, message: 'Daily Rewards event is not active.' };
    }

    // Get player's reward data
    const rewardsData = this.getPlayerData(player);

    // If no data exists, initialize a new streak
    if (!rewardsData) {
      this.resetSeries(player);
      return { success: true };
    }

    // Check event state
    const eventState = this.getEventState(rewardsData);

    // If event has expired and auto-repeat is enabled, reset the streak
    if (eventState.expired && this.config.autoRepeat) {
      this.resetSeries(player);
    }

    return { success: true };
  }

  /**
   * Resets the reward series of the player.
   * This starts a new streak from day 0.
   *
   * @param player - The player whose series will be reset
   */
  public resetSeries(player: hz.Player) {
    // Save new player data with current date as start and no collections
    this.savePlayerData(player, {
      startDate: this.getDate(),
      lastCollection: null
    });
  }

  /**
   * Gets the state of the daily rewards event for the player.
   * Calculates current day, collection status, and expiration status.
   *
   * @param eventData - The player's persistent reward data
   * @returns The current state of the event for the player
   */
  public getEventState(eventData: DailyRewardsPersistentData): DailyRewardsEventState {
    // Normalize dates to midnight for consistent day calculations
    const currentDate = new Date(this.getDate()).setHours(0, 0, 0, 0); // Get today's date at midnight
    const startDate = new Date(eventData.startDate).setHours(0, 0, 0, 0); // Normalize start date to midnight

    // Initialize event state with default values
    const eventState: DailyRewardsEventState = {
      expired: false,
      hasCollectedToday: false,
      currentDay: 0,
      nextCollectionDate: null
    };

    // Handle case where player has never collected a reward
    if (!eventData.lastCollection) {
      eventState.currentDay = 0;

      // Check if streak should expire when player misses a day
      const daysSinceStart = this.getDaysBetweenDates(startDate, currentDate);
      eventState.expired = this.config.resetStreakIfDayIsMissed && daysSinceStart > 0;

      return eventState;
    }

    // Handle case where player has collected rewards before
    const lastCollectionDate = new Date(eventData.lastCollection.date).setHours(0, 0, 0, 0);
    eventState.hasCollectedToday = lastCollectionDate === currentDate;

    // Calculate days since last collection and determine current day
    const daysSinceLastCollection = this.getDaysBetweenDates(lastCollectionDate, currentDate);
    eventState.currentDay = daysSinceLastCollection > 0 ? eventData.lastCollection.index + 1 : eventData.lastCollection.index;

    // Determine if event has expired due to inactivity or completion
    const expiredFromInactivity = this.config.resetStreakIfDayIsMissed && daysSinceLastCollection > 1;
    const collectedAllRewards = eventData.lastCollection.index >= this.config.rewards.length - 1;
    eventState.expired = expiredFromInactivity || collectedAllRewards;

    // Set next collection date if player collected today and event is still active
    if (eventState.hasCollectedToday && !eventState.expired) {
      eventState.nextCollectionDate = currentDate + 24 * 60 * 60 * 1000; // Tomorrow at midnight
    }

    return eventState;
  }

  /**
   * Gets the enriched rewards data with display information.
   * @returns Array of rewards with additional display information
   */
  public getRewards(): RewardEnrichedData[] {
    return this.enrichedRewardsData;
  }

  /**
   * Gets the current timestamp.
   * Abstracted to allow for easier testing and time manipulation.
   * @returns Current timestamp in milliseconds
   */
  private getDate(): number { return Date.now(); }

  /**
   * Retrieves the player's daily rewards data from persistent storage.
   * @param player - The player whose data to retrieve
   * @returns The player's daily rewards data or null if not found
   */
  public getPlayerData(player: hz.Player): DailyRewardsPersistentData | null {
    if (!this.config.persistentObjectVariableKey) {
      throw Error('Persistent Object Variable is required.');
    }
    return this.world.persistentStorage.getPlayerVariable<DailyRewardsPersistentData>(
      player,
      this.config.persistentObjectVariableKey
    );
  }

  /**
   * Saves the player's daily rewards data to persistent storage.
   * @param player - The player whose data to save
   * @param data - The daily rewards data to save
   */
  private savePlayerData(player: hz.Player, data: DailyRewardsPersistentData): void {
    if (!this.config.persistentObjectVariableKey) {
      throw Error('Persistent Object Variable is required.');
    }
    this.world.persistentStorage.setPlayerVariable<DailyRewardsPersistentData>(
      player,
      this.config.persistentObjectVariableKey,
      data
    );
  }

  /**
   * Grants a reward to the player (and wait for it to be delivered)
   * @param player - The player receiving the reward
   * @param reward - The reward data containing SKU and quantity
   */
  private async grantReward(player: hz.Player, reward: RewardEnrichedData): Promise<DailyRewardsClaimResult> {
    // We are casting to number because the quantity returned is actually a BigInt
    const currentRewardQuantity: number = Number(await hz.WorldInventory.getPlayerEntitlementQuantity(player, reward.sku));
    const expectedRewardQuantity = currentRewardQuantity + reward.quantity;

    await hz.WorldInventory.grantItemToPlayer(player, reward.sku, reward.quantity);

    // Because the backend doesn't support async grant, we need to manually
    // wait for validation that the purchase was successful, by waiting and comparing the entitlements
    const maxRetries = 10; // Maximum times to retry
    let retries = 0; // Number of retries so far
    while (retries++ < maxRetries
      && !await this.hasExpectedEntitlements(player, reward.sku, expectedRewardQuantity)) {
      // Wait for a second before checking again
      if (this.owner != undefined) {
        await new Promise(r => this.owner!.async.setTimeout(r, 1000));
      }
    }

    if (retries > maxRetries) {
      // Timing out the verification will be assumed as a success
      // This is arguably not an ideal solution, but this is only temporary
      // until the backend supports async grant
      return { success: true, message: 'Timed out. Could not verify.', reward: reward };
    }

    return { success: true, message: 'Reward granted.', reward: reward };
  }

  /**
   * Checks asynchronously if a player has the expected entitlements for a given item
   * @param player The player to check
   * @param expectedItemSku The SKU of the item to check
   * @param expectedItemQuantity The expected quantity of the item
   * @returns Whether the player has the expected entitlements
   */
  private async hasExpectedEntitlements(player: hz.Player, expectedItemSku: string, expectedItemQuantity: number) {
    // We are casting to number because the quantity returned is actually a BigInt
    const quantity = Number(await hz.WorldInventory.getPlayerEntitlementQuantity(player, expectedItemSku));
    return quantity === expectedItemQuantity;
  }

  /**
   * Calculates the number of days between two dates.
   * @param start - Start date in milliseconds
   * @param end - End date in milliseconds
   * @returns Number of days between the dates
   */
  private getDaysBetweenDates(start: number, end: number): number {
    const millisecondsInADay = 24 * 60 * 60 * 1000;
    return Math.floor((end - start) / millisecondsInADay);
  }

  /**
   * Fetches additional information about rewards from the world inventory.
   * Enriches the basic reward data with names, descriptions, and other display information.
   */
  public async fetchEnrichedRewardsData() {
    // Fetch item details from world inventory
    let items: hz.InWorldPurchasable[] = [];
    try {
      items = await hz.WorldInventory.getWorldPurchasablesBySKUs(this.config.rewards.map(r => r.sku));
    } catch (e) {
      console.error(`Error fetching items: ${e}`);
    }

    // Create a map for quick lookup of item details by SKU
    const itemMap = new Map(items.map(item => [item.sku, item]));

    // Enrich each reward with additional information
    let index = 0;
    this.enrichedRewardsData = this.config.rewards.map(reward => {
      const item = itemMap.get(reward.sku);
      return {
        sku: reward.sku,
        quantity: reward.quantity,
        name: item?.name ?? '',
        description: item?.description ?? '',
        thumbnailId: reward.thumbnailId,
        thumbnailVersionId: reward.thumbnailVersionId,
        day: index++,
      };
    });
  }
}

/**
 * Abstract base class for economy server components.
 *
 * This class provides the foundation for implementing economy-related server components
 * with standardized initialization flow and common functionality.
 *
 * @template T The component's configuration type
 * @template TLogic The business logic implementation type
 */
abstract class EconomyServer<T, TLogic> extends hz.Component<T> {

  /**
   * Constant identifier key used for economy server identification
   */
  static readonly ID = "Id";

  /**
   * Constant key for the displayed title in the UI
   */
  static readonly DISPLAYED_TITLE_KEY = "Displayed Title";

  /**
   * Constant key for the icon associated with the displayed title
   */
  static readonly DISPLAYED_TITLE_ICON = "Displayed Title Icon";

  /**
   * Abstract method that must be implemented by subclasses.
   * Called after the component has been fully initialized with its logic.
   */
  protected abstract onInitialized(): void;

  /**
   * The unique identifier for this economy server instance
   */
  protected id: string | null = null;

  /**
   * Icon asset associated with this economy server
   */
  protected icon: Readonly<hz.Asset> | undefined;

  /**
   * The business logic implementation for this economy server
   */
  private logic: TLogic | null = null;

  /**
   * Gets the unique identifier of this economy server
   * @returns The server's ID or null if not set
   */
  public get Id(): string | null { return this.id; }

  /**
   * Gets the business logic implementation
   * @returns The logic implementation or null if not initialized
   */
  public get Logic(): TLogic | null { return this.logic; }

  /**
   * Determines if this server is the intended recipient for a given ID
   * @param id The ID to check against this server
   * @returns True if this server should handle the request (when ID matches or input ID is null)
   */
  public isRecipient(id: string | null) {
    return (id === null || this.Id === id);
  }

  /**
   * Abstract method that must be implemented by subclasses.
   * Responsible for creating and initializing the business logic for this server.
   * @returns A promise that resolves to the initialized logic instance
   */
  protected abstract initializeLogic(): Promise<TLogic>;

  /**
   * Lifecycle method called before the component starts.
   * Handles initialization of resources and business logic.
   *
   * The initialization sequence:
   * 1. Preloads icon assets if available
   * 2. Initializes the business logic
   * 3. Calls the onInitialized hook for subclass-specific initialization
   */
  async preStart(): Promise<void> {
    // Preload the icon asset if one is defined
    if (this.icon) {
      ImageSource.fromTextureAsset(this.icon);
    }

    // Initialize the business logic
    this.logic = await this.initializeLogic();

    // Notify subclass that initialization is complete
    this.onInitialized();
  }

  /**
   * Lifecycle method called when the component starts.
   * Currently empty as all initialization is handled in preStart.
   *
   * Implementation of this method is required by the hz.Component base class.
   * @remarks Note that this method will be called before preStart() is over due
   * to the fact that preStart() is exceptionally asynchronous.
   */
  start() { }
}

/**
 * DailyRewards class - Manages a daily rewards system for players
 *
 * This class extends EconomyServer to provide a daily login reward system.
 * It allows game creators to define rewards for each day of a streak,
 * with configurable behavior for streaks, timers, and reward claiming.
 */
export class DailyRewards extends EconomyServer<typeof DailyRewards, DailyRewardsLogic> {
  // Configuration keys for the daily rewards system
  /** Key for storing persistent player data across sessions */
  static readonly PERSISTENT_OBJECT_VARIABLE_KEY = "Persistent Object Variable";
  /** Key to enable/disable the daily rewards feature */
  static readonly ACTIVATION_KEY = "Daily Rewards Activation";
  /** Key to determine if rewards tracking begins when player joins */
  static readonly BEGIN_ON_PLAYER_JOIN_KEY = "Begin On Player Join";
  /** Key for the number of days in the reward cycle */
  static readonly NUMBER_OF_DAYS_KEY = "# Reward Days";
  /** Key to determine if the reward cycle should automatically repeat */
  static readonly AUTO_REPEAT_KEY = "Auto Repeat";
  /** Key to toggle visibility of the countdown timer */
  static readonly SHOW_TIMER_KEY = "Show Timer";
  /** Key to determine if missing a day resets the streak */
  static readonly RESET_STREAK_IF_DAY_IS_MISSED_KEY = "Reset Streak If Day Is Missed";

  // Day 1 reward configuration keys
  static readonly DAY1_REWARD_SKU = "Day 1 Reward SKU";
  static readonly DAY1_REWARD_QUANTITY = "Day 1 Reward Quantity";
  static readonly DAY1_REWARD_THUMBNAIL = "Day 1 Reward Thumbnail";

  // Day 2 reward configuration keys
  static readonly DAY2_REWARD_SKU = "Day 2 Reward SKU";
  static readonly DAY2_REWARD_QUANTITY = "Day 2 Reward Quantity";
  static readonly DAY2_REWARD_THUMBNAIL = "Day 2 Reward Thumbnail";

  // Day 3 reward configuration keys
  static readonly DAY3_REWARD_SKU = "Day 3 Reward SKU";
  static readonly DAY3_REWARD_QUANTITY = "Day 3 Reward Quantity";
  static readonly DAY3_REWARD_THUMBNAIL = "Day 3 Reward Thumbnail";

  // Day 4 reward configuration keys
  static readonly DAY4_REWARD_SKU = "Day 4 Reward SKU";
  static readonly DAY4_REWARD_QUANTITY = "Day 4 Reward Quantity";
  static readonly DAY4_REWARD_THUMBNAIL = "Day 4 Reward Thumbnail";

  // Day 5 reward configuration keys
  static readonly DAY5_REWARD_SKU = "Day 5 Reward SKU";
  static readonly DAY5_REWARD_QUANTITY = "Day 5 Reward Quantity";
  static readonly DAY5_REWARD_THUMBNAIL = "Day 5 Reward Thumbnail";

  // Day 6 reward configuration keys
  static readonly DAY6_REWARD_SKU = "Day 6 Reward SKU";
  static readonly DAY6_REWARD_QUANTITY = "Day 6 Reward Quantity";
  static readonly DAY6_REWARD_THUMBNAIL = "Day 6 Reward Thumbnail";

  // Day 7 reward configuration keys
  static readonly DAY7_REWARD_SKU = "Day 7 Reward SKU";
  static readonly DAY7_REWARD_QUANTITY = "Day 7 Reward Quantity";
  static readonly DAY7_REWARD_THUMBNAIL = "Day 7 Reward Thumbnail";

  // To add additional rewards, add a new set of keys for each day, following the pattern above.
  // Then, add them to the propsDefinition and to the rewards array in the initializeLogic method.

  /**
   * Property definitions for the DailyRewards component
   * These define the configuration options available in the editor
   */
  static propsDefinition = {
    // Base properties inherited from EconomyServer
    [EconomyServer.ID]: { type: hz.PropTypes.String },
    [EconomyServer.DISPLAYED_TITLE_KEY]: { type: hz.PropTypes.String },
    [EconomyServer.DISPLAYED_TITLE_ICON]: { type: hz.PropTypes.Asset },

    // Daily rewards specific configuration
    [DailyRewards.PERSISTENT_OBJECT_VARIABLE_KEY]: { type: hz.PropTypes.String },
    [DailyRewards.ACTIVATION_KEY]: { type: hz.PropTypes.Boolean, default: true },
    [DailyRewards.BEGIN_ON_PLAYER_JOIN_KEY]: { type: hz.PropTypes.Boolean, default: true },
    [DailyRewards.AUTO_REPEAT_KEY]: { type: hz.PropTypes.Boolean, default: true },
    [DailyRewards.SHOW_TIMER_KEY]: { type: hz.PropTypes.Boolean, default: true },
    [DailyRewards.RESET_STREAK_IF_DAY_IS_MISSED_KEY]: { type: hz.PropTypes.Boolean, default: false },

    // Day 1 reward properties
    [DailyRewards.DAY1_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY1_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY1_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },

    // Day 2 reward properties
    [DailyRewards.DAY2_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY2_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY2_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },

    // Day 3 reward properties
    [DailyRewards.DAY3_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY3_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY3_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },

    // Day 4 reward properties
    [DailyRewards.DAY4_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY4_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY4_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },

    // Day 5 reward properties
    [DailyRewards.DAY5_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY5_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY5_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },

    // Day 6 reward properties
    [DailyRewards.DAY6_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY6_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY6_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },

    // Day 7 reward properties
    [DailyRewards.DAY7_REWARD_SKU]: { type: hz.PropTypes.String },
    [DailyRewards.DAY7_REWARD_QUANTITY]: { type: hz.PropTypes.Number, default: 1 },
    [DailyRewards.DAY7_REWARD_THUMBNAIL]: { type: hz.PropTypes.Asset },
  };

  /** Cached enriched rewards data with additional metadata */
  private enrichedRewardsData: RewardEnrichedData[] | undefined;

  /**
   * Initializes the daily rewards logic
   *
   * This method sets up the core functionality by:
   * 1. Loading the title icon and ID
   * 2. Creating a rewards array from configured properties
   * 3. Initializing the DailyRewardsLogic with configuration
   * 4. Pre-loading thumbnail assets for rewards
   * 5. Fetching enriched reward data
   *
   * @returns A Promise resolving to the initialized DailyRewardsLogic
   */
  protected async initializeLogic(): Promise<DailyRewardsLogic> {
    // Set up basic component properties
    this.icon = this.props[EconomyServer.DISPLAYED_TITLE_ICON];
    this.id = this.props[EconomyServer.ID];

    // Pre-load the title icon if one is provided
    if (this.icon) {
      ImageSource.fromTextureAsset(this.icon);
    }

    // Create an array of all configured rewards
    const rewards = [
      { sku: this.props[DailyRewards.DAY1_REWARD_SKU], quantity: this.props[DailyRewards.DAY1_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY1_REWARD_THUMBNAIL] },
      { sku: this.props[DailyRewards.DAY2_REWARD_SKU], quantity: this.props[DailyRewards.DAY2_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY2_REWARD_THUMBNAIL] },
      { sku: this.props[DailyRewards.DAY3_REWARD_SKU], quantity: this.props[DailyRewards.DAY3_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY3_REWARD_THUMBNAIL] },
      { sku: this.props[DailyRewards.DAY4_REWARD_SKU], quantity: this.props[DailyRewards.DAY4_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY4_REWARD_THUMBNAIL] },
      { sku: this.props[DailyRewards.DAY5_REWARD_SKU], quantity: this.props[DailyRewards.DAY5_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY5_REWARD_THUMBNAIL] },
      { sku: this.props[DailyRewards.DAY6_REWARD_SKU], quantity: this.props[DailyRewards.DAY6_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY6_REWARD_THUMBNAIL] },
      { sku: this.props[DailyRewards.DAY7_REWARD_SKU], quantity: this.props[DailyRewards.DAY7_REWARD_QUANTITY], thumbnail: this.props[DailyRewards.DAY7_REWARD_THUMBNAIL] },
    ];

    // Initialize the rewards logic with configuration from properties
    const logic = new DailyRewardsLogic(this, this.world, {
      persistentObjectVariableKey: this.props[DailyRewards.PERSISTENT_OBJECT_VARIABLE_KEY],
      activation: this.props[DailyRewards.ACTIVATION_KEY],
      autoRepeat: this.props[DailyRewards.AUTO_REPEAT_KEY],
      resetStreakIfDayIsMissed: this.props[DailyRewards.RESET_STREAK_IF_DAY_IS_MISSED_KEY],
      rewards: rewards.map(reward => {
        // Pre-load each reward thumbnail for later use by clients
        if (reward.thumbnail) {
          // Load Thumbnail to the server, so that local can get it later
          ImageSource.fromTextureAsset(reward.thumbnail);
        }

        // Return the reward data in the format expected by DailyRewardsLogic
        return {
          sku: reward.sku,
          quantity: reward.quantity,
          thumbnailId: reward.thumbnail?.id ?? BigInt(0),
          thumbnailVersionId: reward.thumbnail?.versionId ?? BigInt(0)
        }
      })
    });

    // Set the active state based on configuration
    if (this.props[DailyRewards.ACTIVATION_KEY]) {
      logic.isActive = true;
    }

    // Load additional reward metadata
    await logic.fetchEnrichedRewardsData();

    return logic;
  }

  /**
   * Initializes event handlers and sets up network communication
   * Called once logic has been initialized and component is ready to start
   */
  protected onInitialized() {
    // Set up automatic login recording when players join the world (if enabled)
    if (this.props[DailyRewards.BEGIN_ON_PLAYER_JOIN_KEY]) {
      // Record login of players who already joined
      this.recordLogins();

      this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player: hz.Player) => {
        this.recordLogin({ player: player, id: this.Id });
      });
    }

    // Connect network event handlers for client requests
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.RequestRewardsList, this.sendRewardsList.bind(this));
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.RequestEventState, this.sendEventState.bind(this));
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.ClaimReward, this.OnRewardClaimed.bind(this));
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.RecordLogin, this.recordLogin.bind(this));

    // Broadcast initial rewards list to all clients
    this.broadcastRewardsList();
  }

  /**
   * Handles reward claim requests from clients
   *
   * This method processes a player's request to claim their daily reward:
   * 1. Validates that the request is intended for this component
   * 2. Attempts to claim the reward using the logic component
   * 3. Sends a response to the client with the result and updated state
   *
   * @param player - The player claiming the reward
   * @param id - The component ID to verify the request target
   */
  private async OnRewardClaimed({ player, id }: { player: hz.Player, id: string | null }) {
    if (!this.isRecipient(id)) {
      // Reject this request as it is not aimed at this shop
      return;
    }

    // Process the claim request through the logic component
    const result = await this.Logic!.claimReward(player);

    // Send response to the client with claim results
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.ClaimRewardResponse,
      {
        player: player,
        id: this.Id,
        eventState: this.getEventState(player),
        result: result
      }
    );
  }

  /**
   * Broadcasts the rewards list to all clients
   *
   * This method sends the complete rewards list and metadata to all clients,
   * allowing them to display the daily rewards UI without making individual requests.
   */
  private broadcastRewardsList() {
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.BroadcastRewardsList,
      {
        id: this.Id,
        metadata: {
          title: this.props[DailyRewards.DISPLAYED_TITLE_KEY],
          titleIconId: this.icon?.id ?? BigInt(0),
          titleIconVersionId: this.icon?.versionId ?? BigInt(0)
        },
        rewards: this.getRewards()
      }
    );
  }

  /**
   * Sends the rewards list to a specific player
   *
   * This method responds to a client request for the rewards list by sending
   * the complete rewards data and metadata to the requesting player.
   *
   * @param player - The player requesting the rewards list
   * @param id - The component ID to verify the request target
   */
  private sendRewardsList({ player, id }: { player: hz.Player, id: string | null }) {
    if (!this.isRecipient(id)) {
      // Reject this request as it is not aimed at this shop
      return;
    }

    // Send rewards list to the requesting player
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.SendRewardsList,
      {
        player: player,
        id: this.Id,
        metadata: {
          title: this.props[DailyRewards.DISPLAYED_TITLE_KEY],
          titleIconId: this.icon?.id ?? BigInt(0),
          titleIconVersionId: this.icon?.versionId ?? BigInt(0)
        },
        rewards: this.getRewards()
      });
  }

  /**
   * Sends the current event state to a specific player
   *
   * This method responds to a client request for their current daily rewards state,
   * including information about their streak, next available reward, and timers.
   *
   * @param player - The player requesting their event state
   * @param id - The component ID to verify the request target
   */
  private sendEventState({ player, id }: { player: hz.Player, id: string | null }) {
    if (!this.isRecipient(id)) {
      // Reject this request as it is not aimed at this shop
      return;
    }

    // Send the player's current event state
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.SendEventState,
      {
        player: player,
        id: this.Id,
        eventState: this.getEventState(player)
      }
    );
  }

  /**
   * Records login for all players
   *
   * This method processes a login event for all players who already joined the world.
   */
  private recordLogins() {
    // Get all players currently in the world
    const players = this.world.getPlayers();

    // Record login for each player
    players.forEach(player => {
      this.recordLogin({ player: player, id: this.Id });
    });
  }

  /**
   * Records a player login for daily rewards tracking
   *
   * This method processes a login event, which may be triggered automatically
   * when a player joins or manually through client interaction.
   *
   * @param player - The player logging in
   * @param id - The component ID to verify the request target
   */
  private recordLogin({ player, id }: { player: hz.Player, id: string | null }) {
    if (!this.isRecipient(id)) {
      // Reject this request as it is not aimed at this shop
      return;
    }

    // Record the login in the logic component to update streak and availability
    this.Logic!.recordLogin(player);
  }

  /**
   * Retrieves the current event state for a player
   *
   * This helper method gets the player's current daily rewards state,
   * including streak information, next reward availability, and timers.
   *
   * @param player - The player to get event state for
   * @returns The player's event state or null if no data exists
   */
  private getEventState(player: hz.Player) {
    // Get the player's stored rewards data
    const rewardsData = this.Logic!.getPlayerData(player);
    if (!rewardsData) {
      return null;
    }

    // Convert raw data into event state information
    return this.Logic!.getEventState(rewardsData);
  }

  /**
   * Retrieves the enriched rewards data
   *
   * This helper method returns cached rewards data with additional metadata,
   * or fetches it from the logic component if not yet cached.
   *
   * @returns Array of enriched reward data objects with metadata
   */
  private getRewards(): RewardEnrichedData[] {
    // Return cached data if available
    if (this.enrichedRewardsData) {
      return this.enrichedRewardsData;
    }

    // Fetch and cache rewards data from logic component
    this.enrichedRewardsData = this.Logic!.getRewards();
    return this.enrichedRewardsData!;
  }
}

/**
 * Register the DailyRewards component with the Horizon framework
 * This makes the component available for use in the game editor
 */
hz.Component.register(DailyRewards);
