/**
 * (c) Meta Platforms, Inc. and affiliates. Confidential and proprietary.
 */

// @generated version: YUDHHU

import * as hz from 'horizon/core';
import { Player, TextureAsset, NetworkEvent } from 'horizon/core';
import { Text, ImageSource, Binding, UINode, ScrollView, DynamicList, ViewStyle, View, Image, UIChildren, Pressable, TextStyle, ImageStyle, Bindable, FontFamily, UIComponent, AnimatedBinding, Animation, Easing } from 'horizon/ui';

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
 * Represents an item in a grid. It is responsible for converting itself to a UINode.
 * We're using this interface instead of a class because we want to allow using different types of items in the grid or letting creators
 * create their own item classes.
 *
 * Implementers of this interface must provide a toUINode method that converts the item to a renderable UI node.
 */
interface IUIElement {
  /**
   * Converts the item to a UINode for rendering
   * @param index - The position of this item in the grid
   * @param numberOfItems - The total number of items in the grid
   * @returns A UINode representing this item
   */
  toUINode(index: number, numberOfItems: number): UINode;
}

/**
 * Represents a proxy for an item used in a dynamic list. It is used to pass the index of the item to the render function of the DynamicList.
 * This proxy pattern allows us to maintain a lightweight reference to the actual item without duplicating the entire object.
 * Most of the logic will be handled by the owner of the dynamic list and the item class itself.
 */
type DynamicListItemProxy = {
  index: number
};

/**
 * PanelEvents object contains network events related to panel visibility management.
 * These events can be dispatched to show or hide panels for specific players.
 *
 * Each event carries information about:
 * - player: The Player instance for whom the panel should be shown/hidden
 * - id: The unique identifier of the panel (null means all panels)
 */
const PanelEvents = {
  /**
   * Event dispatched to show a panel for a specific player.
   * @param player - The player for whom to show the panel
   * @param id - The identifier of the panel to show (null for all panel)
   */
  ShowPanel: new NetworkEvent<{ player: Player, id: string | null }>('PanelEvents.ShowPanel'),

  /**
   * Event dispatched to hide a panel for a specific player.
   * @param player - The player for whom to hide the panel
   * @param id - The identifier of the panel to hide (null for all panels)
   */
  HidePanel: new NetworkEvent<{ player: Player, id: string | null }>('PanelEvents.HidePanel'),
}

abstract class UIElement implements IUIElement {
  protected readonly style: ViewStyle = {
  }

  constructor(styleOverrides?: Partial<ViewStyle>) {
    if (styleOverrides) {
      this.style = { ...this.style, ...styleOverrides };
    }
  }

  public abstract toUINode(index: number, numberOfItems: number): UINode;
}

/**
 * Represents a grid layout. It is responsible for managing the items and rendering them as a grid.
 * It also handles the scrolling using a ScrollView UI node.
 *
 * The Grid uses a wrapped flex layout to arrange items in rows, automatically wrapping to the next row
 * when the current row is filled. This creates a responsive grid that adapts to different screen sizes.
 */
class Grid extends UIElement {
  /**
   * The width of the grid in pixels.
   * This property is used to track and manage the grid's horizontal dimension.
   */
  private width: number = 0;

  /**
   * Gets the current width of the grid.
   * @returns The width value.
   */
  public get Width(): number {
    return this.width;
  }

  /**
   * The height of the grid in pixels.
   * This property is used to track and manage the grid's vertical dimension.
   */
  private height: number = 0;

  /**
   * Gets the current height of the grid.
   * @returns The height value.
   */
  public get Height(): number {
    return this.height;
  }

  /**
   * Determines if the grid should scroll horizontally.
   * When true, the grid will scroll horizontally; when false (default), it will scroll vertically.
   */
  private horizontal: boolean = false;

  /**
   * Gets whether the grid scrolls horizontally.
   * @returns True if the grid scrolls horizontally, false if it scrolls vertically.
   */
  public get isHorizontal(): boolean {
    return this.horizontal;
  }

  /**
   * Creates a new Grid instance.
   * @param horizontal - Optional parameter to set horizontal scrolling.
   * @param width - Optional parameter to set the initial width of the grid.
   * @param height - Optional parameter to set the initial height of the grid.
   */
  constructor(horizontal: boolean, width: number, height: number) {
    super();
    this.horizontal = horizontal;
    this.width = width;
    this.height = height;

    // Update the wrapped flex style and scroll view style based on horizontal setting
    if (horizontal) {
      this.wrappedFlexStyle.flexDirection = "column";
      this.scrollViewStyle.flexDirection = "column";
      this.scrollViewStyle.width = width;
      this.scrollViewStyle.height = height;
      this.wrappedFlexStyle.height = '100%';
    }
    else {
      this.wrappedFlexStyle.flexDirection = "row";
      this.scrollViewStyle.flexDirection = "row";
      this.scrollViewStyle.width = width;
      this.scrollViewStyle.height = height;
      this.wrappedFlexStyle.width = '100%';
    }
  }

  /**
   * The collection of items to be displayed in the grid
   */
  private Items: IUIElement[] = [];

  /**
   * Style for the wrapped flex container that holds the grid items
   */
  private readonly wrappedFlexStyle: ViewStyle = {
    display: "flex",
    flexGrow: 0,
    alignItems: "flex-start",
    flexWrap: "wrap",
  }

  /**
   * Style for the ScrollView that contains the grid
   */
  private readonly scrollViewStyle: ViewStyle = {
    ...this.wrappedFlexStyle,
    justifyContent: "space-between",
  }

  /**
   * A binding that holds proxies to the grid items
   * This is used by the DynamicList to efficiently render only the visible items
   */
  private readonly ItemsData = new Binding<DynamicListItemProxy[]>([]);

  /**
   * Renders an item as a UINode based on the provided item proxy and optional index.
   * This method is called by the DynamicList for each visible item in the grid.
   *
   * @param itemProxy - The proxy containing the index of the item to render.
   * @param index - An optional index to override the item proxy index.
   * @returns A UINode representing the rendered item.
   */
  private renderItems(itemProxy: DynamicListItemProxy, index?: number): UINode {
    // Default to 0 if itemProxy.index is undefined
    const itemIndex = itemProxy.index ?? 0;

    // Get the actual item from our Items array using the index from the proxy
    const item = this.Items[itemIndex];

    // Convert the item to a UINode, passing either the provided index or the proxy index
    // Also pass the total number of items for layout calculations if needed
    return item.toUINode(index ?? itemIndex, this.Items.length);
  }

  /**
   * Sets the items to be managed by the grid and updates the binding data.
   * This method should be called whenever the grid's content needs to be updated.
   *
   * @param items - An array of items to be displayed in the grid.
   */
  public setItems(items: IUIElement[]) {
    // Store the new items
    this.Items = items;

    // Update the binding with proxies for each item
    // Each proxy contains just the index of the corresponding item
    // This will trigger the DynamicList to re-render with those items
    this.ItemsData.set(this.Items.map((_, index) => ({ index })));
  }

  /**
   * Constructs the content for the grid layout.
   * This method creates a DynamicList of IUIElements.
   *
   * @returns An array of UINodes representing the grid's content
   */
  public constructContent(): UINode[] {
    return [DynamicList({
      data: this.ItemsData,
      renderItem: this.renderItems.bind(this),
      style: this.wrappedFlexStyle
    })];
  }

  /**
   * Constructs and returns a UINode representing the grid layout with scrollable content.
   * This is the main method to call when you want to render the grid.
   *
   * @returns A UINode for the grid's scrollable content.
   */
  public toUINode(): UINode {
    // Get the content for the popup
    let children: UINode[] | undefined = this.constructContent();
    // If there's no content, set children to undefined (View API requirement)
    // as passing an empty array will throw an error
    if (children.length === 0) {
      children = undefined;
    }

    // Create and return a View component that represents the popup
    return ScrollView({
      children: children,
      contentContainerStyle: this.wrappedFlexStyle,
      style: this.scrollViewStyle,
      horizontal: this.horizontal
    });
  }
}

/**
 * An object that contains style-related properties that will be used by the Panel class.
 */
