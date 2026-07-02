function bogGetProductionValidation_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var mode = bogGetActiveEnvironment_();
  var activeSheetName = bogGetActiveChekeoSheetName_();
  var checks = [];

  var sheets = {
    master: spreadsheet.getSheetByName(BurgerOGConstants.SHEETS.MASTER_SHEET_NAME),
    active: spreadsheet.getSheetByName(activeSheetName),
    chekeoNuevo: spreadsheet.getSheetByName(BurgerOGConstants.SHEETS.CHEKEO_ACTIVE_SHEET_NAME),
    chekeo: spreadsheet.getSheetByName(BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME),
    config: spreadsheet.getSheetByName(BurgerOGConstants.SHEETS.CONFIG_SHEET_NAME),
    summary: spreadsheet.getSheetByName(BurgerOGConstants.SHEETS.SUMMARY_SHEET_NAME),
    history: spreadsheet.getSheetByName(BurgerOGConstants.SHEETS.HISTORY_SHEET_NAME)
  };

  checks.push(bogBuildSheetExistsCheck_('Existe Pedidos Master', sheets.master, BurgerOGConstants.SHEETS.MASTER_SHEET_NAME));
  checks.push(bogBuildSheetExistsCheck_('Existe hoja activa actual', sheets.active, activeSheetName));
  checks.push(bogBuildSheetExistsCheck_('Existe Chekeo Nuevo', sheets.chekeoNuevo, BurgerOGConstants.SHEETS.CHEKEO_ACTIVE_SHEET_NAME));
  checks.push(bogBuildSheetExistsCheck_('Existe Chekeo', sheets.chekeo, BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME));
  checks.push(bogBuildSheetExistsCheck_('Existe Configuración', sheets.config, BurgerOGConstants.SHEETS.CONFIG_SHEET_NAME));
  checks.push(bogBuildSheetExistsCheck_('Existe Resumen Pedidos', sheets.summary, BurgerOGConstants.SHEETS.SUMMARY_SHEET_NAME));
  checks.push(bogBuildSheetExistsCheck_('Existe Historico', sheets.history, BurgerOGConstants.SHEETS.HISTORY_SHEET_NAME));

  checks.push(
    bogBuildHeadersCheck_(
      'Headers requeridos de hoja activa',
      sheets.active,
      BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS
    )
  );

  checks.push(
    bogBuildHeadersCheck_(
      'Headers requeridos de Chekeo',
      sheets.chekeo,
      BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS
    )
  );

  checks.push(
    bogBuildHeadersCheck_(
      'Headers requeridos de Resumen Pedidos',
      sheets.summary,
      BurgerOGConstants.SUMMARY_REQUIRED_COLUMNS
    )
  );

  checks.push(
    bogBuildHeadersCheck_(
      'Headers requeridos de Historico',
      sheets.history,
      BurgerOGConstants.HISTORY_COLUMNS
    )
  );

  checks.push(bogBuildBankConfigCheck_());

  var hasCriticalErrors = checks.some(function (check) {
    return check.severity === 'error' && !check.ok;
  });

  checks.push({
    label: 'Sin errores críticos de contrato',
    ok: !hasCriticalErrors,
    severity: hasCriticalErrors ? 'error' : 'info',
    message: hasCriticalErrors
      ? 'Existen validaciones críticas pendientes antes de producción.'
      : 'No se detectaron errores críticos de contrato.'
  });

  var ready = !checks.some(function (check) {
    return check.severity === 'error' && !check.ok;
  });

  return {
    ready: ready,
    mode: mode,
    activeSheet: activeSheetName,
    checks: checks,
    summary: {
      totalChecks: checks.length,
      errors: checks.filter(function (check) { return check.severity === 'error' && !check.ok; }).length,
      warnings: checks.filter(function (check) { return check.severity === 'warning' && !check.ok; }).length
    }
  };
}

