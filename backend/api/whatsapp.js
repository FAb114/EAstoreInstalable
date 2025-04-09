const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../config');

class WhatsAppService {
  constructor() {
    this.apiKey = config.whatsapp.apiKey;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.apiVersion = config.whatsapp.apiVersion || 'v17.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    this.initialized = !!(this.apiKey && this.phoneNumberId);
  }
  
  // Verificar si el servicio está inicializado
  isInitialized() {
    return this.initialized;
  }
  
  // Enviar mensaje de texto
  async enviarMensaje(telefono, mensaje) {
    if (!this.isInitialized()) {
      throw new Error('Servicio de WhatsApp no inicializado');
    }
    
    // Verificar formato del número
    const numeroFormateado = this.formatearNumero(telefono);
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: numeroFormateado,
          type: 'text',
          text: {
            body: mensaje
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return {
        success: true,
        messageId: response.data.messages[0].id
      };
    } catch (error) {
      console.error('Error al enviar mensaje de WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }
  
  // Enviar factura como PDF
  async enviarFactura(facturaData, telefono) {
    if (!this.isInitialized()) {
      throw new Error('Servicio de WhatsApp no inicializado');
    }
    
    try {
      // Generar PDF de la factura (usando el servicio PrintService)
      const PrintService = require('../services/print');
      const printService = new PrintService();
      
      const pdfBuffer = await printService.generarPDFFactura(facturaData);
      
      // Guardar PDF temporalmente
      const tempDir = path.join(require('os').tmpdir(), 'eastore');
      
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = `factura_${facturaData.numero.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filePath = path.join(tempDir, fileName);
      
      fs.writeFileSync(filePath, pdfBuffer);
      
      // Subir archivo a servidor de meta
      const documentId = await this.subirDocumento(filePath, fileName);
      
      // Formatear número de teléfono
      const numeroFormateado = this.formatearNumero(telefono);
      
      // Enviar mensaje con documento
      const mensaje = `¡Gracias por tu compra! Aquí está tu factura #${facturaData.numero}`;
      
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: numeroFormateado,
          type: 'document',
          document: {
            id: documentId,
            caption: mensaje
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      // Eliminar archivo temporal
      fs.unlinkSync(filePath);
      
      return {
        success: true,
        messageId: response.data.messages[0].id
      };
    } catch (error) {
      console.error('Error al enviar factura por WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }
  
  // Subir documento al servidor de Meta
  async subirDocumento(filePath, fileName) {
    if (!this.isInitialized()) {
      throw new Error('Servicio de WhatsApp no inicializado');
    }
    
    try {
      // Leer archivo como buffer
      const fileBuffer = fs.readFileSync(filePath);
      
      // Crear formulario para subir archivo
      const FormData = require('form-data');
      const form = new FormData();
      
      form.append('messaging_product', 'whatsapp');
      form.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'application/pdf'
      });
      
      const response = await axios.post(
        `${this.baseUrl}/media`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      
      return response.data.id;
    } catch (error) {
      console.error('Error al subir documento a Meta:', error.response?.data || error.message);
      throw error;
    }
  }
  
  // Formatear número de teléfono
  formatearNumero(telefono) {
    // Eliminar caracteres no numéricos
    let numero = telefono.replace(/\D/g, '');
    
    // Verificar si ya tiene código de país
    if (!numero.startsWith('54')) {
      numero = '54' + numero;
    }
    
    return numero;
  }
  
  // Configurar credenciales
  async configurarCredenciales(apiKey, phoneNumberId) {
    this.apiKey = apiKey;
    this.phoneNumberId = phoneNumberId;
    
    // Guardar en config
    config.whatsapp.apiKey = apiKey;
    config.whatsapp.phoneNumberId = phoneNumberId;
    
    this.initialized = !!(this.apiKey && this.phoneNumberId);
    return this.initialized;
  }
}

module.exports = WhatsAppService;
