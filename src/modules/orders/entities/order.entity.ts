import { ProductEntity } from 'src/modules/products/entities/product.entity';
import { OrderStatus } from 'src/shares/enums/order';
import { OrderDepositsEntity } from './order-deposits.entity';
import { OrderChangeEntity } from './order-change.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'product_id', referencedColumnName: 'id' })
  product: ProductEntity;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.IN_PROGRESS,
    name: 'status',
  })
  status: OrderStatus;

  @Column({ name: 'paid_amount', default: 0 })
  paidAmount: number;

  @Column({ name: 'credit_amount', default: 0 })
  creditAmount: number;

  @Column({ name: 'change_amount', default: 0 })
  changeAmount: number;

  @Column({ name: 'remark', nullable: true })
  remark: string;

  @OneToMany(() => OrderDepositsEntity, (deposit) => deposit.order)
  deposits: OrderDepositsEntity[];

  @OneToMany(() => OrderChangeEntity, (change) => change.order)
  change: OrderChangeEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
