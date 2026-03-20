export function validateChecklistPayload(payload) {
  const { vehicleKey, checks, username } = payload;

  if (!vehicleKey || typeof vehicleKey !== "string") {
    return "vehicleKey fehlt oder ist ungueltig";
  }

  if (!username || typeof username !== "string") {
    return "username fehlt oder ist ungueltig";
  }

  if (!Array.isArray(checks) || checks.length === 0) {
    return "checks muss eine nicht leere Liste sein";
  }

  for (const item of checks) {
    if (!["ok", "defekt"].includes(item.status)) {
      return `Ungueltiger Status fuer ${item.itemKey}`;
    }

    if (item.status === "defekt") {
      if (!item.defectDescription || item.defectDescription.trim().length < 3) {
        return `Defektbeschreibung fehlt fuer ${item.itemKey}`;
      }

      if (!["niedrig", "mittel", "kritisch"].includes(item.defectPriority)) {
        return `Defektprioritaet ungueltig fuer ${item.itemKey}`;
      }
    }
  }

  return null;
}
