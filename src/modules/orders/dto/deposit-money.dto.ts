import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

export class DepositMoneyDto {
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsUUID()
  @IsNotEmpty()
  denominationId: string;

  @IsInt()
  @IsPositive()
  qty: number;
}

export class DepositMoneyBodyDto {
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @IsUUID()
  @IsNotEmpty()
  denominationId: string;

  @IsInt()
  @IsPositive()
  qty: number;
}

export class DepositMoneyResponseDto {
  success: boolean;
  orderId: string;
  depositAmount: number;
  totalAmount: number;
}
