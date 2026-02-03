import { IsInt, IsNotEmpty, IsUUID } from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  deltaQty: number; // Increase or decrease quantity as positive or negative value
}

export class AdjustStockBodyDto {
  @IsInt()
  @IsNotEmpty()
  deltaQty: number;
}
