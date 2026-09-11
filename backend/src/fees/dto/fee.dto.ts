import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateFeeDto {
  @IsUUID()
  studentId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  dueDate?: string;
}

export class PayFeeDto {
  @IsNumber()
  @Min(0.01)
  amount: number;
}
