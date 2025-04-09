const { AfipWSAPIClient } = require('afip-apis');
const { createLogger } = require('../../utils/logger');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const config = require('../../config');

class AfipService {
  constructor() {
    // Ruta a los certificados
    const userDataPath = app.getPath('userData');
    const certPath = path.join(userDataPath, 'certificates');
    
    if (!fs.existsSync(certPath)) {
      fs.mkdirSync(certPath, { recursive: true });
    }
    
    this.certFile = path.join(certPath, config.afip.certFile || 'cert.crt');
    this.keyFile = path.join(certPath, config.afip.keyFile || 'key.key');
    
    // CUIT de la empresa
    this.cuit = config.afip.cuit;
    
    // Modo de producción o testing
    this.production = config.afip.production || false;
    
    // Cliente de AFIP
    this.client = null;
    
    // Inicializar cliente si los certificados existen
    if (fs.existsSync(this.certFile) && fs.existsSync(this.keyFile)) {
      this.inicializarCliente();
    }
  }
  
  // Inicializar cliente de AFIP
  inicializarCliente() {
    try {
      this.client = new AfipWSAPIClient({
        CUIT: this.cuit,
        cert: fs.readFileSync(this.certFile, 'utf8'),
        key: fs.readFileSync(this.keyFile, 'utf8'),
        production: this.production
      });
      
      console.log('Cliente AFIP inicializado correctamente');
      return true;
    } catch (error) {
      console.error('Error al inicializar cliente AFIP:', error);
      this.client = null;
      return false;
    }
  }
  
  // Verificar si el cliente está inicializado
  isInitialized() {
    return this.client !== null;
  }
  
  // Verificar estado de los servicios de AFIP
  async verificarEstadoServicios() {
    if (!this.isInitialized()) {
      throw new Error('Cliente AFIP no inicializado');
    }
    
    try {
      const status = await this.client.wsfe.dummy();
      return status;
    } catch (error) {
      console.error('Error al verificar estado de servicios AFIP:', error);
      throw error;
    }
  }
  
  // Emitir factura electrónica
  async emitirFactura(facturaData) {
    if (!this.isInitialized()) {
      throw new Error('Cliente AFIP no inicializado');
    }
    
    try {
      // Obtener el último número de comprobante
      const ptoVta = parseInt(facturaData.numero.split('-')[0]);
      const tipoComprobante = this.mapTipoFactura(facturaData.tipo);
      
      // Obtener último número de AFIP
      const ultimoComprobante = await this.client.wsfe.FECompUltimoAutorizado({
        PtoVta: ptoVta,
        CbteTipo: tipoComprobante
      });
      
      // Número de comprobante
      const numeroComprobante = ultimoComprobante.CbteNro + 1;
      
      // Formatear fecha actual
      const hoy = new Date();
      const fechaHoy = hoy.toISOString().split('T')[0].replace(/-/g, '');
      
      // Crear datos de la factura para AFIP
      const datosFactura = {
        FeCAEReq: {
          FeCabReq: {
            CantReg: 1,
            PtoVta: ptoVta,
            CbteTipo: tipoComprobante
          },
          FeDetReq: {
            FECAEDetRequest: [{
              Concepto: 1, // Productos
              DocTipo: facturaData.cliente?.cuit ? 80 : 96, // 80: CUIT, 96: DNI
              DocNro: facturaData.cliente?.cuit || facturaData.cliente?.dni || 0,
              CbteDesde: numeroComprobante,
              CbteHasta: numeroComprobante,
              CbteFch: fechaHoy,
              ImpTotal: parseFloat(facturaData.total).toFixed(2),
              ImpTotConc: 0,
              ImpNeto: this.calcularNetoFactura(facturaData),
              ImpOpEx: 0,
              ImpIVA: this.calcularIVAFactura(facturaData),
              ImpTrib: 0,
              FchServDesde: null,
              FchServHasta: null,
              FchVtoPago: null,
              MonId: 'PES',
              MonCotiz: 1,
              // Si hay detalles de IVA
              Iva: this.obtenerDetallesIVA(facturaData)
            }]
          }
        }
      };
      
      // Solicitar CAE
      const response = await this.client.wsfe.FECAESolicitar(datosFactura);
      
      // Verificar si fue autorizado
      if (response.FeDetResp.FECAEDetResponse[0].Resultado !== 'A') {
        throw new Error(`Error al autorizar factura: ${response.FeDetResp.FECAEDetResponse[0].Observaciones}`);
      }
      
      // Extraer datos del CAE
      const cae = response.FeDetResp.FECAEDetResponse[0].CAE;
      const vencimientoCae = response.FeDetResp.FECAEDetResponse[0].CAEFchVto;
      
      return {
        success: true,
        cae,
        vencimientoCae,
        numeroComprobante,
        response
      };
      
    } catch (error) {
      console.error('Error al emitir factura en AFIP:', error);
      throw error;
    }
  }
  
