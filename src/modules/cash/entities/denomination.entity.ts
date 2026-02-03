import { DenominationType } from 'src/shares/enums/denomination';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('denominations')
export class DenominationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'amount' })
  amount: number;

  @Column({ type: 'enum', enum: DenominationType, name: 'type' })
  type: DenominationType;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
