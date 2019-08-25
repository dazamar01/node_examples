
var fs = require('fs'),
xmlReader = require('read-xml');

const soap = require('soap');
const utf8 = require('utf8');

const TEST = true;
let WSDL_ROUTE = "https://tramitesdigitales.sat.gob.mx/Sicofi.wsExtValidacionCFD/WsValidacionCFDsExt.asmx?WSDL";


WSDL_ROUTE = 'https://consultaqr.facturaelectronica.sat.gob.mx/consultacfdiservice.svc?wsdl';

const FAKE_ENDPOINT = "http://wsvalidacioncfdsext.getsandbox.com/Sicofi.wsExtValidacionCFD/WsValidacionCFDsExt.asmx";

module.exports = {

friendlyName: 'Servicio validador xml',

description: '',

inputs: {
  consecutivo: {
    type: 'number',
    example: 2,
    description: 'Es el identificador del archivo en memoria.',
    required: true
  },
  nombreArchivo: {
    type: 'string',
    example: 'dd70f66b-50b8-4029-9466-c1753b8cc57c.xml',
    description: 'Es el nombre del archivo.',
    required: true
  },
  contenidoArchivoXML: {
    type: 'string',
    example: '<cfdi:>',
    description: 'Es el contenido del archivo XML.',
    required: true
  },
},

exits: {

},


fn: async function (inputs, exits) {

  // console.debug('Servicio validador de XML ante SAT');
  const E_VALIDO = 1;
  const E_NO_VALIDO = -300;

  // En este apartado implementar la lectura del xml.
  let archivo = inputs.nombreArchivo;

  let xml = inputs.contenidoArchivoXML;

  let params ;

  // params = { re: 'CAL171010US4', rr: 'CAL171010US4', tt: '219.00', id: 'D0AC1389-CDC7-4258-82A5-9474B30C3037' };
  
  params = getDatosFromXML(xml);

  let respuesta = await consumirWSDL(params);

  // console.debug('>>>>>respuesta');
  // console.debug(respuesta);

  let resultado;

  if (respuesta.ConsultaResult.Estado === 'Vigente') { 
    resultado = {
      estatus: E_VALIDO,
      informacion: '',
    };
  } else {
    resultado = {
      estatus: E_NO_VALIDO,
      informacion: '',
    };
  }

  // All done.
  return exits.success(resultado);

}

};


async function consumirWSDL(params) {

let expresionImpresa = `?re=${params.re}&rr=${params.rr}&tt=${params.tt}&id=${params.id}`;

console.debug('Validando ante hacienda ID: ' + params.id);

// let args = { 'expresionImpresa': '?re=CAL171010US4&rr=CAL171010US4&tt=219.00&id=D0AC1389-CDC7-4258-82A5-9474B30C3037' };
let args = { 'expresionImpresa': expresionImpresa };

let ressultadoServicio;

try {
  await syncConsumirWSDL(WSDL_ROUTE, args).then(function (obj) {

    ressultadoServicio = obj.respuesta;
    
  });

} catch (err) {
  ressultadoServicio = '';
  console.debug('Error consultando el servicio WEB');
  sails.log.error(err);
}

console.debug('Validación finalizada');
console.debug(ressultadoServicio);

return ressultadoServicio;

}

function syncConsumirWSDL(url, args) {

return new Promise(function (fulfill, reject) {

  soap.createClient(url, function (err, client) {
    if (err)
      sails.log.error(err);
    else {

      client.Consulta(args, function (err, response) {
        if (err) {
          reject(err);
        }
        else {
          /*
          
          */

          fulfill({ respuesta: response });
        }
      })
    }
  });

});

}


function getDatosFromXML(contenido) {

const transform = require('camaro');

const template = {
  re: '/cfdi:Comprobante/cfdi:Emisor/@Rfc',
  rr: '/cfdi:Comprobante/cfdi:Receptor/@Rfc',
  tt: '/cfdi:Comprobante/@Total',
  id: '/cfdi:Comprobante/cfdi:Complemento/tfd:TimbreFiscalDigital/@UUID',
}

let datosFactura = transform(contenido, template);

return datosFactura;
}