var fs = require('fs'),
  xmlReader = require('read-xml');
module.exports = {


  friendlyName: 'Servicio lector xml',


  description: '',


  inputs: {
    consecutivo: {
      type: 'number',
      example: 2,
      description: 'Es el identificador del archivo en memoria.',
      required: true
    },
    constanteError: {
      type: 'number',
      example: -90,
      description: 'Constante de error para la lectura.',
      required: true
    },
    nombreArchivo: {
      type: 'string',
      example: 'dd70f66b-50b8-4029-9466-c1753b8cc57c.xml',
      description: 'Es el nombre del archivo.',
      required: true
    },
  },


  exits: {

  },


  fn: async function (inputs, exits) {

    let resultado;
    const E_VALIDO = 1;
    const E_NO_VALIDO = -1;

    // En este apartado implementar la lectura del xml.
    let archivo = inputs.nombreArchivo;
    let constanteError = inputs.constanteError;

    let encoding = '';
    let contenido = '';

    try {

      // console.debug('Contenido de archivo: ' + archivo);
      await leerXML(archivo).then(function (obj) {
        encoding = obj.encoding;
        contenido = obj.contenido;
      });

      // console.debug('Contenido de archivo: ');
      // console.debug(contenido);

      const df = getDatosFromXML(contenido);

      let datosExtra = {
        folioFactura: df.folio,
        tipoPago: df.tipoPago,
        importe: df.importe,
        serieFactura: df.serie,
        uuidFactura: df.uuid,
        iva: df.iva,
        monto: df.monto,
        fechaVencimiento: df.fecha,
        fechaCreacion: df.fecha,
        tipoPagoDescripcion: '',
      };

      resultado = {
        estatus: E_VALIDO,
        datosExtra: datosExtra,
        contenidoArchivoXML: contenido,
      };

    } catch (err) {
      resultado = {
        estatus: constanteError,
        datosExtra: datosExtra
      };
    }

    // All done.
    return exits.success(resultado);

  }


};


function leerXML(archivo) {

  return new Promise(function (fulfill, reject) {

    xmlReader.readXML(fs.readFileSync(archivo), function (err, data) {

      if (err) {
        sails.log.error(err);
      }

      fulfill({ encoding: data.encoding, contenido: data.content });

    });

  });
}

function getDatosFromXML(contenido) {

  const transform = require('camaro');

  const template = {
    serie: '/cfdi:Comprobante/@Serie',
    folio: '//cfdi:Comprobante/@Folio',
    uuid: '/cfdi:Comprobante/cfdi:Complemento/tfd:TimbreFiscalDigital/@UUID',
    fecha: '/cfdi:Comprobante/@Fecha',
    importe: '/cfdi:Comprobante/@SubTotal',
    iva: '/cfdi:Comprobante/cfdi:Impuestos/@TotalImpuestosTrasladados',
    monto: '/cfdi:Comprobante/@Total',
    tipoPago: '/cfdi:Comprobante/@FormaPago',
  }

  let datosFactura = transform(contenido, template);

  return datosFactura;
}