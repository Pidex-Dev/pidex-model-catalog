import { evaluateRestrictedCel } from './evaluator'
import { parseRestrictedCel, type RestrictedCelExpression } from './parser'
import { tokenizeRestrictedCel } from './tokenizer'
import {
  RestrictedCelError,
  type JsonObject,
  type ModelOptionMapProgram,
  type ModelOptionName,
  type RestrictedCelValue,
} from './types'

export function compileModelOptionMap(source: string, variableName: ModelOptionName): ModelOptionMapProgram {
  const normalizedSource = source.trim()
  if (!normalizedSource.length) {
    throw new RestrictedCelError('expression must not be empty', 0)
  }
  const expression = parseRestrictedCel(tokenizeRestrictedCel(normalizedSource), variableName)
  assertObjectResultExpression(expression)
  return Object.freeze({
    source: normalizedSource,
    evaluate(input: RestrictedCelValue): JsonObject {
      const result = evaluateRestrictedCel(expression, input)
      if (!isJsonObject(result)) {
        throw new RestrictedCelError('model option map must return a JSON object', 0)
      }
      return result
    },
  })
}

function assertObjectResultExpression(expression: RestrictedCelExpression): void {
  if (expression.type === 'object') return
  if (expression.type === 'conditional') {
    assertObjectResultExpression(expression.whenTrue)
    assertObjectResultExpression(expression.whenFalse)
    return
  }
  throw new RestrictedCelError('model option map must return a JSON object', expression.offset)
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
