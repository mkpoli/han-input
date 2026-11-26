declare module 'han-compose/loader' {
  export interface ComposedResult {
    d?: string
    cut?: string | null
    missing?: string[]
  }

  export interface FromUrlOptions {
    suffix?: string
    fetch?: typeof globalThis.fetch
    load?: (name: string) => Promise<Record<string, unknown>>
  }

  export function fromUrl(baseUrl: string, options?: FromUrlOptions): unknown
  export function compose(
    source: unknown,
    ids: string,
    options?: { fontStyle?: 'sans' | 'serif' },
  ): Promise<ComposedResult | null | undefined>
}
