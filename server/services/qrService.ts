import QRCode from 'qrcode';

export class QRService {
  async generateQRCode(url: string, format: 'png' | 'svg' = 'png'): Promise<string> {
    try {
      if (format === 'svg') {
        const svgString = await QRCode.toString(url, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 256,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        return `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
      }

      const qrDataURL = await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 256,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  async generateQRCodeBuffer(url: string, format: 'png' | 'svg' = 'png'): Promise<Buffer> {
    try {
      if (format === 'svg') {
        const svgString = await QRCode.toString(url, {
          type: 'svg',
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 256,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        return Buffer.from(svgString, 'utf-8');
      }

      const qrBuffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 256,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrBuffer;
    } catch (error) {
      console.error('Error generating QR code buffer:', error);
      throw new Error('Failed to generate QR code buffer');
    }
  }
}

export const qrService = new QRService();
