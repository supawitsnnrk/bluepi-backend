import { MigrationInterface, QueryRunner } from "typeorm";

export class InitiateTable1769967788792 implements MigrationInterface {
    name = 'InitiateTable1769967788792'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "product_stock" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "product_id" uuid NOT NULL, CONSTRAINT "REL_62a8438c36b1a42790d3cd755a" UNIQUE ("product_id"), CONSTRAINT "PK_557112c9955555e7d08fa913f3f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "price" integer NOT NULL, "sku" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_c44ac33a05b144dd0d9ddcf9327" UNIQUE ("sku"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c44ac33a05b144dd0d9ddcf932" ON "products" ("sku") `);
        await queryRunner.query(`CREATE TYPE "public"."denominations_type_enum" AS ENUM('BILL', 'COIN')`);
        await queryRunner.query(`CREATE TABLE "denominations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" integer NOT NULL, "type" "public"."denominations_type_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_e140c1e744d16edffd825a9449b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "order_deposits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "denomination_id" uuid NOT NULL, CONSTRAINT "PK_2ecb2104fa3d2cc88da0a3f0295" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "order_change" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "order_id" uuid NOT NULL, "denomination_id" uuid NOT NULL, CONSTRAINT "PK_228daac4dc69364c91f0ccd15f1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('IN_PROGRESS', 'SUCCESS', 'CANCELLED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."orders_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', "paid_amount" integer NOT NULL DEFAULT '0', "credit_amount" integer NOT NULL DEFAULT '0', "change_amount" integer NOT NULL DEFAULT '0', "remark" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "product_id" uuid, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cash_stock" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "quantity" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "denomination_id" uuid NOT NULL, CONSTRAINT "PK_d54d0796269a0cf7ea44acf3b88" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "product_stock" ADD CONSTRAINT "FK_62a8438c36b1a42790d3cd755a1" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_deposits" ADD CONSTRAINT "FK_15d1236c1c5ba80213f59c2e180" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_deposits" ADD CONSTRAINT "FK_2af51ad77a013e0369cea74e618" FOREIGN KEY ("denomination_id") REFERENCES "denominations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_change" ADD CONSTRAINT "FK_57255f124aea36a61a042ac2e56" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_change" ADD CONSTRAINT "FK_3953b6172e119551ecbfd3e6379" FOREIGN KEY ("denomination_id") REFERENCES "denominations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_ac832121b6c331b084ecc4121fd" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cash_stock" ADD CONSTRAINT "FK_9f825c79f77255e7d0b3ef547ce" FOREIGN KEY ("denomination_id") REFERENCES "denominations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cash_stock" DROP CONSTRAINT "FK_9f825c79f77255e7d0b3ef547ce"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_ac832121b6c331b084ecc4121fd"`);
        await queryRunner.query(`ALTER TABLE "order_change" DROP CONSTRAINT "FK_3953b6172e119551ecbfd3e6379"`);
        await queryRunner.query(`ALTER TABLE "order_change" DROP CONSTRAINT "FK_57255f124aea36a61a042ac2e56"`);
        await queryRunner.query(`ALTER TABLE "order_deposits" DROP CONSTRAINT "FK_2af51ad77a013e0369cea74e618"`);
        await queryRunner.query(`ALTER TABLE "order_deposits" DROP CONSTRAINT "FK_15d1236c1c5ba80213f59c2e180"`);
        await queryRunner.query(`ALTER TABLE "product_stock" DROP CONSTRAINT "FK_62a8438c36b1a42790d3cd755a1"`);
        await queryRunner.query(`DROP TABLE "cash_stock"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
        await queryRunner.query(`DROP TABLE "order_change"`);
        await queryRunner.query(`DROP TABLE "order_deposits"`);
        await queryRunner.query(`DROP TABLE "denominations"`);
        await queryRunner.query(`DROP TYPE "public"."denominations_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c44ac33a05b144dd0d9ddcf932"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TABLE "product_stock"`);
    }

}
