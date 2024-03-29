import { APP_LANG } from '@config/env'
import { i18nConfig } from '@config/i18nextConfig'
import db from '@database/data-source'
import Role from '@database/entities/Role'
import Session from '@database/entities/Session'
import User, { UserAttributes } from '@database/entities/User'
import {
  validateBoolean,
  validateEmpty,
  validateUUID,
} from '@expresso/helpers/Formatter'
import { optionsYup } from '@expresso/helpers/Validation'
import { DtoFindAll } from '@expresso/interfaces/Paginate'
import { ReqOptions } from '@expresso/interfaces/ReqOptions'
import ResponseError from '@expresso/modules/Response/ResponseError'
import PluginSqlizeQuery from '@expresso/modules/SqlizeQuery/PluginSqlizeQuery'
import { Request } from 'express'
import { TOptions } from 'i18next'
import _ from 'lodash'
import { Op } from 'sequelize'
import userSchema from './schema'

const including = [{ model: Role }, { model: Session }]

class UserService {
  /**
   *
   * @param req
   * @returns
   */
  public static async findAll(req: Request): Promise<DtoFindAll<User>> {
    const { lang, filtered } = req.getQuery()

    const defaultLang = lang ?? APP_LANG
    const i18nOpt: string | TOptions = { lng: defaultLang }

    const { includeCount, order, ...queryFind } = PluginSqlizeQuery.generate(
      req.query,
      User,
      PluginSqlizeQuery.makeIncludeQueryable(filtered, including)
    )

    const data = await User.findAll({
      ...queryFind,
      order: order.length ? order : [['createdAt', 'desc']],
    })
    const total = await User.count({
      include: includeCount,
      where: queryFind.where,
    })

    const message = i18nConfig.t('success.data_received', i18nOpt)
    return { message: `${total} ${message}`, data, total }
  }

  /**
   *
   * @param id
   * @param options
   * @returns
   */
  public static async findById(
    id: string,
    options?: ReqOptions
  ): Promise<User> {
    const i18nOpt: string | TOptions = { lng: options?.lang }

    const newId = validateUUID(id, { ...options })
    const data = await User.findOne({
      where: { id: newId },
      include: including,
      paranoid: options?.isParanoid,
    })

    if (!data) {
      const message = i18nConfig.t('errors.not_found', i18nOpt)
      throw new ResponseError.NotFound(`user ${message}`)
    }

    return data
  }

  /**
   *
   * @param email
   * @param options
   */
  public static async validateEmail(
    email: string,
    options?: ReqOptions
  ): Promise<void> {
    const i18nOpt: string | TOptions = { lng: options?.lang }

    const data = await User.findOne({
      where: { email },
    })

    if (data) {
      const message = i18nConfig.t('errors.already_email', i18nOpt)
      throw new ResponseError.BadRequest(message)
    }
  }

  /**
   *
   * @param formData
   * @returns
   */
  public static async create(formData: UserAttributes): Promise<User> {
    const value = userSchema.create.validateSync(formData, optionsYup)

    const newFormData = {
      ...value,
      phone: validateEmpty(value?.phone),
      password: validateEmpty(value?.confirmNewPassword),
    }

    const data = await User.create(newFormData)

    return data
  }

  /**
   *
   * @param id
   * @param formData
   * @param options
   * @returns
   */
  public static async update(
    id: string,
    formData: Partial<UserAttributes>,
    options?: ReqOptions
  ): Promise<User> {
    const data = await this.findById(id, { ...options })

    // validate email from request
    if (!_.isEmpty(formData.email) && formData.email !== data.email) {
      await this.validateEmail(String(formData.email), { ...options })
    }

    const value = userSchema.create.validateSync(
      { ...data, ...formData },
      optionsYup
    )

    const newFormData = {
      ...data,
      ...value,
      phone: validateEmpty(value?.phone),
      password: validateEmpty(value?.confirmNewPassword),
    }

    const newData = await data.update(newFormData)

    return newData
  }

  /**
   *
   * @param id
   * @param options
   */
  public static async restore(id: string, options?: ReqOptions): Promise<void> {
    const data = await this.findById(id, { isParanoid: false, ...options })
    await data.restore()
  }

  /**
   *
   * @param id
   * @param options
   */
  private static async delete(id: string, options?: ReqOptions): Promise<void> {
    // if true = force delete else soft delete
    const isForce = validateBoolean(options?.isForce)

    const data = await this.findById(id, { ...options })
    await data.destroy({ force: isForce })
  }

  /**
   *
   * @param id
   * @param options
   */
  public static async softDelete(
    id: string,
    options?: ReqOptions
  ): Promise<void> {
    // soft delete
    await this.delete(id, options)
  }

  /**
   *
   * @param id
   * @param options
   */
  public static async forceDelete(
    id: string,
    options?: ReqOptions
  ): Promise<void> {
    // force delete
    await this.delete(id, { isForce: true, ...options })
  }

  /**
   *
   * @param ids
   * @param options
   */
  private static validateIds(ids: string[], options?: ReqOptions): void {
    const i18nOpt: string | TOptions = { lng: options?.lang }

    if (_.isEmpty(ids)) {
      const message = i18nConfig.t('errors.cant_be_empty', i18nOpt)
      throw new ResponseError.BadRequest(`ids ${message}`)
    }
  }

  /**
   *
   * @param ids
   * @param options
   */
  public static async multipleRestore(
    ids: string[],
    options?: ReqOptions
  ): Promise<void> {
    // validate empty ids
    this.validateIds(ids, options)

    await User.restore({
      where: { id: { [Op.in]: ids } },
    })
  }

  /**
   *
   * @param ids
   * @param options
   */
  private static async multipleDelete(
    ids: string[],
    options?: ReqOptions
  ): Promise<void> {
    // validate empty ids
    this.validateIds(ids, options)

    // if true = force delete else soft delete
    const isForce = validateBoolean(options?.isForce)

    await User.destroy({
      where: { id: { [Op.in]: ids } },
      force: isForce,
    })
  }

  /**
   *
   * @param ids
   * @param options
   */
  public static async multipleSoftDelete(
    ids: string[],
    options?: ReqOptions
  ): Promise<void> {
    // multiple soft delete
    await this.multipleDelete(ids, options)
  }

  /**
   *
   * @param ids
   * @param options
   */
  public static async multipleForceDelete(
    ids: string[],
    options?: ReqOptions
  ): Promise<void> {
    // multiple force delete
    await this.multipleDelete(ids, { isForce: true, ...options })
  }

  public static async updateBalance(formData: any): Promise<number> {
    const value = userSchema.updateBalance.validateSync(formData, optionsYup)
    const { userId, amount } = value
    return await db.sequelize.transaction(async (t) => {
      const user = await UserService.findById(userId)
      const balance = (user.balance ?? 0) + amount
      if (balance >= 0) {
        await user.update({ balance })
        return balance
      } else throw new ResponseError.BadRequest(`Insufficient fund`)
    })
  }
}

export default UserService
