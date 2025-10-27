import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import "./GameComponent.scss";

const GameComponent: React.FC = () => {
  const gameRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.NONE,
        parent: gameRef.current,
        width: 320,
        height: 200,
        zoom: 2
      },
      fps: {
        target: 60,
        forceSetTimeOut: true
      },
      scene: {
        preload: function() {
          this.load.image("logo", "/logo192.png");
        },
        create: function() {
          const logo = this.add.image(160, 100, "logo");
          logo.setScale(0.5);
          
          this.add.text(160, 150, "Project Latest Game", {
            fontSize: "16px",
            color: "#ffffff"
          }).setOrigin(0.5);
        }
      }
    };

    phaserGameRef.current = new Phaser.Game(config);

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>Project Latest Game</h2>
        <p>Educational game system</p>
      </div>
      <div ref={gameRef} className="game-canvas" />
    </div>
  );
};

export default GameComponent;