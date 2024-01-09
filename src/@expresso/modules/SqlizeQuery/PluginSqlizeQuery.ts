/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { DB_CONNECTION } from '@config/env'
import SqlizeQuery, {
  getPrimitiveDataType,
  transformIncludeToQueryable,
} from '@expresso/modules/SqlizeQuery/SqlizeQuery'
import _ from 'lodash'
import {
  DataTypes,
  Includeable,
  IncludeOptions,
  ModelStatic,
  Op,
} from 'sequelize'
import { validate as uuidValidate } from 'uuid'
import {
  FilterIncludeHandledOnlyProps,
  GenerateOptions,
  ReqGenerate,
} from './interface'

/**
 *
 * @param value
 * @returns
 */
const parserString = (value: any): any => {
  return typeof value === 'string' ? JSON.parse(value) : value || []
}

/**
 *
 * @param id
 * @param prefixName
 * @returns
 */
function getExactQueryIdModel(id: string, prefixName: any): string | undefined {
  if (id === undefined) {
    return undefined
  }
  const splitId = id.split('.')
  if (!prefixName && splitId.length > 1) {
    return undefined
  }
  const indexId = splitId.findIndex((str) => str === prefixName)
  if (prefixName && indexId < 0) {
    return undefined
  }

  const curId = prefixName
    ? splitId
        .filter((str, index) => {
          return [indexId, indexId + 1].includes(index)
        })
        .pop()
    : id

  if (!curId || (prefixName && splitId.indexOf(curId) !== splitId.length - 1)) {
    return undefined
  }

  return curId
}

/**
 *
 * @param model
 * @param prefixName
 * @returns
 */
function getFilteredQuery(model?: ModelStatic<any>, prefixName?: string): any {
  const sequelizeQuery = new SqlizeQuery()
  sequelizeQuery.addValueParser(parserString)
  sequelizeQuery.addQueryBuilder(
    (
      filterData: { id: string; value: any; operator?: string },
      queryHelper
    ) => {
      const { id, value, operator } = filterData || {}
      const curId = getExactQueryIdModel(id, prefixName)
      if (!curId) {
        return
      }

      const type = getPrimitiveDataType(model?.rawAttributes?.[curId]?.type)

      let op = Op.eq
      switch (operator) {
        case 'gt':
          op = Op.gt
          break
        case 'gte':
          op = Op.gte
          break
        case 'lt':
          op = Op.lt
          break
        case 'lte':
          op = Op.lte
          break
        default:
          if (type === DataTypes.STRING) {
            if (uuidValidate(value) || model?.rawAttributes?.[curId]?.values) {
              op = Op.eq
            } else if (DB_CONNECTION === 'postgres') {
              op = Op.iLike
            } else {
              op = Op.like
            }
          }
      }

      let val = value
      if (type === DataTypes.DATE) val = new Date(value)
      if (op === Op.iLike || op === Op.like) val = `%${val}%`

      queryHelper.setQuery(curId, { [op]: val })
    }
  )
  return sequelizeQuery
}

/**
 * Get Sorted Query
 * @returns
 */
function getSortedQuery(): SqlizeQuery {
  const sequelizeQuery = new SqlizeQuery()
  sequelizeQuery.addValueParser(parserString)
  sequelizeQuery.addQueryBuilder((value, queryHelper) => {
    if (value?.id) {
      queryHelper.setQuery(value.id, value.desc === true ? 'DESC' : 'ASC')
    }
  })
  sequelizeQuery.addTransformBuild((buildValue, transformHelper) => {
    transformHelper.setValue(
      Object.entries(buildValue).map(([id, value]) => {
        return [...id.split('.'), value]
      })
    )
  })
  return sequelizeQuery
}

/**
 * Get Pagination Query
 * @returns
 */
