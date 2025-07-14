import * as hz from 'horizon/core';

export const ProgressionEvents = {
  xpGained: new hz.NetworkEvent<{player: hz.Player, amount: number, source: string, skillType?: string}>('xpGained'),
  levelUp: new hz.LocalEvent<{player: hz.Player, newLevel: number, previousLevel: number, skillType?: string}>('levelUp'),
  progressionUpdated: new hz.NetworkEvent<{player: hz.Player, currentXP: number, currentLevel: number, xpToNextLevel: number, skillType?: string}>('progressionUpdated'),
  skillUnlocked: new hz.LocalEvent<{player: hz.Player, skillName: string, skillType: string}>('skillUnlocked'),
  tierUpgraded: new hz.LocalEvent<{player: hz.Player, newTier: string, previousTier: string}>('tierUpgraded'),
  newIslandDiscovered: new hz.LocalEvent<{player: hz.Player, islandName: string}>('newIslandDiscovered'),
  itemCollected: new hz.LocalEvent<{player: hz.Player, itemName: string, rarity: string}>('itemCollected'),
};

export interface SkillData {
  name: string;
  description: string;
  levelRequired: number;
  xpCost: number;
  unlocked: boolean;
  active: boolean;
  skillType: string;
}

export interface ProgressionData {
  // Overall progression
  overallLevel: number;
  overallXP: number;
  totalPlayTime: number;
  lastSaveTime: number;
  
  // Skill progression
  movementXP: number;
  movementLevel: number;
  explorationXP: number;
  explorationLevel: number;
  combatXP: number;
  combatLevel: number;
  
  // Discovery tracking
  discoveredIslands: Set<string>;
  collectedItems: Set<string>;
  achievements: Set<string>;
  
  // Skills unlocked
  skills: Map<string, SkillData>;
}

export class ProgressionSystem extends hz.Component<typeof ProgressionSystem> {
  static propsDefinition = {
    // Overall progression
    xpPerMinute: { type: hz.PropTypes.Number, default: 5 },
    xpPerLevel: { type: hz.PropTypes.Number, default: 100 },
    maxLevel: { type: hz.PropTypes.Number, default: 100 },
    
    // Skill-specific XP
    xpPerJump: { type: hz.PropTypes.Number, default: 10 },
    xpPerIsland: { type: hz.PropTypes.Number, default: 50 },
    xpPerItem: { type: hz.PropTypes.Number, default: 25 },
    
    // Auto-save
    autoSaveInterval: { type: hz.PropTypes.Number, default: 30000 },
    
    // Time tracking
    timeTrackingInterval: { type: hz.PropTypes.Number, default: 5000 }, // 5 seconds
  };

  private playerData: Map<hz.Player, ProgressionData> = new Map();
  private saveTimer?: hz.EventSubscription;
  private timeTrackingTimer?: hz.EventSubscription;
  private playerJoinTimes: Map<hz.Player, number> = new Map();

  // Skill definitions
  private readonly SKILLS = {
    doubleJump: {
      name: "Double Jump",
      description: "Jump again while in the air",
      levelRequired: 5,
      xpCost: 200,
      skillType: "movement"
    },
    enhancedJump: {
      name: "Enhanced Jump",
      description: "Jump 50% higher",
      levelRequired: 10,
      xpCost: 500,
      skillType: "movement"
    },
    sprintSpeed: {
      name: "Sprint Speed",
      description: "Move 25% faster",
      levelRequired: 15,
      xpCost: 750,
      skillType: "movement"
    },
    glideAbility: {
      name: "Glide",
      description: "Slowly descend while holding jump",
      levelRequired: 20,
      xpCost: 1000,
      skillType: "movement"
    },
    wallJump: {
      name: "Wall Jump",
      description: "Jump off walls",
      levelRequired: 25,
      xpCost: 1500,
      skillType: "movement"
    }
  };

  // Tier definitions
  private readonly TIERS = [
    { name: "Novice", minLevel: 1, color: "#8B8B8B" },
    { name: "Explorer", minLevel: 10, color: "#4CAF50" },
    { name: "Adventurer", minLevel: 25, color: "#2196F3" },
    { name: "Master", minLevel: 50, color: "#FF9800" },
    { name: "Legend", minLevel: 75, color: "#E91E63" },
    { name: "Mythic", minLevel: 100, color: "#9C27B0" }
  ];

