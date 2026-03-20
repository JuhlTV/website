const vehicles = [
  {
    key: "elw1",
    name: "ELW 1 (Einsatzleitwagen)",
    vehicleType: "Fuehrungsfahrzeug",
    checklist: [
      { key: "funkgeraete", label: "2-4 Funkgeraete (fest + Handfunkgeraete)" },
      { key: "leitsoftware", label: "Einsatzleitsoftware (Laptop/Tablet)" },
      { key: "drucker", label: "Drucker + Papier" },
      { key: "lagekarten", label: "Whiteboard / Lagekarten" },
      { key: "kartenmaterial", label: "Kartenmaterial" },
      { key: "stromversorgung", label: "Stromversorgung (Batterie + extern)" },
      { key: "internet", label: "Internet (LTE Router)" },
      { key: "beleuchtung", label: "Beleuchtung innen/aussen" },
      { key: "ladegeraete", label: "Ladegeraete fuer Funkgeraete" },
      { key: "warnwesten", label: "Warnwesten (Fuehrungskraefte)" },
      { key: "dokumentation", label: "Dokumentationsmaterial" }
    ]
  },
  {
    key: "hlf20",
    name: "HLF 20",
    chassis: "typ. Mercedes Atego",
    useCase: "Brand + Technische Hilfe",
    checklist: [
      { key: "wassertank", label: "Wassertank (ca. 1600-2000 Liter)" },
      { key: "schaummitteltank", label: "Schaummitteltank" },
      { key: "loeschpumpe", label: "Feuerloeschkreiselpumpe (ca. 2000-3000 l/min)" },
      { key: "schnellangriff", label: "Schnellangriff" },
      { key: "atemschutz", label: "Atemschutzgeraete (4 Stueck im Mannschaftsraum)" },
      { key: "waermebildkamera", label: "Waermebildkamera" },
      { key: "rettungsschere", label: "Hydraulischer Rettungssatz - Schere" },
      { key: "rettungsspreizer", label: "Hydraulischer Rettungssatz - Spreizer" },
      { key: "rettungszylinder", label: "Hydraulischer Rettungssatz - Rettungszylinder" },
      { key: "hebekissen", label: "Hebekissensystem" },
      { key: "stromerzeuger", label: "Stromerzeuger (ca. 13-14 kVA)" },
      { key: "lichtmast", label: "Lichtmast LED" },
      { key: "schlaeuche", label: "Schlaeuche (B, C, D)" },
      { key: "strahlrohre", label: "Strahlrohre" },
      { key: "luefter", label: "Luefter" },
      { key: "tauchpumpe", label: "Tauchpumpe" },
      { key: "oelbinder", label: "Oelbindemittel" },
      { key: "verkehrsabsicherung", label: "Verkehrsabsicherung" },
      { key: "rettungstasche", label: "Erste-Hilfe / Rettungstasche" }
    ]
  },
  {
    key: "dlak2312",
    name: "DLAK 23/12 (Drehleiter)",
    model: "Rosenbauer L32A-XS 3.2",
    chassis: "Mercedes-Benz Atego 1630",
    power: "ca. 300 PS",
    ladderHeight: "32 Meter",
    checklist: [
      { key: "leiterpark", label: "5-teiliger Leiterpark" },
      { key: "rettungskorb", label: "Rettungskorb (Tragkraft ca. 500 kg)" },
      { key: "multifunktionssaeule", label: "Multifunktionssaeule im Korb" },
      { key: "tragenhalterung", label: "Krankentragenhalterung" },
      { key: "ledleiter", label: "LED-Beleuchtung am Leiterpark" },
      { key: "beleuchtungssack", label: "Beleuchtungssack" },
      { key: "stromerzeuger", label: "Stromerzeuger (Rosenbauer RTE PX 14)" },
      { key: "wasserwerfer", label: "Wasserwerfer (ca. 2000 l/min, fernsteuerbar)" },
      { key: "hochleistungsluefter", label: "Hochleistungsluefter" },
      { key: "windmesser", label: "Windmesser" },
      { key: "schwerlasttrage", label: "Schwerlasttrage (bis 300 kg)" },
      { key: "absturzsicherung", label: "Absturzsicherung" },
      { key: "akkukettensaegen", label: "Akkukettensaegen" },
      { key: "waldarbeit", label: "Waldarbeitsausruestung" },
      { key: "abseilgeraete", label: "Abseilgeraete" },
      { key: "funkgeraete", label: "Funkgeraete" }
    ]
  },
  {
    key: "lf20",
    name: "LF 20",
    checklist: [
      { key: "wassertank", label: "Wassertank (~2000 Liter)" },
      { key: "pumpe", label: "Pumpe" },
      { key: "schlaeuche", label: "Schlaeuche" },
      { key: "verteiler", label: "Verteiler" },
      { key: "strahlrohre", label: "Strahlrohre" },
      { key: "atemschutz", label: "Atemschutzgeraete" },
      { key: "steckleitern", label: "Steckleitern" },
      { key: "beleuchtung", label: "Beleuchtung" },
      { key: "luefter", label: "Luefter" },
      { key: "feuerloescher", label: "Feuerloescher" },
      { key: "kleinwerkzeug", label: "Kleinwerkzeug" }
    ]
  },
  {
    key: "tlf1625",
    name: "TLF 16/25",
    checklist: [
      { key: "wassertank", label: "Wassertank (2500 Liter)" },
      { key: "schnellangriff", label: "Schnellangriff" },
      { key: "feuerloeschpumpe", label: "Feuerloeschpumpe" },
      { key: "schlaeuche", label: "Schlaeuche" },
      { key: "wasserwerfer", label: "Wasserwerfer / Monitor" },
      { key: "schaummittel", label: "Schaummittel" },
      { key: "atemschutz", label: "Atemschutzgeraete" }
    ]
  },
  {
    key: "lf106",
    name: "LF 10/6",
    checklist: [
      { key: "wassertank", label: "Wassertank (~600 Liter)" },
      { key: "tragkraftspritze", label: "Tragkraftspritze" },
      { key: "schlaeuche", label: "Schlaeuche" },
      { key: "leitern", label: "Leitern" },
      { key: "atemschutz", label: "Atemschutzgeraete" },
      { key: "grundausstattung", label: "Grundausstattung Brandbekaempfung" }
    ]
  },
  {
    key: "rw2",
    name: "RW 2",
    checklist: [
      { key: "rettungssatz", label: "Hydraulischer Rettungssatz" },
      { key: "seilwinde", label: "Seilwinde" },
      { key: "hebekissen", label: "Hebekissen" },
      { key: "trennschleifer", label: "Trennschleifer" },
      { key: "motorsaege", label: "Motorsaege" },
      { key: "greifzug", label: "Greifzug" },
      { key: "werkzeug", label: "Werkzeug (umfangreich)" },
      { key: "beleuchtung", label: "Beleuchtung" },
      { key: "absicherung", label: "Absicherungsmaterial" }
    ]
  },
  {
    key: "gwl2",
    name: "GW-L2 (Logistik / LKW)",
    vehicleInfo: "Mercedes + Schlingmann Aufbau",
    checklist: [
      { key: "rollcontainer", label: "Rollcontainer-System" },
      { key: "nachschub", label: "Nachschubmaterial (Schlaeuche, Atemschutz)" },
      { key: "transportmaterial", label: "Transportmaterial" },
      { key: "ladebordwand", label: "Ladebordwand" },
      { key: "sicherungssysteme", label: "Sicherungssysteme" }
    ]
  },
  {
    key: "mtw",
    name: "MTW (Mannschaftstransportwagen)",
    checklist: [
      { key: "sitzplaetze", label: "Sitzplaetze fuer Mannschaft" },
      { key: "funkgeraete", label: "Funkgeraete" },
      { key: "erstehilfe", label: "Erste-Hilfe-Ausruestung" },
      { key: "warnwesten", label: "Warnwesten" },
      { key: "transportmaterial", label: "Transportmaterial" }
    ]
  }
];

export function getVehiclesWithChecklist() {
  return vehicles;
}

export function findVehicleByKey(vehicleKey) {
  return getVehiclesWithChecklist().find((v) => v.key === vehicleKey);
}
