import { BulletManager } from '../entities/Bullet';
import { EnemyManager, type EnemyData } from '../entities/Enemy';
import { TankBulletManager, TANK_BULLET_RADIUS } from '../entities/TankBullet';
import { ItemManager, type ItemData } from '../entities/Item';

const PLAYER_RADIUS = 16; // player collision radius (smaller than visual for fairness)
const BULLET_RADIUS = 8;
const NEAR_MISS_EXTRA = 30; // extra distance beyond enemy radius for near-miss detection

export interface CollisionEvent {
  type: 'bullet_enemy' | 'bullet_enemy_hit' | 'enemy_player' | 'bullet_near_miss' | 'tank_bullet_player' | 'item_player';
  enemyX: number;
  enemyY: number;
  enemyType: EnemyData['type'];
  /** For near miss: the enemy data reference (to flashGlow). */
  enemyRef?: EnemyData;
  /** For item pickup: the item data reference. */
  itemRef?: ItemData;
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
    tankBulletManager?: TankBulletManager,
    itemManager?: ItemManager,
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

    // Bullet near-miss detection (per bullet, closest enemy only)
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (!b.active) continue;

      let closestDist = Infinity;
      let closestEnemy: EnemyData | null = null;

      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        if (!e.active) continue;

        const dx = b.posX - e.posX;
        const dy = b.posY - e.posY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const threshold = e.radius + NEAR_MISS_EXTRA;

        // Only consider enemies outside hit range but inside near-miss range
        if (dist > e.radius + BULLET_RADIUS && dist < threshold && dist < closestDist) {
          closestDist = dist;
          closestEnemy = e;
        }
      }

      if (closestEnemy) {
        this.events.push({
          type: 'bullet_near_miss',
          enemyX: closestEnemy.posX,
          enemyY: closestEnemy.posY,
          enemyType: closestEnemy.type,
          enemyRef: closestEnemy,
        });
      }
    }

    // Tank Bullet ↔ Player (circle-circle)
    if (tankBulletManager) {
      const tankBullets = tankBulletManager.activeBullets;
      for (let ti = tankBullets.length - 1; ti >= 0; ti--) {
        const tb = tankBullets[ti];
        if (!tb.active) continue;

        const dx = playerX - tb.posX;
        const dy = playerY - tb.posY;
        const distSq = dx * dx + dy * dy;
        const r = PLAYER_RADIUS + TANK_BULLET_RADIUS;

        if (distSq < r * r) {
          this.events.push({
            type: 'tank_bullet_player',
            enemyX: tb.posX,
            enemyY: tb.posY,
            enemyType: 'tank',
          });
          tb.active = false; // bullet consumed
        }
      }
    }

    // Item ↔ Player (circle-circle pickup)
    if (itemManager) {
      const items = itemManager.activeItems;
      for (let ii = items.length - 1; ii >= 0; ii--) {
        const item = items[ii];
        if (!item.active) continue;

        const dx = playerX - item.posX;
        const dy = playerY - item.posY;
        const distSq = dx * dx + dy * dy;
        const r = PLAYER_RADIUS + item.radius;

        if (distSq < r * r) {
          this.events.push({
            type: 'item_player',
            enemyX: item.posX,
            enemyY: item.posY,
            enemyType: 'chaser', // unused for item events
            itemRef: item,
          });
          itemManager.collect(item);
        }
      }
    }

    return this.events;
  }
}
