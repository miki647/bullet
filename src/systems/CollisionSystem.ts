import { BulletManager } from '../entities/Bullet';
import { EnemyManager, type EnemyData } from '../entities/Enemy';

const PLAYER_RADIUS = 16; // player collision radius (smaller than visual for fairness)
const BULLET_RADIUS = 8;

export interface CollisionEvent {
  type: 'bullet_enemy' | 'bullet_enemy_hit' | 'enemy_player';
  enemyX: number;
  enemyY: number;
  enemyType: EnemyData['type'];
}

export class CollisionSystem {
  private events: CollisionEvent[] = [];

  /**
   * Run all collision checks for this frame.
   * Returns collision events for other systems to react to (particles, score, etc.).
   */
  check(
    bulletManager: BulletManager,
    enemyManager: EnemyManager,
    playerX: number,
    playerY: number,
  ): ReadonlyArray<CollisionEvent> {
    this.events.length = 0;

    const enemies = enemyManager.activeEnemies;
    const bullets = bulletManager.activeBullets;

    // Bullet ↔ Enemy (circle-circle)
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (!e.active) continue;

      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (!b.active) continue;

        const dx = b.posX - e.posX;
        const dy = b.posY - e.posY;
        const distSq = dx * dx + dy * dy;
        const r = BULLET_RADIUS + e.radius;

        if (distSq < r * r) {
          // Hit!
          e.hp--;
          b.active = false; // bullet consumed

          if (e.hp <= 0) {
            this.events.push({
              type: 'bullet_enemy',
              enemyX: e.posX,
              enemyY: e.posY,
              enemyType: e.type,
            });
            enemyManager.kill(e);
          } else {
            // Non-lethal hit (for Tank hit pulse, etc.)
            this.events.push({
              type: 'bullet_enemy_hit',
              enemyX: e.posX,
              enemyY: e.posY,
              enemyType: e.type,
            });
          }
          break; // this bullet can only hit one enemy
        }
      }
    }

    // Enemy ↔ Player (circle-circle)
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (!e.active) continue;

      const dx = playerX - e.posX;
      const dy = playerY - e.posY;
      const distSq = dx * dx + dy * dy;
      const r = PLAYER_RADIUS + e.radius;

      if (distSq < r * r) {
        this.events.push({
          type: 'enemy_player',
          enemyX: e.posX,
          enemyY: e.posY,
          enemyType: e.type,
        });
        enemyManager.kill(e);
        // Player damage will be handled by Game/GameState in later steps
      }
    }

    return this.events;
  }
}