const StyleSheetBase = {
  // Main Panel Options
  PANEL_WIDTH: 660, // Width of the panel
  PANEL_RATIO: 1.375, // Ratio for panel dimensions, height will be calculated based on this
  PANEL_BACKGROUND_COLOR: 'transparent', // Background color of the component
  PANEL_BACKGROUND_COLOR_GRADIENT_A: '#202020D0', // Initial color for the panel background gradient
  PANEL_BACKGROUND_COLOR_GRADIENT_B: '#505560DA', // End color for the panel background gradient
  PANEL_BACKGROUND_COLOR_GRADIENT_ANGLE: '200deg', // Angle of the panel background gradient
  PANEL_FOOTER_HEIGHT: 80, // Height of the footer,

  // Border Options
  BORDER_WIDTH: 2, // Width of the default borders
  BORDER_COLOR: '#202020', // Outer color for borders
  BORDER_INNER_COLOR: '#AAAAAA', // Inner color for borders (when using the double border styling)

  // Margins, Paddings and gaps
  PADDING_LARGE: 24, // Large padding size
  PADDING_SMALL: 8, // Small padding size
  RADIUS_SMALL: 12, // Small radius size
  GAP_MINIMUM: 4, // Minimum gap size
  GAP_SMALL: 8, // Small gap size
  GAP_MEDIUM: 12, // Medium gap size

  // Text Options
  TEXT_COLOR_PRIMARY: "#EEEEEE", // Primary text color
  TEXT_COLOR_SECONDARY: "#CCCCCC", // Secondary text color
  TEXT_COLOR_BRIGHT: "#FFFFFF", // Bright text color
  TEXT_SIZE_TITLE: 18, // Text size for titles
  TEXT_SIZE_ITEM: 12, // Text size for items
  TEXT_SIZE_BUTTON: 14, // Text size for buttons
  TEXT_SIZE_BUTTON_CURRENCY: 10, // Text size for small buttons
  TEXT_SIZE_DESCRIPTION: 10, // Text size for descriptions
  TEXT_SIZE_LINE_HEIGHT: 24, // Line height for text
  TEXT_LINEHEIGHT_ITEM: 18, // Line height for items
  TEXT_LINEHEIGHT_DESCRIPTION: 12, // Line height for descriptions
  TEXT_LINEHEIGHT_BUTTON: 16, // Line height for buttons
  TEXT_WEIGHT_TITLE: "600" as Bindable<"700" | "400" | "600" | "normal" | "bold" | "100" | "200" | "300" | "500" | "800" | "900">, // Font weight for titles
  TEXT_WEIGHT_ITEM: "700" as Bindable<"700" | "400" | "600" | "normal" | "bold" | "100" | "200" | "300" | "500" | "800" | "900">, // Font weight for items
  TEXT_WEIGHT_DESCRIPTION: "400" as Bindable<"700" | "400" | "600" | "normal" | "bold" | "100" | "200" | "300" | "500" | "800" | "900">, // Font weight for descriptions
  TEXT_WEIGHT_BUTTON: "700" as Bindable<"700" | "400" | "600" | "normal" | "bold" | "100" | "200" | "300" | "500" | "800" | "900">, // Font weight for descriptions
  TEXT_FONT_PRIMARY: "Roboto" as FontFamily, // Primary font family

  // Button Options
  BUTTON_SIZE: 28, // Size of buttons
  BUTTON_BACKGROUND_COLOR: "#404040", // Background color of buttons
  BUTTON_BACKGROUND_COLOR_HOVER: "#606060", // Background color of buttons on hover
  BUTTON_BACKGROUND_COLOR_ACCENT: "#A72A82", // Accent background color of buttons
  BUTTON_CURRENCY_MIN_WIDTH: 64, // Minimum width of currency buttons

  // Toggle Overlay Button Options
  TOGGLE_OVERLAY_BUTTON_SIZE: 42, // Size of toggle overlay buttons

  // Item Options
  ITEM_WIDTH: 144, // Width of the item used in the grid
  ITEM_THUMBNAIL_HEIGHT: 108, // Height of the thumbnail used in the grid, this is not the full height of an item, because of possible texts below
  ITEM_THUMBNAIL_RADIUS: 8, // Radius of the thumbnail used in the grid
  ITEM_THUMBNAIL_TINT_NORMAL: "#FFFFFF", // Tint color of the thumbnail used in the grid
  ITEM_THUMBNAIL_TINT_GREYED_OUT: "#C0C0C0", // Greyed out color of the thumbnail used in the grid
};

/**
 * An object that contains style-related properties that will are computed from the StyleSheet object constants.
 */
const StyleSheet =
{
  ...StyleSheetBase,
  PANEL_HEIGHT: StyleSheetBase.PANEL_WIDTH / StyleSheetBase.PANEL_RATIO, // Height of the panel
  SCROLLVIEW_WIDTH: StyleSheetBase.PANEL_WIDTH - 2 * (StyleSheetBase.PADDING_LARGE) + StyleSheetBase.PADDING_SMALL, // Ideal width for the scroll view
  ITEM_HEIGHT: StyleSheetBase.ITEM_THUMBNAIL_HEIGHT + (StyleSheetBase.TEXT_SIZE_LINE_HEIGHT * 2), // Estimated height of an item
  SCROLLVIEW_TWO_LINES_HEIGHT: ((StyleSheetBase.ITEM_THUMBNAIL_HEIGHT + (StyleSheetBase.TEXT_SIZE_LINE_HEIGHT * 2)) * 2) + StyleSheetBase.GAP_SMALL,
  SCROLLVIEW_ONE_LINE_HEIGHT: StyleSheetBase.ITEM_THUMBNAIL_HEIGHT + (StyleSheetBase.TEXT_SIZE_LINE_HEIGHT * 2),
  BUTTON_RADIUS: StyleSheetBase.BUTTON_SIZE / 2, // Radius used for buttons (50% of the height will lead to a circle border)
  BUTTON_ICON_SIZE: StyleSheetBase.BUTTON_SIZE - 2 * StyleSheetBase.BORDER_WIDTH, // Size of the icons within a button (taking the border into account)
  BUTTON_ICON_RADIUS: (StyleSheetBase.BUTTON_SIZE - 2 * StyleSheetBase.BORDER_WIDTH) / 2, // Radius for icons within a button
  TOGGLE_OVERLAY_BUTTON_RADIUS: StyleSheetBase.TOGGLE_OVERLAY_BUTTON_SIZE / 2, // Radius for toggle overlay buttons
}

/**
 * Utility class providing methods for UI element manipulation, such as wrapping elements in a flex container with optional border overlays.
 */
class Utils {
  /**
   * Wraps the given children in a flex container with optional border overlays.
   * @param children - The UI elements to be wrapped.
   * @param style - The style to be applied to the flex container.
   * @param borderAsOverlay - Determines if the border should be an overlay.
   * @param doubleBorder - Determines if a double border should be applied.
   * @returns The children wrapped in a flex container with optional borders.
   */
  static WrapInFlex({ children, style, borderAsOverlay, doubleBorder, borderStyleOverride }: {
    children: UIChildren | undefined,
    style: ViewStyle,
    borderAsOverlay: boolean,
    doubleBorder: boolean,
    borderStyleOverride?: Partial<ViewStyle>
  }): UIChildren {
    const radiusValue = style.borderRadius instanceof Binding ? style.borderRadius : new Binding<number>((style.borderRadius as number) ?? 2);
    const borders = Utils.BuildDoubleBorderOverlay({
      radius: radiusValue,
      double: doubleBorder,
      styleOverride: borderStyleOverride
    });
    const flex = View({
      children: children,
      style: style
    });
    return borderAsOverlay ? [flex, borders] : [borders, flex];
  }

  /**
   * Builds a double border overlay view.
   * @param radius - The border radius to be applied.
   * @param double - Determines if a double border should be created.
   * @returns A UI node representing the border overlay.
   */
  static BuildDoubleBorderOverlay({ radius, double, styleOverride }: {
    radius: Bindable<number> | number | undefined,
    double: boolean,
    styleOverride?: Partial<ViewStyle>
  }): UINode {
    let radiusValue: Binding<number>;
    if (radius instanceof Binding) {
      radiusValue = radius;
    } else {
      radiusValue = new Binding<number>((radius as number) ?? 2);
    }

    return View({
      children: double ? View({
        style: {
          top: 0,
          left: 0,
          position: 'absolute',
          borderWidth: StyleSheet.BORDER_WIDTH,
          borderColor: StyleSheet.BORDER_INNER_COLOR,
          borderRadius: radiusValue.derive(r => r - 2),
          width: '100%',
          height: '100%',
        }
      }
      ) : undefined,
      style: {
        top: 0,
        left: 0,
        position: 'absolute',
        borderWidth: StyleSheet.BORDER_WIDTH,
        borderColor: StyleSheet.BORDER_COLOR,
        borderRadius: radiusValue,
        width: '100%',
        height: '100%',
        ...styleOverride
      }
    });
  }
}

/**
 * Abstract base class for creating buttons.
 *
 * This class provides the foundation for building interactive buttons with
 * consistent styling and behavior. Subclasses should implement the constructContent()
 * method to define the actual content of the button.
 */
export abstract class Button extends UIElement {
  /**
   * Default button styling properties.
   * These define the visual appearance of all buttons created from this class.
   * The style uses values from the StyleSheet constants for consistency.
   */
  protected readonly style: ViewStyle = {
    backgroundColor: StyleSheet.BUTTON_BACKGROUND_COLOR,
    borderRadius: StyleSheet.BUTTON_RADIUS,
    height: StyleSheet.BUTTON_SIZE,
    marginRight: StyleSheet.GAP_MINIMUM,
  }

  /**
   * Styling for the flex style within the button.
   */
  protected readonly flexStyle: ViewStyle = {
    justifyContent: "center",
    flexDirection: "row",
    alignContent: "center",
    borderRadius: StyleSheet.BUTTON_RADIUS,
    height: '100%',
    padding: StyleSheet.BORDER_WIDTH
  }

  /**
   * Constructs the content to be displayed inside the button.
   *
   * @returns An array of UINode elements to render inside the button.
   * Subclasses need to implement this method to provide custom content.
   */
  protected abstract constructContent(): UINode[];

  /**
   * Handles the click event for the button.
   *
   * This method is called when the button is clicked. Subclasses should
   * override this method to implement custom click behavior.
   */
  protected onClick(player: Player): void { }

  /**
   * Determines if the button can be clicked.
   *
   * @returns A boolean indicating whether the button is clickable.
   * Subclasses can override this to implement conditional clickability.
   */
  protected canBeClicked(player: Player): boolean { return true; }

