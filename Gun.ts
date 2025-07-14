import LocalCamera from 'horizon/camera';
import * as hz from 'horizon/core';

import {SpawnedAssets, SpawnedAssetsEvents} from 'SpawnedAssets';

export const GunEvents = {
  grantAmmo: new hz.NetworkEvent<{amount: number}>('grantAmmo'),
  takeDamage: new hz.NetworkEvent<{damage: number, source: hz.Entity, locations: hz.Vec3[]}>('takeDamage'),
  setAmmoSource: new hz.LocalEvent<{ source: hz.Entity, loadedAmmo: number, reserveAmmo: number, unlimitedAmmo: boolean, isRightHand: boolean}> ('setAmmoSource'),
  loadedAmmoChanged: new hz.LocalEvent<{ current: number, previous: number}> ('loadedAmmoChanged'),
  reserveAmmoChanged: new hz.LocalEvent<{ current: number, previous: number}> ('reserveAmmoChanged'),
  syncImpactFX: new hz.NetworkEvent<{effects: FXList[]}>('syncImpactFX'),
  syncMissFX: new hz.NetworkEvent<{effects: FXList[]}>('syncMissFX'),
}

type GunState = {
  loadedAmmo: number,
  reserveAmmo: number,
  impactFX: FXList[],
  missFX: FXList[],
}

type GunRaycastHit = {
  hitPos: hz.Vec3,
  sprayAngle: hz.Vec3,
  fireSource: hz.Vec3,
  hit?: hz.RaycastHit,
}

type FXList = {
  fx: hz.ParticleGizmo[],
}

/*
* A gun class that can be used as the basis for creating a variety of ranged weapons.
* Guns are categorized into hitscan or projectile based weapons.
* Guns only work with third person or first person view in XS.
*
* For hit scan weapons:
* -Damage is immediate and accurate
* -Can visualize the bullet path by adding an optional projectile gizmo
* -Best used for fast weapons that require immediate player feedback (such as AR)
* For projectile weapons:
* -Damage is dependent on projectile speed and can be affected by player momentum and gravity
* -Should be used when the grabbable aim rotation/position properties are non-zero
* -Best used for slower projectile weapons (such as a rocket launcher)
*
* To respond to damage:
* -All guns send the same damage network event (GunEvents.takeDamage). Hook into it with a target entity
* or player to respond to damage.
* Ex:
* this.connectNetworkEvent(this.entity, GunEvents.takeDamage, (data) => {
*  // Take damage
* });
* this.connectNetworkEvent(player, GunEvents.takeDamage, (data) => {
*  // Take damage
* });
*
* Other helpful setup tips:
* -All the VFX/SFX can be switched out to whatever you want to use.
* -Only the impact and miss VFX are required to come from an asset template as they must be spawned at run-time.
* -An empty entity with a SpawnedAssets component must be tied to the assetSpawner property for impact/missVFX to work.
* -ammoUI is optional. Feel free to create your own UI to display the current and reserve ammo.
* -If using raycast and projectile launcher together, do not apply an additional grab aim pos/rot to the projectile launcher. This will cause the projectile to be inaccurate.
* -To respond to damage events from a gun, listen to GunEvents.takeDamage event.
*
* How to import/use as an asset template:
* -Dragging an asset with the script attached will bring it into your world automatically
* -Camera and UI APIs must be enabled through Scripts->Settings->API
* -After the asset is in your world, close down and re-open the editor to remove the ScriptModule errors
*/
export class Gun extends hz.Component<typeof Gun> {
  static propsDefinition = {
    attackRate: {type: hz.PropTypes.Number, default: 1000}, // How often this weapon can attack (ms)
    damage: {type: hz.PropTypes.Number, default: 10}, // How much damage this weapon does
    autoAttack: {type: hz.PropTypes.Boolean, default: false}, // Whether or not this weapon continuously attacks when attack input is held
    range: {type: hz.PropTypes.Number, default: 30}, // How far this weapon can hit
    ammoPerFire: {type: hz.PropTypes.Number, default: 1}, // How much ammo is required per fire. 0 means unlimited ammo.
    clipSize: {type: hz.PropTypes.Number, default: 10}, // The max ammount of ammo that can be loaded at any given time
    maxAmmo: {type: hz.PropTypes.Number, default: 30}, // The max amount of ammo that can be carried with this weapon
    startingAmmo: {type: hz.PropTypes.Number, default: 10}, // How much ammo is loaded when the weapon spawns in
    startingReserveAmmo: {type: hz.PropTypes.Number, default: 20}, // How much ammo is in reserves when the weapon spawns in
    autoReload: {type: hz.PropTypes.Boolean, default: false}, // Whether or not this weapon automatically reloads when out of ammo
    bulletBurstPerFire: {type: hz.PropTypes.Number, default: 1}, // How many sequential bullets are fired per fire.
    bulletBurstDelay: {type: hz.PropTypes.Number, default: 100}, // How long to wait between each bullet in a burst (ms).
    bulletSprayAngle: {type: hz.PropTypes.Number, default: 0}, // The firing direction will get randomized between 0 and this amount in the upwards and right axis for each fire.
    assetSpawner: {type: hz.PropTypes.Entity}, // The asset spawner to use for spawning impact and miss effects.
    impactFX: {type: hz.PropTypes.Asset}, // VFX that play when the weapon hits something. Visible to all players.
    missFX: {type: hz.PropTypes.Asset}, // VFX that play when the weapon misses. Visible to all players.
    muzzleFX: {type: hz.PropTypes.Entity}, // VFX that play when the weapon fires. Visible to all players.
    fireSFX: {type: hz.PropTypes.Entity}, // SFX that play when the weapon fires. Audible to all players.
    shellFX: {type: hz.PropTypes.Entity}, // VFX that play when the weapon fires. Visible to the local player only.
    shellSFX: {type: hz.PropTypes.Entity}, // SFX that play when the weapon fires. Audible to the local player only.
    reloadSFX: {type: hz.PropTypes.Entity}, // SFX that play when the weapon reloads. Audible to the local player only.
    pickupSFX: {type: hz.PropTypes.Entity}, // SFX that play when the weapon is picked up. Audible to the local player only.
    outOfAmmoSFX: {type: hz.PropTypes.Entity}, // SFX that play when the weapon is out of ammo. Audible to the local player only.
    raycaster: {type: hz.PropTypes.Entity}, // If this is set, the weapon will default to raycast hit detection.
    projectileLauncher: {type: hz.PropTypes.Entity}, // If this is set (and raycaster is not set), the weapon will default to projectile hit detection.
    projectileSpeed: {type: hz.PropTypes.Number, default: 150}, // How fast the bullet from the projectile launcher travels.
    ammoUI: {type: hz.PropTypes.Entity}, // Optional UI to display current/reserve ammo. AmmoUI entities must implement GunEvents.setAmmoSource/loadedAmmoChanged/reserveAmmoChanged events.
    rightHandIs2HMain: {type: hz.PropTypes.Boolean, default: true}, // Used in VR+multigrab to determine input controls
    is2Handed: {type: hz.PropTypes.Boolean, default: false}, // Used in VR to know when to expect multigrab. If a gun is marked as multigrab in its properties, this value should also get set to true.
    debugHits: {type: hz.PropTypes.Boolean, default: false}, // Set to true to receive console outputs on hit results.
    debugRaycastPos: {type: hz.PropTypes.Entity}, // If set, will position this entity to the hit position of the last raycast fired.
    debugProjPos: {type: hz.PropTypes.Entity}, // If set, will position this entity to the hit position of the last projectile fired.
  };

