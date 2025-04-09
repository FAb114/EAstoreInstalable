/**
 * Servicio de Email para EAstore
 * Maneja el envío de facturas y notificaciones por correo electrónico
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const logger = require('../../utils/logger');
const config = require('../../config/app-config');

class EmailService {
  constructor() {
    // Crear transporter para envío de emails
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password
      }
    });
    
    // Compilar plantillas
    this.templates = {
      factura: this.compilarPlantilla('factura'),
      pedido: this.compilarPlantilla('pedido'),
      bienvenida: this.compilarPlantilla('bienvenida')
    };
  }
  
  /**
   * Compila una plantilla de email
   * @param {String} nombre - Nombre de la plantilla
   * @returns {Function} - Plantilla compilada
   */
  compilarPlantilla(nombre) {
    try {
      const templatePath = path.join(__dirname, `../../templates/email/${nombre}.html`);
      const source = fs.readFileSync(templatePath, 'utf8');
      return handlebars.compile(source);
    } catch (error) {
      logger.error(`Error al compilar plantilla ${nombre}:`, error);
      // Fallback a plantilla simple en caso de error
      return handlebars.compile('<h1>{{titulo}}</h1><p>{{mensaje}}</p>');
    }
  }
  
  /**
   * Envía una factura por email
   * @param {Object} factura - Datos de la factura
   * @param {String} email - Email del destinatario
   * @returns {Promise<Object>} - Resultado del envío
   */
  async enviarFactura(factura, email) {
    try {
      // Generar PDF de la factura (implementación omitida)
      const pdfBuffer = await this.generarPDFFactura(factura);
      
      // Preparar los datos para la plantilla
      const datosPlantilla = {
        numeroFactura: factura.numero,
        fechaFactura: new Date(factura.fecha).toLocaleDateString(),
        nombreCliente: factura.cliente.nombre,
        totalFactura: `$${factura.total.toFixed(2)}`,
        empresa: config.empresa.nombre,
        logoUrl: config.empresa.logoUrl
      };
      
      // Renderizar el HTML con la plantilla
      const htmlContent = this.templates.factura(datosPlantilla);
      
      // Configurar el email
      const mailOptions = {
        from: `${config.empresa.nombre} <${config.email.user}>`,
        to: email,
        subject: `Factura ${factura.tipoFactura} ${factura.numero} - ${config.empresa.nombre}`,
        html: htmlContent,
        attachments: [{
          filename: `Factura-${factura.numero}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      };
      
      // Enviar el email
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email de factura ${factura.numero} enviado: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'Factura enviada correctamente'
      };
    } catch (error) {
      logger.error('Error al enviar factura por email:', error);
      throw new Error(`Error al enviar factura por email: ${error.message}`);
    }
  }
  
  /**
   * Genera un PDF a partir de una factura
   * @param {Object} factura - Datos de la factura
   * @returns {Promise<Buffer>} - Buffer del PDF generado
   */
  async generarPDFFactura(factura) {
    try {
      // Esta función debería implementarse con una biblioteca de generación de PDF
      // como PDFKit, jsPDF, etc.
      
      // Ejemplo básico (esta implementación es un placeholder)
      const pdf = Buffer.from('PDF simulado de la factura');
      return pdf;
    } catch (error) {
      logger.error('Error al generar PDF de factura:', error);
      throw new Error('Error al generar PDF de la factura');
    }
  }
  
  /**
   * Envía un email de bienvenida a un nuevo cliente
   * @param {Object} cliente - Datos del cliente
   * @returns {Promise<Object>} - Resultado del envío
   */
  async enviarEmailBienvenida(cliente) {
    try {
      if (!cliente.email) {
        throw new Error('El cliente no tiene email registrado');
      }
      
      const datosPlantilla = {
        nombreCliente: cliente.nombre,
        empresa: config.empresa.nombre,
        logoUrl: config.empresa.logoUrl,
        webUrl: config.empresa.webUrl
      };
      
      const htmlContent = this.templates.bienvenida(datosPlantilla);
      
      const mailOptions = {
        from: `${config.empresa.nombre} <${config.email.user}>`,
        to: cliente.email,
        subject: `¡Bienvenido/a a ${config.empresa.nombre}!`,
        html: htmlContent
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email de bienvenida enviado a ${cliente.email}: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'Email de bienvenida enviado correctamente'
      };
    } catch (error) {
      logger.error('Error al enviar email de bienvenida:', error);
      throw new Error(`Error al enviar email de bienvenida: ${error.message}`);
    }
  }
  
  /**
   * Envía notificación de pago recibido
   * @param {Object} pago - Datos del pago
   * @param {Object} cliente - Datos del cliente
   * @returns {Promise<Object>} - Resultado del envío
   */
  async enviarComprobantePago(pago, cliente) {
    try {
      if (!cliente.email) {
        throw new Error('El cliente no tiene email registrado');
      }
      
      const datosPlantilla = {
        nombreCliente: cliente.nombre,
        fechaPago: new Date(pago.fecha).toLocaleDateString(),
        montoPago: `$${pago.monto.toFixed(2)}`,
        referenciaPago: pago.referencia,
        metodoPago: pago.metodo,
        empresa: config.empresa.nombre,
        logoUrl: config.empresa.logoUrl
      };
      
      // Utilizar la plantilla de factura con datos de pago
      const htmlContent = this.templates.factura(datosPlantilla);
      
      const mailOptions = {
        from: `${config.empresa.nombre} <${config.email.user}>`,
        to: cliente.email,
        subject: `Comprobante de pago - ${config.empresa.nombre}`,
        html: htmlContent
      };
      
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Comprobante de pago enviado a ${cliente.email}: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'Comprobante de pago enviado correctamente'
      };
    } catch (error) {
      logger.error('Error al enviar comprobante de pago:', error);
      throw new Error(`Error al enviar comprobante de pago: ${error.message}`);
    }
  }
  
  /**
   * Verifica la configuración de email
   * @returns {Promise<Boolean>} - True si la configuración es correcta
   */
  async verificarConfiguracion() {
    try {
      await this.transporter.verify();
      logger.info('Configuración de email verificada correctamente');
      return true;
    } catch (error) {
      logger.error('Error en la configuración de email:', error);
      return false;
    }
  }
}

module.exports = new EmailService();