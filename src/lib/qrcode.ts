import QRCode from "qrcode-svg";

export interface QRCodeParams {
  width: number;
  height: number;
  url: string;
  color: string;
  background: string;
}

export const QR_CODE_DEFAULTS: QRCodeParams = {
  width: 512,
  height: 512,
  url: "https://www.themade.org",
  color: "#000000",
  background: "#ffffff",
};

const parseDimension = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return value !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Reads QR code generation params (width, height, url, color, background)
 * from a request's query string, falling back to QR_CODE_DEFAULTS.
 */
export function getQrCodeParams(searchParams: URLSearchParams): QRCodeParams {
  return {
    width: parseDimension(searchParams.get("width"), QR_CODE_DEFAULTS.width),
    height: parseDimension(searchParams.get("height"), QR_CODE_DEFAULTS.height),
    url: searchParams.get("url") ?? QR_CODE_DEFAULTS.url,
    color: searchParams.get("color") ?? QR_CODE_DEFAULTS.color,
    background: searchParams.get("background") ?? QR_CODE_DEFAULTS.background,
  };
}

/**
 * Generates a QR code as an SVG markup string from the given params.
 */
export function generateQrCodeSvg(params: QRCodeParams): string {
  const qrcode = new QRCode({
    content: params.url,
    padding: 4,
    width: params.width,
    height: params.height,
    color: params.color,
    background: params.background,
    ecl: "M",
  });

  return qrcode.svg();
}
