import type { ProviderOverlay } from '../../schema/catalog'

/**
 * Additional wire-protocol endpoints documented by upstream vendors,
 * merged onto Pi base providers' native `protocolEndpoints`.
 */
export const PROTOCOL_ENDPOINT_OVERLAYS: readonly ProviderOverlay[] = [
  {
    providerId: 'openai',
    protocolEndpoints: {
      'openai-completions': 'https://api.openai.com/v1',
    },
  },
  {
    providerId: 'google',
    protocolEndpoints: {
      'openai-completions': 'https://generativelanguage.googleapis.com/v1beta/openai',
    },
  },
  {
    providerId: 'xai',
    protocolEndpoints: {
      'openai-completions': 'https://api.x.ai/v1',
    },
  },
  {
    providerId: 'mistral',
    protocolEndpoints: {
      'openai-completions': 'https://api.mistral.ai/v1',
    },
  },
  {
    providerId: 'openrouter',
    protocolEndpoints: {
      'openai-responses': 'https://openrouter.ai/api/v1',
    },
  },
]
