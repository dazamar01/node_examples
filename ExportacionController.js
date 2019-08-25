/**
 * ExportacionController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

//const folderRaizArchivosAplicacion = '/aplicacion';
var fs = require('fs');
const folderRaizArchivosAplicacion = '/aplicacion/exportacion-pdf';
const directorioRaiz = require('path').resolve(sails.config.appPath, 'assets' + folderRaizArchivosAplicacion);

// const rutaApp = require('path').resolve(sails.config.appPath, 'assets/aplicacion');

const moment = require('moment');

const salidaArchivos = directorioRaiz + '/salida';
const ROL_ADMINISTRATIVO = 4;
const ROL_PROVEEDOR = 2;
const ROL_MANTENIMIENTO = 5;

const ROL_SISTEMA = 1;

var SOURCE;
const REPORTE_GLOBAL = 'reporte-global';

module.exports = {

	exportarHistorialFacturaXLS: async function (req, res) {

		let opcionesBusqueda = null;
		let idSucursal = req.param('x-sucursal', 0);
		let fechaDe = req.param('x-fecha-de', '');
		let fechaHasta = req.param('x-fecha-hasta', '');
		let estatus = req.param('x-estatus', 0);
		let serieFactura = req.param('x-serie', '');
		let folioFactura = req.param('x-folio', '');

		let tipoGasto = req.param('x-tipo-gasto', '');

		SOURCE = req.param('x-source', '');


		let infoSesion = await sails.helpers.sesionUsuario.with({ 'reqSession': req.session });

		rolId = infoSesion.rolId;
		usuarioId = infoSesion.usuarioId;

		opcionesBusqueda = getFiltrosBusqueda(opcionesBusqueda, idSucursal, estatus, fechaDe, fechaHasta, serieFactura, folioFactura, tipoGasto);
		getFacturasPorProveedor(usuarioId, opcionesBusqueda);

		let facturas; // = await getFacturasPorProveedor(usuarioId, opcionesBusqueda);

		switch (rolId) {
			case ROL_PROVEEDOR: case ROL_MANTENIMIENTO:
				console.debug('OBTENIENDO EXPORTACION POR PROVEEDOR o MANTENIMIENTO')
				facturas = await getFacturasPorProveedor(usuarioId, opcionesBusqueda);
				break;
			case ROL_ADMINISTRATIVO: case ROL_SISTEMA:
				// console.debug('OBTENIENDO EXPORTACION POR SISTEMA	');
				facturas = await getFacturasAdministrativo(opcionesBusqueda);
				break;
			default:
				// console.debug('ROL NO SOPORTADO PARA EXPORTACION')
				facturas = [];
				break;
		}


		exportarExcel(facturas, res);

	},

	////// Exportación en PDF

	exportarHistorialFactura: async function (req, res) {

		let opcionesBusqueda = null;
		let idSucursal = req.param('e-sucursal', 0);
		let fechaDe = req.param('e-fecha-de', '');
		let fechaHasta = req.param('e-fecha-hasta', '');
		let estatus = req.param('e-estatus', 0);

		let serieFactura = req.param('e-serie', '');
		let folioFactura = req.param('e-folio', '');

		let tipoGasto = req.param('e-tipo-gasto', '');

		SOURCE = req.param('e-source', '');

		let rolId = null, usuarioId = null;

		let origenHTML = 'historial-facturas' + Date.now() + '.html';
		let archivoFuente = salidaArchivos + '/html/' + origenHTML;
		let archivoDestino = salidaArchivos + '/pdf/' + 'hist-facturas-' + new Date().getTime() + '.pdf';

		let infoSesion = await sails.helpers.sesionUsuario.with({ 'reqSession': req.session });

		rolId = infoSesion.rolId;
		usuarioId = infoSesion.usuarioId;

		opcionesBusqueda = getFiltrosBusqueda(opcionesBusqueda, idSucursal, estatus, fechaDe, fechaHasta, serieFactura, folioFactura, tipoGasto);

		let facturas;
		switch (rolId) {
			case ROL_PROVEEDOR: case ROL_MANTENIMIENTO:
				console.debug('OBTENIENDO EXPORTACION POR PROVEEDOR o MANTENIMIENTO')
				facturas = await getFacturasPorProveedor(usuarioId, opcionesBusqueda);
				break;
			case ROL_ADMINISTRATIVO: case ROL_SISTEMA:
				// console.debug('OBTENIENDO EXPORTACION POR SISTEMA	');
				facturas = await getFacturasAdministrativo(opcionesBusqueda);
				break;
			default:
				// console.debug('ROL NO SOPORTADO PARA EXPORTACION')
				facturas = [];
				break;
		}
		let reporteHTML = await construirHTMLHistorialFacturas(facturas, fechaDe, fechaHasta);

		fs.writeFile(archivoFuente, reporteHTML, { flag: 'w' }, function (err) {
			if (err) {
				return res.json({ resultado: false, error: err });
			} else {
				var origen = fs.readFileSync(archivoFuente, 'utf8');

				const HistoriaFacturaPdfConfig = {
					"format": "Letter",
					"orientation": "landscape",
				}
				exportarArchivo(origen, HistoriaFacturaPdfConfig, archivoDestino, res);
			}
		});

	}

};













// Exportacion en Formato PDF


function exportarArchivo(archivoFuente, options, archivoDestino, res) {

	var pdf = require('html-pdf');
	try {
		let nombrePDF = 'hist-facturas-';
		pdf.create(archivoFuente, options).toFile(archivoDestino, function (err, respuesta) {
			if (err) {
				sails.log.error(">>>Error interno exportando archivo");
				sails.log.error(err);

				// return res.json({ resultado: false, error: err });
				if (REPORTE_GLOBAL === SOURCE) {
					return res.redirect('/reporte-facturas');
				} else {
					return res.redirect('/facturas/historial');
				}


			} else {
				if (REPORTE_GLOBAL === SOURCE) {
					nombrePDF = 'rep-global-';
				}
				res.download(respuesta.filename, nombrePDF + moment().format('DD[-]MM[-]YYYY') + '.pdf');
			}
		});
	} catch (error) {
		sails.log.error("Error exportando archivo");
		sails.log.error(error);
	}

}

async function construirHTMLHistorialFacturas(facturas, fechaDesde, fechaHasta) {

	let moment = require('moment');

	let tablaFacturas = '';
	for (let row of facturas) {
		tablaFacturas += '<tr>';
		let fVencimiento = moment(row.fechaVencimiento).format('DD/MM/YYYY');
		let fEmision = moment(row.fechaCreacion).format('DD/MM/YYYY') + ' ' + moment(row.fechaCreacion).format('HH:mm:ss')
		let importe = `$${row.importe.toLocaleString('es-MX')} MXN`;
		let iva = `$${row.iva.toLocaleString('es-MX')} MXN`;
		let monto = `$${row.monto.toLocaleString('es-MX')} MXN`;
		tablaFacturas += `
		<td class="text-center" >
			${row.serieFactura}
		</td>
		<td class="text-center" >
			${row.folioFactura}
		</td>
		<td class="text-center" >
			${row.proveedor.razonSocial}
		</td>
		<td class="text-center" >
			${row.proveedor.rfc}
		</td>
		<td class="text-center"  >
			${row.sucursal.nombreSucursal}
		</td>
		<td class="text-center" >
			${row.tipoGasto.descripcion}
		</td>
		<td class="text-center" >
			${row.tipoPago.descripcion}
		</td>
		<td class="text-right">
			${importe}
		</td>
		<td class="text-right">
			${iva}
		</td>
		<td class="text-right" >
			${monto}
		</td>
		<td class="text-center" >
			${row.tiempoCredito}
		</td>
		<td class="text-center"  >
			${fEmision}			
		</td>
		<td class="text-center"  >
			${fVencimiento}			
		</td>
		<td class="text-center"  >
			${row.estatus.descripcion}
		</td>
		`;
		tablaFacturas += '</tr>'
	}

	let origen = 'Historial de Facturas';
	if (SOURCE === REPORTE_GLOBAL) {
		origen = 'Reporte global de facturas';
	}

	let tTitulo = '';
	if (fechaDesde != '') {
		tTitulo = `Centura - ${origen} de ${fechaDesde} a ${fechaHasta}`
	} else {
		tTitulo = `Centura - ${origen}`
	}
	let tHead = `
	<html>
  <head>
		<meta charset="utf8">
		<meta name="viewport">
		<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
		<title>${tTitulo}</title>
		<style type="text/css">
				
				h2{
					padding: 25px, 100px;
				}
				table, th, td {
					font-size: 8px;
				}
		</style>
		<link href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.1/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-WskhaSGFgHYWDcbwN70/dfYBj47jz9qbsMId/iRN3ewGhXQFZCSftd1LZCfmhktB" crossorigin="anonymous">
	</head>
	<body class="container">
		
			<div "class="row">
						<br /><br />
				<div class="col-sm-12">
						<div style="margin: 150px, 100px, 15px, 100px; width:700px; text-align: center;">
							<h3 class="text-center">${tTitulo}</h3>
						</div>
				</div>
				<br /><br />
			</div>
		
	</div>
	<div class="row">
		<div class="col-sm-10 col-sm-offset-1">
	`;
	let tFoot = `
			</div>
		</div>
  </body>
	</html>
	`;
	let tablaCabecera = `
	<div style="width: 500px" >
	<table class="table table-striped table-sm" style="margin: 100px, 80px, 15px, 80px; ">
	<thead >
		<tr>
			<th class="text-center">Serie</th>
			<th class="text-center" >Folio</th>
			<th  class="text-center">Razón social <br/>Proveedor</th>
			<th  class="text-center">RFC <br/>Proveedor</th>
			<th class="text-center" >Sucursal</th>
			<th  class="text-center">Tipo de gasto</th>
			<th class="text-center">Tipo de pago</th>
			<th class="text-right">Importe</th>
			<th class="text-right">IVA</th>
			<th class="text-right">Monto</th>
			<th class="text-center" >Tiempo de
				<br/>crédito</th>
			<th class="text-center">Fecha de
				<br/>emisión</th>
			<th class="text-center">Fecha de
				<br/>venc.</th>
			<th class="text-center" >Estatus</th>
		</tr>
	</thead>
	<tbody>
	`;
	let tablaFooter = `</tbody></table> </div>`;
	if (tablaFacturas === '') {
		tablaFacturas = '<tr>&nbsp;</tr>';
	}

	let elHTML = tHead + tablaCabecera + tablaFacturas + tablaFooter + tFoot;

	// console.info('elHTML');
	// console.info(elHTML);


	return elHTML;
}

async function getFacturasPorProveedor(usuarioId, opcionesBusqueda) {

	let proveedor = null, proveedorId = null, facturas = undefined;

	try {

		proveedor = await ProveedorCustom.getProveedorByUsuarioId(usuarioId);

		if (proveedor !== undefined) {
			if (proveedor.length > 0) {
				proveedorId = proveedor[0].id;
				facturas = await FacturaCustom.getHistorialFacturasByProveedor(proveedorId, opcionesBusqueda);
			}
		}

	} catch (err) {
		sails.log.error(errTrace);
		sails.log.error('err-obteniendo-sesion');
		sails.log.error(err);
	}

	if (facturas === undefined) {
		facturas = [];
	}

	return facturas;

}

function getFiltrosBusqueda(opcionesBusqueda, idSucursal, estatus, fechaDe, fechaHasta, serieFactura, folioFactura, tipoGasto) {

	try {

		if (estatus > 0) {
			if (opcionesBusqueda == null) opcionesBusqueda = {};
			opcionesBusqueda['estatus'] = estatus;
		}

	} catch (err) {
		sails.log.error(errTrace);
		sails.log.error('error-getFiltrosBusqueda');
		sails.log.error(err);
	}

	return opcionesBusqueda;

}

async function getFacturasAdministrativo(opcionesBusqueda) {

	try {

		if (opcionesBusqueda == null) {
			facturas = await Factura.find()
				.populate('proveedor')
				.populate('sucursal')
				.populate('tipoGasto')
				.populate('tipoPago')
				.populate('estatus')
				.sort('fechaVencimiento desc')
				.paginate(0, 100000);
		} else {
			facturas = await Factura.find(opcionesBusqueda)
				.populate('proveedor')
				.populate('sucursal')
				.populate('tipoGasto')
				.populate('tipoPago')
				.populate('estatus')
				.sort('fechaVencimiento desc')
				.paginate(0, 100000);
		}

	} catch (err) {
		sails.log.error(errTrace);
		sails.log.error('err-obteniendo-sesion');
		sails.log.error(err);
	}

	if (facturas === undefined) {
		facturas = [];
	}

	return facturas;

}











//// APARTADO DE FUNCIONES PARA EXPORTACION EN EXCEL

function exportarExcel(facturas, res) {

	// https://www.npmjs.com/package/excel-export

	var nodeExcel = require('excel-export');

  var conf = {};
  
	conf.name = "Hoja1";

	conf.cols = getHeaders();

	conf.rows = getRows(facturas);

	var result = nodeExcel.execute(conf);

	let nombreReporte;

	if (REPORTE_GLOBAL === SOURCE) {
		nombreReporte = 'rep-global-' + moment(new Date()).format('DD-MM-YYYY');
	} else {
		nombreReporte = "hist-facturas-" + moment(new Date()).format('DD-MM-YYYY');
	}

	res.setHeader('Content-Type', 'application/vnd.openxmlformats charset=utf-8');
	res.setHeader("Content-Disposition", "attachment; filename=" + nombreReporte + ".xlsx");
	res.end(result, 'binary');
}

function getRows(facturas) {

	let aFacturas = [];

	const utf8 = require('utf8');

	for (let f of facturas) {
		aFacturas.push([
			utf8.encode(f.serieFactura), utf8.encode(f.folioFactura),
			utf8.encode(f.proveedor.razonSocial), utf8.encode(f.proveedor.rfc), utf8.encode(f.sucursal.nombreSucursal),
			utf8.encode(f.tipoGasto.descripcion), utf8.encode(f.tipoPago.descripcion),
			f.importe, f.iva, f.monto, f.tiempoCredito,
			utf8.encode(moment(f.fechaCreacion).format('DD/MM/YYYY') + ' ' + moment(f.fechaCreacion).format('HH:mm:ss')),
			utf8.encode(moment(f.fechaVencimiento).format('DD/MM/YYYY')),
			utf8.encode(f.estatus.descripcion)
		]);
	}
	return aFacturas;
}

function getHeaders() {
	const utf8 = require('utf8');
	return [
		{ caption: 'Serie', type: 'string', width: 60 },
		{ caption: 'Folio', type: 'string', width: 60 },
		{ caption: 'Razon social proveedor', type: 'string', width: 60 },
		{ caption: 'RFC Proveedor', type: 'string', width: 60 },
		{ caption: 'Sucursal', type: 'string', width: 60 },
		{ caption: 'Tipo de Gasto', type: 'string', width: 60 },
		{ caption: 'Tipo de Pago', type: 'string', width: 60 },
		{ caption: 'Importe', type: 'number', width: 60 },
		{ caption: 'IVA', type: 'number', width: 60 },
		{ caption: 'Monto', type: 'number', width: 60 },
		{ caption: utf8.encode('Tiempo de credito'), type: 'number', width: 60 },
		{ caption: 'Fecha de emision', type: 'ref', width: 60 },
		{ caption: 'Fecha de vencimiento', type: 'ref', width: 60 },
		{ caption: 'Estatus', type: 'string', width: 60 },
	];
}
