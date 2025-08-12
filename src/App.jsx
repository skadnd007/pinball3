import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Matter from "matter-js";

const rand = (min, max) => Math.random() * (max - min) + min;
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];

export default function App() {
  const sceneRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const engineRef = useRef(null);
  const runnerRef = useRef(null);
  const renderRef = useRef(null);
  const afterRenderHandlerRef = useRef(null);
  const hasInitRef = useRef(false);

  const [finishedOrder, setFinishedOrder] = useState([]);
  const [showPodium, setShowPodium] = useState(false);
  const [firstCelebrated, setFirstCelebrated] = useState(false);

  const width = 800;
  const height = 600;
  const finishY = height - 40;

  const cleanupWorld = () => {
    try {
      if (renderRef.current && afterRenderHandlerRef.current) {
        Matter.Events.off(renderRef.current, "afterRender", afterRenderHandlerRef.current);
      }
      if (renderRef.current) {
        Matter.Render.stop(renderRef.current);
        if (renderRef.current.canvas && renderRef.current.canvas.remove) {
          renderRef.current.canvas.remove();
        }
        renderRef.current.textures = {};
        renderRef.current = null;
      }
      if (runnerRef.current) {
        Matter.Runner.stop(runnerRef.current);
        runnerRef.current = null;
      }
      if (engineRef.current) {
        Matter.World.clear(engineRef.current.world, false);
        Matter.Engine.clear(engineRef.current);
        engineRef.current = null;
      }
    } catch (e) {
      console.error("cleanup error", e);
    }
  };

  const resetWorld = () => {
    cleanupWorld();
    setFinishedOrder([]);
    setShowPodium(false);
    setFirstCelebrated(false);

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      overlay.width = width;
      overlay.height = height;
      overlay.style.width = width + "px";
      overlay.style.height = height + "px";
    }

    const engine = Matter.Engine.create({ enableSleeping: false });
    const world = engine.world;
    world.gravity.y = 1.1;
    engineRef.current = engine;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.className = "rounded-2xl shadow-lg bg-white";
    if (sceneRef.current) {
      sceneRef.current.innerHTML = "";
      sceneRef.current.appendChild(canvas);
    }

    const render = Matter.Render.create({
      engine,
      canvas,
      options: {
        width,
        height,
        wireframes: false,
        background: "#0f172a"
      }
    });
    renderRef.current = render;

    const thickness = 50;
    const ground = Matter.Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, {
      isStatic: true,
      render: { fillStyle: "#1e293b" }
    });
    const ceiling = Matter.Bodies.rectangle(width / 2, -thickness / 2, width, thickness, {
      isStatic: true,
      render: { fillStyle: "#1e293b" }
    });
    const leftWall = Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height, {
      isStatic: true,
      render: { fillStyle: "#1e293b" }
    });
    const rightWall = Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, {
      isStatic: true,
      render: { fillStyle: "#1e293b" }
    });

    const finish = Matter.Bodies.rectangle(width / 2, finishY, width - 40, 6, {
      isStatic: true,
      isSensor: true,
      label: "finish",
      render: { fillStyle: "#f8fafc" }
    });

    const pegs = [];
    const pegRows = 5;
    const pegCols = 9;
    const pegRadius = 7;
    const offsetY = 140;
    const spacingX = (width - 120) / (pegCols - 1);
    const spacingY = 70;

    for (let r = 0; r < pegRows; r++) {
      for (let c = 0; c < pegCols; c++) {
        const x = 60 + c * spacingX + (r % 2 ? spacingX / 2 : 0);
        const y = offsetY + r * spacingY;
        const peg = Matter.Bodies.circle(x, y, pegRadius, {
          isStatic: true,
          restitution: 0.9,
          friction: 0,
          render: {
            fillStyle: "#334155",
            strokeStyle: "#64748b",
            lineWidth: 1
          }
        });
        pegs.push(peg);
      }
    }

    const bumpers = [
      Matter.Bodies.circle(width * 0.25, height * 0.55, 24, {
        isStatic: true,
        restitution: 1.2,
        render: { fillStyle: "#0ea5e9" }
      }),
      Matter.Bodies.circle(width * 0.75, height * 0.5, 24, {
        isStatic: true,
        restitution: 1.2,
        render: { fillStyle: "#ef4444" }
      })
    ];

    const paddles = [
      Matter.Bodies.rectangle(width * 0.2, height * 0.75, 160, 12, {
        isStatic: true,
        angle: -0.4,
        render: { fillStyle: "#16a34a" }
      }),
      Matter.Bodies.rectangle(width * 0.8, height * 0.78, 160, 12, {
        isStatic: true,
        angle: 0.45,
        render: { fillStyle: "#f97316" }
      })
    ];

    const balls = Array.from({ length: 5 }).map((_, i) => {
      const x = 120 + i * 120;
      const y = 60;
      const ball = Matter.Bodies.circle(x, y, 12, {
        restitution: 0.85,
        friction: 0.01,
        frictionAir: 0.002,
        label: `ball_${i}`,
        render: {
          fillStyle: COLORS[i],
          strokeStyle: "#ffffff",
          lineWidth: 1.5
        }
      });
      Matter.Body.setVelocity(ball, { x: Math.random() * 4 - 2, y: 1 + Math.random() * 2 });
      return ball;
    });

    Matter.World.add(world, [ground, ceiling, leftWall, rightWall, finish, ...pegs, ...bumpers, ...paddles, ...balls]);

    Matter.Events.on(engine, "collisionStart", (evt) => {
      for (const pair of evt.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes("finish")) {
          const other = pair.bodyA.label === "finish" ? pair.bodyB : pair.bodyA;
          if (other.label && other.label.startsWith("ball_")) {
            const id = parseInt(other.label.split("_")[1], 10);
            setFinishedOrder((prev) => {
              if (prev.some((p) => p.id === id)) return prev;
              const next = [...prev, { id, color: COLORS[id], time: performance.now() }];
              return next;
            });
          }
        }
      }
    });

    const runner = Matter.Runner.create();
    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);
    runnerRef.current = runner;

    const ctx = render.context;
    const drawOverlay = () => {
      ctx.save();
      ctx.fillStyle = "#94a3b8";
      ctx.globalAlpha = 0.4;
      ctx.fillRect(20, finishY - 8, width - 40, 16);
      ctx.restore();

      ctx.save();
      ctx.font = "14px ui-sans-serif, system-ui";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText("START", 20, 24);
      ctx.fillText("FINISH", 20, finishY - 12);
      ctx.restore();
    };
    afterRenderHandlerRef.current = drawOverlay;
    Matter.Events.on(render, "afterRender", drawOverlay);
  };

  const fireworksRef = useRef({ particles: [] });
  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = width;
      overlayCanvasRef.current.height = height;
      overlayCanvasRef.current.style.width = width + "px";
      overlayCanvasRef.current.style.height = height + "px";
    }
    resetWorld();
    return () => {
      cleanupWorld();
    };
  }, []);

  useEffect(() => {
    if (!firstCelebrated && finishedOrder.length === 1) {
      setFirstCelebrated(true);
      const cx = Math.max(120, Math.min(800 - 120, 400));
      const cy = finishY - 60;
      spawnFireworks(cx, cy);
    }
    if (finishedOrder.length === 5) {
      const t = setTimeout(() => setShowPodium(true), 1300);
      return () => clearTimeout(t);
    }
  }, [finishedOrder]);

  const spawnFireworks = (cx, cy) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    const particles = [];
    for (let i = 0; i < 120; i++) {
      const angle = (Math.PI * 2 * i) / 120;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * rand(2, 5),
        vy: Math.sin(angle) * rand(2, 5),
        life: rand(35, 70),
        color: `hsl(${Math.floor(rand(0, 360))}, 80%, 60%)`
      });
    }
    fireworksRef.current.particles = particles;
    let frame;
    const tick = () => {
      const ctx2 = ctx;
      ctx2.clearRect(0, 0, overlay.width, overlay.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 1;
        ctx2.globalAlpha = Math.max(p.life / 70, 0);
        ctx2.fillStyle = p.color;
        ctx2.beginPath();
        ctx2.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx2.fill();
      });
      fireworksRef.current.particles = particles.filter((p) => p.life > 0);
      if (fireworksRef.current.particles.length > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        ctx2.clearRect(0, 0, overlay.width, overlay.height);
        cancelAnimationFrame(frame);
      }
    };
    tick();
  };

  const ranking = [...finishedOrder].sort((a, b) => a.time - b.time);

  const startRace = () => resetWorld();
  const resetRace = () => resetWorld();

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="w-[920px] max-w-full">
        <h1 className="text-2xl font-semibold mb-3">Pinball Race — 5 Balls</h1>
        <p className="text-sm text-slate-300 mb-4">
          모든 공 5개가 동시에 출발합니다. 먼저 결승선을 통과한 공은 축포가 터지고,
          모든 공이 결승선을 통과하면 포디움 화면으로 전환됩니다.
        </p>

        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-12 lg:col-span-9 relative">
            <div ref={sceneRef} className="relative"></div>
            <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0" style={{ width: width + 'px', height: height + 'px' }}></canvas>
            <AnimatePresence>
              {showPodium && (
                <motion.div
                  className="absolute inset-0 bg-slate-900/95 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Podium ranking={ranking} onReset={resetRace} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="col-span-12 lg:col-span-3 space-y-3">
            <div className="p-4 rounded-xl bg-slate-800 shadow">
              <div className="text-sm font-medium mb-2">컨트롤</div>
              <div className="flex gap-2">
                <button
                  onClick={startRace}
                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium shadow"
                >
                  레이스 시작
                </button>
                <button
                  onClick={resetRace}
                  className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium"
                >
                  리셋
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800 shadow">
              <div className="text-sm font-medium mb-2">실시간 순위</div>
              <ol className="text-sm space-y-1">
                {ranking.length === 0 && (
                  <li className="text-slate-400">아직 결승선을 통과한 공이 없습니다.</li>
                )}
                {ranking.map((r, idx) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="inline-block w-5 text-right tabular-nums">{idx + 1}.</span>
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: r.color }} />
                    <span>Ball {r.id + 1}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-4 rounded-xl bg-slate-800 shadow">
              <div className="text-sm font-medium mb-2">Tip</div>
              <p className="text-xs text-slate-300 leading-relaxed">
                장애물 배치를 바꾸고 싶다면 코드의 <code>pegs</code>, <code>bumpers</code>, <code>paddles</code> 생성 부분을 수정하세요.
                물리 감각은 <code>restitution</code>, <code>friction</code>, <code>gravity</code>로 조절합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Podium({ ranking, onReset }) {
  const steps = [
    { place: 1, h: 220 },
    { place: 2, h: 170 },
    { place: 3, h: 140 }
  ];
  const winners = ranking.slice(0, 3);

  return (
    <div className="w-full max-w-2xl mx-auto p.6">
      <motion.h2
        className="text-center text-3xl font-bold mb-6"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        결과 포디움
      </motion.h2>

      <div className="grid grid-cols-3 gap-6 h-[260px] items-end">
        {steps.map((s, i) => {
          const winner = winners.find((_, idx) => idx + 1 === s.place);
          const color = winner ? winner.color : "#475569";
          const label = winner ? `Ball ${winner.id + 1}` : "—";
          return (
            <motion.div
              key={s.place}
              className="rounded-2xl bg-slate-800 flex flex-col items-center justify-end"
              style={{ height: s.h }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 18, delay: i * 0.1 }}
            >
              <motion.div
                className="w-full rounded-2xl"
                style={{ background: color, height: 10 }}
                initial={{ width: "10%" }}
                animate={{ width: "100%" }}
              />
              <div className="py-4 text-center">
                <div className="text-sm text-slate-300">{s.place}위</div>
                <div className="font-semibold">{label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-slate-800">
        <div className="text-sm text-slate-300 mb-2">그 외 순위</div>
        <ol className="text-sm space-y-1 list-decimal list-inside">
          {ranking.slice(3).map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: r.color }} />
              <span>Ball {r.id + 1}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow"
        >
          다시 하기
        </button>
      </div>
    </div>
  );
}