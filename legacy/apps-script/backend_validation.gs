function bogValidateChekeoRecord_(record) {
  var errors = [];

  if (!/^BOG-\d{3,}$/.test(bogTrim_(record['ID Pedido']))) {
    errors.push('ID Pedido inválido.');
  }

  if (!/^\d+$/.test(bogTrim_(record['Fila Master']))) {
    errors.push('Fila Master debe ser numérico.');
  }

  if (bogNormalizeAlertValue_(record['Alerta']) !== bogTrim_(record['Alerta'])) {
    errors.push('Alerta solo admite vacío o ⚠️.');
  }

  if (BurgerOGConstants.ENUMS.ESTADO_PEDIDO.indexOf(record['Estado Pedido']) === -1) {
    errors.push('Estado Pedido fuera de catálogo.');
  }

  if (BurgerOGConstants.ENUMS.ESTADO_PAGO.indexOf(record['Estado Pago']) === -1) {
    errors.push('Estado Pago fuera de catálogo.');
  }

  if (BurgerOGConstants.ENUMS.METODO_PAGO.indexOf(record['Método Pago']) === -1) {
    errors.push('Método Pago fuera de catálogo.');
  }

  if (BurgerOGConstants.ENUMS.TICKET_ENVIADO.indexOf(record['Ticket Enviado']) === -1) {
    errors.push('Ticket Enviado fuera de catálogo.');
  }

  if (record['Ticket Enviado'] === 'Si' && bogTrim_(record['Fecha Ticket Enviado']) === '') {
    errors.push('Si Ticket Enviado = Si, Fecha Ticket Enviado es obligatoria.');
  }

  try {
    var total = bogNormalizeMoney_(record['Total']);
    if (total < 0) {
      errors.push('Total debe ser numérico >= 0.');
    }
  } catch (err) {
    errors.push(err.message);
  }

  return errors;
}

function bogRequiresAlert_(record) {
  var fieldsToScan = [
    record['Resumen Pedido'],
    record['Hamburguesas'],
    record['Extras'],
    record['Guarniciones']
  ];

  return fieldsToScan.some(function (value) {
    return BurgerOGConstants.SPECIAL_FLAGS_REGEX.test(String(value || ''));
  });
}

function bogValidateSheetSetup_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var requiredSheets = Object.keys(BurgerOGConstants.SHEETS).map(function (key) {
    return BurgerOGConstants.SHEETS[key];
  });

  var missingSheets = requiredSheets.filter(function (sheetName) {
    return !spreadsheet.getSheetByName(sheetName);
  });

  if (missingSheets.length) {
    return {
      valid: false,
      issues: ['Hojas faltantes: ' + missingSheets.join(', ')]
    };
  }

  var issues = [];

  try {
    var master = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.MASTER_SHEET_NAME);
    bogReadSheetAsObjects_(master, BurgerOGConstants.MASTER_REQUIRED_COLUMNS);
  } catch (errMaster) {
    issues.push(errMaster.message);
  }

  try {
    var chekeo = bogGetRequiredSheet_(spreadsheet, bogGetActiveChekeoSheetName_());
    bogEnsureChekeoHeaders_(chekeo);
  } catch (errChekeo) {
    issues.push(errChekeo.message);
  }

  return {
    valid: issues.length === 0,
    issues: issues
  };
}
