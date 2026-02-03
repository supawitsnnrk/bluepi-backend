import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';
import { CashStockEntity } from './entities/cash-stock.entity';
import { DenominationEntity } from './entities/denomination.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashStockEntity, DenominationEntity])],
  controllers: [CashController],
  providers: [CashService],
  exports: [CashService],
})
export class CashModule {}
