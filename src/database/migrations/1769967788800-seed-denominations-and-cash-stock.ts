import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Seed Denominations and Cash Stock
 *
 * Creates master data:
 * - Denominations: coins 1,5,10 + bills 20,50,100,500,1000 THB
 * - Initial Cash Stock:
 *   • Coins: 1000 pieces each (used frequently for change)
 *   • Bills: as needed (20,50→200 pcs, 100→300 pcs, 500→100 pcs, 1000→20 pcs)
 *   • Total cash in machine: ~130,000 THB
 *
 * Quantities designed to support multiple test cases without needing to refill change
 */
export class SeedDenominationsAndCashStock1769967788800
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert Denominations (coins 1,5,10 + bills 20,50,100,500,1000)
    const denominationData = [
      { amount: 1, type: 'COIN' },
      { amount: 5, type: 'COIN' },
      { amount: 10, type: 'COIN' },
      { amount: 20, type: 'BILL' },
      { amount: 50, type: 'BILL' },
      { amount: 100, type: 'BILL' },
      { amount: 500, type: 'BILL' },
      { amount: 1000, type: 'BILL' },
    ];

    for (const data of denominationData) {
      await queryRunner.query(
        `
        INSERT INTO denominations (amount, type, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
      `,
        [data.amount, data.type, true],
      );
    }

    // 2. Insert Cash Stock (initial quantities by type)
    // Fetch newly created denominations
    const denominations = await queryRunner.query(
      `SELECT id, amount, type FROM denominations ORDER BY amount ASC`,
    );

    // Define initial quantities by type and value
    const initialQuantities = {
      1: 1000, // 1 THB coin - used very frequently for change
      5: 1000, // 5 THB coin - used very frequently for change
      10: 1000, // 10 THB coin - used very frequently for change
      20: 200, // 20 THB bill - used occasionally
      50: 200, // 50 THB bill - used occasionally
      100: 300, // 100 THB bill - used quite frequently for change
      500: 100, // 500 THB bill - used often for large amounts
      1000: 20, // 1000 THB bill - reserve, rarely used for change
    };

    for (const denomination of denominations) {
      const quantity = initialQuantities[denomination.amount];
      await queryRunner.query(
        `
        INSERT INTO cash_stock (denomination_id, quantity, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
      `,
        [denomination.id, quantity],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: Delete all seeded data
    await queryRunner.query(`DELETE FROM cash_stock`);
    await queryRunner.query(`DELETE FROM denominations`);
  }
}