function bogGetProductionMigrationPreview_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var testSheet = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.CHEKEO_ACTIVE_SHEET_NAME);
  var productionSheet = bogGetRequiredSheet_(spreadsheet, BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME);

  var testHeaderMap = bogValidateHeadersWithoutMutation_(testSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);
  var productionHeaderMap = bogValidateHeadersWithoutMutation_(productionSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);

  var testData = bogReadSheetAsObjects_(testSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);
  var productionData = bogReadSheetAsObjects_(productionSheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);

  var productionById = {};
  productionData.rows.forEach(function (row) {
    var orderId = bogTrim_(row.data['ID Pedido']);
    if (!orderId) {
      return;
    }

    if (!productionById[orderId]) {
      productionById[orderId] = [];
    }
    productionById[orderId].push(row);
  });

  var insertions = [];
  var updates = [];
  var duplicateIdsInProduction = [];

  testData.rows.forEach(function (row) {
    var orderId = bogTrim_(row.data['ID Pedido']);
    if (!orderId) {
      return;
    }

    var matches = productionById[orderId] || [];
    if (!matches.length) {
      insertions.push(orderId);
      return;
    }

    if (matches.length > 1) {
      duplicateIdsInProduction.push(orderId);
    }

    updates.push(orderId);
  });

  return {
    sourceSheet: BurgerOGConstants.SHEETS.CHEKEO_ACTIVE_SHEET_NAME,
    targetSheet: BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME,
    mode: bogGetActiveEnvironment_(),
    activeSheet: bogGetActiveChekeoSheetName_(),
    headers: {
      testColumns: Object.keys(testHeaderMap).length,
      productionColumns: Object.keys(productionHeaderMap).length
    },
    totals: {
      sourceRows: testData.rows.filter(function (row) { return bogTrim_(row.data['ID Pedido']) !== ''; }).length,
      targetRows: productionData.rows.filter(function (row) { return bogTrim_(row.data['ID Pedido']) !== ''; }).length,
      wouldInsert: insertions.length,
      wouldUpdate: updates.length,
      duplicateIdsInProduction: bogUniqueNonEmpty_(duplicateIdsInProduction).length
    },
    sample: {
      insertions: insertions.slice(0, 20),
      updates: updates.slice(0, 20),
      duplicateIdsInProduction: bogUniqueNonEmpty_(duplicateIdsInProduction).slice(0, 20)
    },
    safeMode: {
      migrationExecuted: false,
      note: 'Este endpoint solo genera preview y no copia ni borra datos.'
    }
  };
}

function bogPrepareProductionSheets_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var actions = [];

  bogPrepareSheetWithHeaders_(
    spreadsheet,
    BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME,
    BurgerOGConstants.CHEKEO_COLUMNS,
    BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS,
    actions
  );

  bogPrepareSheetWithHeaders_(
    spreadsheet,
    BurgerOGConstants.SHEETS.SUMMARY_SHEET_NAME,
    BurgerOGConstants.SUMMARY_COLUMNS,
    BurgerOGConstants.SUMMARY_REQUIRED_COLUMNS,
    actions
  );

  bogPrepareSheetWithHeaders_(
    spreadsheet,
    BurgerOGConstants.SHEETS.HISTORY_SHEET_NAME,
    BurgerOGConstants.HISTORY_COLUMNS,
    BurgerOGConstants.HISTORY_COLUMNS,
    actions
  );

  return {
    prepared: true,
    mode: bogGetActiveEnvironment_(),
    activeSheet: bogGetActiveChekeoSheetName_(),
    targets: [
      BurgerOGConstants.SHEETS.CHEKEO_PRODUCTION_SHEET_NAME,
      BurgerOGConstants.SHEETS.SUMMARY_SHEET_NAME,
      BurgerOGConstants.SHEETS.HISTORY_SHEET_NAME
    ],
    actions: actions,
    safeGuards: [
      'No se activó producción automáticamente.',
      'No se migraron pedidos automáticamente.',
      'No se borraron hojas ni datos.',
      'No se cambió BOG_ACTIVE_ENV.'
    ]
  };
}

function bogPrepareSheetWithHeaders_(spreadsheet, sheetName, expectedHeaders, requiredHeaders, actions) {
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    actions.push('Se creó hoja: ' + sheetName + '.');
  }

  var hasAnyContent = sheet.getLastRow() > 0 && sheet.getLastColumn() > 0;
  if (!hasAnyContent) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    actions.push('Se inicializaron encabezados en: ' + sheetName + '.');
    return;
  }

  bogValidateHeadersWithoutMutation_(sheet, requiredHeaders);
  actions.push('Se validaron encabezados existentes en: ' + sheetName + '.');
}

function bogBuildSheetExistsCheck_(label, sheet, sheetName) {
  var exists = Boolean(sheet);
  return {
    label: label,
    ok: exists,
    severity: exists ? 'info' : 'error',
    message: exists ? 'OK: ' + sheetName + ' disponible.' : 'Falta hoja: ' + sheetName + '.'
  };
}

function bogBuildHeadersCheck_(label, sheet, requiredHeaders) {
  if (!sheet) {
    return {
      label: label,
      ok: false,
      severity: 'error',
      message: 'No se pudo validar headers porque la hoja no existe.'
    };
  }

  try {
    bogValidateHeadersWithoutMutation_(sheet, requiredHeaders);
    return {
      label: label,
      ok: true,
      severity: 'info',
      message: 'Headers válidos en ' + sheet.getName() + '.'
    };
  } catch (err) {
    return {
      label: label,
      ok: false,
      severity: 'error',
      message: err.message
    };
  }
}

function bogBuildBankConfigCheck_() {
  try {
    bogGetBankConfig_();
    return {
      label: 'Configuración bancaria completa',
      ok: true,
      severity: 'info',
      message: 'Banco, Nombre y Número de cuenta disponibles.'
    };
  } catch (err) {
    return {
      label: 'Configuración bancaria completa',
      ok: false,
      severity: 'error',
      message: err.message
    };
  }
}

function bogValidateHeadersWithoutMutation_(sheet, requiredHeaders) {
  var lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    throw new Error('La hoja ' + sheet.getName() + ' no tiene encabezados.');
  }

  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  return bogValidateRequiredHeaders_(headers, requiredHeaders, sheet.getName());
}
