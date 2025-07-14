import * as hz from 'horizon/core';
import * as hzui from 'horizon/ui';

type Asset = {
  id: string,
  version?: string,
}

export const AmmoUIEvents = {
  setAmmoSource: new hz.LocalEvent<{ source: hz.Entity, loadedAmmo: number, reserveAmmo: number, unlimitedAmmo: boolean, isRightHand: boolean}> ('setAmmoSource'),
  loadedAmmoChanged: new hz.LocalEvent<{ current: number, previous: number}> ('loadedAmmoChanged'),
  reserveAmmoChanged: new hz.LocalEvent<{ current: number, previous: number}> ('reserveAmmoChanged'),
}

function AmmoComponent(displayAmmoUI: hzui.Binding<boolean>, isRightHand: hzui.Binding<boolean>, platform: hzui.Binding<string>,
  loadedAmmo: hzui.Binding<number>, reserveAmmo: hzui.Binding<number>, ammoIconAsset: hzui.Binding<Asset>): hzui.UINode {
    let bottom = hzui.Binding.derive([platform, isRightHand], (platform, isRightHand) => {
      switch(platform) {
        case hz.PlayerDeviceType.VR:
          return isRightHand ? '25%' : '75%';
        case hz.PlayerDeviceType.Mobile:
          return isRightHand ? '21%' : '79%';
        default:
          return isRightHand ? '15%' : '85%';
      }
    });
    let right = hzui.Binding.derive([platform, isRightHand], (platform, isRightHand) => {
      switch(platform) {
        case hz.PlayerDeviceType.VR:
          return isRightHand ? '15%' : '85%';
        case hz.PlayerDeviceType.Mobile:
          return isRightHand ? '21%' : '79%';
        default:
          return isRightHand ? '5%' : '95%';
      }
    });


    return hzui.View({
      children: [
        hzui.Text({ // loaded ammo text
          text: loadedAmmo.derive((loadedAmmo) => loadedAmmo.toString()),
          style: { fontWeight: '600', fontSize: 28, color: 'white' },
        }),
        hzui.Text({
          text: '/',
          style: { fontSize: 28, color: 'white'},
        }),
        hzui.Text({ // reserve ammo text
          text: reserveAmmo.derive((reserveAmmo) => reserveAmmo.toString()),
        style: { fontSize: 28, color: 'white' },
        }),
        hzui.UINode.if(
          ammoIconAsset.derive((asset) => {
            const assetId = BigInt(asset.id);
            return assetId != BigInt(0);
          }),
          hzui.Image({
            source: ammoIconAsset.derive((asset) => {
              return hzui.ImageSource.fromTextureAsset(new hz.TextureAsset(BigInt(asset.id), BigInt(asset.version ?? 0)));
            }),
            style: {width: 42, height: 42},
          })
        )
      ],
      style: {
        display: displayAmmoUI.derive((displayAmmoUI) => displayAmmoUI ? 'flex' : 'none'),
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        bottom: bottom,
        right: right,
      }
    });
}

export class AmmoUI extends hzui.UIComponent<typeof AmmoUI> {
  static propsDefinition = {
    ammoIcon: {type: hz.PropTypes.Asset},
    useLatestIcon: {type: hz.PropTypes.Boolean, default: true},
  };

  private displayAmmoUI = new hzui.Binding<boolean>(false);
  private rightHanded = new hzui.Binding<boolean>(true);
  private playerPlatform = new hzui.Binding<string>(hz.PlayerDeviceType.Desktop);

  private ammoIconAsset = new hzui.Binding<Asset>({id: '0', version: '0'});
  private loadedAmmo = new hzui.Binding<number>(0);
  private reserveAmmo = new hzui.Binding<number>(0);

  private sourceSet?: hz.EventSubscription;
  private handSet?: hz.EventSubscription;
  private loadedAmmoChanged?: hz.EventSubscription;
  private reserveAmmoChanged?: hz.EventSubscription;

  initializeUI(): hzui.UINode {
    if(this.props.ammoIcon) {
      this.ammoIconAsset.set({id: this.props.ammoIcon.id.toString(), version: this.props.useLatestIcon ? '0' : this.props.ammoIcon.versionId.toString()});
    }

    return hzui.View({
      children: [
        AmmoComponent(this.displayAmmoUI, this.rightHanded, this.playerPlatform, this.loadedAmmo, this.reserveAmmo, this.ammoIconAsset),
      ],
      style: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }
    });
  }

  override preStart() {
    if(this.world.getLocalPlayer() != this.world.getServerPlayer()) {
      this.playerPlatform.set(this.entity.owner.get().deviceType.get());
    }

    this.entity.children.get().forEach((child) => {
      child.owner.set(this.entity.owner.get());
    });

    this.sourceSet = this.connectLocalEvent(this.entity, AmmoUIEvents.setAmmoSource, (data) => {
      this.loadedAmmoChanged?.disconnect();
      this.reserveAmmoChanged?.disconnect();
      this.handSet?.disconnect();

      this.loadedAmmoChanged = this.connectLocalEvent(data.source, AmmoUIEvents.loadedAmmoChanged, (data) => {
        this.loadedAmmo.set(Math.max(0, data.current));
      });
      this.reserveAmmoChanged = this.connectLocalEvent(data.source, AmmoUIEvents.reserveAmmoChanged, (data) => {
        this.reserveAmmo.set(Math.max(0, data.current));
      });

      this.loadedAmmo.set(Math.max(0, data.loadedAmmo));
      this.reserveAmmo.set(Math.max(0, data.reserveAmmo));
      this.rightHanded.set(data.isRightHand);

      if(data.unlimitedAmmo) {
        this.displayAmmoUI.set(false);
      }
      else {
        this.displayAmmoUI.set(true);
      }
    });
  }

  start() {
  }

  override dispose() {
    this.sourceSet?.disconnect();
    this.handSet?.disconnect();
    this.loadedAmmoChanged?.disconnect();
    this.reserveAmmoChanged?.disconnect();
    super.dispose();
  }
}
hzui.UIComponent.register(AmmoUI);
