function generarHTMLTicket(factura) {
    const { cliente, productos, total, fecha, cae, formaPago, tipo } = factura;
  
    const mostrarCAE = cae && formaPago.toLowerCase() !== 'efectivo';
  
    const productosHTML = productos.map(p =>
      `<tr>
        <td>${p.nombre}</td>
        <td style="text-align:right;">${p.cantidad}</td>
        <td style="text-align:right;">$${(p.precio).toFixed(2)}</td>
      </tr>`
    ).join('');
  
    return `
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 10pt; padding: 10px; width: 58mm; }
            h2, h4 { text-align: center; margin: 0; }
            table { width: 100%; margin-top: 10px; border-collapse: collapse; }
            td { padding: 2px 0; }
            .footer { text-align: center; margin-top: 10px; }
          </style>
        </head>
        <body>
          <h2>EAstore</h2>
          <h4>Factura ${tipo}</h4>
          <div>Fecha: ${fecha}</div>
          <div>Cliente: ${cliente?.nombre || 'Consumidor Final'}</div>
          <hr />
          <table>
            <thead><tr><td>Producto</td><td>Cant</td><td>Precio</td></tr></thead>
            <tbody>${productosHTML}</tbody>
          </table>
          <hr />
          <div style="text-align:right;"><strong>Total: $${total.toFixed(2)}</strong></div>
          <div style="text-align:center;">Pago: ${formaPago}</div>
          ${mostrarCAE ? `
            <div class="footer">
              <div>CAE: ${cae}</div>
              <div>Factura Electrónica Validada por AFIP</div>
            </div>` : ''
          }
        </body>
      </html>
    `;
  }
  
  function generarHTMLA4(factura) {
    const { cliente, productos, total, fecha, cae, formaPago, tipo } = factura;
  
    const mostrarCAE = cae && formaPago.toLowerCase() !== 'efectivo';
  
    const productosHTML = productos.map(p =>
      `<tr>
        <td>${p.nombre}</td>
        <td>${p.cantidad}</td>
        <td>$${(p.precio).toFixed(2)}</td>
        <td>$${(p.precio * p.cantidad).toFixed(2)}</td>
      </tr>`
    ).join('');
  
    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12pt; padding: 40px; }
            h1 { text-align: center; }
            table { width: 100%; margin-top: 20px; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            .footer { margin-top: 30px; font-size: 10pt; }
          </style>
        </head>
        <body>
          <h1>Factura ${tipo}</h1>
          <div><strong>EAstore</strong></div>
          <div>Fecha: ${fecha}</div>
          <div>Cliente: ${cliente?.nombre || 'Consumidor Final'}</div>
          <div>Dirección: ${cliente?.direccion || '-'}</div>
          <div>CUIT: ${cliente?.cuit || '-'}</div>
  
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${productosHTML}
            </tbody>
          </table>
  
          <h2 style="text-align:right;">Total: $${total.toFixed(2)}</h2>
          <div><strong>Forma de pago:</strong> ${formaPago}</div>
  
          ${mostrarCAE ? `
          <div class="footer">
            <p>CAE: ${cae}</p>
            <p>Factura Electrónica Validada por AFIP</p>
          </div>` : ''
        }
        </body>
      </html>
    `;
  }
  
  module.exports = {
    generarHTMLTicket,
    generarHTMLA4
  };
  