  // Mapear tipo de factura a código AFIP
  mapTipoFactura(tipo) {
    const tiposFactura = {
      'A': 1,
      'B': 6,
      'C': 11,
      'M': 51,
      'E': 19
    };
    
    return tiposFactura[tipo] || 6; // Por defecto factura B
  }
  
  // Calcular importe neto (sin IVA)
  calcularNetoFactura(facturaData) {
    let neto = 0;
    
    if (facturaData.detalles && facturaData.detalles.length > 0) {
      // Si hay detalles, calcular desde ellos
      for (const detalle of facturaData.detalles) {
        neto += detalle.subtotal / (1 + (detalle.iva / 100));
      }
    } else {
      // Si no hay detalles, estimar desde el total
      neto = facturaData.total / 1.21; // Asumiendo IVA 21%
    }
    
    return parseFloat(neto).toFixed(2);
  }
  
  // Calcular importe de IVA
  calcularIVAFactura(facturaData) {
    let iva = 0;
    
    if (facturaData.detalles && facturaData.detalles.length > 0) {
      // Si hay detalles, calcular desde ellos
      for (const detalle of facturaData.detalles) {
        const neto = detalle.subtotal / (1 + (detalle.iva / 100));
        iva += neto * (detalle.iva / 100);
      }
    } else {
      // Si no hay detalles, estimar desde el total
      iva = facturaData.total - (facturaData.total / 1.21); // Asumiendo IVA 21%
    }
    
    return parseFloat(iva).toFixed(2);
  }
  
  // Obtener detalles de IVA para AFIP
  obtenerDetallesIVA(facturaData) {
    // Agrupar por alícuota de IVA
    const alicuotas = {};
    
    if (facturaData.detalles && facturaData.detalles.length > 0) {
      for (const detalle of facturaData.detalles) {
        const iva = detalle.iva || 21;
        const key = iva.toString();
        
        if (!alicuotas[key]) {
          alicuotas[key] = {
            neto: 0,
            importe: 0
          };
        }
        
        const neto = detalle.subtotal / (1 + (iva / 100));
        const importeIva = neto * (iva / 100);
        
        alicuotas[key].neto += neto;
        alicuotas[key].importe += importeIva;
      }
    } else {
      // Si no hay detalles, estimar con IVA 21%
      const neto = facturaData.total / 1.21;
      const importeIva = facturaData.total - neto;
      
      alicuotas['21'] = {
        neto,
        importe: importeIva
      };
    }
    
    // Convertir a formato AFIP
    const alicuotasArray = [];
    
    for (const key in alicuotas) {
      const id = this.mapAlicuotaIVA(parseFloat(key));
      
      alicuotasArray.push({
        Id: id,
        BaseImp: parseFloat(alicuotas[key].neto).toFixed(2),
        Importe: parseFloat(alicuotas[key].importe).toFixed(2)
      });
    }
    
    return alicuotasArray;
  }
  
  // Mapear alícuota de IVA a código AFIP
  mapAlicuotaIVA(porcentaje) {
    const alicuotas = {
      0: 3,    // 0%
      10.5: 4, // 10.5%
      21: 5,   // 21%
      27: 6    // 27%
    };
    
    return alicuotas[porcentaje] || 5; // Por defecto 21%
  }
  
  // Consultar un comprobante existente
  async consultarComprobante(tipo, puntoVenta, numeroComprobante) {
    if (!this.isInitialized()) {
      throw new Error('Cliente AFIP no inicializado');
    }
    
    try {
      const tipoComprobante = this.mapTipoFactura(tipo);
      
      const response = await this.client.wsfe.FECompConsultar({
        FeCompConsReq: {
          CbteTipo: tipoComprobante,
          CbteNro: numeroComprobante,
          PtoVta: puntoVenta
        }
      });
      
      return response;
    } catch (error) {
      console.error('Error al consultar comprobante en AFIP:', error);
      throw error;
    }
  }
  
  // Subir certificados
  async subirCertificados(certData, keyData) {
    try {
      fs.writeFileSync(this.certFile, certData);
      fs.writeFileSync(this.keyFile, keyData);
      
      // Reinicializar cliente
      const result = this.inicializarCliente();
      
      return result;
    } catch (error) {
      console.error('Error al subir certificados:', error);
      throw error;
    }
  }
}

module.exports = AfipService;
