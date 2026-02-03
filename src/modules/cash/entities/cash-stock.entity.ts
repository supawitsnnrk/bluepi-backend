import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DenominationEntity } from './denomination.entity';

@Entity('cash_stock')
export class CashStockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => DenominationEntity, { nullable: false })
  @JoinColumn({ name: 'denomination_id', referencedColumnName: 'id' })
  denomination: DenominationEntity;

  @Column({ default: 0, name: 'quantity' })
  quantity: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
