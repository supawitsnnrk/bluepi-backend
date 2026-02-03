import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductStockEntity } from '../products/entities/product-stock.entity';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    @InjectRepository(ProductStockEntity)
    private readonly productStockRepository: Repository<ProductStockEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * seedDemoProducts - Create demo product data for testing/demo purposes
   *
   * Performs 2 steps within 1 transaction:
   * 1. Create demo products (drinks/snacks) with prices - 7 items
   * 2. Create product_stock for each product (initial quantity 20 pieces each)
   *
   * Notes:
   * - Denominations and Cash Stock are already created in migration
   * - If products already exist, skip seed to prevent duplicates
   */
  async seedDemoProducts(): Promise<{
    message: string;
    productsCreated: number;
    productStockCreated: number;
  }> {
    // Check if products already exist
    const existingProducts = await this.productRepository.count();
    if (existingProducts > 0) {
      this.logger.warn('Products already exist. Skipping seed.');
      return {
        message: 'Demo products already exist. Skipping seed.',
        productsCreated: 0,
        productStockCreated: 0,
      };
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create demo products
      const productData = [
        { name: 'Coca Cola', price: 20, sku: 'COKE-001' },
        { name: 'Pepsi', price: 20, sku: 'PEPSI-001' },
        { name: 'Water', price: 10, sku: 'WATER-001' },
        { name: 'Green Tea', price: 25, sku: 'TEA-001' },
        { name: 'Lays Chips', price: 15, sku: 'CHIPS-001' },
        { name: 'Snickers', price: 30, sku: 'SNICK-001' },
        { name: 'KitKat', price: 25, sku: 'KITKAT-001' },
      ];

      const products: ProductEntity[] = [];
      for (const data of productData) {
        const product = queryRunner.manager.create(ProductEntity, {
          name: data.name,
          price: data.price,
          sku: data.sku,
          isActive: true,
        });
        const saved = await queryRunner.manager.save(product);
        products.push(saved);
      }
      this.logger.log(`Created ${products.length} products`);

      // 2. Create Product Stock for each product (initial 20 pieces per product)
      const productStocks: ProductStockEntity[] = [];
      for (const product of products) {
        const productStock = queryRunner.manager.create(ProductStockEntity, {
          product: product,
          quantity: 20, // Initial quantity 20 pieces each
        });
        const saved = await queryRunner.manager.save(productStock);
        productStocks.push(saved);
      }
      this.logger.log(`Created ${productStocks.length} product stock records`);

      // Commit transaction
      await queryRunner.commitTransaction();

      return {
        message: 'Demo products seeded successfully',
        productsCreated: products.length,
        productStockCreated: productStocks.length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Error seeding initial data', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
