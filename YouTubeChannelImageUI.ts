import * as hz from 'horizon/core';
import { UIComponent, Text, ImageStyle, View } from 'horizon/ui';
import { loadImage2, type UITextureProps } from 'StationAll-CustomUI-Library';

const baseSimpleImage2Style: ImageStyle = { height: 200, width: 400 };

export class YouTubeChannelImageUI extends UIComponent<UITextureProps> {
  static propsDefinition = {
    textureAsset: { type: hz.PropTypes.Asset },
  };

  panelWidth = 450;
  panelHeight = 250;

  initializeUI() {
    return View({
      children: [
        Text({ text: "My YouTube Channel Banner", style: { fontSize: 24, color: "#fff", marginBottom: 10 } }),
        loadImage2(this.props.textureAsset, baseSimpleImage2Style),
      ],
    });
  }
}

hz.Component.register(YouTubeChannelImageUI); 