import { IsInt, Min } from 'class-validator';

export class CapacityUpdateDto {
  @IsInt()
  @Min(0)
  public!: number;

  @IsInt()
  @Min(0)
  private!: number;
}
