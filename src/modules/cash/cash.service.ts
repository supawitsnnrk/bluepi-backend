import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AdjustCashStockDto } from './dto/adjust-cash-stock.dto';
import {
  CalculateChangeDto,
  CalculateChangeResult,
} from './dto/calculate-change.dto';
import { ValidateDenominationDto } from './dto/validate-denomination.dto';
import { CashStockEntity } from './entities/cash-stock.entity';
import { DenominationEntity } from './entities/denomination.entity';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(
    @InjectRepository(DenominationEntity)
    private readonly denominationRepository: Repository<DenominationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private async startTransaction(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    return queryRunner;
  }

  // 1. listActiveDenominations - คืน list denom ที่รับได้ (is_active=true)
  async listActiveDenominations(): Promise<DenominationEntity[]> {
    this.logger.log('listActiveDenominations called');
    return await this.denominationRepository.find({
      where: { isActive: true },
      order: { amount: 'DESC' },
    });
  }

  // 2. validateDenomination - ตรวจว่า denom active และ qty > 0
  async validateDenomination(
    validateDto: ValidateDenominationDto,
  ): Promise<{ valid: boolean; message?: string }> {
    this.logger.log(
      `validateDenomination called with denominationId: ${validateDto.denominationId}`,
    );
    const denomination = await this.denominationRepository.findOne({
      where: { id: validateDto.denominationId },
    });

    if (!denomination) {
      return {
        valid: false,
        message: `Denomination ID: ${validateDto.denominationId} not found`,
      };
    }

    if (!denomination.isActive) {
      return {
        valid: false,
        message: `Denomination ${denomination.amount} is not active`,
      };
    }

    if (validateDto.qty <= 0) {
      return { valid: false, message: 'Quantity must be greater than 0' };
    }

    return { valid: true };
  }

  // 3. getCashStock - ดูเงินในเครื่อง (debug/admin)
  async getCashStock(): Promise<CashStockEntity[]> {
    this.logger.log('getCashStock called');
    return await this.dataSource
      .createQueryBuilder(CashStockEntity, 'cashStock')
      .leftJoinAndSelect('cashStock.denomination', 'denomination')
      .where('denomination.isActive = :isActive', { isActive: true })
      .orderBy('denomination.amount', 'DESC')
      .getMany();
  }

  // 4. adjustCashStock - เติมเหรียญ/แบงก์ในเครื่อง (admin/seed)
  async adjustCashStock(
    adjustDto: AdjustCashStockDto,
    queryRunner?: QueryRunner,
  ): Promise<CashStockEntity> {
    this.logger.log(
      `adjustCashStock called with denominationId: ${adjustDto.denominationId}, deltaQty: ${adjustDto.deltaQty}`,
    );
    const shouldCommit = !queryRunner;
    if (!queryRunner) {
      queryRunner = await this.startTransaction();
    }

    try {
      // Check denomination exists and active
      const denomination = await queryRunner.manager.findOne(
        DenominationEntity,
        {
          where: { id: adjustDto.denominationId },
        },
      );

      if (!denomination) {
        throw new NotFoundException(
          `Denomination ID: ${adjustDto.denominationId} not found`,
        );
      }

      // Find or create cash stock
      let cashStock = await queryRunner.manager.findOne(CashStockEntity, {
        where: { denomination: { id: adjustDto.denominationId } },
      });

      if (!cashStock) {
        cashStock = queryRunner.manager.create(CashStockEntity, {
          denomination: denomination as any,
          quantity: 0,
        });
      }

      // Calculate new quantity
      const newQuantity = cashStock.quantity + adjustDto.deltaQty;

      // Prevent negative stock
      if (newQuantity < 0) {
        throw new ConflictException(
          `Insufficient cash stock. Current: ${cashStock.quantity}, Requested: ${adjustDto.deltaQty}`,
        );
      }

      cashStock.quantity = newQuantity;
      const updatedStock = await queryRunner.manager.save(
        CashStockEntity,
        cashStock,
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

  // 5. calculateChange - คำนวณ breakdown เงินทอน (greedy algorithm)
  async calculateChange(
    calculateDto: CalculateChangeDto,
  ): Promise<CalculateChangeResult> {
    this.logger.log(
      `calculateChange called with amountToChange: ${calculateDto.amountToChange}`,
    );
    // Get active denominations with available stock
    const cashStocks = await this.dataSource
      .createQueryBuilder(CashStockEntity, 'cashStock')
      .leftJoinAndSelect('cashStock.denomination', 'denomination')
      .where('denomination.isActive = :isActive', { isActive: true })
      .andWhere('cashStock.quantity > 0')
      .orderBy('denomination.amount', 'DESC')
      .getMany();

    if (cashStocks.length === 0) {
      return {
        success: false,
        totalAmount: 0,
        breakdown: [],
        message: 'No cash available in machine',
      };
    }

    let remainingAmount = calculateDto.amountToChange;
    const breakdown = [];

    // Greedy algorithm: use largest denominations first
    for (const cashStock of cashStocks) {
      if (remainingAmount <= 0) break;

      const denomination = cashStock.denomination;
      const denominationAmount = denomination.amount;
      const availableQty = cashStock.quantity;

      // Calculate how many of this denomination we need
      const qtyNeeded = Math.floor(remainingAmount / denominationAmount);
      const qtyToUse = Math.min(qtyNeeded, availableQty);

      if (qtyToUse > 0) {
        breakdown.push({
          denominationId: denomination.id,
          amount: denominationAmount,
          qty: qtyToUse,
        });
        remainingAmount -= qtyToUse * denominationAmount;
      }
    }

    // Check if we can make exact change
    if (remainingAmount > 0) {
      return {
        success: false,
        totalAmount: calculateDto.amountToChange - remainingAmount,
        breakdown: [],
        message: `Cannot make exact change. Short by ${remainingAmount}`,
      };
    }

    return {
      success: true,
      totalAmount: calculateDto.amountToChange,
      breakdown,
    };
  }
}