  /**
   * Handles the pointer enter event for the button.
   *
   * This method is called when a pointer enters the button area.
   * Subclasses can override this to implement hover effects.
   */
  protected onEnter(player: Player): void { }

  /**
   * Handles the pointer exit event for the button.
   *
   * This method is called when a pointer leaves the button area.
   * Subclasses can override this to reset hover effects.
   */
  protected onExit(player: Player): void { }

  /**
   * Converts the button into a UINode that can be rendered.
   *
   * This method creates a Pressable component with the button's content
   * and event handlers. It handles the logic for when callbacks should be executed.
   *
   * @returns A UINode representing the button.
   */
  public toUINode(): UINode {
    // Get the content for the button
    let children: UIChildren | undefined = this.constructContent();

    // If there's no content, set children to undefined (Pressable API requirement)
    // as passing an empty array will throw an error
    if ((children as UINode[])?.length === 0) {
      children = undefined;
    }

    // Create and return a Pressable component that represents the button
    return Pressable({
      children: Utils.WrapInFlex({ children: children, style: this.flexStyle, borderAsOverlay: false, doubleBorder: false }),
      onClick: (player: Player) => {
        // Skip the click handler if the button can't be clicked
        if (this.canBeClicked(player) === false) return;

        // Execute the onClick callback if it exists
        this.onClick(player);
      },
      onEnter: (player: Player) => {
        // Skip the enter handler if the button can't be clicked
        if (this.canBeClicked(player) === false) return;

        // Execute the onEnter callback if it exists
        this.onEnter(player);
      },
      onExit: (player: Player) => {
        // Execute the onExit callback if it exists
        this.onExit(player);
      },
      style: this.style,
    });
  }
}

/**
 * Abstract base class for local UI components that can be shown/hidden for specific players.
 *
 * The LocalUI class provides core functionality for:
 * - Managing UI visibility states
 * - Handling show/hide events from both local and network sources
 * - Providing a structured initialization flow
 *
 * This class is designed to be pooled and assigned to a specific player during initialization.
 * We recommend using the Asset Pooling gizmo to manage the assignment to players.
 *
 * @template T The type parameter for the UIComponent base class
 */
abstract class LocalUI<T> extends UIComponent<T> {
  /**
   * Optional identifier for this UI component, used to target specific UI instances
   * when showing/hiding panels
   */
  protected id: string | null = null;

  /**
   * Hook method called during UI initialization.
   * Override this in child classes to perform custom post initialization logic.
   * This is called during the initializeUI() method, before the construct() method.
   */
  protected onInitializeUI() { }

  /**
   * Construct and return the UI node structure for this component.
   * This is called during the initializeUI() method.
   *
   * @returns The UI node structure to be rendered
   */
  protected abstract construct(): UINode;

  // Abstract Methods that must be implemented by the child class
  /**
   * This is called once the player has been properly assigned to this component.
   * Which is after initializeUI(), during start().
   */
  protected abstract initialize(): void;

  /**
   * Define the anchor style for positioning this UI component.
   * @returns The ViewStyle object defining positioning and layout
   */
  protected abstract get AnchorStyle(): ViewStyle;

  /**
   * Gets the player that owns this UI component
   * @returns The player instance that owns this component
   */
  public get Player(): hz.Player { return this.entity.owner.get(); }

  /**
   * Gets the identifier for this UI component
   * @returns The component's ID or null if not set
   */
  public get Id(): string | null { return this.id; }

  /**
   * Determines if this UI component should be shown for a specific player.
   * Override in child classes to implement custom visibility logic based
   * on player state or properties.
   *
   * @param player The player to check visibility for
   * @returns True if the UI should be shown for this player, false otherwise
   *
   * @remarks Default implementation always returns true
   */
  public shouldShowForPlayer(player: hz.Player): boolean {
    return true;
  }

  /**
   * Determines if this UI component should respond to an event
   * based on the target player and optional ID
   *
   * @param player The player targeted by the event
   * @param id Optional ID to target a specific UI component
   * @returns True if this component should respond to the event
   */
  public isRecipient(player: hz.Player, id: string | null) {
    return this.Player === player && (id === null || this.Id === id);
  }

  /**
   * Lifecycle method called before start.
   * Sets up event connections and ensures the panel starts hidden.
   */
  public preStart() {
    // Connect to both local and network broadcast events for showing/hiding panels
    this.connectLocalBroadcastEvent(PanelEvents.ShowPanel, this.onReceivedShowPanel.bind(this));
    this.connectLocalBroadcastEvent(PanelEvents.HidePanel, this.onReceivedHidePanel.bind(this));
    this.connectNetworkBroadcastEvent(PanelEvents.ShowPanel, this.onReceivedShowPanel.bind(this));
    this.connectNetworkBroadcastEvent(PanelEvents.HidePanel, this.onReceivedHidePanel.bind(this));

    // Force hide the panel on start, ignoring the the properties of the entity
    // That's because those dispatchable UIs are not meant to be visible before assigned to a player
    this.hide();
  }

  /**
   * Lifecycle method called when the component starts.
   * Initializes the UI if not on the server player.
   */
  public start() {
    // Skip initialization for server player
    if (this.Player == this.world.getServerPlayer()) return;

    // Hide (again) the panel by default after initialization
    this.hide();

    // Call the abstract initialize method that child classes must implement
    this.initialize();
  }

  /**
   * Event handler for ShowPanel events.
   * Shows this panel if it matches the target player and ID.
   *
   * @param param0 Object containing the target player and optional ID
   */
  private onReceivedShowPanel({ player, id }: { player: hz.Player, id: string | null }) {
    // Only respond if this UI is the intended recipient
    if (!this.isRecipient(player, id)) return;

    this.show();
  }

  /**
   * Event handler for HidePanel events.
   * Hides this panel if it matches the target player and ID.
   *
   * @param param0 Object containing the target player and optional ID
   */
  private onReceivedHidePanel({ player, id }: { player: hz.Player, id: string | null }) {
    // Only respond if this UI is the intended recipient
    if (!this.isRecipient(player, id)) return;

    this.hide();
  }

  /**
   * Shows this UI component by setting its visibility to true.
   */
  public show() {
    // Only show the panel if it should be shown for the current player
    if (!this.shouldShowForPlayer(this.Player)) return;

    this.setVisibility(true);
  }

  /**
   * Hides this UI component by setting its visibility to false.
   */
  public hide() {
    this.setVisibility(false);
  }

  /**
   * Sets the visibility state of this UI component and triggers appropriate callbacks.
   *
   * @param visible Whether the component should be visible
   */
  public setVisibility(visible: boolean) {
    // Update the entity's visibility property
    this.entity.visible.set(visible);

    // Call the appropriate lifecycle hook based on visibility
    if (visible) this.onShow();
    else this.onHide();
  }

  /**
   * Hook method called when the UI becomes visible.
   * Override in child classes to perform actions when the UI is shown.
   */
  protected onShow() { }

  /**
   * Hook method called when the UI becomes hidden.
   * Override in child classes to perform actions when the UI is hidden.
   */
  protected onHide() { }

  /**
   * Initializes the UI by wrapping a dynamic list in a centered anchor view.
   * This method is called automatically very early on to create the actual UI structure.
   *
   * @returns The root View for this UI component
   */
  initializeUI() {
    // This very early initialization needs to occur to preload some textures required by the UI
    // Additionally, they need to be called by the server as well
    this.onInitializeUI();

    // If the panel is being initialized for the server player, we won't construct anything
    // Just return an empty view
    if (this.Player == this.world.getServerPlayer()) return View({});

    // Create and return the main view with the constructed UI and specified anchor style
    return View({
      children: this.construct(),
      style: this.AnchorStyle
    });
  }
}

/**
 * Abstract base class for creating UI panels with standardized layout and behavior.
 * Extends LocalUI to inherit basic UI functionality like show/hide, and player assignement.
 */
abstract class Panel extends LocalUI<typeof Panel> {
  /**
   * Defines the properties that can be passed to the Panel component.
   * - id: Unique identifier for the panel
   * - closeIconTexture: Asset for the close button icon
   * - metaCreditsThumbnail: Asset for the Meta Credits icon
   * - spinnerTexture: Asset for a spinner icon
   */
  public static propsDefinition =
    {
      id: { type: hz.PropTypes.String, default: null },
      closeIconTexture: { type: hz.PropTypes.Asset },
      metaCreditsThumbnail: { type: hz.PropTypes.Asset },
      spinnerTexture: { type: hz.PropTypes.Asset },
    };

  /**
   * Style for the main panel view
   */
  private readonly panelStyle: ViewStyle = {
    position: "absolute",
    borderRadius: StyleSheet.RADIUS_SMALL,
    width: StyleSheet.PANEL_WIDTH,
    layoutOrigin: [0.5, 0.5],
  }

  /**
   * Style for the main panel flex
   */
  private readonly panelFlexStyle: ViewStyle = {
    borderRadius: StyleSheet.RADIUS_SMALL,
    display: 'flex',
    flexDirection: "column",
    alignItems: "flex-start",
    width: '100%',
    height: '100%',
    padding: StyleSheet.PADDING_LARGE
  }

  /**
   * Style for the title text
   */
  private readonly titleStyle: TextStyle = {
    color: StyleSheet.TEXT_COLOR_PRIMARY,
    fontSize: StyleSheet.TEXT_SIZE_TITLE,
    fontFamily: StyleSheet.TEXT_FONT_PRIMARY,
    fontWeight: StyleSheet.TEXT_WEIGHT_TITLE,
    lineHeight: StyleSheet.TEXT_SIZE_LINE_HEIGHT
  }

