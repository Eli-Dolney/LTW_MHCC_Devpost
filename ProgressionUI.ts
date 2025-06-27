import * as hz from 'horizon/core';
import * as hzui from 'horizon/ui';

export class ProgressionUI extends hzui.UIComponent<typeof ProgressionUI> {
  static propsDefinition = {
    currentLevel: { type: hz.PropTypes.Number, default: 1 }
  };

  initializeUI(): hzui.UINode {
    return hzui.View({
      children: [
        hzui.Text({
          text: `Level: ${this.props.currentLevel}`,
          style: {
            fontSize: 28,
            fontWeight: 'bold',
            color: '#FFD700',
            textAlign: 'center'
          }
        })
      ],
      style: {
        position: 'absolute',
        top: 20, // pixels from the top
        left: '50%',
        transform: [{ translateX: -100 }], // adjust for width, tweak as needed
        width: 200,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center'
      }
    });
  }
}

class MyUI extends hzui.UIComponent<typeof MyUI> {
  static propsDefinition = {};
  initializeUI() {
    return hzui.View({ children: [hzui.Text({ text: 'Hello UI' })] });
  }
}

hz.Component.register(ProgressionUI);
hzui.UIComponent.register(MyUI);