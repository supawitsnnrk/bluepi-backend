import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CancelOrderDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelOrderBodyDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CancelOrderResponseDto {
  success: boolean;
  orderId: string;
  refundAmount: number;
}
