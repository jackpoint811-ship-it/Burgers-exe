var BurgerOGConstants = (function () {
  var SHEETS = {
    MASTER_SHEET_NAME: 'Pedidos Master',
    CHEKEO_ACTIVE_SHEET_NAME: 'Chekeo Nuevo',
    CHEKEO_PRODUCTION_SHEET_NAME: 'Chekeo',
    CONFIG_SHEET_NAME: 'Configuración',
    SUMMARY_SHEET_NAME: 'Resumen Pedidos',
    HISTORY_SHEET_NAME: 'Historico'
  };

  var CHEKEO_COLUMNS = [
    'ID Pedido',
    'Fila Master',
    'Fecha Pedido',
    'Hora Pedido',
    'Nombre',
    'Teléfono',
    'Resumen Pedido',
    'Hamburguesas',
    'Extras',
    'Guarniciones',
    'Total',
    'Estado Pedido',
    'Estado Pago',
    'Método Pago',
    'Nota Interna',
    'Nota Cliente',
    'Alerta',
    'Ticket Enviado',
    'Fecha Ticket Enviado',
    'Hora Inicio',
    'Hora Listo',
    'Última Actualización',
    'Guarnición Lista',
    'Ubicación'
  ];

  var MASTER_REQUIRED_COLUMNS = [
    'Marca temporal',
    'Nombre'
  ];

  var CHEKEO_REQUIRED_COLUMNS = CHEKEO_COLUMNS.slice();

  var HISTORY_REQUIRED_META_COLUMNS = [
    'Fecha Archivado',
    'Hora Archivado',
    'Corte ID'
  ];

  var HISTORY_OPTIONAL_META_COLUMNS = [
    'Motivo Archivo'
  ];

  var HISTORY_COLUMNS = CHEKEO_COLUMNS
    .concat(HISTORY_REQUIRED_META_COLUMNS)
    .concat(HISTORY_OPTIONAL_META_COLUMNS);

  var SUMMARY_REQUIRED_COLUMNS = [
    'Corte ID',
    'Fecha Corte',
    'Hora Corte',
    'Total Pedidos',
    'Pedidos Archivables',
    'Pedidos No Archivables',
    'Total Vendido',
    'Total Pagado',
    'Total Pendiente',
    'Con Alerta',
    'Sin Ticket Enviado',
    'Notas'
  ];

  var SUMMARY_COLUMNS = SUMMARY_REQUIRED_COLUMNS.concat([
    'IDs Archivables',
    'IDs No Archivables',
    'Generado En'
  ]);

  var ENUMS = {
    ESTADO_PEDIDO: ['Nuevo', 'Confirmado', 'Preparando', 'Listo'],
    ESTADO_PAGO: ['Pendiente', 'Pagado'],
    METODO_PAGO: ['Efectivo', 'Transferencia', 'Mixto', 'No definido'],
    TICKET_ENVIADO: ['Si', 'No']
  };

  var DEFAULTS = {
    ESTADO_PEDIDO: 'Nuevo',
    ESTADO_PAGO: 'Pendiente',
    METODO_PAGO: 'No definido',
    TICKET_ENVIADO: 'No',
    GUARNICION_LISTA: 'No'
  };

  var ENVIRONMENTS = {
    TEST: 'TEST',
    PROD: 'PROD'
  };


  var PUBLIC_ORDER_PRICE_TABLE = {
    OG: 85,
    BBQ: 85,
    PAPAS_OG: 20,
    PAPAS_ESPECIALES: 25,
    PAPAS_LEMON_PEPPER: 25,
    AROS_CEBOLLA: 30,
    EXTRA_PEPINILLOS: 5,
    EXTRA_QUESO_AMERICANO: 5,
    EXTRA_QUESO_MANCHEGO: 5,
    EXTRA_TOCINO: 5,
    EXTRA_CATSUP: 5,
    EXTRA_MOSTAZA: 5,
    EXTRA_TOMATE: 5
  };

  return {
    SHEETS: SHEETS,
    CHEKEO_COLUMNS: CHEKEO_COLUMNS,
    MASTER_REQUIRED_COLUMNS: MASTER_REQUIRED_COLUMNS,
    CHEKEO_REQUIRED_COLUMNS: CHEKEO_REQUIRED_COLUMNS,
    HISTORY_REQUIRED_META_COLUMNS: HISTORY_REQUIRED_META_COLUMNS,
    HISTORY_OPTIONAL_META_COLUMNS: HISTORY_OPTIONAL_META_COLUMNS,
    HISTORY_COLUMNS: HISTORY_COLUMNS,
    SUMMARY_REQUIRED_COLUMNS: SUMMARY_REQUIRED_COLUMNS,
    SUMMARY_COLUMNS: SUMMARY_COLUMNS,
    ENUMS: ENUMS,
    DEFAULTS: DEFAULTS,
    ENVIRONMENTS: ENVIRONMENTS,
    PUBLIC_ORDER_PRICE_TABLE: PUBLIC_ORDER_PRICE_TABLE,
    SPECIAL_FLAGS_REGEX: /(\(\+1\)|Chequeo Manual)/i
  };
})();
