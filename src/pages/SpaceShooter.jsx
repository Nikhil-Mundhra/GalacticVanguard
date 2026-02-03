import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Rocket, Heart, Star, RotateCcw, Play, Pause } from 'lucide-react';

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const BULLET_WIDTH = 4;
const BULLET_HEIGHT = 12;
const ENEMY_WIDTH = 36;
const ENEMY_HEIGHT = 36;
const STAR_COUNT = 50;
const POWERUP_WIDTH = 28;
const POWERUP_HEIGHT = 28;
const POWERUP_TYPES = ['rapidFire', 'shield', 'spread', 'extraLife'];
const POWERUP_DURATION = 5000; // 5 seconds for temporary powerups
const BOSS_WIDTH = 80;
const BOSS_HEIGHT = 60;
const BOSS_LEVELS = [5, 10, 15, 20, 25, 30];

export default function SpaceShooter() {
  const [gameState, setGameState] = useState('start'); // start, playing, paused, gameOver
  const [player, setPlayer] = useState({ x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2, y: GAME_HEIGHT - 80 });
  const [bullets, setBullets] = useState([]);
  const [enemies, setEnemies] = useState([]);
  const [explosions, setExplosions] = useState([]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [stars, setStars] = useState([]);
  const [powerups, setPowerups] = useState([]);
  const [activePowerups, setActivePowerups] = useState({ rapidFire: false, shield: false, spread: false });
  const [boss, setBoss] = useState(null);
  const [bossProjectiles, setBossProjectiles] = useState([]);
  const [isBossFight, setIsBossFight] = useState(false);
  const bossShootTimerRef = useRef(0);
  
  const gameLoopRef = useRef(null);
  const keysRef = useRef({});
  const lastShotRef = useRef(0);
  const containerRef = useRef(null);

  // Initialize stars
  useEffect(() => {
    const initialStars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * GAME_WIDTH,
      y: Math.random() * GAME_HEIGHT,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.3
    }));
    setStars(initialStars);
  }, []);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysRef.current[e.key] = true;
      if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Spawn enemies
  const spawnEnemy = useCallback(() => {
    if (isBossFight) return; // Don't spawn regular enemies during boss fight
    const enemy = {
      id: Date.now() + Math.random(),
      x: Math.random() * (GAME_WIDTH - ENEMY_WIDTH),
      y: -ENEMY_HEIGHT,
      speed: 1.5 + level * 0.3 + Math.random(),
      type: Math.random() > 0.7 ? 'fast' : 'normal'
    };
    setEnemies(prev => [...prev, enemy]);
  }, [level, isBossFight]);

  // Spawn boss
  const spawnBoss = useCallback((bossLevel) => {
    const maxHealth = 50 + bossLevel * 20;
    setBoss({
      id: Date.now(),
      x: GAME_WIDTH / 2 - BOSS_WIDTH / 2,
      y: -BOSS_HEIGHT,
      targetY: 60,
      health: maxHealth,
      maxHealth,
      phase: 1,
      direction: 1,
      speed: 1.5 + bossLevel * 0.2,
      attackPattern: 0
    });
    setIsBossFight(true);
    setEnemies([]);
  }, []);

  // Boss attack patterns
  const bossAttack = useCallback(() => {
    if (!boss) return;
    
    const centerX = boss.x + BOSS_WIDTH / 2;
    const bottomY = boss.y + BOSS_HEIGHT;
    
    if (boss.phase === 1) {
      // Phase 1: Single aimed shot
      setBossProjectiles(prev => [...prev, {
        id: Date.now(),
        x: centerX - 4,
        y: bottomY,
        vx: 0,
        vy: 4,
        type: 'normal'
      }]);
    } else if (boss.phase === 2) {
      // Phase 2: Spread shot
      for (let i = -2; i <= 2; i++) {
        setBossProjectiles(prev => [...prev, {
          id: Date.now() + i,
          x: centerX - 4,
          y: bottomY,
          vx: i * 1.5,
          vy: 4,
          type: 'spread'
        }]);
      }
    } else {
      // Phase 3: Rapid burst + spiral
      const angle = (boss.attackPattern * 30) * Math.PI / 180;
      setBossProjectiles(prev => [...prev, {
        id: Date.now(),
        x: centerX - 4 + Math.cos(angle) * 30,
        y: bottomY + Math.sin(angle) * 10,
        vx: Math.cos(angle + Math.PI/2) * 2,
        vy: 5,
        type: 'spiral'
      }]);
    }
  }, [boss]);

  // Spawn powerup
  const spawnPowerup = useCallback((x, y) => {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    setPowerups(prev => [...prev, {
      id: Date.now() + Math.random(),
      x: x - POWERUP_WIDTH / 2,
      y,
      type,
      speed: 2
    }]);
  }, []);

  // Collect powerup
  const collectPowerup = useCallback((type) => {
    if (type === 'extraLife') {
      setLives(prev => Math.min(prev + 1, 5));
    } else {
      setActivePowerups(prev => ({ ...prev, [type]: true }));
      setTimeout(() => {
        setActivePowerups(prev => ({ ...prev, [type]: false }));
      }, POWERUP_DURATION);
    }
  }, []);

  // Shoot bullet
  const shoot = useCallback(() => {
    const now = Date.now();
    const fireRate = activePowerups.rapidFire ? 100 : 200;
    if (now - lastShotRef.current > fireRate) {
      lastShotRef.current = now;
      const centerX = player.x + PLAYER_WIDTH / 2 - BULLET_WIDTH / 2;
      
      if (activePowerups.spread) {
        setBullets(prev => [
          ...prev,
          { id: Date.now(), x: centerX, y: player.y - BULLET_HEIGHT, angle: 0 },
          { id: Date.now() + 1, x: centerX - 10, y: player.y - BULLET_HEIGHT + 5, angle: -0.2 },
          { id: Date.now() + 2, x: centerX + 10, y: player.y - BULLET_HEIGHT + 5, angle: 0.2 }
        ]);
      } else {
        setBullets(prev => [...prev, {
          id: Date.now(),
          x: centerX,
          y: player.y - BULLET_HEIGHT,
          angle: 0
        }]);
      }
    }
  }, [player.x, player.y, activePowerups.rapidFire, activePowerups.spread]);

  // Create explosion
  const createExplosion = useCallback((x, y) => {
    const explosion = {
      id: Date.now() + Math.random(),
      x,
      y,
      frame: 0
    };
    setExplosions(prev => [...prev, explosion]);
    setTimeout(() => {
      setExplosions(prev => prev.filter(e => e.id !== explosion.id));
    }, 300);
  }, []);

  // Check collisions
  const checkCollisions = useCallback(() => {
    const bulletsToRemove = new Set();
    const enemiesToRemove = new Set();
    
    setBullets(prevBullets => {
      setEnemies(prevEnemies => {
        prevBullets.forEach((bullet, bi) => {
          prevEnemies.forEach((enemy, ei) => {
            if (
              bullet.x < enemy.x + ENEMY_WIDTH &&
              bullet.x + BULLET_WIDTH > enemy.x &&
              bullet.y < enemy.y + ENEMY_HEIGHT &&
              bullet.y + BULLET_HEIGHT > enemy.y
            ) {
              bulletsToRemove.add(bi);
              enemiesToRemove.add(ei);
              createExplosion(enemy.x + ENEMY_WIDTH / 2, enemy.y + ENEMY_HEIGHT / 2);
              // 20% chance to drop powerup
              if (Math.random() < 0.2) {
                spawnPowerup(enemy.x + ENEMY_WIDTH / 2, enemy.y + ENEMY_HEIGHT / 2);
              }
              setScore(prev => prev + (enemy.type === 'fast' ? 20 : 10));
            }
          });
        });

        return prevEnemies.filter((_, i) => !enemiesToRemove.has(i));
      });

      return prevBullets.filter((_, i) => !bulletsToRemove.has(i));
      });

      // Check boss collision with bullets
      if (boss) {
      setBullets(prevBullets => {
      const bulletsHit = new Set();
      prevBullets.forEach((bullet, bi) => {
        if (
          bullet.x < boss.x + BOSS_WIDTH &&
          bullet.x + BULLET_WIDTH > boss.x &&
          bullet.y < boss.y + BOSS_HEIGHT &&
          bullet.y + BULLET_HEIGHT > boss.y
        ) {
          bulletsHit.add(bi);
          setBoss(prevBoss => {
            if (!prevBoss) return null;
            const newHealth = prevBoss.health - 1;
            if (newHealth <= 0) {
              // Boss defeated
              createExplosion(prevBoss.x + BOSS_WIDTH / 2, prevBoss.y + BOSS_HEIGHT / 2);
              setIsBossFight(false);
              setScore(s => s + prevBoss.maxHealth * 10);
              setBossProjectiles([]);
              // Drop multiple powerups
              for (let i = 0; i < 3; i++) {
                setTimeout(() => spawnPowerup(prevBoss.x + BOSS_WIDTH / 2 + (i - 1) * 30, prevBoss.y + BOSS_HEIGHT / 2), i * 100);
              }
              // Advance to next level
              setLevel(l => l + 1);
              return null;
            }
            // Phase transitions
            const healthPercent = newHealth / prevBoss.maxHealth;
            let newPhase = prevBoss.phase;
            if (healthPercent <= 0.33 && prevBoss.phase < 3) newPhase = 3;
            else if (healthPercent <= 0.66 && prevBoss.phase < 2) newPhase = 2;
            return { ...prevBoss, health: newHealth, phase: newPhase };
          });
        }
      });
      return prevBullets.filter((_, i) => !bulletsHit.has(i));
      });
      }
      }, [createExplosion, spawnPowerup, boss]);

  // Check player collision with enemies
  const checkPlayerCollision = useCallback(() => {
    // Check powerup collection
    setPowerups(prevPowerups => {
      return prevPowerups.filter(powerup => {
        const collision = 
          player.x < powerup.x + POWERUP_WIDTH &&
          player.x + PLAYER_WIDTH > powerup.x &&
          player.y < powerup.y + POWERUP_HEIGHT &&
          player.y + PLAYER_HEIGHT > powerup.y;
        
        if (collision) {
          collectPowerup(powerup.type);
          return false;
        }
        return true;
      });
    });

    // Check enemy collision (shield protects)
    setEnemies(prevEnemies => {
      let hit = false;
      const remaining = prevEnemies.filter(enemy => {
        const collision = 
          player.x < enemy.x + ENEMY_WIDTH &&
          player.x + PLAYER_WIDTH > enemy.x &&
          player.y < enemy.y + ENEMY_HEIGHT &&
          player.y + PLAYER_HEIGHT > enemy.y;
        
        if (collision) {
          hit = true;
          createExplosion(enemy.x + ENEMY_WIDTH / 2, enemy.y + ENEMY_HEIGHT / 2);
          return false;
        }
        return true;
      });

      if (hit && !activePowerups.shield) {
        setLives(prev => {
          if (prev <= 1) {
            setGameState('gameOver');
            setHighScore(hs => Math.max(hs, score));
            return 0;
          }
          return prev - 1;
        });
      }

      return remaining;
    });

    // Check boss projectile collision with player
    setBossProjectiles(prevProjectiles => {
      let playerHit = false;
      const remaining = prevProjectiles.filter(proj => {
        const collision = 
          player.x < proj.x + 8 &&
          player.x + PLAYER_WIDTH > proj.x &&
          player.y < proj.y + 8 &&
          player.y + PLAYER_HEIGHT > proj.y;
        
        if (collision) {
          playerHit = true;
          return false;
        }
        return true;
      });

      if (playerHit && !activePowerups.shield) {
        setLives(prev => {
          if (prev <= 1) {
            setGameState('gameOver');
            setHighScore(hs => Math.max(hs, score));
            return 0;
          }
          return prev - 1;
        });
      }

      return remaining;
    });
  }, [player.x, player.y, createExplosion, score, collectPowerup, activePowerups.shield]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    let enemySpawnTimer = 0;
    const enemySpawnRate = Math.max(60 - level * 5, 30);

    const gameLoop = () => {
      // Move player
      setPlayer(prev => {
        let newX = prev.x;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a']) {
          newX = Math.max(0, prev.x - 6);
        }
        if (keysRef.current['ArrowRight'] || keysRef.current['d']) {
          newX = Math.min(GAME_WIDTH - PLAYER_WIDTH, prev.x + 6);
        }
        return { ...prev, x: newX };
      });

      // Shoot
      if (keysRef.current[' '] || keysRef.current['ArrowUp']) {
        shoot();
      }

      // Move bullets
      setBullets(prev => prev
        .map(b => ({ 
          ...b, 
          y: b.y - 10,
          x: b.x + (b.angle || 0) * 10
        }))
        .filter(b => b.y > -BULLET_HEIGHT && b.x > 0 && b.x < GAME_WIDTH)
      );

      // Move powerups
      setPowerups(prev => prev
        .map(p => ({ ...p, y: p.y + p.speed }))
        .filter(p => p.y < GAME_HEIGHT)
      );

      // Move enemies
      setEnemies(prev => prev
        .map(e => ({ ...e, y: e.y + e.speed }))
        .filter(e => e.y < GAME_HEIGHT)
      );

      // Move stars
      setStars(prev => prev.map(star => ({
        ...star,
        y: star.y + star.speed,
        ...(star.y > GAME_HEIGHT ? { y: 0, x: Math.random() * GAME_WIDTH } : {})
      })));

      // Move boss
      setBoss(prevBoss => {
        if (!prevBoss) return null;
        let newX = prevBoss.x;
        let newY = prevBoss.y;
        let newDirection = prevBoss.direction;
        
        // Move to target Y first
        if (newY < prevBoss.targetY) {
          newY = Math.min(newY + 2, prevBoss.targetY);
        } else {
          // Horizontal movement
          newX += prevBoss.speed * prevBoss.direction;
          if (newX <= 0 || newX >= GAME_WIDTH - BOSS_WIDTH) {
            newDirection = -prevBoss.direction;
          }
        }
        
        return { ...prevBoss, x: newX, y: newY, direction: newDirection, attackPattern: prevBoss.attackPattern + 1 };
      });

      // Move boss projectiles
      setBossProjectiles(prev => prev
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy }))
        .filter(p => p.y < GAME_HEIGHT && p.x > -10 && p.x < GAME_WIDTH + 10)
      );

      // Boss attack timer
      bossShootTimerRef.current++;
      const shootRate = boss?.phase === 3 ? 8 : boss?.phase === 2 ? 20 : 40;
      if (isBossFight && bossShootTimerRef.current >= shootRate) {
        bossShootTimerRef.current = 0;
        bossAttack();
      }

      // Spawn enemies (not during boss fight)
      enemySpawnTimer++;
      if (enemySpawnTimer >= enemySpawnRate && !isBossFight) {
        enemySpawnTimer = 0;
        spawnEnemy();
      }

      // Check if should spawn boss
      if (!isBossFight && !boss && BOSS_LEVELS.includes(level)) {
        spawnBoss(level);
      }

      // Check collisions
      checkCollisions();
      checkPlayerCollision();

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, shoot, spawnEnemy, checkCollisions, checkPlayerCollision, isBossFight, boss, bossAttack, spawnBoss, level]);

  const startGame = () => {
    setPlayer({ x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2, y: GAME_HEIGHT - 80 });
    setBullets([]);
    setEnemies([]);
    setExplosions([]);
    setPowerups([]);
    setActivePowerups({ rapidFire: false, shield: false, spread: false });
    setBoss(null);
    setBossProjectiles([]);
    setIsBossFight(false);
    bossShootTimerRef.current = 0;
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameState('playing');
  };

  const togglePause = () => {
    setGameState(prev => prev === 'playing' ? 'paused' : 'playing');
  };

  // Touch controls
  const handleTouch = (direction) => {
    if (direction === 'left') {
      setPlayer(prev => ({ ...prev, x: Math.max(0, prev.x - 30) }));
    } else if (direction === 'right') {
      setPlayer(prev => ({ ...prev, x: Math.min(GAME_WIDTH - PLAYER_WIDTH, prev.x + 30) }));
    } else if (direction === 'shoot') {
      shoot();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0f0f2a] to-[#1a1a3a] flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-[400px] mb-4">
        <div className="flex justify-between items-center text-white mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="text-lg font-bold tracking-wider">{score.toString().padStart(6, '0')}</span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Heart 
                key={i} 
                className={`w-5 h-5 transition-all duration-300 ${i < lives ? 'text-pink-500 fill-pink-500' : 'text-gray-600'}`} 
              />
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span>LEVEL {level}</span>
            {activePowerups.rapidFire && <span className="px-1.5 py-0.5 bg-pink-500/30 text-pink-400 rounded text-[10px]">⚡RAPID</span>}
            {activePowerups.shield && <span className="px-1.5 py-0.5 bg-cyan-500/30 text-cyan-400 rounded text-[10px]">🛡️SHIELD</span>}
            {activePowerups.spread && <span className="px-1.5 py-0.5 bg-yellow-500/30 text-yellow-400 rounded text-[10px]">✦SPREAD</span>}
            {isBossFight && <span className="px-1.5 py-0.5 bg-red-500/30 text-red-400 rounded text-[10px] animate-pulse">⚠️BOSS</span>}
          </div>
          <span>HIGH SCORE: {highScore}</span>
        </div>
      </div>

      {/* Game Canvas */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/30 shadow-[0_0_50px_rgba(0,245,255,0.2)]"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT, background: 'linear-gradient(180deg, #0a0a1a 0%, #0f1525 100%)' }}
      >
        {/* Stars Background */}
        {stars.map((star, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: star.x,
              top: star.y,
              width: star.size,
              height: star.size,
              opacity: star.opacity
            }}
          />
        ))}

        {/* Player Ship */}
        {gameState !== 'start' && (
          <div
            className="absolute transition-transform duration-75"
            style={{ left: player.x, top: player.y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT }}
          >
            <div className="relative w-full h-full">
              {/* Shield effect */}
              {activePowerups.shield && (
                <div className="absolute -inset-3 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-pulse" />
              )}
              {/* Ship body */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`w-0 h-0 border-l-[20px] border-r-[20px] border-b-[40px] border-l-transparent border-r-transparent ${activePowerups.spread ? 'border-b-yellow-400' : activePowerups.rapidFire ? 'border-b-pink-400' : 'border-b-cyan-400'} drop-shadow-[0_0_10px_rgba(0,245,255,0.8)]`} />
              </div>
              {/* Engine glow */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-6 bg-gradient-to-t from-orange-500 via-yellow-400 to-transparent rounded-b-full animate-pulse opacity-80" />
            </div>
          </div>
        )}

        {/* Bullets */}
        {bullets.map(bullet => (
          <div
            key={bullet.id}
            className="absolute bg-gradient-to-t from-cyan-400 to-white rounded-full shadow-[0_0_10px_rgba(0,245,255,0.8)]"
            style={{
              left: bullet.x,
              top: bullet.y,
              width: BULLET_WIDTH,
              height: BULLET_HEIGHT
            }}
          />
        ))}

        {/* Enemies */}
        {enemies.map(enemy => (
          <div
            key={enemy.id}
            className="absolute"
            style={{ left: enemy.x, top: enemy.y, width: ENEMY_WIDTH, height: ENEMY_HEIGHT }}
          >
            <div className={`w-full h-full ${enemy.type === 'fast' ? 'text-pink-500' : 'text-purple-500'}`}>
              <div className="relative w-full h-full flex items-center justify-center">
                <div 
                  className={`w-0 h-0 border-l-[18px] border-r-[18px] border-t-[36px] border-l-transparent border-r-transparent ${
                    enemy.type === 'fast' ? 'border-t-pink-500 drop-shadow-[0_0_8px_rgba(255,0,128,0.8)]' : 'border-t-purple-500 drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]'
                  }`} 
                />
              </div>
            </div>
          </div>
        ))}

        {/* Boss */}
        {boss && (
          <div
            className="absolute"
            style={{ left: boss.x, top: boss.y, width: BOSS_WIDTH, height: BOSS_HEIGHT }}
          >
            {/* Boss body */}
            <div className={`relative w-full h-full ${boss.phase === 3 ? 'animate-pulse' : ''}`}>
              <div className={`absolute inset-0 flex items-center justify-center`}>
                <div className={`w-16 h-12 rounded-lg ${
                  boss.phase === 1 ? 'bg-gradient-to-b from-purple-600 to-purple-800' :
                  boss.phase === 2 ? 'bg-gradient-to-b from-orange-500 to-red-700' :
                  'bg-gradient-to-b from-red-500 to-red-900'
                } shadow-lg border-2 ${
                  boss.phase === 1 ? 'border-purple-400' :
                  boss.phase === 2 ? 'border-orange-400' :
                  'border-red-400'
                }`}>
                  {/* Eyes */}
                  <div className="flex justify-center gap-4 mt-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-300 shadow-[0_0_8px_yellow]" />
                    <div className="w-3 h-3 rounded-full bg-yellow-300 shadow-[0_0_8px_yellow]" />
                  </div>
                  {/* Cannon */}
                  <div className="flex justify-center mt-1">
                    <div className="w-4 h-3 bg-gray-700 rounded-b" />
                  </div>
                </div>
              </div>
              {/* Wings */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 ${
                boss.phase === 1 ? 'bg-purple-500' : boss.phase === 2 ? 'bg-orange-500' : 'bg-red-500'
              } rounded-l`} />
              <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 ${
                boss.phase === 1 ? 'bg-purple-500' : boss.phase === 2 ? 'bg-orange-500' : 'bg-red-500'
              } rounded-r`} />
            </div>
            {/* Health bar */}
            <div className="absolute -top-4 left-0 w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-200 ${
                  boss.phase === 1 ? 'bg-purple-500' : boss.phase === 2 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${(boss.health / boss.maxHealth) * 100}%` }}
              />
            </div>
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white font-bold">
              PHASE {boss.phase}
            </div>
          </div>
        )}

        {/* Boss Projectiles */}
        {bossProjectiles.map(proj => (
          <div
            key={proj.id}
            className={`absolute rounded-full ${
              proj.type === 'spiral' ? 'bg-red-500 shadow-[0_0_8px_red]' :
              proj.type === 'spread' ? 'bg-orange-500 shadow-[0_0_8px_orange]' :
              'bg-purple-500 shadow-[0_0_8px_purple]'
            }`}
            style={{
              left: proj.x,
              top: proj.y,
              width: 8,
              height: 8
            }}
          />
        ))}

        {/* Powerups */}
        {powerups.map(powerup => (
          <div
            key={powerup.id}
            className="absolute animate-bounce"
            style={{ left: powerup.x, top: powerup.y, width: POWERUP_WIDTH, height: POWERUP_HEIGHT }}
          >
            <div className={`w-full h-full rounded-lg flex items-center justify-center text-xs font-bold shadow-lg ${
              powerup.type === 'rapidFire' ? 'bg-pink-500 text-white shadow-pink-500/50' :
              powerup.type === 'shield' ? 'bg-cyan-500 text-white shadow-cyan-500/50' :
              powerup.type === 'spread' ? 'bg-yellow-500 text-black shadow-yellow-500/50' :
              'bg-green-500 text-white shadow-green-500/50'
            }`}>
              {powerup.type === 'rapidFire' ? '⚡' :
               powerup.type === 'shield' ? '🛡️' :
               powerup.type === 'spread' ? '✦' : '❤️'}
            </div>
          </div>
        ))}

        {/* Explosions */}
        {explosions.map(exp => (
          <div
            key={exp.id}
            className="absolute animate-ping"
            style={{
              left: exp.x - 20,
              top: exp.y - 20,
              width: 40,
              height: 40
            }}
          >
            <div className="w-full h-full rounded-full bg-gradient-radial from-yellow-400 via-orange-500 to-transparent opacity-80" />
          </div>
        ))}

        {/* Start Screen */}
        {gameState === 'start' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <Rocket className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
            <h1 className="text-3xl font-bold text-white mb-2 tracking-widest">SPACE SHOOTER</h1>
            <p className="text-gray-400 text-sm mb-8">Destroy enemies • Survive • Set high scores</p>
            <Button 
              onClick={startGame}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white px-8 py-3 text-lg font-bold tracking-wider shadow-[0_0_20px_rgba(0,245,255,0.4)]"
            >
              <Play className="w-5 h-5 mr-2" />
              START GAME
            </Button>
            <p className="text-gray-500 text-xs mt-6">Use ← → or A/D to move • SPACE to shoot</p>
          </div>
        )}

        {/* Paused Screen */}
        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <Pause className="w-12 h-12 text-cyan-400 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-6 tracking-widest">PAUSED</h2>
            <Button 
              onClick={togglePause}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-400 hover:to-purple-400 text-white px-6 py-2"
            >
              <Play className="w-4 h-4 mr-2" />
              RESUME
            </Button>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === 'gameOver' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <h2 className="text-3xl font-bold text-pink-500 mb-2 tracking-widest animate-pulse">GAME OVER</h2>
            <p className="text-white text-lg mb-1">Final Score: <span className="text-cyan-400 font-bold">{score}</span></p>
            <p className="text-gray-400 text-sm mb-6">Level Reached: {level}</p>
            {score >= highScore && score > 0 && (
              <p className="text-yellow-400 text-sm mb-4 animate-bounce">🎉 NEW HIGH SCORE! 🎉</p>
            )}
            <Button 
              onClick={startGame}
              className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 text-white px-6 py-2"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              PLAY AGAIN
            </Button>
          </div>
        )}

        {/* Pause Button */}
        {gameState === 'playing' && (
          <button
            onClick={togglePause}
            className="absolute top-3 right-3 p-2 bg-black/40 rounded-lg text-white/60 hover:text-white hover:bg-black/60 transition-all"
          >
            <Pause className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mobile Touch Controls */}
      <div className="w-full max-w-[400px] mt-4 flex justify-between items-center gap-4 md:hidden">
        <Button
          onTouchStart={() => handleTouch('left')}
          className="flex-1 h-14 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xl"
        >
          ←
        </Button>
        <Button
          onTouchStart={() => handleTouch('shoot')}
          className="flex-1 h-14 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 hover:from-cyan-500/70 hover:to-purple-500/70 border border-cyan-400/30 text-white"
        >
          FIRE
        </Button>
        <Button
          onTouchStart={() => handleTouch('right')}
          className="flex-1 h-14 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xl"
        >
          →
        </Button>
      </div>

      {/* Instructions */}
      <p className="text-gray-500 text-xs mt-4 text-center hidden md:block">
        Arrow Keys or A/D to move • Space or ↑ to shoot • P to pause
      </p>
    </div>
  );
}