  /**
   * Style for the optional title icon
   */
  private readonly titleIconStyle: ImageStyle = {
    alignSelf: "center",
    marginRight: StyleSheet.GAP_SMALL,
    height: StyleSheet.TEXT_SIZE_TITLE,
    width: StyleSheet.TEXT_SIZE_TITLE,
    tintColor: StyleSheet.TEXT_COLOR_PRIMARY
  }

  /**
   * Style for the header view
   */
  private readonly headerStyle: ViewStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: 'flex-start',
    flexDirection: "row",
    flexGrow: 0,
    marginBottom: StyleSheet.PADDING_LARGE
  }

  /**
   * Style for the footer view
   */
  private readonly footerStyle: ViewStyle = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    flexDirection: "row",
    width: "100%",
    flexGrow: 0,
    marginTop: StyleSheet.PADDING_LARGE,
    marginBottom: StyleSheet.PADDING_LARGE
  }

  /**
   * Flag indicating whether the panel is currently in a busy state.
   * When true, the panel may show loading indicators or disable user interactions.
   */
  private busy: boolean = false;

  /**
   * Array of Button components to be displayed in the panel header.
   */
  protected HeaderButtons: Button[] = [];

  /**
   * Binding for the header buttons data used by the DynamicList component.
   * Updates when setButtons is called.
   */
  private readonly HeaderButtonsData = new Binding<DynamicListItemProxy[]>([]);

  /**
   * ImageSource for the close button icon.
   * Initialized in onInitializeUI from props.
   */
  private closeIcon: ImageSource | null = null;

  /**
   * ImageSource for the Meta Credits icon.
   * Initialized in onInitializeUI from props.
   */
  public metaCreditsIcon: ImageSource | null = null;

  /**
   * ImageSource for the spinner icon used to indicate loading states.
   * Initialized in onInitializeUI from props.
   */
  public spinnerIcon: ImageSource | null = null;

  /**
   * Gets the busy state of the panel.
   * When busy, the panel may show loading indicators or disable interactions.
   *
   * @returns Current busy state as boolean
   */
  public get Busy(): boolean { return this.busy; }

  /**
   * Sets the busy state of the panel.
   * When set to true, the panel may show loading indicators or disable interactions.
   * Calls refreshBindings() to update UI elements that depend on the busy state.
   *
   * @param value - New busy state to set
   */
  public set Busy(value: boolean) {
    // Update the internal busy state
    this.busy = value;

    // Refresh any bindings that might depend on the busy state
    this.refreshBindings();
  }

  /**
   * Returns the style for the anchor element that centers the panel.
   * Used as a positioning reference point.
   */
  protected get AnchorStyle(): ViewStyle {
    return {
      position: "absolute",
      width: 0,
      height: 0,
      left: "50%",
      top: "50%"
    }
  }

  /**
   * Initializes the UI components and assets.
   * Called first in the initializeUI() method.
   */
  protected onInitializeUI() {
    super.onInitializeUI();
    this.id = this.props.id;

    // Convert texture assets to ImageSource objects if provided
    this.closeIcon = this.props.closeIconTexture ? ImageSource.fromTextureAsset(this.props.closeIconTexture as hz.TextureAsset) : null;
    this.metaCreditsIcon = this.props.metaCreditsThumbnail ? ImageSource.fromTextureAsset(this.props.metaCreditsThumbnail as hz.TextureAsset) : null;
    this.spinnerIcon = this.props.spinnerTexture ? ImageSource.fromTextureAsset(this.props.spinnerTexture as hz.TextureAsset) : null;
  }

  /**
   * Renders a button for the header based on the provided ButtonProxy.
   * Used as the renderItem callback for the DynamicList component.
   *
   * @param itemProxy - The ButtonProxy object containing the button index
   * @param _ - Optional index parameter (unused but required by DynamicList interface)
   * @returns A UINode representing the rendered button
   */
  private renderButton(itemProxy: DynamicListItemProxy, _?: number): UINode {
    const buttonIndex = itemProxy.index ?? 0;
    const button = this.HeaderButtons[buttonIndex];
    return button.toUINode();
  }

  /**
   * Sets the buttons to be displayed in the panel header.
   * Updates the HeaderButtonsData binding to reflect the new buttons.
   *
   * @param items - Array of Button components to display in the header
   */
  public setButtons(items: Button[]) {
    // Store the new items
    this.HeaderButtons = items;

    // Update the binding with proxies for each item
    // Each proxy contains just the index of the corresponding item
    // This will trigger the DynamicList to re-render with those items
    this.HeaderButtonsData.set(this.HeaderButtons.map((_, index) => ({ index })));
  }

  /**
   * Constructs the main panel view with specified children and styles.
   * Creates a flex container that will hold the header, content, and footer.
   *
   * @param children - Optional UI elements to include in the panel
   * @returns A UINode representing the panel
   */
  protected constructPanel(children?: UIChildren): UINode {
    // The main panel is a simple flex container that will hold the header,
    // the main content (probably scrollable), and the footer.
    const panel = View({
      children: Utils.WrapInFlex({
        children: children,
        style: this.panelFlexStyle,
        borderAsOverlay: false,
        doubleBorder: true,
        borderStyleOverride: {
          backgroundColor: StyleSheet.PANEL_BACKGROUND_COLOR,
          gradientColorA: StyleSheet.PANEL_BACKGROUND_COLOR_GRADIENT_A,
          gradientColorB: StyleSheet.PANEL_BACKGROUND_COLOR_GRADIENT_B,
          gradientAngle: StyleSheet.PANEL_BACKGROUND_COLOR_GRADIENT_ANGLE
        }
      }),
      style: this.panelStyle
    });

    // We'll wrap this main view in an anchor to center it.
    return panel;
  }

  /**
   * Constructs an exit button with hover effects and click functionality to hide the panel.
   * The button changes background color on hover and closes the panel when clicked.
   *
   * @returns A UINode representing the exit button
   */
  protected constructExitButton(): UINode {
    // Create a binding for the background color to enable hover effects
    const backgroundColor = new Binding<string>(StyleSheet.BUTTON_BACKGROUND_COLOR);
    const children = [
      Image({
        source: this.closeIcon,
        style: {
          alignSelf: "center",
          height: '100%',
          width: '100%',
          tintColor: StyleSheet.TEXT_COLOR_PRIMARY,
        }
      })];

    return Pressable({
      children: Utils.WrapInFlex({
        children: children,
        style: {
          borderRadius: StyleSheet.BUTTON_RADIUS,
          padding: StyleSheet.PADDING_SMALL,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          height: '100%',
          width: '100%',
        },
        borderAsOverlay: true,
        doubleBorder: false
      }),
      onClick: (_: hz.Player) => {
        this.hide();
      },
      onEnter: (_: hz.Player) => {
        backgroundColor.set(StyleSheet.BUTTON_BACKGROUND_COLOR_HOVER);
      },
      onExit: (_: hz.Player) => {
        backgroundColor.set(StyleSheet.BUTTON_BACKGROUND_COLOR);
      },
      style: {
        backgroundColor: backgroundColor,
        borderRadius: StyleSheet.BUTTON_RADIUS,
        height: StyleSheet.BUTTON_SIZE,
        width: StyleSheet.BUTTON_SIZE,
      },
    });
  }

  /**
   * Constructs a header view with a title, optional icon, and an exit button.
   * Also includes any additional buttons set via setButtons().
   *
   * @param title - The title text or binding to display in the header
   * @param icon - Optional icon to display next to the title
   * @returns A UINode representing the header
   */
  protected constructHeader(title: Binding<string> | string, icon: Binding<ImageSource> | ImageSource | undefined): UINode {
    // Build the Header
    const children: UINode[] = [];

    // An optional Header Icon accompanying the title
    if (icon) {
      children.push(Image({ source: icon, style: this.titleIconStyle }));
    }

    // The Title
    children.push(Text({ text: title, style: this.titleStyle }));

    // Separator - flexible space that pushes buttons to the right
    children.push(View({ style: { flex: 1 } }));

    // Additional Buttons - dynamically rendered from HeaderButtonsData
    children.push(DynamicList({ data: this.HeaderButtonsData, renderItem: this.renderButton.bind(this) }));

    // Exit Button - always appears at the end of the header
    children.push(this.constructExitButton());

    // Create the header container with appropriate styling
    const header = View({ children: children, style: this.headerStyle });
    return header;
  }

  /**
   * Constructs a footer view with optional children.
   * The footer is positioned at the bottom of the panel.
   *
   * @param children - Optional UI elements to include in the footer
   * @returns A UINode representing the footer
   */
  protected constructFooter(children?: UINode): UINode {
    const footer = View({ children: children, style: this.footerStyle });
    return footer;
  }

  /**
   * Refreshes all bindings that depend on the panel's state.
   * This method is called when the panel's state changes, such as when the busy state is updated.
   * Override this method in derived classes to update specific bindings as needed.
   */
  protected refreshBindings() {
  }
}

/**
 * Represents an owner of a Grid component that must be a Panel.
 * This type ensures the owner has access to a Grid property.
 */
type GridOwner = Panel & {
  get Grid(): Grid | undefined;
};

/**
 * Represents an item that can be displayed in a grid layout.
 * This abstract class provides the base functionality for all grid items, including:
 * - Visual representation with thumbnail, title, and description
 * - Interactive behavior (click, hover effects)
 * - Animation support for visual feedback
 * - Customizable styling
 */
