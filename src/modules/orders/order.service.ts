import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrderDepositsEntity } from './entities/order-deposits.entity';
import { OrderChangeEntity } from './entities/order-change.entity';
import {
  DepositMoneyDto,
  DepositMoneyResponseDto,
} from './dto/deposit-money.dto';
import {
  SelectProductDto,
  SelectProductResponseDto,
} from './dto/select-product.dto';
import { CancelOrderDto, CancelOrderResponseDto } from './dto/cancel-order.dto';
import { PurchaseResponseDto } from './dto/purchase-response.dto';
import { OrderStatus } from 'src/shares/enums/order';
import { ProductEntity } from '../products/entities/product.entity';
import { DenominationEntity } from '../cash/entities/denomination.entity';
import { CashService } from '../cash/cash.service';
import { ProductService } from '../products/product.service';
import { CreateOrderResponse } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly cashService: CashService,
    private readonly productService: ProductService,
    private readonly dataSource: DataSource,
  ) {}

  private async startTransaction(): Promise<QueryRunner> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    return queryRunner;
  }

  /**
   * 1. createOrder - Create new vending machine order session
   *
   * Initializes a new order with IN_PROGRESS status.
   * Customer can then deposit money and select products.
   *
   * @returns OrderEntity with IN_PROGRESS status, all amounts = 0
   */
  async createOrder(): Promise<CreateOrderResponse> {
    this.logger.log('createOrder called');
    const newOrder = this.orderRepository.create({
      status: OrderStatus.IN_PROGRESS,
      paidAmount: 0,
      creditAmount: 0,
      changeAmount: 0,
    });
    const order = await this.orderRepository.save(newOrder);

    return { orderId: order.id };
  }

  /**
   * 2. getOrder - Retrieve order details with all relations
   *
   * Fetches complete order information including:
   * - Product details (if selected)
   * - Deposit history (money inserted)
   * - Change breakdown (if transaction completed)
   *
   * @param id - Order UUID
   * @returns OrderEntity with full relations
   */
  async getOrder(id: string): Promise<OrderEntity> {
    this.logger.log(`getOrder called with id: ${id}`);
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: {
        product: true,
        deposits: {
          denomination: true,
        },
        change: {
          denomination: true,
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID: ${id} not found`);
    }

    return order;
  }

  /**
   * 3. depositMoney - Customer inserts money (coin/bill) into machine
   *
   * Process:
   * 1. Get or create order (if orderId not provided, create new one)
   * 2. Validate order is IN_PROGRESS
   * 3. Validate denomination is active
   * 4. Record deposit in order_deposits table
   * 5. Add denomination amount to order.paidAmount
   * 6. Update order.creditAmount (= paidAmount - product price if product selected)
   *
   * Note: Money is NOT yet added to cash_stock (only during purchase completion)
   *
   * @param depositDto - orderId (optional), denominationId, quantity
   * @returns Minimal response with success, orderId, depositAmount, totalAmount
   */
  async depositMoney(
    depositDto: DepositMoneyDto,
  ): Promise<DepositMoneyResponseDto> {
    this.logger.log(
      `depositMoney called with orderId: ${
        depositDto.orderId || 'NEW'
      }, denominationId: ${depositDto.denominationId}, qty: ${depositDto.qty}`,
    );
    const queryRunner = await this.startTransaction();

    try {
      // 1. Get existing order or create new one
      let order: OrderEntity;

      if (depositDto.orderId) {
        // If orderId provided, find it
        order = await queryRunner.manager.findOne(OrderEntity, {
          where: { id: depositDto.orderId },
          relations: { product: true },
        });

        if (!order) {
          throw new NotFoundException(
            `Order with ID: ${depositDto.orderId} not found`,
          );
        }
      } else {
        // If no orderId, create new order
        const newOrder = queryRunner.manager.create(OrderEntity, {
          status: OrderStatus.IN_PROGRESS,
        });
        order = await queryRunner.manager.save(newOrder);
      }

      // 2. Validate order is in progress
      if (order.status !== OrderStatus.IN_PROGRESS) {
        throw new ConflictException(
          `Order ${order.id} is not in progress (status: ${order.status})`,
        );
      }

      // 3. Validate denomination is active
      const denomination = await queryRunner.manager.findOne(
        DenominationEntity,
        {
          where: { id: depositDto.denominationId },
        },
      );

      if (!denomination) {
        throw new NotFoundException(
          `Denomination with ID: ${depositDto.denominationId} not found`,
        );
      }

      if (!denomination.isActive) {
        throw new BadRequestException(
          `Denomination ${denomination.amount} is not active`,
        );
      }

      // 3. Record deposit
      const deposit = queryRunner.manager.create(OrderDepositsEntity, {
        order: order,
        denomination: denomination,
        quantity: depositDto.qty,
      });
      await queryRunner.manager.save(OrderDepositsEntity, deposit);

      // 4. Update order amounts
      const depositAmount = denomination.amount * depositDto.qty;
      order.paidAmount += depositAmount;

      // Calculate credit (remaining amount after product price)
      if (order.product) {
        order.creditAmount = order.paidAmount - order.product.price;
      } else {
        order.creditAmount = order.paidAmount; // No product selected yet
      }

      const updatedOrder = await queryRunner.manager.save(OrderEntity, order);
      await queryRunner.commitTransaction();

      return {
        success: true,
        orderId: updatedOrder.id,
        depositAmount,
        totalAmount: updatedOrder.paidAmount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 4. selectProduct - Customer selects product from machine
   *
   * Process:
   * 1. Validate order is IN_PROGRESS
   * 2. Validate product exists, active, and in stock
   * 3. Link product to order
   * 4. Recalculate creditAmount (= paidAmount - product.price)
   *
   * Note: Does NOT deduct stock yet (only during purchase)
   *
   * @param selectDto - orderId, productId
   * @returns Minimal response with success, orderId, productId
   */
  async selectProduct(
    selectDto: SelectProductDto,
  ): Promise<SelectProductResponseDto> {
    this.logger.log(
      `selectProduct called with orderId: ${selectDto.orderId}, productId: ${selectDto.productId}`,
    );
    const queryRunner = await this.startTransaction();

    try {
      // 1. Validate order
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: selectDto.orderId },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID: ${selectDto.orderId} not found`,
        );
      }

      if (order.status !== OrderStatus.IN_PROGRESS) {
        throw new ConflictException(
          `Order ${selectDto.orderId} is not in progress`,
        );
      }

      // 2. Validate product
      const product = await queryRunner.manager.findOne(ProductEntity, {
        where: { id: selectDto.productId },
        relations: { productStock: true },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID: ${selectDto.productId} not found`,
        );
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }

      if (!product.productStock || product.productStock.quantity <= 0) {
        throw new ConflictException(`Product ${product.name} is out of stock`);
      }

      // 3. Update order
      order.product = product;
      order.creditAmount = order.paidAmount - product.price;

      await queryRunner.manager.save(OrderEntity, order);
      await queryRunner.commitTransaction();

      return {
        success: true,
        orderId: selectDto.orderId,
        productId: selectDto.productId,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 5. purchase - Complete the transaction (CORE FUNCTION)
   *
   * This is the most complex operation, executing everything in ONE transaction:
   *
   * Process:
   * 1. Validate order has product selected
   * 2. Validate sufficient payment (paidAmount >= product.price)
   * 3. Calculate change needed
   * 4. Calculate change breakdown using greedy algorithm
   * 5. Validate machine has enough change denominations
   * 6. Deduct product stock by 1
   * 7. Add customer deposits to cash_stock
   * 8. Deduct change from cash_stock
   * 9. Record change breakdown in order_change table
   * 10. Update order status to SUCCESS, record changeAmount
   *
   * ALL steps must succeed or entire transaction rolls back.
   *
   * @param orderId - Order UUID
   * @returns Minimal response with success, orderId, changeAmount, and change details
   */
  async purchase(orderId: string): Promise<PurchaseResponseDto> {
    this.logger.log(`purchase called with orderId: ${orderId}`);
    const queryRunner = await this.startTransaction();

    try {
      // 1. Get order with all relations
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: orderId },
        relations: {
          product: { productStock: true },
          deposits: { denomination: true },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID: ${orderId} not found`);
      }

      if (order.status !== OrderStatus.IN_PROGRESS) {
        throw new ConflictException(
          `Order ${orderId} is not in progress (status: ${order.status})`,
        );
      }

      if (!order.product) {
        throw new BadRequestException(
          'Cannot purchase without selecting a product',
        );
      }

      // 2. Validate payment
      if (order.paidAmount < order.product.price) {
        throw new BadRequestException(
          `Insufficient payment. Required: ${order.product.price}, Paid: ${order.paidAmount}`,
        );
      }

      // 3. Calculate change
      const changeNeeded = order.paidAmount - order.product.price;

      // 4. If change needed, calculate breakdown and validate availability
      let changeBreakdown = [];
      if (changeNeeded > 0) {
        const changeResult = await this.cashService.calculateChange({
          amountToChange: changeNeeded,
        });

        if (!changeResult.success) {
          throw new ConflictException(
            `Cannot make exact change: ${changeResult.message}`,
          );
        }

        changeBreakdown = changeResult.breakdown;
      }

      // 5. Deduct product stock
      await this.productService.adjustProductStock(
        {
          productId: order.product.id,
          deltaQty: -1, // Decrease by 1
        },
        queryRunner,
      );

      // 6. Add deposits to cash_stock (customer's inserted money)
      for (const deposit of order.deposits) {
        await this.cashService.adjustCashStock(
          {
            denominationId: deposit.denomination.id,
            deltaQty: deposit.quantity, // Add to machine
          },
          queryRunner,
        );
      }

      // 7. Deduct change from cash_stock and record breakdown
      for (const change of changeBreakdown) {
        // Deduct from machine
        await this.cashService.adjustCashStock(
          {
            denominationId: change.denominationId,
            deltaQty: -change.qty, // Decrease
          },
          queryRunner,
        );

        // Record in order_change table
        const orderChange = queryRunner.manager.create(OrderChangeEntity, {
          order: order,
          denomination: { id: change.denominationId } as DenominationEntity,
          quantity: change.qty,
        });
        await queryRunner.manager.save(OrderChangeEntity, orderChange);
      }

      // 8. Update order to SUCCESS
      order.status = OrderStatus.SUCCESS;
      order.changeAmount = changeNeeded;
      order.creditAmount = 0; // Reset credit (transaction complete)

      await queryRunner.manager.save(OrderEntity, order);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order ${orderId} completed successfully. Change: ${changeNeeded}`,
      );

      // Return minimal response with change details
      return {
        success: true,
        orderId,
        changeAmount: changeNeeded,
        change: changeBreakdown.map((c) => ({
          amount: c.amount,
          quantity: c.qty,
        })),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Purchase failed for order ${orderId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 6. cancelOrder - Cancel order and refund deposited money
   *
   * Process:
   * 1. Validate order is IN_PROGRESS
   * 2. Get all deposits (money customer inserted)
   * 3. Record refund in order_change table (as "change")
   * 4. Update status to CANCELLED
   * 5. Record cancellation reason in remark
   *
   * Note: Customer deposits are NOT added to cash_stock (never entered machine).
   * Refund breakdown is stored in order_change table for audit trail.
   * changeAmount = total paidAmount refunded
   *
   * @param cancelDto - orderId, optional reason
   * @returns Minimal response with success, orderId, refundAmount
   */
  async cancelOrder(
    cancelDto: CancelOrderDto,
  ): Promise<CancelOrderResponseDto> {
    this.logger.log(`cancelOrder called with orderId: ${cancelDto.orderId}`);
    const queryRunner = await this.startTransaction();

    try {
      const order = await queryRunner.manager.findOne(OrderEntity, {
        where: { id: cancelDto.orderId },
        relations: { deposits: { denomination: true } },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID: ${cancelDto.orderId} not found`,
        );
      }

      if (order.status !== OrderStatus.IN_PROGRESS) {
        throw new ConflictException(
          `Order ${cancelDto.orderId} cannot be cancelled (status: ${order.status})`,
        );
      }

      // Record refund (return all deposited money)
      // Store in order_change table to show what was refunded
      if (order.deposits && order.deposits.length > 0) {
        for (const deposit of order.deposits) {
          const refund = queryRunner.manager.create(OrderChangeEntity, {
            order: { id: order.id },
            denomination: { id: deposit.denomination.id },
            quantity: deposit.quantity,
          });
          await queryRunner.manager.save(OrderChangeEntity, refund);
        }
      }

      order.status = OrderStatus.CANCELLED;
      order.changeAmount = order.paidAmount; // Full refund
      order.remark = cancelDto.reason || 'Cancelled by customer';

      await queryRunner.manager.save(OrderEntity, order);
      await queryRunner.commitTransaction();

      const refundAmount = order.paidAmount;

      this.logger.log(
        `Order ${cancelDto.orderId} cancelled, refunded ${refundAmount} THB`,
      );

      return {
        success: true,
        orderId: cancelDto.orderId,
        refundAmount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 7. listOrders - Get all orders with pagination support
   *
   * Returns orders ordered by creation date (newest first).
   * Includes basic relations (product, deposits count, change count).
   *
   * Optional: Can add filters by status, date range, etc.
   *
   * @returns Array of OrderEntity
   */
  async listOrders(): Promise<OrderEntity[]> {
    this.logger.log('listOrders called');
    return await this.orderRepository.find({
      relations: {
        product: true,
        deposits: { denomination: true },
        change: { denomination: true },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }
}