  start() {
    console.log('[ProgressionSystem] start() called');
    this.async.setInterval(() => {
      this.trackPlayTime({ deltaTime: 10 });
    }, 10000); // every 10 seconds
  }

  private onUpdate(data: { deltaTime: number }) {
    // Auto-save every 30 seconds
    const currentTime = Date.now();
    this.playerData.forEach((data, player) => {
      if (currentTime - data.lastSaveTime > this.props.autoSaveInterval) {
        this.savePlayerData(player);
        data.lastSaveTime = currentTime;
      }
    });
  }

  private trackPlayTime(data: { deltaTime: number }) {
    console.log('[ProgressionSystem] trackPlayTime called', data);
    const currentTime = Date.now();
    const players = this.world.getPlayers();
    players.forEach(player => {
      if (!this.playerJoinTimes.has(player)) {
        this.playerJoinTimes.set(player, currentTime);
      }
      const joinTime = this.playerJoinTimes.get(player)!;
      const playTime = currentTime - joinTime;
      // Award XP based on xpPerMinute property
      const secondsPlayed = Math.floor(playTime / 1000); // seconds
      if (secondsPlayed > 0) {
        const xpToAward = Math.floor((this.props.xpPerMinute / 60) * secondsPlayed);
        this.addTimeXP(player, xpToAward); // Award calculated XP
        this.playerJoinTimes.set(player, currentTime); // Reset timer
      }
    });
    this.playerJoinTimes.forEach((joinTime, player) => {
      if (!players.includes(player)) {
        this.playerJoinTimes.delete(player);
      }
    });
  }

  public getPlayerData(player: hz.Player): ProgressionData {
    if (!this.playerData.has(player)) {
      // Load saved level from persistent variable if available
      let savedLevel = 1;
      if (this.world.persistentStorage && this.world.persistentStorage.getPlayerVariable) {
        const loaded = this.world.persistentStorage.getPlayerVariable(player, "PlayerGr:Level");
        if (typeof loaded === 'number' && !isNaN(loaded)) {
          savedLevel = loaded;
        }
      }
      const newData: ProgressionData = {
        overallLevel: savedLevel,
        overallXP: 0,
        totalPlayTime: 0,
        lastSaveTime: Date.now(),
        movementXP: 0,
        movementLevel: 1,
        explorationXP: 0,
        explorationLevel: 1,
        combatXP: 0,
        combatLevel: 1,
        discoveredIslands: new Set(),
        collectedItems: new Set(),
        achievements: new Set(),
        skills: new Map()
      };
      
      // Initialize skills
      for (const [skillId, skillDef] of Object.entries(this.SKILLS)) {
        newData.skills.set(skillId, {
          ...skillDef,
          unlocked: false,
          active: false
        });
      }
      
      this.playerData.set(player, newData);
      this.savePlayerData(player);
    }
    return this.playerData.get(player)!;
  }

  public addXP(player: hz.Player, amount: number, source: string, skillType?: string) {
    console.log('[ProgressionSystem] addXP called:', { player: player.name.get(), amount, source, skillType });
    const data = this.getPlayerData(player);
    const previousLevel = data.overallLevel;
    data.overallXP += amount;
    if (skillType) {
      switch (skillType) {
        case 'movement':
          data.movementXP += amount;
          this.checkSkillLevelUp(player, 'movement', data.movementXP, data.movementLevel);
          break;
        case 'exploration':
          data.explorationXP += amount;
          this.checkSkillLevelUp(player, 'exploration', data.explorationXP, data.explorationLevel);
          break;
        case 'combat':
          data.combatXP += amount;
          this.checkSkillLevelUp(player, 'combat', data.combatXP, data.combatLevel);
          break;
      }
    }
    const xpNeededForNextLevel = this.getXPForLevel(data.overallLevel + 1);
    // Debug log for XP math
    console.log('[ProgressionSystem] XP check:', { overallXP: data.overallXP, xpNeededForNextLevel });
    while (data.overallXP >= xpNeededForNextLevel && data.overallLevel < this.props.maxLevel) {
      data.overallLevel++;
      data.overallXP -= xpNeededForNextLevel;
      this.sendLocalEvent(this.entity, ProgressionEvents.levelUp, {
        player: player,
        newLevel: data.overallLevel,
        previousLevel: previousLevel,
        skillType: skillType
      });
      // Sync leaderboard and persistent variable
      const currentPersistentLevel = this.world.persistentStorage.getPlayerVariable(player, "PlayerGr:Level") ?? 1;
      if (data.overallLevel !== currentPersistentLevel) {
        // Update leaderboard (always override)
        this.world.leaderboards.setScoreForPlayer('Level', player, data.overallLevel, true);
        // Update persistent variable
        this.world.persistentStorage.setPlayerVariable(player, "PlayerGr:Level", data.overallLevel);
      }
      this.checkTierUpgrade(player, data.overallLevel);
      this.checkSkillUnlocks(player, data);
    }
    this.sendLocalEvent(this.entity, ProgressionEvents.xpGained, {
      player: player,
      amount: amount,
      source: source,
      skillType: skillType
    });
    // Debug log for progressionUpdated event
    console.log('[ProgressionSystem] Sending progressionUpdated:', {
      player: player.name.get(),
      currentXP: data.overallXP,
      currentLevel: data.overallLevel,
      xpToNextLevel: this.getXPForLevel(data.overallLevel + 1) - data.overallXP,
      skillType: skillType
    });
    this.sendNetworkEvent(player, ProgressionEvents.progressionUpdated, {
      player: player,
      currentXP: data.overallXP,
      currentLevel: data.overallLevel,
      xpToNextLevel: this.getXPForLevel(data.overallLevel + 1) - data.overallXP,
      skillType: skillType
    });
    this.savePlayerData(player);
  }

