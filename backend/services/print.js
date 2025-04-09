const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { generarHTMLTicket, generarHTMLFacturaA4 } = require('../helpers/contenidoFactura');

class PrintService {
  async imprimirFactura(factura, formato = 'ticket') {
    try {
      const win = new BrowserWindow({
        show: false,
        webPreferences: {
          offscreen: true
        }
      });

      const html = formato === 'ticket'
        ? generarHTMLTicket(factura)
        : generarHTMLFacturaA4(factura);

      const tempPath = path.join(os.tmpdir(), `factura_${Date.now()}.html`);
      fs.writeFileSync(tempPath, html, 'utf-8');

      await win.loadFile(tempPath);

      win.webContents.on('did-finish-load', async () => {
        await win.webContents.print({
          silent: true,
          printBackground: true
        });

        win.close();
        fs.unlinkSync(tempPath);
      });

    } catch (error) {
      console.error('Error al imprimir factura:', error);
      throw error;
    }
  }
}

module.exports = PrintService;
