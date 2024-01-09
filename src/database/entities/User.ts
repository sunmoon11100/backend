import userSchema from '@controllers/Account/User/schema'
import * as bcrypt from 'bcrypt'
import {
  BeforeCreate,
  BeforeUpdate,
  BelongsTo,
  Column,
  DataType,
  DefaultScope,
  DeletedAt,
  ForeignKey,
  HasMany,
  IsUUID,
  Scopes,
  Table,
  Unique,
} from 'sequelize-typescript'
import Base, { BaseEntity } from './Base'
import Role from './Role'
import Session from './Session'

interface UserEntity extends BaseEntity {
  deletedAt?: Date | null
  fullname: string
  email: string
  password?: string | null
  phone?: string | null
  tokenVerify?: string | null
  isActive?: boolean | null
  isBlocked?: boolean | null
  RoleId: string
  balance?: number | null

  // virtual field
  newPassword?: string | null
  confirmNewPassword?: string | null
}

export interface UserLoginAttributes {
  uid: string
}

export type CreatePassword = Pick<
  UserEntity,
  'newPassword' | 'confirmNewPassword'
>

export type LoginAttributes = Pick<UserEntity, 'email' | 'password'>

export type UserAttributes = Omit<
  UserEntity,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
>

@DefaultScope(() => ({
  attributes: {
    exclude: ['password', 'tokenVerify'],
  },
}))
@Scopes(() => ({
  withPassword: {},
}))
@Table({ tableName: 'user', paranoid: true })
class User extends Base {
  @DeletedAt
  @Column
  deletedAt?: Date

  @Column({ allowNull: false })
  fullname: string

  @Unique
  @Column({ allowNull: false })
  email: string

  @Column({ allowNull: false })
  password?: string

  @Column({ type: DataType.STRING('20') })
  phone?: string

  @Column({ type: DataType.TEXT })
  tokenVerify?: string

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isActive?: boolean

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isBlocked?: boolean

  @IsUUID(4)
  @ForeignKey(() => Role)
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    allowNull: false,
  })
  RoleId: string

  @BelongsTo(() => Role)
  Role: Role

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  balance?: number

  // one to many
  @HasMany(() => Session)
  Sessions: Session[]

  @Column({ type: DataType.VIRTUAL })
  newPassword: string

  @Column({ type: DataType.VIRTUAL })
  confirmNewPassword: string

  comparePassword: (currentPassword: string) => Promise<boolean>

  @BeforeUpdate
  @BeforeCreate
  static setUserPassword(instance: User): void {
    const { newPassword, confirmNewPassword } = instance
    const saltRounds = 10

    if (newPassword ?? confirmNewPassword) {
      const formPassword = { newPassword, confirmNewPassword }
      const validPassword = userSchema.createPassword.validateSyncAt(
        'confirmNewPassword',
        formPassword
      )

      // @ts-expect-error
      const hash = bcrypt.hashSync(validPassword, saltRounds)
      instance.setDataValue('password', hash)
    }
  }
}

// compare password
User.prototype.comparePassword = async function (
  currentPassword: string
): Promise<boolean> {
  return await new Promise((resolve, reject) => {
    const password = String(this.password)

    bcrypt.compare(currentPassword, password, function (err, isMatch) {
      if (err) reject(err)
      resolve(isMatch)
    })
  })
}

export default User