  private addTimeXP(player: hz.Player, amount: number) {
    this.addXP(player, amount, 'time_played');
  }

  public discoverIsland(player: hz.Player, islandName: string) {
    const data = this.getPlayerData(player);
    
    if (!data.discoveredIslands.has(islandName)) {
      data.discoveredIslands.add(islandName);
      this.addXP(player, this.props.xpPerIsland, 'island_discovery', 'exploration');
      
      this.sendLocalEvent(this.entity, ProgressionEvents.newIslandDiscovered, {
        player: player,
        islandName: islandName
      });
    }
  }

  public collectItem(player: hz.Player, itemName: string, rarity: string = 'common') {
    const data = this.getPlayerData(player);
    
    if (!data.collectedItems.has(itemName)) {
      data.collectedItems.add(itemName);
      const xpMultiplier = this.getItemRarityMultiplier(rarity);
      const xpToAward = this.props.xpPerItem * xpMultiplier;
      
      this.addXP(player, xpToAward, 'item_collection', 'exploration');
      
      this.sendLocalEvent(this.entity, ProgressionEvents.itemCollected, {
        player: player,
        itemName: itemName,
        rarity: rarity
      });
    }
  }

  private getItemRarityMultiplier(rarity: string): number {
    switch (rarity.toLowerCase()) {
      case 'common': return 1;
      case 'uncommon': return 2;
      case 'rare': return 5;
      case 'epic': return 10;
      case 'legendary': return 25;
      default: return 1;
    }
  }

  public awardJumpXP(player: hz.Player) {
    this.addXP(player, this.props.xpPerJump, 'jump_pad', 'movement');
  }

  public unlockSkill(player: hz.Player, skillId: string): boolean {
    const data = this.getPlayerData(player);
    const skill = data.skills.get(skillId);
    
    if (!skill || skill.unlocked) {
      return false;
    }
    
    if (data.overallLevel >= skill.levelRequired && data.overallXP >= skill.xpCost) {
      skill.unlocked = true;
      skill.active = true;
      data.overallXP -= skill.xpCost;
      
      this.sendLocalEvent(this.entity, ProgressionEvents.skillUnlocked, {
        player: player,
        skillName: skill.name,
        skillType: skill.skillType
      });
      
      this.savePlayerData(player);
      return true;
    }
    
    return false;
  }

  public getSkillLevel(player: hz.Player, skillType: string): number {
    const data = this.getPlayerData(player);
    switch (skillType) {
      case 'movement': return data.movementLevel;
      case 'exploration': return data.explorationLevel;
      case 'combat': return data.combatLevel;
      default: return 1;
    }
  }

