import * as hz from 'horizon/core';
import * as hzui from 'horizon/ui';
import { ProgressionEvents } from './ProgressionSystem';

export class RankUI extends hzui.UIComponent<typeof RankUI> {
  static propsDefinition = {
    progressionSystem: { type: hz.PropTypes.Entity }
  };

  private currentLevel = new hzui.Binding<string>('1');
  private currentXP = new hzui.Binding<string>('0');
  private xpToNextLevel = new hzui.Binding<string>('100');
  private progress = new hzui.Binding<number>(0);

  start() {
    // Transfer UI ownership to the player on join (local mode)
    this.connectCodeBlockEvent(
      this.entity,
      hz.CodeBlockEvents.OnPlayerEnterWorld,
      (player: hz.Player) => {
        this.entity.owner.set(player);
        console.log('[RankUI] UI ownership transferred to', player.name.get());
      }
    );
    if (!this.props.progressionSystem) return;
    this.connectNetworkEvent(
      this.world.getLocalPlayer(),
      ProgressionEvents.progressionUpdated,
      (data) => {
        console.log('[RankUI] Received progressionUpdated:', data);
        this.currentLevel.set(String(data.currentLevel));
        console.log('[RankUI] Set currentLevel:', String(data.currentLevel));
        this.currentXP.set(String(data.currentXP));
        console.log('[RankUI] Set currentXP:', String(data.currentXP));
        this.xpToNextLevel.set(String(data.xpToNextLevel));
        console.log('[RankUI] Set xpToNextLevel:', String(data.xpToNextLevel));
        // Calculate progress as a value between 0 and 1
        const xp = Number(data.currentXP);
        const toNext = Number(data.xpToNextLevel);
        const total = xp + toNext;
        this.progress.set(total > 0 ? xp / total : 0);
        console.log('[RankUI] Set progress:', total > 0 ? xp / total : 0);
      }
    );
    // Award 1 XP every 2 seconds
    this.async.setInterval(() => {
      if (this.props.progressionSystem) {
        this.sendNetworkEvent(
          this.props.progressionSystem,
          ProgressionEvents.xpGained,
          {
            player: this.world.getLocalPlayer(),
            amount: 1,
            source: 'time_played'
          }
        );
      }
    }, 2000);
  }

  initializeUI(): hzui.UINode {
    // Derived bindings for progress bar width and XP text
    const progressWidth = this.progress.derive(p => 180 * p);
    const xpText = hzui.Binding.derive([this.currentXP, this.xpToNextLevel], (xp, toNext) => {
      const xpNum = Number(xp);
      const toNextNum = Number(toNext);
      return `${xpNum} / ${xpNum + toNextNum} XP`;
    });
    // Emblem binding: changes every 5 levels (or by tier in future)
    const emblem = this.currentLevel.derive(level => {
      const lvl = Number(level);
      if (lvl >= 100) return '👑';
      if (lvl >= 75) return '💎';
      if (lvl >= 50) return '🔥';
      if (lvl >= 25) return '⭐';
      if (lvl >= 10) return '🥈';
      if (lvl >= 5) return '🥉';
      return '🔰';
    });
    return hzui.View({
      children: [
        hzui.View({
          children: [
            hzui.Text({
              text: emblem,
              style: {
                fontSize: 28,
                marginRight: 8,
                textAlign: 'center',
                color: '#FFD700'
              }
            }),
            hzui.Text({
              text: this.currentLevel,
              style: {
                fontSize: 28,
                fontWeight: 'bold',
                color: '#FFD700',
                textAlign: 'center',
                marginBottom: 8
              }
            })
          ],
          style: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4
          }
        }),
        // Progress bar background
        hzui.View({
          children: [
            // Progress bar fill (dynamic width)
            hzui.View({
              style: {
                width: progressWidth,
                height: 18,
                backgroundColor: '#FFD700',
                borderRadius: 6
              }
            })
          ],
          style: {
            width: 180,
            height: 18,
            backgroundColor: '#444',
            borderRadius: 6,
            marginBottom: 4
          }
        }),
        // XP Text (dynamic)
        hzui.Text({
          text: xpText,
          style: {
            fontSize: 14,
            color: '#FFF',
            textAlign: 'right',
            width: 180
          }
        })
      ],
      style: {
        width: 240,
        height: 90,
        backgroundColor: '#222',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 10,
        position: 'absolute',
        top: 32,
        alignSelf: 'center',
        zIndex: 1000
      }
    });
  }
}

hz.Component.register(RankUI);