  private attackInput?: hz.PlayerInput;
  private reloadInput?: hz.PlayerInput;
  private grantAmmo?: hz.EventSubscription;
  private grabStart?: hz.EventSubscription;
  private grabEnd?: hz.EventSubscription;
  private multiGrabStart?: hz.EventSubscription;
  private multiGrabEnd?: hz.EventSubscription;

  private syncImpactFX?: hz.EventSubscription;
  private syncMissFX?: hz.EventSubscription;
  private impactFX: FXList[] = [];
  private missFX: FXList[] = [];
  private nextImpactFXIdx = 0;
  private nextMissFXIdx = 0;

  private muzzleFX?: hz.ParticleGizmo;
  private shellFX?: hz.ParticleGizmo;
  private shellSFX?: hz.AudioGizmo;
  private fireSFX?: hz.AudioGizmo;
  private reloadSFX?: hz.AudioGizmo;
  private pickupSFX?: hz.AudioGizmo;
  private outOfAmmoSFX?: hz.AudioGizmo;

  private raycaster?: hz.RaycastGizmo;

  private projectileLauncher?: hz.ProjectileLauncherGizmo;
  private projHitPlayer?: hz.EventSubscription;
  private projHitEntity?: hz.EventSubscription;
  private projHitWorld?: hz.EventSubscription;
  private projMiss?: hz.EventSubscription;

  private attackCooldown: boolean = false;
  private attackCooldownTimer?: number;

  private reloadTimer?: number;
  private autoAttackTimer?: number;

  private fireDelay?: number;

  private bulletBurstTimer?: number;
  private currentBurstCount: number = 0;

  private _loadedAmmo: number = 0;
  public get loadedAmmo(): number { return this._loadedAmmo; }
  public set loadedAmmo(value: number) {
    const ammoToGrant = Math.min(Math.max(0, this.props.clipSize), value);
    const previous = this.loadedAmmo;
    this._loadedAmmo = Math.max(0, ammoToGrant);
    if(previous != this.loadedAmmo) {
      this.sendLocalEvent(this.entity, GunEvents.loadedAmmoChanged, {current: this.loadedAmmo, previous: previous});
    }
  }

  private _reserveAmmo: number = 0;
  public get reserveAmmo(): number {return this._reserveAmmo;}
  public set reserveAmmo(value: number) {
    const ammoToGrant = Math.min(value, Math.max(0, this.props.maxAmmo) - this.loadedAmmo);
    const previous = this.reserveAmmo;
    this._reserveAmmo = Math.max(0, ammoToGrant);
    if(previous != this.reserveAmmo) {
      this.sendLocalEvent(this.entity, GunEvents.reserveAmmoChanged, {current: this.reserveAmmo, previous: previous});
    }
  }

  public get hasUnlimitedAmmo(): boolean {
    return this.props.ammoPerFire <= 0;
  }