  public getProgressToNextLevel(player: hz.Player, skillType?: string): number {
    const data = this.getPlayerData(player);
    
    if (skillType) {
      let currentXP: number, currentLevel: number;
      switch (skillType) {
        case 'movement':
          currentXP = data.movementXP;
          currentLevel = data.movementLevel;
          break;
        case 'exploration':
          currentXP = data.explorationXP;
          currentLevel = data.explorationLevel;
          break;
        case 'combat':
          currentXP = data.combatXP;
          currentLevel = data.combatLevel;
          break;
        default:
          return 0;
      }
      
      const xpForCurrentLevel = this.getXPForLevel(currentLevel);
      const xpForNextLevel = this.getXPForLevel(currentLevel + 1);
      return currentXP / (xpForNextLevel - xpForCurrentLevel);
    } else {
      if (data.overallLevel >= this.props.maxLevel) {
        return 1.0;
      }
      
      const xpForCurrentLevel = this.getXPForLevel(data.overallLevel);
      const xpForNextLevel = this.getXPForLevel(data.overallLevel + 1);
      return data.overallXP / (xpForNextLevel - xpForCurrentLevel);
    }
  }

  public getCurrentTier(player: hz.Player): string {
    const data = this.getPlayerData(player);
    let currentTier = this.TIERS[0];
    
    for (const tier of this.TIERS) {
      if (data.overallLevel >= tier.minLevel) {
        currentTier = tier;
      } else {
        break;
      }
    }
    
    return currentTier.name;
  }

  public getAvailableSkills(player: hz.Player): SkillData[] {
    const data = this.getPlayerData(player);
    const available: SkillData[] = [];
    
    for (const skill of Array.from(data.skills.values())) {
      if (data.overallLevel >= skill.levelRequired && !skill.unlocked) {
        available.push(skill);
      }
    }
    
    return available;
  }

  public getUnlockedSkills(player: hz.Player): SkillData[] {
    const data = this.getPlayerData(player);
    return Array.from(data.skills.values()).filter(skill => skill.unlocked);
  }

  private checkSkillLevelUp(player: hz.Player, skillType: string, currentXP: number, currentLevel: number) {
    const xpNeededForNextLevel = this.getXPForLevel(currentLevel + 1);
    if (currentXP >= xpNeededForNextLevel) {
      const data = this.getPlayerData(player);
      
      switch (skillType) {
        case 'movement':
          data.movementLevel++;
          break;
        case 'exploration':
          data.explorationLevel++;
          break;
        case 'combat':
          data.combatLevel++;
          break;
      }
      
      this.sendLocalEvent(this.entity, ProgressionEvents.levelUp, {
        player: player,
        newLevel: data.overallLevel,
        previousLevel: currentLevel,
        skillType: skillType
      });
    }
  }

  private checkTierUpgrade(player: hz.Player, newLevel: number) {
    const currentTier = this.getCurrentTier(player);
    const previousTier = this.getCurrentTier(player); // This would need to be tracked
    
    if (currentTier !== previousTier) {
      this.sendLocalEvent(this.entity, ProgressionEvents.tierUpgraded, {
        player: player,
        newTier: currentTier,
        previousTier: previousTier
      });
    }
  }

  private checkSkillUnlocks(player: hz.Player, data: ProgressionData) {
    for (const [skillId, skill] of Array.from(data.skills.entries())) {
      if (!skill.unlocked && data.overallLevel >= skill.levelRequired) {
        // Auto-unlock skills when level requirement is met
        this.unlockSkill(player, skillId);
      }
    }
  }

  public getXPForLevel(level: number): number {
    // Exponential XP curve: each level requires 1.5x more XP than the previous
    return Math.floor(this.props.xpPerLevel * Math.pow(1.5, level - 1));
  }

  private savePlayerData(player: hz.Player) {
    const data = this.getPlayerData(player);
    // Save to persistent variable for leaderboard linkage
    if (this.world.persistentStorage && this.world.persistentStorage.setPlayerVariable) {
      this.world.persistentStorage.setPlayerVariable(player, "PlayerGr:Level", data.overallLevel);
    }
    console.log(`[ProgressionSystem] Saved data for ${player.name.get()}:`, {
      overallLevel: data.overallLevel,
      overallXP: data.overallXP,
      discoveredIslands: data.discoveredIslands.size,
      collectedItems: data.collectedItems.size,
      unlockedSkills: Array.from(data.skills.values()).filter(s => s.unlocked).length
    });
  }

  dispose() {
    this.saveTimer?.disconnect();
    this.timeTrackingTimer?.disconnect();
    super.dispose();
  }
}

hz.Component.register(ProgressionSystem); 