abstract class Item extends UIElement {
  protected readonly owner: GridOwner;

  /**
   * Controls the opacity of the thumbnail for animation effects.
   * Default value is 0.9 (slightly transparent).
   */
  private readonly opacity: AnimatedBinding = new AnimatedBinding(0.9);

  /**
   * Controls the scale of the thumbnail for animation effects.
   * Default value is 1 (normal size).
   */
  private readonly scale: AnimatedBinding = new AnimatedBinding(1);

  /**
   * Binding that determines if the item can be clicked.
   * This affects visual appearance and interaction behavior.
   * Protected to allow subclasses to access and set this property.
   */
  protected readonly canBeClickedBinding: Binding<boolean> = new Binding(false);

  /**
   * Base style for the item container.
   * Defines the layout direction and dimensions for the item.
   * Uses predefined constants from StyleSheet for consistent sizing.
   */
  private containerStyle: ViewStyle = {
    display: "flex",
    flexDirection: "column",
    width: StyleSheet.ITEM_WIDTH,
    height: StyleSheet.ITEM_HEIGHT
  }

  /**
   * Style definition for the thumbnail image or placeholder.
   * Uses reactive bindings for opacity, scale, and tint color to support dynamic changes.
   */
  private readonly thumbnailStyle: ImageStyle = {
    alignSelf: "center",
    width: "100%",
    height: "100%",
    backgroundColor: StyleSheet.BUTTON_BACKGROUND_COLOR,
    opacity: this.opacity,
    transform: [{ scale: this.scale }],
    tintColor: this.canBeClickedBinding.derive(v => v ? StyleSheet.ITEM_THUMBNAIL_TINT_NORMAL : StyleSheet.ITEM_THUMBNAIL_TINT_GREYED_OUT),
    borderRadius: StyleSheet.ITEM_THUMBNAIL_RADIUS,
    resizeMode: 'cover',
    alignContent: 'center',
    justifyContent: 'center'
  };

  /**
   * Style definition for the pressable container that wraps the thumbnail.
   * Defines the overall appearance of the interactive area.
   */
  private readonly pressableStyle: ViewStyle = {
    backgroundColor: 'transparent',
    borderRadius: StyleSheet.ITEM_THUMBNAIL_RADIUS,
    height: StyleSheet.ITEM_THUMBNAIL_HEIGHT,
    marginBottom: StyleSheet.GAP_MINIMUM,
    overflow: "hidden",
    width: '100%',
  };

  /**
   * Style definition for the pressable flex that handles the layout of
   * the thumbnail.
   */
  private readonly pressableFlexStyle: ViewStyle = {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    overflow: "hidden",
    borderRadius: StyleSheet.ITEM_THUMBNAIL_RADIUS,
  }

  /**
   * Style definition for the item's title text.
   * Uses predefined style constants from StyleSheet.
   */
  private readonly titleStyle: TextStyle = {
    color: StyleSheet.TEXT_COLOR_PRIMARY,
    fontSize: StyleSheet.TEXT_SIZE_ITEM,
    fontFamily: StyleSheet.TEXT_FONT_PRIMARY,
    fontWeight: StyleSheet.TEXT_WEIGHT_ITEM,
    lineHeight: StyleSheet.TEXT_LINEHEIGHT_ITEM,
    textAlign: "center"
  }

  /**
   * Style definition for the item's description text.
   * Uses predefined style constants from StyleSheet.
   */
  private readonly descriptionStyle: TextStyle = {
    color: StyleSheet.TEXT_COLOR_SECONDARY,
    fontSize: StyleSheet.TEXT_SIZE_DESCRIPTION,
    fontFamily: StyleSheet.TEXT_FONT_PRIMARY,
    fontWeight: StyleSheet.TEXT_WEIGHT_DESCRIPTION,
    lineHeight: StyleSheet.TEXT_LINEHEIGHT_DESCRIPTION,
    textAlign: "center"
  }

  /**
   * The title text to display for this item.
   */
  private readonly title: string;

  /**
   * The description text to display for this item.
   */
  private readonly description: string;

  /**
   * Optional image source for the item's thumbnail.
   * If not provided, a placeholder view (empty) will be used instead.
   */
  public readonly thumbnail?: ImageSource;

  /**
   * Constructs an Item instance with the specified properties.
   *
   * @param title - The title of the item to be displayed.
   * @param description - A brief description of the item to be displayed.
   * @param thumbnail - An optional image source for the item's thumbnail. If not provided, a placeholder will be used.
   */
  constructor({
    title,
    description,
    thumbnail,
    owner
  }: {
    title: string;
    description: string;
    thumbnail?: ImageSource;
    owner: GridOwner;
  }) {
    super();
    this.title = title;
    this.description = description;
    this.thumbnail = thumbnail;
    this.owner = owner;
  }

  /**
   * Creates the content for the thumbnail area.
   * If a thumbnail image is provided, it will be displayed.
   * Otherwise, a placeholder view will be created.
   *
   * @returns An array of UINodes representing the thumbnail content.
   */
  protected constructThumbnailContent(): UINode[] {
    const children: UINode[] = [];

    // If the thumbnail is not provided, create a placeholder view
    if (this.thumbnail) {
      children.push(
        Image({
          source: this.thumbnail,
          style: this.thumbnailStyle
        }));
    }
    else {
      children.push(
        View({
          style: this.thumbnailStyle
        }));
    }

    return children;
  }

  /**
   * Handler for click events on the item.
   * This is an empty implementation that should be overridden by subclasses
   * to provide specific behavior when the item is clicked.
   */
  protected onClick(): void { }

  /**
   * Determines whether the item can be clicked.
   * This base implementation always returns true.
   * Subclasses can override this to implement conditional interactivity.
   *
   * @returns A boolean indicating whether the item can be clicked.
   */
  protected canBeClicked(): boolean { return !this.owner.Busy; }

  /**
   * Refreshes the bindings for the item.
   * It should be called whenever the item's state changes to ensure the UI is updated correctly.
   * Additionally, it should be implemented by subclasses to refresh any additional bindings.
   */
  public refreshBindings() {
    this.canBeClickedBinding.set(this.canBeClicked());
  }

  /**
   * Handler for pointer enter events (hover).
   * Animates the thumbnail to become fully opaque and slightly larger,
   * providing visual feedback that the item is being hovered over.
   */
  protected onEnter(): void {
    // Animate the thumbnail to grow and become fully opaque
    this.opacity.set(Animation.timing(1, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    }));
    this.scale.set(Animation.timing(1.1, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    }));
  }

  /**
   * Handler for pointer exit events (end of hover).
   * Animates the thumbnail back to its default state (slightly transparent and normal size).
   */
  protected onExit(): void {
    this.opacity.set(Animation.timing(0.9, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    }));
    this.scale.set(Animation.timing(1, {
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    }));
  }

  /**
   * Creates a pressable UI component containing the thumbnail content.
   * Handles click, enter, and exit events with appropriate callbacks.
   *
   * @returns A UINode representing the pressable thumbnail area.
   */
  private constructThumbnailPressable(): UINode {
    // Create an array to hold all child components
    let children: UIChildren = this.constructThumbnailContent();

    return Pressable({
      children: Utils.WrapInFlex({ children: children, style: this.pressableFlexStyle, borderAsOverlay: true, doubleBorder: true }),
      onClick: (_player: Player) => {
        if (this.canBeClicked() === false) return;

        // Execute the onClick callback if the item can be clicked
        this.onClick();
      },
      onEnter: (_player: Player) => {
        if (this.canBeClicked() === false) return;

        // Execute the onEnter callback if the item can be clicked
        this.onEnter();
      },
      onExit: (_player: Player) => {
        // Execute the onExit callback regardless of clickability
        // This ensures the item returns to its normal state
        this.onExit();
      },
      style: this.pressableStyle
    });
  }

  /**
   * Creates a UINode representing the title of the item.
   * Meant to be overriden if necessary.
   *
   * @returns the UINode representing the title of the item.
   */
  protected constructTitle(): UINode {
    return Text({
      text: this.title,
      style: this.titleStyle
    })
  }

  /**
   * Creates a UINode representing the description of the item.
   * Meant to be overriden if necessary.
   *
   * @returns the UINode representing the description of the item.
   */
  protected constructDescription(): UINode {
    return Text({
      text: this.description,
      style: this.descriptionStyle
    });
  }

  /**
   * Converts the item into a UINode for rendering in a UI grid.
   * Creates a complete item view with thumbnail, title, and description.
   * Calculates appropriate margins based on the item's position in the grid.
   *
   * @param index - The index of the item in the grid, used for margin calculations.
   * @param _numberOfItems - The total number of items in the grid. Not currently used but kept for API compatibility.
   * @returns A UINode representing the complete item view.
   */
  public toUINode(index: number, _numberOfItems: number): UINode {
    // Create an array to hold all child components
    const children: UINode[] = [];

    // Adding Thumbnail as a Pressable
    children.push(
      this.constructThumbnailPressable()
    );

    // Adding Title
    children.push(
      this.constructTitle()
    );

    // Adding Description
    children.push(
      this.constructDescription()
    );

    // Because we don't support the gap property for flex, we'll have to manually add the margins
    // Calculate the number of columns based on available width and item width
    const dimensions = this.computeTableDimensions(_numberOfItems);

    // Last column should not have a right margin
    const expectedRightMargin = index % dimensions.numberOfColumns == (dimensions.numberOfColumns - 1) ? 0 : StyleSheet.GAP_MEDIUM;

    // Last row should not have a bottom margin
    const expectedBottomMargin = index / dimensions.numberOfRows == 1 ? 0 : StyleSheet.GAP_MEDIUM;

    // Create and return the complete item view
    const view = View({
      children: children,
      style:
      {
        ...this.containerStyle,
        marginBottom: expectedBottomMargin,
        marginRight: expectedRightMargin
      }
    });

    return view;
  }

  /**
   * Computes the dimensions of the grid table based on the number of items.
   * Calculates the number of columns and rows depending on the grid's orientation.
   *
   * @param numberOfItems - The total number of items in the grid
   * @returns An object containing the calculated number of columns and rows
   */
  private computeTableDimensions(numberOfItems: number): { numberOfColumns: number, numberOfRows: number } {
    let numberOfColumns = 0;
    let numberOfRows = 0;

    if (this.owner.Grid?.isHorizontal) {
      numberOfRows = Math.max(1, Math.floor(this.owner.Grid.Height / StyleSheet.ITEM_HEIGHT));
      numberOfColumns = Math.floor(numberOfItems / numberOfRows);
    }
    else {
      numberOfColumns = Math.max(1, Math.floor((this.owner.Grid?.Width ?? StyleSheet.ITEM_WIDTH) / StyleSheet.ITEM_WIDTH));
      numberOfRows = Math.floor(numberOfItems / numberOfColumns);
    }

    return { numberOfColumns, numberOfRows };
  }
}

