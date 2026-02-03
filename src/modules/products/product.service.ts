import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { ProductEntity } from './entities/product.entity';
import { ProductStockEntity } from './entities/product-stock.entity';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private async startTransaction(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    return queryRunner;
  }

  async create(createProductDto: CreateProductDto): Promise<ProductEntity> {
    this.logger.log(`create called with sku: ${createProductDto.sku}`);
    const queryRunner = await this.startTransaction();
    const isDuplicate = await queryRunner.manager
      .getRepository(ProductEntity)
      .findOne({
        where: { sku: createProductDto.sku },
      });
    if (isDuplicate) {
      throw new ConflictException(
        `Product with SKU: ${createProductDto.sku} already exists`,
      );
    }

    try {
      const newProduct = queryRunner.manager.create(
        ProductEntity,
        createProductDto,
      );
      const product = await queryRunner.manager.save(ProductEntity, newProduct);

      const productStock = queryRunner.manager.create(ProductStockEntity, {
        quantity: 0,
        product: product,
      });
      await queryRunner.manager.save(ProductStockEntity, productStock);

      await queryRunner.commitTransaction();
      return product;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to create product');
    } finally {
      await queryRunner.release();
    }
  }

  async getActiveProducts(): Promise<ProductEntity[]> {
    this.logger.log('getActiveProducts called');
    const products = this.dataSource
      .createQueryBuilder(ProductEntity, 'product')
      .leftJoinAndSelect('product.productStock', 'productStock')
      .where('product.isActive = :isActive', { isActive: true });
    return await products.getMany();
  }

  async getProductAndStock(id: string): Promise<ProductEntity> {
    this.logger.log(`getProductAndStock called with id: ${id}`);
    const product = await this.productRepository.findOne({
      where: { id },
      relations: {
        productStock: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID: ${id} not found`);
    }
    return product;
  }

  async findOne(id: string): Promise<ProductEntity> {
    this.logger.log(`findOne called with id: ${id}`);
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID: ${id} not found`);
    }
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductEntity> {
    this.logger.log(`update called with id: ${id}`);
    const product = await this.findOne(id);
    Object.assign(product, updateProductDto);
    return await this.productRepository.save(product);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`remove called with id: ${id}`);
    const product = await this.findOne(id);
    await this.productRepository.softRemove(product);
  }

  async adjustProductStock(
    adjustStockDto: AdjustStockDto,
    queryRunner?: QueryRunner,
  ): Promise<ProductStockEntity> {
    this.logger.log(
      `adjustProductStock called with productId: ${adjustStockDto.productId}, deltaQty: ${adjustStockDto.deltaQty}`,
    );
    const shouldCommit = !queryRunner;
    if (!queryRunner) {
      queryRunner = await this.startTransaction();
    }

    try {
      const product = await queryRunner.manager.findOne(ProductEntity, {
        where: { id: adjustStockDto.productId },
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID: ${adjustStockDto.productId} not found`,
        );
      }

      const productStock = await queryRunner.manager.findOne(
        ProductStockEntity,
        {
          where: { product: { id: adjustStockDto.productId } },
          relations: { product: true },
        },
      );

      if (!productStock) {
        throw new NotFoundException(
          `Product stock for product ID: ${adjustStockDto.productId} not found`,
        );
      }

      // re calculate stock
      const newQuantity = productStock.quantity + adjustStockDto.deltaQty;

      // make sure stock is not negative
      if (newQuantity < 0) {
        throw new ConflictException(
          `Insufficient stock. Current: ${productStock.quantity}, Requested: ${adjustStockDto.deltaQty}`,
        );
      }

      // update stock
      productStock.quantity = newQuantity;
      const updatedStock = await queryRunner.manager.save(
        ProductStockEntity,
        productStock,
      );

      if (shouldCommit) {
        await queryRunner.commitTransaction();
      }

      return updatedStock;
    } catch (error) {
      if (shouldCommit) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      if (shouldCommit) {
        await queryRunner.release();
      }
    }
  }
}
