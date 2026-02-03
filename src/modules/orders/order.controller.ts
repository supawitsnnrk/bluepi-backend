import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { OrderService } from './order.service';
import { DepositMoneyBodyDto } from './dto/deposit-money.dto';
import { SelectProductBodyDto } from './dto/select-product.dto';
import { CancelOrderBodyDto } from './dto/cancel-order.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * POST /api/orders
   * Create new order session (start transaction)
   */
  @Post()
  async createOrder() {
    return await this.orderService.createOrder();
  }

  /**
   * GET /api/orders/:id
   * Get order details with full relations
   */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return await this.orderService.getOrder(id);
  }

  /**
   * POST /api/orders/deposit
   * Customer deposits money (coin/bill)
   * If orderId provided in body -> use existing order
   * If orderId not provided -> create new order
   */
  @Post('deposit')
  async depositMoney(@Body() body: DepositMoneyBodyDto) {
    return await this.orderService.depositMoney({
      orderId: body.orderId,
      denominationId: body.denominationId,
      qty: body.qty,
    });
  }

  /**
   * POST /api/orders/:id/select-product
   * Customer selects product
   */
  @Post(':id/select-product')
  async selectProduct(
    @Param('id') orderId: string,
    @Body() body: SelectProductBodyDto,
  ) {
    return await this.orderService.selectProduct({
      orderId,
      productId: body.productId,
    });
  }

  /**
   * POST /api/orders/:id/purchase
   * Complete purchase transaction (deduct stock, add/deduct cash, calculate change)
   */
  @Post(':id/purchase')
  async purchase(@Param('id') orderId: string) {
    return await this.orderService.purchase(orderId);
  }

  /**
   * POST /api/orders/:id/cancel
   * Cancel order and refund
   */
  @Post(':id/cancel')
  async cancelOrder(
    @Param('id') orderId: string,
    @Body() body: CancelOrderBodyDto,
  ) {
    return await this.orderService.cancelOrder({
      orderId,
      reason: body.reason,
    });
  }

  /**
   * GET /api/orders
   * List all orders (with pagination in future)
   */
  @Get()
  async listOrders() {
    return await this.orderService.listOrders();
  }
}
