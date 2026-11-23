import { compileModelOptionMap } from './option-map/compiler'
import type { OptionSpecs } from './catalog'

/** Validates optional CEL option_specs maps and tests representative evaluation inputs. */
export function validateOptionSpecs(specs: OptionSpecs, label: string): void {
  if (specs.reasoningLevel?.map) {
    try {
      const program = compileModelOptionMap(specs.reasoningLevel.map, 'reasoningLevel')
      const probe = specs.reasoningLevel.values?.[0] ?? 'medium'
      program.evaluate(probe)
    } catch (error) {
      throw new Error(
        `Invalid reasoningLevel.map in ${label}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  if (specs.maxOutputTokens?.map) {
    try {
      const program = compileModelOptionMap(specs.maxOutputTokens.map, 'maxOutputTokens')
      program.evaluate(specs.maxOutputTokens.max ?? 4096)
    } catch (error) {
      throw new Error(
        `Invalid maxOutputTokens.map in ${label}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
