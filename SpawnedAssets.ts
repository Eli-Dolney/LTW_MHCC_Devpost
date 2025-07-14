import * as hz from 'horizon/core';

export const SpawnedAssetsEvents = {
  setOwningPlayer: new hz.NetworkEvent<{player: hz.Player}>('setOwningPlayer'),
  despawnAssets: new hz.NetworkEvent<{rootEntities: hz.Entity[]}>('despawnAssets'),
}

export class SpawnedAssets extends hz.Component<typeof SpawnedAssets> {
  static propsDefinition = {};

  private playerExitWorld?: hz.EventSubscription;
  private setOwningPlayerEvent?: hz.EventSubscription;
  private despawnAssetsEvent?: hz.EventSubscription;
  private owningPlayer?: hz.Player;

  private spawners: hz.SpawnController[] = [];

  start() {
    if(this.world.getLocalPlayer() != this.world.getServerPlayer()) {
      console.error("Spawned Assets should only be used on the server!");
      return;
    }

    this.owningPlayer = this.world.getServerPlayer();
    this.playerExitWorld = this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitWorld, (player: hz.Player) => {
      if(this.owningPlayer == player) {
        this.despawnAll();
      }
    });
    this.setOwningPlayerEvent = this.connectNetworkEvent(this.entity, SpawnedAssetsEvents.setOwningPlayer, (data) => {
      this.setOwningPlayer(data.player);
    });
    this.despawnAssetsEvent = this.connectNetworkEvent(this.entity, SpawnedAssetsEvents.despawnAssets, (data) => {
      data.rootEntities.forEach((rootEntity) => {
        this.despawnAsset(rootEntity);
      });
    });
  }

  dispose() {
    this.playerExitWorld?.disconnect();
    this.setOwningPlayerEvent?.disconnect();
    this.despawnAssetsEvent?.disconnect();
    this.despawnAll();
    super.dispose();
  }

  public spawnAsset(asset: hz.Asset, position: hz.Vec3, rotation: hz.Quaternion, scale: hz.Vec3, count = 1): Promise<hz.Entity[][]> {
    const numberToSpawn = Math.max(1, count);
    const spawnAsyncs: Promise<hz.Entity[]>[] = [];
    for(let i = 0; i < numberToSpawn; ++i) {
      var spawnAsync: Promise<hz.Entity[]> = new Promise((resolve, reject) => {
        const spawner = new hz.SpawnController(asset, position, rotation, scale);
        this.spawners.push(spawner);
        const spawnerPromise = spawner.spawn();
        spawnerPromise.then(() => {
          return resolve(spawner.rootEntities.get());
        }).catch((e) => {
          return reject(e);
        });
      });
      spawnAsyncs.push(spawnAsync);
    }

    return Promise.all(spawnAsyncs);
  }

  public hasSpawnedAssets() {
    return this.spawners.length > 0;
  }

  public hasSpawnedAsset(asset: hz.Asset) {
    var found = false;
    this.spawners.forEach((spawner) => {
      if(spawner.asset.id == asset.id) {
        found = true;
      }
    });
    return found;
  }

  public despawnAsset(rootEntity: hz.Entity) {
    if(!rootEntity.exists()) {
      return;
    }

    var spawnerIdx = -1;
    for(let i = 0; i < this.spawners.length; ++i) {
      const rootEntities = this.spawners[i].rootEntities.get();
      for(let j = 0; j < rootEntities.length; ++j) {
        if(rootEntities[j].id == rootEntity.id) {
          spawnerIdx = i;
          break;
        }
      }

      if(spawnerIdx != -1) {
        break;
      }
    }


    if(spawnerIdx >= 0) {
      this.spawners[spawnerIdx].dispose();
      this.spawners.splice(spawnerIdx, 1);
    }
  }

  public despawnAll() {
    this.spawners.forEach((spawner) => {
      spawner.dispose();
    });
    this.spawners = [];
  }

  public setOwningPlayer(player: hz.Player) {
    this.owningPlayer = player;
  }
}
hz.Component.register(SpawnedAssets);
