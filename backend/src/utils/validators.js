export function validateChecklistPayload(payload) {
  const { vehicleKey, checks, username, signatureDataUrl } = payload;

  if (!vehicleKey || typeof vehicleKey !== "string") {
    return "vehicleKey fehlt oder ist ungültig";
  }

  if (!username || typeof username !== "string") {
    return "username fehlt oder ist ungültig";
  }

  if (!Array.isArray(checks) || checks.length === 0) {
    return "checks muss eine nicht leere Liste sein";
  }

  if (!signatureDataUrl || typeof signatureDataUrl !== "string") {
    return "Unterschrift fehlt";
  }

  const normalizedSignature = signatureDataUrl.trim();
  if (normalizedSignature.length < 100) {
    return "Unterschrift ist unvollständig";
  }

  if (normalizedSignature.length > 1_500_000) {
    return "Unterschrift ist zu groß";
  }

  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(normalizedSignature)) {
    return "Unterschrift hat ein ungültiges Format";
  }

  for (const item of checks) {
    if (!["ok", "defekt"].includes(item.status)) {
      return `Ungültiger Status für ${item.itemKey}`;
    }

    if (item.status === "defekt") {
      if (!item.defectDescription || item.defectDescription.trim().length < 3) {
        return `Defektbeschreibung fehlt für ${item.itemKey}`;
      }

      if (!["niedrig", "mittel", "kritisch"].includes(item.defectPriority)) {
        return `Defektpriorität ungültig für ${item.itemKey}`;
      }
    }
  }

  return null;
}