function getPaginationQuery(): SqlizeQuery {
  const sequelizeQuery = new SqlizeQuery()
  const offsetId = 'page'
  const limitId = 'pageSize'
  const defaultOffset = 0
  const defaultLimit = 10
  sequelizeQuery.addValueParser((value) => {
    return [
      {
        id: offsetId,
        value: Number(value.page),
      },
      {
        id: limitId,
        value: Number(value.pageSize),
      },
    ]
  })

  sequelizeQuery.addQueryBuilder(({ id, value }, queryHelper) => {
    if (id === offsetId) {
      const offsetValue = queryHelper.getDataValueById(limitId) * (value - 1)
      queryHelper.setQuery(
        'offset',
        offsetValue > 0 ? offsetValue : defaultOffset
      )
    }
    if (id === limitId) {
      queryHelper.setQuery('limit', value || defaultLimit)
    }
  })

  return sequelizeQuery
}

function getIncludeFilteredQuery(
  filteredValue: any,
  model: any,
  prefixName: any,
  options?: IncludeOptions
) {
  const where = getFilteredQuery(model, prefixName).build(filteredValue)

  let extraProps = {}

  if (Object.keys(where).length > 0) {
    extraProps = {
      ...extraProps,
      where,
      required: true,
    }
  }

  return {
    model,
    ...extraProps,
    ...options,
  }
}

/**
 *
 * @param props
 * @returns
 */
function filterIncludeHandledOnly(props: FilterIncludeHandledOnlyProps): any {
  const { include, filteredInclude } = props

  const curFilteredInclude = filteredInclude || []
  if (include) {
    for (let i = 0; i < include.length; i += 1) {
      const curModel = include[i]
      let childIncludes = []
      if (curModel.include) {
        childIncludes = filterIncludeHandledOnly({
          include: curModel.include,
        })
      }

      if (curModel.where || curModel.required || childIncludes.length > 0) {
        const clonedInclude = _.cloneDeep(curModel)
        _.unset(clonedInclude, 'include')
        if (childIncludes.length > 0) {
          clonedInclude.include = [...childIncludes]
        }
        curFilteredInclude.push(clonedInclude)
      }
    }
  }
  return curFilteredInclude
}

/**
 *
 * @param include
 * @returns
 */
function injectRequireInclude(include: Includeable[]): Includeable[] {
  function test(dataInclude: Includeable[]): boolean {
    for (let i = 0; i < (dataInclude?.length || 0); i += 1) {
      const optionInclude = dataInclude[i] as IncludeOptions
      let data
      if (optionInclude.include) {
        data = test(optionInclude.include)
      }

      if (optionInclude.required) return true
      if (data && optionInclude.required === undefined) {
        optionInclude.required = true
        return true
      }
    }
    return false
  }

  test(include)

  return include
}

/**
 *
 * @param filteredValue
 * @param includes
 * @returns
 */
function makeIncludeQueryable(filteredValue: any, includes: Includeable[]) {
  return transformIncludeToQueryable(includes, (value) => {
    const { model, key, ...restValue } = value
    return getIncludeFilteredQuery(filteredValue, model, value.key, {
      key,
      ...restValue,
    } as IncludeOptions)
  })
}

/**
 *
 * @param reqQuery
 * @param model
 * @param includeRule
 * @param options
 * @returns
 */
function generate(
  reqQuery: ReqGenerate,
  model: any,
  includeRule?: Includeable | Includeable[],
  options?: GenerateOptions
) {
  const { onBeforeBuild } = options ?? {}

  const paginationQuery = getPaginationQuery()
  const filteredQuery = getFilteredQuery(model)
  const sortedQuery = getSortedQuery()
  const includeCountRule = filterIncludeHandledOnly({
    include: includeRule,
  })
  const include = injectRequireInclude(
    _.cloneDeep(includeRule) as Includeable[]
  )
  const includeCount = injectRequireInclude(
    _.cloneDeep(includeCountRule) as Includeable[]
  )

  if (onBeforeBuild) {
    onBeforeBuild({
      filteredQuery,
      paginationQuery,
      sortedQuery,
    })
  }

  const pagination = paginationQuery.build(reqQuery)
  const filter = filteredQuery.build(reqQuery.filtered)
  const sort = sortedQuery.build(reqQuery.sorted)

  return {
    include,
    includeCount,
    where: filter,
    order: sort,
    offset: pagination.offset,
    limit: pagination.limit,
    paranoid: reqQuery.paranoid,
  }
}

const PluginSqlizeQuery = {
  generate,
  makeIncludeQueryable,
}

export default PluginSqlizeQuery