  private _mainHand?: hz.Handedness = undefined;
  public get mainHand(): hz.Handedness | undefined { return this._mainHand; }
  public set mainHand(value: hz.Handedness | undefined) {
    this._mainHand = value;
  }

  preStart() {
    super.preStart();

    this.muzzleFX = this.props.muzzleFX?.as(hz.ParticleGizmo);
    this.shellFX = this.props.shellFX?.as(hz.ParticleGizmo);
    this.shellSFX = this.props.shellSFX?.as(hz.AudioGizmo);
    this.fireSFX = this.props.fireSFX?.as(hz.AudioGizmo);
    this.reloadSFX = this.props.reloadSFX?.as(hz.AudioGizmo);
    this.pickupSFX = this.props.pickupSFX?.as(hz.AudioGizmo);
    this.outOfAmmoSFX = this.props.outOfAmmoSFX?.as(hz.AudioGizmo);
    this.raycaster = this.props.raycaster?.as(hz.RaycastGizmo);
    this.projectileLauncher = this.props.projectileLauncher?.as(hz.ProjectileLauncherGizmo);

    if(!this.raycaster && !this.projectileLauncher) {
      console.error("Gun (" + this.entity.name.get() + ") is missing a raycaster and projectile launcher. Hit detection will not work.");
    }

    this.loadedAmmo = this.props.startingAmmo;
    this.reserveAmmo = this.props.startingReserveAmmo;
  }

