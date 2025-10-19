"use client";

import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";

// Стартовый код, который появится в Monaco
const START_CODE = `// Пример:
// await api.moveForward();
// await api.turnRight();
// await api.turnLeft();
// api.log("готово!");

await api.moveForward();
await api.turnRight();
await api.moveForward();
api.log("Готово!");
`;

export default function Playground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);

  const [code, setCode] = useState(START_CODE);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false); // сцена создана и доступна

  useEffect(() => {
    let isMounted = true;

    (async () => {
      // Важно: динамический импорт, чтобы модуль не исполнился на сервере
      const Phaser = await import("phaser");

      class Scene extends Phaser.Scene {
        constructor() {
          super("play");
        }

        // --- параметры мира ---
        tile = 48;
        gridW = 10;
        gridH = 10;

        // --- состояние героя ---
        hero!: Phaser.GameObjects.Rectangle;
        pos = { x: 1, y: 1 }; // координаты в сетке
        facing: "N" | "E" | "S" | "W" = "E"; // направление взгляда

        // --- хелперы ---
        toPX(x: number) {
          return x * this.tile;
        }
        toPY(y: number) {
          return y * this.tile;
        }
        facingDelta(f: Scene["facing"]) {
          switch (f) {
            case "N":
              return { dx: 0, dy: -1 };
            case "E":
              return { dx: 1, dy: 0 };
            case "S":
              return { dx: 0, dy: 1 };
            case "W":
              return { dx: -1, dy: 0 };
          }
        }

        // --- инициализация сцены ---
        create() {
          this.cameras.main.setBackgroundColor(0x0b1220);
          // сетка
          this.add
            .grid(
              0,
              0,
              this.gridW * this.tile,
              this.gridH * this.tile,
              this.tile,
              this.tile,
              0x0e1222,
              0x222a3a
            )
            .setOrigin(0);
          // герой
          this.pos = { x: 1, y: 1 };
          this.facing = "E";
          this.hero = this.add.rectangle(
            this.toPX(this.pos.x),
            this.toPY(this.pos.y),
            40,
            40,
            0x3f7cff
          );
          this.hero.setAngle(0);
        }

        // --- действия героя (используются из api) ---
        async moveForward() {
          const { dx, dy } = this.facingDelta(this.facing);
          const nx = this.pos.x + dx;
          const ny = this.pos.y + dy;

          // границы поля
          if (nx < 0 || ny < 0 || nx >= this.gridW || ny >= this.gridH) {
            return; // игнорируем ход, если упираемся в край
          }

          this.pos = { x: nx, y: ny };
          return new Promise<void>((resolve) =>
            this.tweens.add({
              targets: this.hero,
              x: this.toPX(nx),
              y: this.toPY(ny),
              duration: 200,
              ease: "Sine.easeInOut",
              onComplete: () => resolve(),
            })
          );
        }

        async turnRight() {
          const order = ["N", "E", "S", "W"] as const;
          this.facing = order[(order.indexOf(this.facing) + 1) % 4];
          this.hero.setAngle(this.hero.angle + 90);
        }

        async turnLeft() {
          const order = ["N", "E", "S", "W"] as const;
          this.facing = order[(order.indexOf(this.facing) + 3) % 4];
          this.hero.setAngle(this.hero.angle - 90);
        }

        // Сброс состояния на старт
        reset() {
          this.pos = { x: 1, y: 1 };
          this.facing = "E";
          this.hero.setPosition(this.toPX(1), this.toPY(1));
          this.hero.setAngle(0);
        }
      }

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 480,
        height: 480,
        parent: containerRef.current!,
        scene: new Scene(), // ключ "play"
        backgroundColor: "#0b1220",
      });

      gameRef.current = game;

      // ждём, когда менеджер сцен отдаст инстанс
      const bind = () => {
        if (!isMounted) return;
        const s = game.scene.getScene("play") as Scene | undefined;
        if (s) {
          sceneRef.current = s;
          setReady(true);
        } else {
          requestAnimationFrame(bind);
        }
      };
      bind();
    })();

    return () => {
      isMounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  const pushLog = (msg: unknown) =>
    setLogs((prev) => [...prev, String(msg)].slice(-200));

  async function runCode() {
    if (!ready || !sceneRef.current) {
      pushLog("Сцена ещё не готова");
      return;
    }
    if (running) return;

    setRunning(true);
    setLogs([]);

    // Сброс мира перед каждым запуском
    sceneRef.current.reset();

    // Мини-API для пользовательского кода
    const api = {
      moveForward: () => sceneRef.current.moveForward(),
      turnRight: () => sceneRef.current.turnRight(),
      turnLeft: () => sceneRef.current.turnLeft(),
      log: (m: unknown) => pushLog(m),
    } as const;

    try {
      // Позволяем использовать await в пользовательском коде
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
        ...args: any[]
      ) => (...args: any[]) => Promise<any>;
      const fn = new AsyncFunction("api", code);
      await fn(api);
      pushLog("✅ Готово");
    } catch (e: any) {
      pushLog("Ошибка: " + (e?.message ?? String(e)));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ width: "50%" }}>
        <Editor
          height="480px"
          defaultLanguage="javascript"
          theme="vs-dark"
          value={code}
          onChange={(v) => setCode(v || "")}
          options={{ fontSize: 14, minimap: { enabled: false } }}
        />
        <button
          onClick={runCode}
          disabled={!ready || running}
          style={{ marginTop: 8 }}
        >
          {ready ? (running ? "Выполняется..." : "▶ Запустить") : "Загрузка..."}
        </button>
        <pre>{logs.join("\n")}</pre>
      </div>

      <div
        ref={containerRef}
        style={{ width: 480, height: 480, border: "1px solid #333" }}
      />
    </div>
  );
}