class Spinner extends UIElement {
  /** Binding for the image source displayed in the spinner */
  private readonly image: Binding<ImageSource> = new Binding<ImageSource>(new ImageSource());

  /** AnimatedBinding controlling the spinner's opacity for fade in/out effects */
  private readonly opacity: AnimatedBinding = new AnimatedBinding(0);

  /** AnimatedBinding controlling the spinner's rotation animation */
  private readonly rotation: AnimatedBinding = new AnimatedBinding(0);

  /** View style properties for the spinner container */
  protected readonly style: ViewStyle = {
    width: "auto",
    height: "auto",
    position: "absolute",
    left: "50%",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    layoutOrigin: [0.5, 0.0],
    opacity: this.opacity,
    transform: [{ rotate: this.rotation.interpolate([0, 1], ["0deg", "360deg"]) }]
  }

  /** Style properties for the spinner image */
  private readonly imageStyle: ImageStyle = {
    width: StyleSheet.BUTTON_SIZE,
    height: StyleSheet.BUTTON_SIZE,
    borderRadius: StyleSheet.BUTTON_SIZE / 2
  }

  /**
   * Shows the spinner with specified image.
   *
   * @param image - The image to display in the popup, or null if no image
   */
  public Show(image: ImageSource | null) {
    // Set the image content, defaulting to empty image if undefined
    this.image.set(image ?? new ImageSource());
    // Animate the opacity from 0 to 1
    this.opacity.set(Animation.timing(1, { duration: 200, easing: Easing.ease }),);
    // Start the rotation animation
    this.rotation.set(Animation.repeat(Animation.timing(1, { duration: 1000, easing: Easing.linear }), -1));
  }

  /**
   * Hides the spinner.
   */
  public Hide() {
    // Animate the opacity from 1 to 0
    this.opacity.set(Animation.timing(0, { duration: 400, easing: Easing.ease }),);
  }

  /**
   * Renders the spinner component as a UINode.
   *
   * Creates a View containing an Image with the spinner's current image source
   * and applies the defined styles for positioning and animation.
   *
   * @returns A UINode representing the spinner component
   */
  public toUINode(): UINode {
    const children = [
      Image({ source: this.image, style: this.imageStyle }),
    ];

    return View({ children: children, style: this.style });
  }
}

/**
 * Defines the required interface for an object that can own shop items.
 * The owner must be a Panel and provide a method to check currency entitlements.
 */
type DailyRewardItemOwner = Panel & {
  claimReward(reward: RewardEnrichedData): void;
  get EventState(): DailyRewardsEventState | null;
  get Grid(): Grid | undefined;
};

/**
 * Represents a daily reward item that can be displayed in a grid layout.
 * Extends the base Item class to provide specific functionality for daily rewards.
 * Each item represents a reward that can be claimed on a specific day.
 * Implements the GridItem interface through its parent class.
 */
class DailyRewardItem extends Item {
  /**
   * Style for the price text displayed on the purchase button
   */
  private readonly contentStyle: TextStyle = {
    height: StyleSheet.BUTTON_SIZE,
    fontFamily: StyleSheet.TEXT_FONT_PRIMARY,
    fontWeight: StyleSheet.TEXT_WEIGHT_BUTTON,
    fontSize: StyleSheet.TEXT_SIZE_BUTTON,
    color: StyleSheet.TEXT_COLOR_BRIGHT,
    padding: StyleSheet.PADDING_SMALL,
    marginRight: StyleSheet.PADDING_SMALL,
    marginLeft: StyleSheet.PADDING_SMALL,
    alignSelf: "center",
    textAlignVertical: "center"
  };

  /**
   * Binding for the button color that changes on hover states
   */
  private readonly buttonColor: Binding<string>;

  /**
   * The reward data associated with this item
   */
  private readonly reward: RewardEnrichedData;

  /**
   * Reference to the owner panel that manages this item
   * Must implement getEventState() to provide the current state of daily rewards
   */
  protected readonly owner: DailyRewardItemOwner;

  /**
   * Spinner component used to show loading state during claim
   */
  private spinner: Spinner | null = null;

  /**
   * Binding that tracks whether this reward has been claimed
   * Used to update the UI accordingly
   */
  private readonly hasBeenClaimedBinding: Binding<boolean> = new Binding<boolean>(false);

  /**
   * Binding that tracks whether a button/text should be shown over
   * the thumbnail
   */
  private readonly showButton: Binding<boolean> = new Binding<boolean>(false);

  /**
   * Returns the reward data associated with this item
   * @returns The reward data object
   */
  public get Reward(): RewardEnrichedData { return this.reward; }

  /**
   * Gets the current state of the daily rewards event from the owner
   * @returns The current event state or null if not available
   */
  public get EventState(): DailyRewardsEventState | null { return this.owner.EventState; }

  /**
   * Gets the spinner component used to display loading state during claim
   * @returns The spinner component or null if not initialized
   */
  public get Spinner(): Spinner | null { return this.spinner; }

  /**
   * Creates a new DailyRewardItem
   * @param reward - The reward data to display
   * @param owner - The panel that owns this item and provides event state
   */
  constructor({
    reward,
    owner,
  }: {
    reward: RewardEnrichedData;
    owner: DailyRewardItemOwner;
  }) {
    // Create thumbnail from the reward's texture assets
    const textureAsset = new TextureAsset(reward.thumbnailId, reward.thumbnailVersionId);
    const thumbnail = ImageSource.fromTextureAsset(textureAsset);

    // Initialize the base Item with title, description and thumbnail
    super({ title: "Day " + (reward.day + 1), description: reward.quantity + "x " + reward.name, thumbnail: thumbnail, owner: owner });
    this.reward = reward;
    this.owner = owner;

    // Initialize button color with default dark style
    this.buttonColor = new Binding<string>(StyleSheet.BUTTON_BACKGROUND_COLOR);
  }

  /**
   * Constructs the content to be displayed in the thumbnail area
   * Adds "Claimed" or "Claim" buttons based on the item's state
   * @returns Array of UI nodes to be rendered in the thumbnail area
   */
  protected constructThumbnailContent(): UINode[] {
    // Get the base thumbnail content from parent class
    const thumbnailContent = super.constructThumbnailContent();

    // Create a purchase button with currency icon and price
    const children = [
      // Text
      Text({
        text: this.hasBeenClaimedBinding.derive(b => b ? "Claimed" : "Claim"),
        style: this.contentStyle
      })
    ];

    // Create a purchase button with currency icon and price
    const button = View({
      children: Utils.WrapInFlex({
        children: children,
        style: {
          height: '100%',
          borderRadius: StyleSheet.BUTTON_RADIUS,
          justifyContent: "center",
          flexDirection: "row",
          padding: StyleSheet.BORDER_WIDTH,
        },
        borderAsOverlay: true,
        doubleBorder: false
      }),
      // Style for the purchase button container
      style: {
        position: 'absolute',
        bottom: 0,
        left: "50%",
        layoutOrigin: [0.5, 0],
        marginBottom: StyleSheet.GAP_SMALL,
        backgroundColor: this.buttonColor,
        borderRadius: StyleSheet.BUTTON_RADIUS,
        height: StyleSheet.BUTTON_SIZE,
      }
    });

    // Conditionally add the claim or claimed button if relevant
    thumbnailContent.push(UINode.if(this.showButton, button, undefined));

    // Create a spinner component to show loading state during claim
    this.spinner = new Spinner();
    thumbnailContent.push(this.spinner.toUINode());

    return thumbnailContent;
  }

  /**
   * Determines if this item can be clicked
   * Overrides the parent method to add additional claim condition
   * @returns True if the item can be clicked and claimed, false otherwise
   */
  protected canBeClicked(): boolean {
    return super.canBeClicked() && this.canBeClaimed();
  }

