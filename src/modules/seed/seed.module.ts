import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductStockEntity } from '../products/entities/product-stock.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity, ProductStockEntity])],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
