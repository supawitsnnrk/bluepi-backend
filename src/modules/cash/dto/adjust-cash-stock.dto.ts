import { IsInt, IsNotEmpty, IsUUID } from 'class-validator';

export class AdjustCashStockDto {
  @IsUUID()
  @IsNotEmpty()
  denominationId: string;

  @IsInt()
  deltaQty: number;
}

export class AdjustCashStockBodyDto {
  @IsInt()
  @IsNotEmpty()
  deltaQty: number;
}