  /**
   * Handles the pointer enter event
   * Changes the button color to hover state
   */
  protected onEnter(): void {
    super.onEnter();
    this.buttonColor.set(this.hasBeenClaimed() ? StyleSheet.BUTTON_BACKGROUND_COLOR_ACCENT : StyleSheet.BUTTON_BACKGROUND_COLOR_HOVER);
  }

  /**
   * Handles the pointer exit event
   * Resets the button color to default state
   */
  protected onExit(): void {
    super.onExit();
    this.buttonColor.set(this.hasBeenClaimed() ? StyleSheet.BUTTON_BACKGROUND_COLOR_ACCENT : StyleSheet.BUTTON_BACKGROUND_COLOR);
  }

  /**
   * Handles the click event
   * Initiates the claim process when the item is clicked
   */
  protected onClick(): void {
    this.claim();
  }

  /**
   * Claims the reward by sending a network event
   * This will notify the server that the player wants to claim this reward
   */
  private claim(): void {
    this.owner.claimReward(this.reward);
  }

  /**
   * Determines if this reward has already been claimed
   * A reward is considered claimed if:
   * - The current day is past this reward's day
   * - The current day matches this reward's day and it has been collected
   * @returns True if the reward has been claimed, false otherwise
   */
  private hasBeenClaimed(): boolean {
    const eventState = this.EventState
    if (eventState == null) {
      return false;
    }

    // If we're past this reward's day, it should be marked as claimed
    if (eventState.currentDay > this.reward.day) {
      return true;
    }

    // If we're on this reward's day, check if it has been collected
    if (eventState.currentDay == this.reward.day) {
      return eventState.hasCollectedToday;
    }

    // For future days, the reward hasn't been claimed
    return false;
  }

  /**
   * Refreshes the bindings for the item.
   * It should be called whenever the item's state changes to ensure the UI is updated correctly.
   */
  public refreshBindings() {
    super.refreshBindings();
    this.hasBeenClaimedBinding.set(this.hasBeenClaimed());
    this.showButton.set(this.canBeClicked() || this.hasBeenClaimed());
    this.buttonColor.set(this.hasBeenClaimed() ? StyleSheet.BUTTON_BACKGROUND_COLOR_ACCENT : StyleSheet.BUTTON_BACKGROUND_COLOR);
  }

  /**
   * Determines if this reward can be claimed
   * A reward can be claimed if:
   * - The current day matches this reward's day and it hasn't been collected yet
   * @returns True if the reward can be claimed, false otherwise
   */
  private canBeClaimed(): boolean {
    const eventState = this.EventState
    if (eventState == null) {
      return false;
    }

    // If we're past this reward's day, it can't be claimed anymore
    if (eventState.currentDay > this.reward.day) {
      return false;
    }

    // If we're on this reward's day, it can be claimed if not already collected
    if (eventState.currentDay == this.reward.day) {
      return !eventState.hasCollectedToday;
    }

    // Future rewards can't be claimed yet
    return false;
  }
}

/**
 * Popup class for displaying temporary notifications with image and text.
 *
 * This class creates customizable popup notifications that can slide in from the bottom
 * of the panel with fade animations. Each popup can contain an optional image and text message.
 *
 * The popup automatically handles its own animations and dismissal after the specified duration.
 */
class Popup extends UIElement {
  /**
   * The image to be displayed in the popup.
   * Uses Binding to allow reactive updates to the image source.
   */
  private readonly image: Binding<ImageSource> = new Binding<ImageSource>(new ImageSource());

  /**
   * The text message to be displayed in the popup.
   * Uses Binding to allow reactive updates to the text content.
   */
  private readonly text: Binding<string> = new Binding<string>("");

  /**
   * Controls the opacity of the popup for fade in/out animations.
   * Uses AnimatedBinding to support smooth transitions.
   */
  private readonly opacity: AnimatedBinding = new AnimatedBinding(0);

  /**
   * Controls the vertical position of the popup for slide in/out animations.
   * Uses AnimatedBinding to support smooth transitions.
   */
  private readonly bottom: AnimatedBinding = new AnimatedBinding(0);

  /**
   * Default popup styling properties.
   * These define the visual appearance of all popup created from this class.
   * The style uses values from the StyleSheet constants for consistency.
   */
  protected readonly style: ViewStyle = {
    backgroundColor: StyleSheet.BUTTON_BACKGROUND_COLOR,
    borderRadius: StyleSheet.RADIUS_SMALL,
    margin: 0,
    padding: StyleSheet.PADDING_SMALL,
    width: "auto",
    height: "auto",
    position: "absolute",
    left: "50%",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    layoutOrigin: [0.5, 0.0],
    opacity: this.opacity,
    bottom: this.bottom
  }

  /**
   * Default styling for the image component in the popup.
   * Sets the dimensions and applies circular border radius.
   */
  private readonly imageStyle: ImageStyle = {
    width: StyleSheet.BUTTON_SIZE,
    height: StyleSheet.BUTTON_SIZE,
    borderRadius: StyleSheet.BUTTON_SIZE / 2
  }

  /**
   * Default styling for the text component in the popup.
   * Defines text appearance properties like color, font, size,
   * and alignment to ensure consistent text presentation.
   */
  private readonly textStyle: TextStyle = {
    color: StyleSheet.TEXT_COLOR_PRIMARY,
    fontFamily: StyleSheet.TEXT_FONT_PRIMARY,
    fontWeight: StyleSheet.TEXT_WEIGHT_BUTTON,
    fontSize: StyleSheet.TEXT_SIZE_BUTTON,
    padding: StyleSheet.PADDING_SMALL,
    alignSelf: "center",
    textAlignVertical: "center"
  }

  /**
   * Shows the popup with specified image, text, and duration.
   *
   * @param image - The image to display in the popup, or undefined if no image
   * @param text - The text message to display in the popup
   * @param duration - How long the popup should remain visible in milliseconds (defaults to 3000ms)
   */
  public Show(image: ImageSource | undefined, text: string, duration: number = 3000) {
    // Set the image content, defaulting to empty image if undefined
    this.image.set(image ?? new ImageSource());
    // Set the text content
    this.text.set(text);
    // Animate the opacity from 0 to 1 (and back) with the specified duration
    this.opacity.set(this.buildAnimation(1, duration));
    // Animate the bottom position to create a sliding up (and back) effect
    this.bottom.set(this.buildAnimation(StyleSheet.PADDING_LARGE, duration));
  }

  /**
   * Builds an animation sequence that animates to a target value and then back to zero.
   *
   * @param target - The target value to animate to (assuming from 0)
   * @param duration - How long to hold at the target value before animating back
   * @returns An Animation sequence that can be applied to a property
   */
  private buildAnimation(target: number, duration: number): Animation {
    return Animation.sequence(
      // First animation: fade/slide in over 200ms
      Animation.timing(target, { duration: 200, easing: Easing.ease }),
      // Second animation: wait for specified duration, then fade/slide out over 400ms
      Animation.delay(duration,
        Animation.timing(0, { duration: 400, easing: Easing.ease })))
  }

  /**
   * Renders the popup as a UINode with image and text components.
   *
   * This method creates the visual representation of the popup by combining
   * an Image component (if an image is provided) and a Text component with
   * the message. These are wrapped in a View with the popup's styling.
   *
   * @returns A UINode representing the complete popup interface
   */
  public toUINode(): UINode {
    const children = [
      Image({ source: this.image, style: this.imageStyle }),
      Text({ text: this.text, style: this.textStyle })
    ];

    return View({ children: children, style: this.style });
  }
}

/**
 * Represents the UI for displaying daily rewards.
 * Extends the Panel class to provide a structured layout for the rewards
 * and handles bespoke UI logic for daily rewards.
 *
 * This component manages:
 * - Display of available rewards in a grid layout
 * - Countdown timer for next available reward
 * - State synchronization with the server
 * - User interactions for claiming rewards
 */
export class DailyRewardsUI extends Panel {
  /**
   * Collection of reward item components displayed in the UI
   */
  private items: DailyRewardItem[] = [];

  /**
   * Grid component that organizes the reward items in a structured layout
   */
  private grid: Grid | undefined = undefined;

  /**
   * Popup used for feedbacks
   */
  private popup: Popup | undefined = undefined;

  /**
   * Current state of the daily rewards event, including claim status and timing information
   */
  private eventState: DailyRewardsEventState | null = null;

  /**
   * Raw reward data received from the server
   */
  private rewards: RewardEnrichedData[] = [];

  /**
   * Binding for the countdown timer text that shows time until next reward
   */
  private remainingTimeText: Binding<string> = new Binding<string>("00:00:00");

  // UI Bindings
  /**
   * Binding for the panel title text
   */
  private readonly title: Binding<string> = new Binding<string>("Daily Rewards");

  /**
   * Binding for the icon displayed next to the title
   */
  private readonly titleIcon: Binding<ImageSource> = new Binding<ImageSource>(new ImageSource());

  /**
   * Returns the current event state for external components to access
   * @returns The current daily rewards event state or null if not yet received
   */
  public get EventState(): DailyRewardsEventState | null { return this.eventState; }

  /**
   * Returns the grid layout component used for organizing items
   * @returns The Grid instance or undefined if not initialized
   */
  public get Grid() { return this.grid; }