  start() {
    this.grabStart = this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnGrabStart, this.onGrabStart.bind(this));
    this.grabEnd = this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnGrabEnd, this.onGrabEnd.bind(this));
    this.multiGrabStart = this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnMultiGrabStart, this.onMultiGrabStart.bind(this));
    this.multiGrabEnd = this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnMultiGrabEnd, this.onMultiGrabEnd.bind(this));

    this.syncImpactFX = this.connectNetworkEvent(
      this.entity,
      GunEvents.syncImpactFX,
      (data) => {
        this.stopFX(this.impactFX);
        this.impactFX = this.syncFX(data.effects, this.impactFX);
      }
    );
    this.syncMissFX = this.connectNetworkEvent(
      this.entity,
      GunEvents.syncMissFX,
      (data) => {
        this.stopFX(this.missFX);
        this.missFX = this.syncFX(data.effects, this.missFX);
      }
    );

    if(this.world.getLocalPlayer() == this.world.getServerPlayer()) {
      this.authSpawnFX();
    }

    if(this.projectileLauncher) {
      this.projHitPlayer = this.connectCodeBlockEvent(this.projectileLauncher, hz.CodeBlockEvents.OnProjectileHitPlayer, this.onProjHitPlayer.bind(this));
      this.projHitEntity = this.connectCodeBlockEvent(this.projectileLauncher, hz.CodeBlockEvents.OnProjectileHitObject, this.onProjHitEntity.bind(this));
      this.projHitWorld = this.connectCodeBlockEvent(this.projectileLauncher, hz.CodeBlockEvents.OnProjectileHitWorld, this.onProjHitWorld.bind(this));
      this.projMiss = this.connectCodeBlockEvent(this.projectileLauncher, hz.CodeBlockEvents.OnProjectileExpired, this.onProjMiss.bind(this));
    }
  }

  dispose() {
    this.attackInput?.disconnect();
    this.reloadInput?.disconnect();

    this.grabStart?.disconnect();
    this.grabEnd?.disconnect();
    this.multiGrabStart?.disconnect();
    this.multiGrabEnd?.disconnect();

    this.projHitPlayer?.disconnect();
    this.projHitEntity?.disconnect();
    this.projHitWorld?.disconnect();
    this.projMiss?.disconnect();

    this.syncImpactFX?.disconnect();
    this.syncMissFX?.disconnect();
    this.impactFX = [];
    this.missFX = [];

    this.grantAmmo?.disconnect();

    this.resetReload();
    this.resetBurst();
    this.resetAutoAttack();

    if(this.fireDelay) {
      this.async.clearTimeout(this.fireDelay);
      this.fireDelay = undefined;
    }
    super.dispose();
  }

  authSpawnFX() {
    if(this.world.getLocalPlayer() != this.world.getServerPlayer()) {
      console.error("Cannot auth spawn FX from a client");
      return;
    }

    if(!this.props.assetSpawner) {
      console.error("Impact and Miss FX require an asset spawner to function.");
      return;
    }

    const foundAssetSpawnerComps = this.props.assetSpawner.getComponents(SpawnedAssets);
    var assetSpawner = foundAssetSpawnerComps ? foundAssetSpawnerComps[0] : undefined;

    if(!assetSpawner) {
      console.error("Asset spawner entity requires a SpawnedAssets component to function.");
      return;
    }

    // Not the biggest fan of this, but there's no way to know in start() if we'll get a receive ownership call or not.
    // For now, just assume that if the assetSpawner has spawned assets, we don't need to spawn them again.
    const hasImpactFX = this.props.impactFX && assetSpawner.hasSpawnedAsset(this.props.impactFX);
    const hasMissFX = this.props.missFX && assetSpawner.hasSpawnedAsset(this.props.missFX);

    if(this.props.impactFX && !hasImpactFX) {
      const spawnImpacts = assetSpawner.spawnAsset(
        this.props.impactFX,
        this.entity.position.get(),
        hz.Quaternion.one,
        hz.Vec3.one,
        1,
      );
      spawnImpacts.then((spawnedAssets) => {
        /*
        * Spawning may happen after the gun entity is assigned ownership to a client.
        * If this happens, we send a network event instead of calling syncFX directly.
        */
        const fxList = this.createFXList(spawnedAssets);
        if(fxList.length > 0) {
          if(this.entity.owner.get() == this.world.getServerPlayer()) {
            this.impactFX = this.syncFX(fxList, this.impactFX);
          }
          else {
            this.sendNetworkEvent(this.entity, GunEvents.syncImpactFX, {effects: fxList});
          }
        }
      }).catch((e) => {
        console.error("Failed to spawn impact FX: " + e);
      });
    }
    if(this.props.missFX && !hasMissFX) {
      const spawnMiss = assetSpawner.spawnAsset(
        this.props.missFX,
        this.entity.position.get(),
        hz.Quaternion.one,
        hz.Vec3.one,
        1,
      );
      spawnMiss.then((spawnedAsset) => {
        const fxList = this.createFXList(spawnedAsset);
        if(fxList.length > 0) {
          if(this.entity.owner.get() == this.world.getServerPlayer()) {
            this.missFX = this.syncFX(fxList, this.missFX);
          }
          else {
            this.sendNetworkEvent(this.entity, GunEvents.syncMissFX, {effects: fxList});
          }
        }
      }).catch((e) => {
        console.error("Failed to spawn miss FX: " + e);
      });
    }
  }

  createFXList(entitiesList: hz.Entity[][]): FXList[] {
    var outFX: FXList[] = [];
    entitiesList.forEach((entities) => {
      var fxList: FXList = {fx: []};
      entities.forEach((entity) => {
        const particle = entity.as(hz.ParticleGizmo);
        if(particle) {
          fxList.fx.push(particle);
        }
      });
      if(fxList.fx.length > 0) {
        outFX.push(fxList);
      }
    });
    return outFX;
  }

  stopFX(spawnedFX: FXList[]) {
    spawnedFX.forEach((spawned) => {
      spawned.fx.forEach((fx) => {
        if(fx.exists()) {
          fx.stop();
        }
      });
    });
  }

  syncFX(spawnedFX: FXList[], existingFX: FXList[]) : FXList[] {
    var fxToDespawn = new Set<hz.Entity>();
    existingFX.forEach((fxList) => {
      fxList.fx.forEach((fx) => {
        fxToDespawn.add(fx);
      });
    });

    spawnedFX.forEach((fxList) => {
      fxList.fx.forEach((fx) => {
        fxToDespawn.delete(fx);
      })
    });

    if(this.props.assetSpawner && fxToDespawn.size > 0) {
      this.sendNetworkEvent(this.props.assetSpawner, SpawnedAssetsEvents.despawnAssets, {rootEntities: Array.from(fxToDespawn)});
    }

    return spawnedFX;
  }

  getImpactFX(): hz.ParticleGizmo[] {
    var fx: hz.ParticleGizmo[] = [];
    if(this.impactFX.length == 0) {
      return fx;
    }

    const index = this.nextImpactFXIdx % this.impactFX.length;
    this.nextImpactFXIdx = index + 1;
    fx = this.impactFX[index].fx;
    fx.forEach((fx) => {
      if(fx.exists()) {
        fx.stop();
      }
    });
    return fx;
  }

  getMissFX(): hz.ParticleGizmo[] {
    var fx: hz.ParticleGizmo[] = [];
    if(this.missFX.length == 0) {
      return fx;
    }

    const index = this.nextMissFXIdx % this.missFX.length;
    this.nextMissFXIdx = index + 1;
    fx = this.missFX[index].fx;
    fx.forEach((fx) => {
      if(fx.exists()) {
        fx.stop();
      }
    });
    return fx;
  }

  triggerFX(position: hz.Vec3, fx: hz.ParticleGizmo[]) {
    fx.forEach((fx) => {
      fx.position.set(position);
      fx.play();
    });
  }

  resetReload() {
    if(this.reloadTimer) {
      this.async.clearTimeout(this.reloadTimer);
      this.reloadTimer = undefined;
    }
  }

  resetBurst() {
    this.currentBurstCount = 0;
    if(this.bulletBurstTimer) {
      this.async.clearInterval(this.bulletBurstTimer);
      this.bulletBurstTimer = undefined;
    }
  }

  resetAutoAttack() {
    if(this.autoAttackTimer) {
      this.async.clearInterval(this.autoAttackTimer);
      this.autoAttackTimer = undefined;
    }
  }

  receiveOwnership(state: GunState | null, fromPlayer: hz.Player, toPlayer: hz.Player) {
    if(state) {
      this.loadedAmmo = state.loadedAmmo;
      this.reserveAmmo = state.reserveAmmo;
      this.impactFX = state.impactFX;
      this.missFX = state.missFX;
    }
  }

  transferOwnership(oldPlayer: hz.Player, newPlayer: hz.Player): GunState {
    this.setPropOwners(newPlayer);
    this.stopFX(this.impactFX);
    this.stopFX(this.missFX);
    if(this.props.assetSpawner) {
      this.sendNetworkEvent(this.props.assetSpawner, SpawnedAssetsEvents.setOwningPlayer, {player: newPlayer});
    }

    return {
      loadedAmmo: this.loadedAmmo,
      reserveAmmo: this.reserveAmmo,
      impactFX: this.impactFX,
      missFX: this.missFX,
    }
  }

  onGrabStart(isRightHand: boolean, player: hz.Player) {
    this.onGrabInitial(isRightHand, player);

    this.grantAmmo = this.connectNetworkEvent(player, GunEvents.grantAmmo, (data) => {
      this.reserveAmmo += data.amount;
      if(this.loadedAmmo < this.props.ammoPerFire && this.props.autoReload) {
        this.triggerReload();
      }
    });
  }

  /*
  * With multigrab, onGrabStart gets called when each hand grabs the gun.
  * There are some init we only want to do on the first grab, which we do here.
  */
  onGrabInitial(isRightHand: boolean, player: hz.Player) {
    if(this.mainHand != undefined) return;

    if(this.props.is2Handed) {
      this.mainHand = this.props.rightHandIs2HMain ? hz.Handedness.Right : hz.Handedness.Left;
    }
    else {
      this.mainHand = isRightHand ? hz.Handedness.Right : hz.Handedness.Left;
    }

    const deviceType = this.entity.owner.get().deviceType.get();
    if(deviceType != hz.PlayerDeviceType.VR || !this.props.is2Handed) {
      this.setupAttackInput();
      this.setupReloadInput();
    }
    this.setupAmmoUI();

    this.pickupSFX?.play({fade: 0, players: [player]});
  }

  onGrabEnd(player: hz.Player) {
    this.resetReload();
    this.resetBurst();
    this.resetAutoAttack();
    this.attackInput?.disconnect();
    this.reloadInput?.disconnect();
    this.grantAmmo?.disconnect();
    this.props.ammoUI?.visible.set(false);
    this.mainHand = undefined;
    this.entity.owner.set(this.world.getServerPlayer());
  }

  onMultiGrabStart(player: hz.Player) {
    if(this.props.is2Handed) {
      this.setupAttackInput();
      this.setupReloadInput();
    }
  }

  onMultiGrabEnd(player: hz.Player) {
    if(this.props.is2Handed) {
      this.attackInput?.disconnect();
      this.reloadInput?.disconnect();
      this.resetReload();
      this.resetBurst();
      this.resetAutoAttack();
    }
  }

  setPropOwners(player: hz.Player) {
    this.props.projectileLauncher?.owner.set(player);
    this.props.raycaster?.owner.set(player);
    this.props.ammoUI?.owner.set(player);
    this.props.muzzleFX?.owner.set(player);
    this.props.shellFX?.owner.set(player);
    this.props.shellSFX?.owner.set(player);
    this.props.fireSFX?.owner.set(player);
    this.props.reloadSFX?.owner.set(player);
    this.props.outOfAmmoSFX?.owner.set(player);
  }

  setupAmmoUI() {
    if(this.props.ammoUI) {
      this.sendLocalEvent(this.props.ammoUI, GunEvents.setAmmoSource, {
        source: this.entity,
        loadedAmmo: this.loadedAmmo,
        reserveAmmo: this.reserveAmmo,
        unlimitedAmmo: this.hasUnlimitedAmmo,
        isRightHand: this.mainHand == hz.Handedness.Right,
      });
    }
    this.props.ammoUI?.visible.set(true);
  }

  setupAttackInput() {
    this.attackInput?.disconnect();
    this.attackInput = hz.PlayerControls.connectLocalInput(
      this.getAttackInputAction(this.mainHand == hz.Handedness.Right),
      hz.ButtonIcon.Fire,
      this
    );
    this.attackInput.registerCallback(this.onInputAttack.bind(this));
  }

  setupReloadInput() {
    this.reloadInput?.disconnect();
    if(!this.hasUnlimitedAmmo) {
      this.reloadInput = hz.PlayerControls.connectLocalInput(
        this.getReloadInputAction(this.mainHand == hz.Handedness.Right),
        hz.ButtonIcon.Reload,
        this
      );
      this.reloadInput.registerCallback(this.onInputReload.bind(this));
    }
  }

  getAttackInputAction(isRightHand: boolean): hz.PlayerInputAction {
    const deviceType = this.entity.owner.get().deviceType.get();
    switch(deviceType) {
      case hz.PlayerDeviceType.VR: {
        return isRightHand ? hz.PlayerInputAction.RightTrigger : hz.PlayerInputAction.LeftTrigger;
      }
      case hz.PlayerDeviceType.Desktop:
        return hz.PlayerInputAction.RightTrigger;
      case hz.PlayerDeviceType.Mobile:
        return hz.PlayerInputAction.RightPrimary;
      default: {
        console.error("Gun (" + this.entity.name.get() + ") will use defaults as it does not support this device type: " + hz.PlayerDeviceType[deviceType]);
        return hz.PlayerInputAction.RightTrigger;
      }
    }
  }

  getReloadInputAction(isRightHand: boolean): hz.PlayerInputAction {
    const deviceType = this.entity.owner.get().deviceType.get();
    switch(deviceType) {
      case hz.PlayerDeviceType.VR: {
        return isRightHand ? hz.PlayerInputAction.RightPrimary : hz.PlayerInputAction.LeftPrimary;
      }
      case hz.PlayerDeviceType.Desktop:
        return hz.PlayerInputAction.RightPrimary;
      case hz.PlayerDeviceType.Mobile:
        return hz.PlayerInputAction.RightSecondary;
      default: {
        console.error("Gun (" + this.entity.name.get() + ") will use defaults as it does not support this device type: " + hz.PlayerDeviceType[deviceType]);
        return hz.PlayerInputAction.RightPrimary;
      }
    }
  }

  onInputAttack(action: hz.PlayerInputAction, pressed: boolean) {
    if(!pressed) {
      this.resetBurst();
      this.resetAutoAttack();
      return;
    }

    this.triggerAttack();
  }

  onInputReload(action: hz.PlayerInputAction, pressed: boolean) {
    if(!pressed) return;

    this.triggerReload();
  }

  public canAttack(): boolean {
    if(this.attackCooldown) {
      return false;
    }

    const ammoPerAttack = Math.max(0, this.props.ammoPerFire);

    if(ammoPerAttack == 0) {
      return true;
    }

    if(ammoPerAttack > this.loadedAmmo) {
      return false;
    }

    return true;
  }

  public triggerAttack() {
    if(!this.canAttack()) {
      this.resetBurst();
      this.resetAutoAttack();

      if(this.loadedAmmo < this.props.ammoPerFire) {
        this.outOfAmmoSFX?.play({fade: 0, players: [this.entity.owner.get()]});
      }

      return;
    }

    if(this.fireDelay) {
      return;
    }

    this.attackCooldown = true;
    if(this.props.ammoPerFire > 0) {
      this.loadedAmmo -= this.props.ammoPerFire;
    }

    if(this.currentBurstCount > 0) {
      this.finishFiring();
    }
    else if(this.entity.owner.get().deviceType.get() == hz.PlayerDeviceType.VR) {
      this.finishFiring();
    }
    else {
      this.entity.owner.get().playAvatarGripPoseAnimationByName(hz.AvatarGripPoseAnimationNames.Fire);
      this.fireDelay = this.async.setTimeout(() => {
        this.finishFiring();
      },50);
    }
  }

  finishFiring() {
    this.fireDelay = undefined;
    this.muzzleFX?.play();
    this.fireSFX?.play();

    if(this.props.ammoPerFire > 0) {
      this.shellSFX?.play({fade: 0, players: [this.entity.owner.get()]});
      this.shellFX?.play({players: [this.entity.owner.get()]});
    }

    if(this.raycaster) {
      this.fireWithRaycast();
    }
    else if(this.projectileLauncher) {
      this.fireWithProjectile();
    }

    if(this.attackCooldownTimer) {
      this.async.clearTimeout(this.attackCooldownTimer);
    }
    this.attackCooldownTimer = this.async.setTimeout(() => {
      this.attackCooldown = false;
      this.attackCooldownTimer = undefined;
    }, Math.max(10, this.props.attackRate));

    if(this.loadedAmmo < this.props.ammoPerFire) {
      this.resetBurst();
      this.resetAutoAttack();
    }
    else {
      this.triggerBurst();
      this.triggerAutoAttack();
    }

    if(this.props.autoReload && this.loadedAmmo == 0) {
      this.resetReload();
      this.reloadTimer = this.async.setTimeout(() => {
        this.reloadTimer = undefined;
        this.triggerReload();
      },500);
    }
  }

  triggerBurst() {
    if(this.props.bulletBurstPerFire <= 1) {
      return;
    }
    if(this.bulletBurstTimer) {
      return;
    }

    if(this.loadedAmmo < this.props.ammoPerFire) {
      return;
    }

    this.currentBurstCount = Math.max(1, this.props.bulletBurstPerFire - 1);

    this.bulletBurstTimer = this.async.setInterval(() => {
      if(this.currentBurstCount == 0) {
        this.resetBurst();
        return;
      }
      this.attackCooldown = false;
      this.triggerAttack();
      this.currentBurstCount--;
    }, this.props.bulletBurstDelay);
  }

  triggerAutoAttack() {
    if(!this.props.autoAttack) {
      return;
    }

    if(this.autoAttackTimer) {
      return;
    }

    this.autoAttackTimer = this.async.setInterval(() => {
      this.attackCooldown = false;
      this.triggerAttack();
    }, this.props.attackRate);
  }

  fireWithRaycast() {
    if(!this.raycaster) {
      console.error("Gun (" + this.entity.name.get() + ") does not have a raycaster set.");
      return;
    }

    const deviceType = this.entity.owner.get().deviceType.get();
    var gunHit: GunRaycastHit;
    switch(deviceType) {
      case hz.PlayerDeviceType.VR: {
        gunHit = this.getRaycastHitVR();
        break;
      }
      case hz.PlayerDeviceType.Desktop:
      case hz.PlayerDeviceType.Mobile:
      default: {
        gunHit = this.getRaycastHit();
        break;
      }
    }

    this.props.debugRaycastPos?.position.set(gunHit.hitPos);

    if(!this.projectileLauncher) {
      if(gunHit.hit) {
        this.triggerFX(gunHit.hitPos, this.getImpactFX());
      }
      else {
        this.triggerFX(gunHit.hitPos, this.getMissFX());
      }
    }
    else {
     /*
     *  With bullet spray, we need to rotate the projectile launcher to account for this spray offset.
     *  The only way to do this currently is to set the local rotation of the launcher.
     *  However, the local rotation doesn't update immediately so we need to wait a few frames for the rotation to take effect
     *  before launching the projectile.
     *
     */
      var distance = gunHit.hitPos.sub(this.projectileLauncher.position.get()).magnitude();
      if(gunHit.hit) {
        distance += 4;
      }
      const duration = distance/this.props.projectileSpeed;
      // For some reason on non-VR things end up reversed so...just multiply by -1.
      const xRadians = deviceType == hz.PlayerDeviceType.VR ? hz.degreesToRadians(gunHit.sprayAngle.x) : hz.degreesToRadians(-gunHit.sprayAngle.x);
      const yRadians = deviceType == hz.PlayerDeviceType.VR ? hz.degreesToRadians(gunHit.sprayAngle.y) : hz.degreesToRadians(-gunHit.sprayAngle.y);
      if(gunHit.sprayAngle.equalsApprox(hz.Vec3.zero, 0.001)) {
        this.projectileLauncher.launch({speed: this.props.projectileSpeed, duration: duration});
      }
      else {
        const xRotation = hz.Quaternion.fromAxisAngle(this.projectileLauncher.up.get(), xRadians);
        const yRotation = hz.Quaternion.fromAxisAngle(this.projectileLauncher.right.get(), yRadians);
        const rotation = hz.Quaternion.mul(xRotation, yRotation);

        this.projectileLauncher.transform.localRotation.set(rotation);
        this.async.setTimeout(() => {
          this.projectileLauncher?.launch({speed: this.props.projectileSpeed, duration: duration});
        },1);
      }
    }

    if(gunHit.hit) {
      if(gunHit.hit.targetType == hz.RaycastTargetType.Player || gunHit.hit.targetType == hz.RaycastTargetType.Entity) {
        this.sendDamageEvent(gunHit.hit.target, [gunHit.hit.hitPoint]);
      }
    }
  }

  fireWithProjectile() {
    if(!this.projectileLauncher) {
      console.error("Gun (" + this.entity.name.get() + ") does not have a projectile launcher set.");
      return;
    }

    const sprayAngle = this.getRandomBulletSprayAngle();
    const xRadians = hz.degreesToRadians(sprayAngle.x);
    const yRadians = hz.degreesToRadians(sprayAngle.y);
    const xRotation = hz.Quaternion.fromAxisAngle(this.projectileLauncher.up.get(), xRadians);
    const yRotation = hz.Quaternion.fromAxisAngle(this.projectileLauncher.right.get(), yRadians);
    const rotation = hz.Quaternion.mul(xRotation, yRotation);
    this.projectileLauncher.transform.localRotation.set(rotation);

    this.async.setTimeout(() => {
      this.projectileLauncher?.launch({speed: this.props.projectileSpeed, duration: this.props.range/this.props.projectileSpeed});
    },1);
  }

  getRaycastHit(): GunRaycastHit {
    var startTraceLoc = this.entity.position.get().add(this.entity.forward.get().mul(0.3));
    var traceDir = this.entity.forward.get().normalize();
    var endTraceLoc = startTraceLoc.add(traceDir.mul(this.props.range));
    var upwardsVec = this.entity.owner.get().up.get();
    var rightVec = upwardsVec.cross(this.entity.forward.get());
    var fireSource = startTraceLoc;

    // Camera only exists on clients
    if(this.world.getLocalPlayer() != this.world.getServerPlayer()) {
      const camLoc = LocalCamera.position.get();
      const camDir = LocalCamera.forward.get();
      const distalLoc = camLoc.add(camDir.mul(1000));
      const toCam = camLoc.sub(distalLoc);
      const toWeapon = this.entity.position.get().sub(distalLoc);
      const weaponToCamProj = toCam.mul(toWeapon.dot(toCam) / toCam.dot(toCam));

      startTraceLoc = distalLoc.add(weaponToCamProj);
      fireSource = startTraceLoc;
      traceDir = camDir;
      endTraceLoc = startTraceLoc.add(traceDir.mul(this.props.range));
      upwardsVec = LocalCamera.up.get();
      rightVec = upwardsVec.cross(LocalCamera.forward.get());
    }

    var sprayAngle = this.getRandomBulletSprayAngle();
    traceDir = this.getSprayDirection(traceDir, sprayAngle.x, sprayAngle.y, upwardsVec, rightVec);
    endTraceLoc = startTraceLoc.add(traceDir.mul(this.props.range));

    if(!this.raycaster) {
      console.error("Gun (" + this.entity.name.get() + ") does not have a raycaster set.");
      return {hitPos: endTraceLoc, sprayAngle: sprayAngle, fireSource: fireSource};
    }

    var traceHit = this.raycaster.raycast(startTraceLoc, traceDir, {maxDistance: this.props.range});

    // Do a second raycast to account for player shooting around a walled corner.
    if(traceHit && this.world.getLocalPlayer() != this.world.getServerPlayer()) {
      startTraceLoc = this.entity.position.get();
      traceDir = traceHit.hitPoint.sub(startTraceLoc);
      traceHit = this.raycaster.raycast(startTraceLoc, traceDir, {maxDistance: traceHit.distance + 1});
    }
    return {hit: traceHit ?? undefined, hitPos: traceHit?.hitPoint ?? endTraceLoc, sprayAngle: sprayAngle, fireSource: fireSource};
  }

  getRaycastHitVR(): GunRaycastHit {
    const startTraceLoc = this.entity.position.get().add(this.entity.forward.get().mul(0.3));
    var traceDir= this.entity.forward.get();
    var endTraceLoc = startTraceLoc.add(traceDir.mul(this.props.range));
    var sprayAngle = hz.Vec3.zero;

    if(!this.raycaster) {
      console.error("Gun (" + this.entity.name.get() + ") does not have a raycaster set.");
      return {hitPos: endTraceLoc, sprayAngle: sprayAngle, fireSource: startTraceLoc};
    }

    sprayAngle = this.getRandomBulletSprayAngle();
    const upwardsVec = this.entity.up.get();
    const rightVec = this.entity.right.get();
    traceDir = this.getSprayDirection(traceDir, sprayAngle.x, sprayAngle.y, upwardsVec, rightVec);
    endTraceLoc = startTraceLoc.add(traceDir.mul(this.props.range));

    const traceHit = this.raycaster.raycast(startTraceLoc, traceDir, {maxDistance: this.props.range});
    return {hit: traceHit ?? undefined, hitPos: traceHit?.hitPoint ?? endTraceLoc, sprayAngle: sprayAngle, fireSource: startTraceLoc};
  }

  getRandomNumberBetween(min: number, max: number) : number {
    return Math.random() * (max - min) + min;
  }

  getRandomBulletSprayAngle(): hz.Vec3 {
    const sprayAngleX = this.getRandomNumberBetween(-this.props.bulletSprayAngle, this.props.bulletSprayAngle);
    const sprayAngleY = this.getRandomNumberBetween(-this.props.bulletSprayAngle, this.props.bulletSprayAngle);
    return new hz.Vec3(sprayAngleX, sprayAngleY, 0);
  }

  getSprayDirection(direction: hz.Vec3, sprayAngleX: number, sprayAngleY: number, upwardsVec: hz.Vec3, rightVec: hz.Vec3): hz.Vec3 {
    const rotateXRadians = hz.degreesToRadians(sprayAngleX);
    const rotateYRadians = hz.degreesToRadians(sprayAngleY);
    const xRotation = hz.Quaternion.fromAxisAngle(upwardsVec, rotateXRadians);
    const yRotation = hz.Quaternion.fromAxisAngle(rightVec, rotateYRadians);
    const combinedRotation = hz.Quaternion.mul(xRotation, yRotation);
    return hz.Quaternion.mulVec3(combinedRotation, direction);
  }

  onProjHitPlayer(playerHit: hz.Player, position: hz.Vec3, normal: hz.Vec3, headshot: boolean) {
    this.props.debugProjPos?.position.set(position);
    this.triggerFX(position, this.getImpactFX());

    if(!this.raycaster) {
      this.sendDamageEvent(playerHit, [position]);
    }
  }

  // Note that projectiles will only hit entities that are animated or interactive
  onProjHitEntity(entityHit: hz.Entity, position: hz.Vec3, normal: hz.Vec3) {
    this.props.debugProjPos?.position.set(position);
    this.triggerFX(position, this.getImpactFX());
    if(!this.raycaster) {
      this.sendDamageEvent(entityHit, [position]);
    }
  }

  onProjHitWorld(position: hz.Vec3, normal: hz.Vec3) {
    this.props.debugProjPos?.position.set(position);
    this.triggerFX(position, this.getImpactFX());
  }

  onProjMiss(position: hz.Vec3, rotation: hz.Quaternion, velocity: hz.Vec3) {
    this.props.debugProjPos?.position.set(position);
    this.triggerFX(position, this.getMissFX());
  }

  sendDamageEvent(target: hz.Entity | hz.Player, locations: hz.Vec3[]){
    this.props.debugHits ? console.log("Gun (" + this.entity.name.get() + ") hit target: " + target.name.get()) : null;
    this.sendNetworkEvent(target, GunEvents.takeDamage, {damage: this.props.damage, source: this.entity, locations: locations});
  }

  public triggerReload() {
    if(this.reloadTimer) return;

    if(this.hasUnlimitedAmmo) return;

    const reloadAmount = Math.min(this.props.clipSize - this.loadedAmmo, this.reserveAmmo);
    if(reloadAmount == 0) return;

    if(reloadAmount < this.props.ammoPerFire) return;

    this.resetBurst();
    this.resetAutoAttack();

    this.reloadTimer = this.async.setTimeout(() => {
      this.reloadTimer = undefined;
    }, 1000);

    this.loadedAmmo += reloadAmount;
    this.reserveAmmo -= reloadAmount;

    this.reloadSFX?.as(hz.AudioGizmo)?.play({fade: 0, players: [this.entity.owner.get()]});
    this.entity.owner.get().playAvatarGripPoseAnimationByName(hz.AvatarGripPoseAnimationNames.Reload);
  }
}
hz.Component.register(Gun);
