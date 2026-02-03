import { IsInt, IsPositive } from 'class-validator';

export class CalculateChangeDto {
  @IsInt()
  @IsPositive()
  amountToChange: number;
}

export class ChangeBreakdown {
  denominationId: string;
  amount: number;
  qty: number;
}

export class CalculateChangeResult {
  success: boolean;
  totalAmount: number;
  breakdown: ChangeBreakdown[];
  message?: string;
}