  /**
   * Initializes the DailyRewardsUI by setting up event listeners and requesting content.
   * This method is called at Start(), once assigned to a player and after initializeUI().
   * @remarks This method is an implementation of the abstract method in the Panel class.
   */
  protected initialize(): void {
    // Connect to the world update event to handle time-based updates (countdown timer)
    this.connectLocalBroadcastEvent(hz.World.onUpdate, this.update.bind(this));

    // Register network event listeners for server communication
    // These events handle the core data flow between client and server

    // Registering the event listener for receiving the rewards list
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.SendRewardsList, this.onContentReceived.bind(this));
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.BroadcastRewardsList, this.onBroadcastContentReceived.bind(this));

    // Registering the event listener for receiving the event state
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.SendEventState, this.onEventStateReceived.bind(this));

    // Registering the event listener for receiving the receipt after reward claim
    this.connectNetworkBroadcastEvent(DailyRewardsEvents.ClaimRewardResponse, this.onClaimRewardResponseReceived.bind(this));

    // Initiate the data flow by requesting the rewards list from the server
    this.requestContent();
  }

  /**
   * Update method called on each frame to handle time-sensitive operations
   * Currently used to update the countdown timer display
   */
  protected update(): void {
    this.updateRemainingTimeLabel();
  }

  /**
   * Updates the countdown timer display showing time until next reward is available
   * Formats the time as HH:MM:SS and handles edge cases
   */
  private updateRemainingTimeLabel() {
    // If no event state or collection date is available, show placeholder
    if (!this.eventState || !this.eventState.nextCollectionDate) {
      this.remainingTimeText.set('--:--:--');
      return;
    }

    // Calculate time remaining until next collection
    let timeLeft = this.eventState.nextCollectionDate - Date.now();
    if (timeLeft <= 0)
      timeLeft = 0;

    // Convert milliseconds to hours, minutes, seconds
    const hours = Math.floor(timeLeft / 1000 / 60 / 60);
    const minutes = Math.floor(timeLeft / 1000 / 60) % 60;
    const seconds = Math.floor(timeLeft / 1000) % 60;

    // Format the time with leading zeros and update the binding
    this.remainingTimeText.set(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  }

  /**
   * Sends a network request to obtain the rewards list for the current player.
   * This method is responsible for initiating the data retrieval process.
   */
  private requestContent(): void {
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.RequestRewardsList, { player: this.Player, id: this.Id });
  }

  /**
   * Requests the current event state from the server
   * This includes information about claimed rewards and next collection time
   */
  private requestEventState(): void {
    this.Busy = true;
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.RequestEventState, { player: this.Player, id: this.Id });
  }

  /**
   * Handles broadcast content received events by forwarding to the standard content handler
   * This allows the UI to respond to both direct and broadcast messages
   *
   * @param id - The target ID for the broadcast
   * @param metadata - Metadata about the daily rewards event
   * @param rewards - Array of reward data to display
   */
  private onBroadcastContentReceived({ id, metadata, rewards }: { id: string | null, metadata: DailyRewardsMetadata, rewards: RewardEnrichedData[] }): void {
    this.onContentReceived({ player: this.Player, id: id, metadata: metadata, rewards: rewards });
  }

  /**
   * Processes received rewards content from the server
   * Updates the UI with new reward data and refreshes the display
   *
   * @param player - The player this content is intended for
   * @param id - The target ID for the message
   * @param metadata - Metadata about the daily rewards event
   * @param rewards - Array of reward data to display
   */
  private onContentReceived({ player, id, metadata, rewards }: { player: Player, id: string | null, metadata: DailyRewardsMetadata, rewards: RewardEnrichedData[] }): void {
    // Verify this message is intended for this instance
    if (!this.isRecipient(player, id))
      return;

    // Update the title of the panel with metadata from server
    this.title.set(metadata.title);

    // Initialize textures required for the panel
    const iconAsset = new TextureAsset(metadata.titleIconId, metadata.titleIconVersionId);
    this.titleIcon.set(ImageSource.fromTextureAsset(iconAsset));

    // Filter out rewards with empty SKUs and store the valid rewards
    this.rewards = rewards.filter(reward => reward.sku !== "");

    // Update the items array with the new rewards data
    // Reuse existing items when possible to avoid unnecessary recreation
    for (let i = 0; i < this.rewards.length; i++) {
      const reward = this.rewards[i];
      let item = this.items[i];
      if (item == undefined) {
        // Create new item if needed
        item = new DailyRewardItem({
          reward: reward,
          owner: this,
        });

        this.items.push(item);
      }
    }

    // Update the grid with the current items
    // This triggers a re-render of the DynamicList
    this.grid?.setItems(this.items);

    // Request the current event state to update claim status
    this.requestEventState();
  }

  /**
   * Processes event state updates from the server
   * Updates the UI to reflect current claim status and next collection time
   *
   * @param player - The player this state is intended for
   * @param id - The target ID for the message
   * @param eventState - Current state of the daily rewards event
   */
  private onEventStateReceived({ player, id, eventState }: { player: Player, id: string | null, eventState: DailyRewardsEventState | null }): void {
    // Verify this message is intended for this instance
    if (!this.isRecipient(player, id))
      return;

    // Update the stored event state
    this.eventState = eventState;

    this.Busy = false;
  }

  /**
   * Refreshes the bindings for all rewards items
   *
   * This method iterates through all rewards items and calls their refreshBindings method
   * to update their visual state based on current data.
   */
  protected refreshBindings(): void {
    for (const item of this.items) {
      item.refreshBindings();
    }
  }

  /**
   * Initiates the process of claiming a reward
   *
   * This method:
   * 1. Sets the UI to busy state to prevent multiple claims
   * 2. Sends a claim request to the server with player and id
   *
   * @param item - The expected reward to be claimed
   */
  public claimReward(reward: RewardEnrichedData): void {
    // Set UI to busy state to prevent multiple attempts
    this.Busy = true;

    // Show spinner for the item
    const rewardItem = this.items.find(i => i.Reward.day === reward.day);
    rewardItem?.Spinner?.Show(this.spinnerIcon);

    // Send claim request to server with player ID, component ID
    // Note that, actually, we don't specify which reward to claim, the server will figure it out
    this.sendNetworkBroadcastEvent(DailyRewardsEvents.ClaimReward, {
      player: this.Player,  // Current player making the claim
      id: this.Id,          // This component's ID for targeted response
    });
  }

  /**
   * Handles the server response after a reward claim attempt
   * Updates the UI based on the claim result
   *
   * @param player - The player who attempted to claim
   * @param id - The target ID for the message
   * @param eventState - Updated event state after claim attempt
   * @param result - The result (as DailyRewardsClaimResult) of the claim attempt
   */
  private onClaimRewardResponseReceived({ player, id, eventState, result }: { player: hz.Player, id: string | null, eventState: DailyRewardsEventState | null, result: DailyRewardsClaimResult }) {
    // Verify this message is intended for this instance
    if (!this.isRecipient(player, id))
      return;

    // Hide spinner for the item
    const shopItem = this.items.find(i => i.Reward.day === result.reward?.day);
    shopItem?.Spinner?.Hide();

    // Update event state to reflect the new claim status
    this.onEventStateReceived({ player: player, id: id, eventState: eventState });

    if (result.success && result.reward) {
      // Push a popup to show the claim was successful
      const shopItem = this.items.find(shopItem => shopItem.Reward.day === result.reward?.day);
      const thumbnail = shopItem?.thumbnail;
      this.popup?.Show(thumbnail, result.reward.name + " received");
    }

    // We may want to push a popup or handle case when the claim was not successful
  }

  /**
   * Constructs the UI components of the DailyRewardsUI panel.
   * This method builds the header, content, and footer of the panel.
   * @remarks This method is an implementation of the abstract method in the Panel class.
   * @returns The constructed panel UI element
   */
  protected construct() {
    // We're building the three main components of the panel: the header, the content, and the footer.

    // The header contains the title and the title icon.
    const header = this.constructHeader(this.title, this.titleIcon);

    // Create the "Next Reward in" text display for the footer
    const nextRewardIn = [
      Text({
        text: "Next Reward in",
        style: { color: StyleSheet.TEXT_COLOR_SECONDARY, marginRight: StyleSheet.GAP_SMALL, fontSize: StyleSheet.TEXT_SIZE_TITLE, fontFamily: StyleSheet.TEXT_FONT_PRIMARY, fontWeight: StyleSheet.TEXT_WEIGHT_TITLE, lineHeight: StyleSheet.TEXT_SIZE_LINE_HEIGHT }
      }),
      Text({
        text: this.remainingTimeText,
        style: { color: StyleSheet.TEXT_COLOR_PRIMARY, fontSize: StyleSheet.TEXT_SIZE_TITLE, fontFamily: StyleSheet.TEXT_FONT_PRIMARY, fontWeight: StyleSheet.TEXT_WEIGHT_TITLE, lineHeight: StyleSheet.TEXT_SIZE_LINE_HEIGHT }
      })
    ];

    // The footer will contain the next reward time.
    const footer = this.constructFooter(nextRewardIn);

    // The content will contain the grid of items.
    this.grid = new Grid(true, StyleSheet.SCROLLVIEW_WIDTH, StyleSheet.SCROLLVIEW_ONE_LINE_HEIGHT);
    const grid = this.grid.toUINode();

    // The content will contain a popup for feedbacks.
    this.popup = new Popup();
    const popupNode = this.popup.toUINode();

    // Assemble the complete panel with header, content grid, and footer
    return this.constructPanel([header, grid, footer, popupNode]);
  }
}

// Register this component with the Horizon framework
hz.Component.register(DailyRewardsUI);
