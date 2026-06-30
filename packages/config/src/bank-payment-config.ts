import type { BankPaymentConfig } from "./contracts";

export const bankPaymentConfig: BankPaymentConfig = {
  bankName: "BBVA",
  accountHolder: "Yolitzin Ameyali Zarate Otero",
  accountNumber: "012180015645465369",
  clabe: "012180015645465369",
  accountLabel: "Cuenta / CLABE",
  transferOnly: true,
  editable: false,
  source: "shared-config",
};

export const getBankPaymentPrimaryLabel = (
  config: BankPaymentConfig = bankPaymentConfig,
) => {
  if (config.accountLabel?.trim()) return config.accountLabel.trim();
  if (config.accountNumber?.trim() && config.clabe?.trim()) {
    return config.accountNumber.trim() === config.clabe.trim()
      ? "Cuenta / CLABE"
      : "Cuenta";
  }
  return config.clabe?.trim() ? "CLABE" : "Cuenta";
};

export const getBankPaymentPrimaryValue = (
  config: BankPaymentConfig = bankPaymentConfig,
) => {
  const accountNumber = config.accountNumber?.trim();
  const clabe = config.clabe?.trim();
  if (accountNumber && clabe) {
    return accountNumber === clabe ? clabe : accountNumber;
  }
  return clabe ?? accountNumber ?? "";
};
