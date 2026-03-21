export function validateChecklistPayload(payload) {
  const { vehicleKey, checks, username } = payload;

  if (!vehicleKey || typeof vehicleKey !== "string") {
    return "vehicleKey fehlt oder ist ungültig";
  }

  if (!username || typeof username !== "string") {
    return "username fehlt oder ist ungültig";
  }

  if (!Array.isArray(checks) || checks.length === 0) {
    return "checks muss eine nicht leere Liste sein";
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
