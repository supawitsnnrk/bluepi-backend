import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderDepositsEntity } from './entities/order-deposits.entity';
import { OrderChangeEntity } from './entities/order-change.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductStockEntity } from '../products/entities/product-stock.entity';
import { DenominationEntity } from '../cash/entities/denomination.entity';
import { CashStockEntity } from '../cash/entities/cash-stock.entity';
import { CashModule } from '../cash/cash.module';
import { ProductModule } from '../products/product.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrderEntity,
      OrderDepositsEntity,
      OrderChangeEntity,
      ProductEntity,
      ProductStockEntity,
      DenominationEntity,
      CashStockEntity,
    ]),
    CashModule, // Import CashService
    ProductModule, // Import ProductService
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
