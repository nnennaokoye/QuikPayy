declare module 'qrcode' {
  export type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

  export interface QRCodeColorOptions {
    dark?: string
    light?: string
  }

  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel
    margin?: number
    scale?: number
    color?: QRCodeColorOptions
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions
  ): Promise<string>

  const _default: {
    toDataURL: typeof toDataURL
  }
  export default _default
}
