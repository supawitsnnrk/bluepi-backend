import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { CashService } from './cash.service';
import { AdjustCashStockBodyDto } from './dto/adjust-cash-stock.dto';
import { ValidateDenominationDto } from './dto/validate-denomination.dto';
import { CalculateChangeDto } from './dto/calculate-change.dto';

@Controller('cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  // 1. GET /cash/denominations - List active denominations
  @Get('denominations')
  listActiveDenominations() {
    return this.cashService.listActiveDenominations();
  }

  // 2. POST /cash/denominations/validate - Validate denomination
  @Post('denominations/validate')
  validateDenomination(@Body() validateDto: ValidateDenominationDto) {
    return this.cashService.validateDenomination(validateDto);
  }

  // 3. GET /cash/stock - Get cash stock (admin/debug)
  @Get('stock')
  getCashStock() {
    return this.cashService.getCashStock();
  }

  // 4. PATCH /cash/stock/:denominationId - Adjust cash stock
  @Patch('stock/:denominationId')
  adjustCashStock(
    @Param('denominationId') denominationId: string,
    @Body() body: AdjustCashStockBodyDto,
  ) {
    return this.cashService.adjustCashStock({
      denominationId,
      deltaQty: body.deltaQty,
    });
  }

  // 5. POST /cash/calculate-change - Calculate change breakdown
  @Post('calculate-change')
  calculateChange(@Body() calculateDto: CalculateChangeDto) {
    return this.cashService.calculateChange(calculateDto);
  }
}
