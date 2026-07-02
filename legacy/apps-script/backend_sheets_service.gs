function bogGetRequiredSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Hoja requerida no encontrada: ' + sheetName);
  }
  return sheet;
}

function bogGetOrCreateSheet_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) {
    return sheet;
  }
  return spreadsheet.insertSheet(sheetName);
}

function bogGetHeaderMap_(headers) {
  var map = {};
  headers.forEach(function (header, index) {
    map[bogNormalizeHeaderKey_(header)] = index;
  });
  return map;
}

function bogValidateRequiredHeaders_(headers, requiredHeaders, sheetName) {
  var headerMap = bogGetHeaderMap_(headers);
  var missing = requiredHeaders.filter(function (requiredHeader) {
    return headerMap[bogNormalizeHeaderKey_(requiredHeader)] === undefined;
  });

  if (missing.length) {
    throw new Error('Faltan columnas obligatorias en ' + sheetName + ': ' + missing.join(', '));
  }

  return headerMap;
}

function bogReadSheetAsObjects_(sheet, requiredHeaders) {
  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    throw new Error('La hoja ' + sheet.getName() + ' está vacía.');
  }

  var headers = values[0];
  var headerMap = bogValidateRequiredHeaders_(headers, requiredHeaders || [], sheet.getName());
  var rows = [];

  for (var i = 1; i < values.length; i += 1) {
    rows.push({
      rowNumber: i + 1,
      values: values[i],
      data: bogToObjectByHeaderMap_(headers, headerMap, values[i])
    });
  }

  return {
    headers: headers,
    headerMap: headerMap,
    rows: rows,
    width: headers.length
  };
}

function bogEnsureChekeoHeaders_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), BurgerOGConstants.CHEKEO_COLUMNS.length);
  var currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var hasAnyHeader = currentHeaders.some(function (value) {
    return bogTrim_(value) !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, BurgerOGConstants.CHEKEO_COLUMNS.length).setValues([BurgerOGConstants.CHEKEO_COLUMNS]);
    return bogGetHeaderMap_(BurgerOGConstants.CHEKEO_COLUMNS);
  }

  var headerMap = bogGetHeaderMap_(currentHeaders);
  var missing = BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS.filter(function (requiredHeader) {
    return headerMap[bogNormalizeHeaderKey_(requiredHeader)] === undefined;
  });

  if (missing.length) {
    missing.forEach(function (header) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    });
    currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return bogValidateRequiredHeaders_(currentHeaders, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS, sheet.getName());
}

function bogEnsureSheetHeaders_(sheet, expectedHeaders) {
  var lastColumn = Math.max(sheet.getLastColumn(), expectedHeaders.length);
  var currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var hasAnyHeader = currentHeaders.some(function (value) {
    return bogTrim_(value) !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    return bogGetHeaderMap_(expectedHeaders);
  }

  var headerMap = bogGetHeaderMap_(currentHeaders);
  var missing = expectedHeaders.filter(function (expectedHeader) {
    return headerMap[bogNormalizeHeaderKey_(expectedHeader)] === undefined;
  });

  if (missing.length) {
    missing.forEach(function (header) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    });
    currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  return bogValidateRequiredHeaders_(currentHeaders, expectedHeaders, sheet.getName());
}

function bogFindChekeoOrderRowById_(sheet, orderId) {
  bogEnsureChekeoHeaders_(sheet);
  var data = bogReadSheetAsObjects_(sheet, BurgerOGConstants.CHEKEO_REQUIRED_COLUMNS);
  var targetId = bogTrim_(orderId);

  for (var i = 0; i < data.rows.length; i += 1) {
    var row = data.rows[i];
    if (bogTrim_(row.data['ID Pedido']) === targetId) {
      return {
        rowNumber: row.rowNumber,
        headerMap: data.headerMap,
        headers: data.headers,
        rowData: row.data,
        width: data.width
      };
    }
  }

  return null;
}

function bogPatchRowByHeaders_(sheet, rowNumber, headerMap, patch) {
  Object.keys(patch).forEach(function (header) {
    var index = headerMap[bogNormalizeHeaderKey_(header)];
    if (index === undefined) {
      throw new Error('No se encontró la columna: ' + header);
    }
    sheet.getRange(rowNumber, index + 1).setValue(patch[header]);
  });
}

function bogBuildRowByHeaderMap_(headers, headerMap, record) {
  var row = new Array(headers.length).fill('');
  Object.keys(record).forEach(function (header) {
    var index = headerMap[bogNormalizeHeaderKey_(header)];
    if (index !== undefined) {
      row[index] = record[header];
    }
  });
  return row;
}

function bogDeleteRowsDescending_(sheet, rowNumbers) {
  var sorted = rowNumbers
    .filter(function (num) { return Number(num) > 1; })
    .slice()
    .sort(function (a, b) { return b - a; });

  sorted.forEach(function (rowNumber) {
    sheet.deleteRow(rowNumber);
  });
}
