import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api/client";

function initialChecksForVehicle(vehicle) {
  return (vehicle?.checklist || []).map((item) => ({
    itemKey: item.key,
    itemLabel: item.label,
    status: "ok",
    comment: "",
    defectDescription: "",
    defectPriority: "mittel"
  }));
}

export default function ChecklistForm({ user, onReportCreated }) {
  const [vehicles, setVehicles] = useState([]);
  const [vehicleKey, setVehicleKey] = useState("");
  const [checks, setChecks] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const successTimerRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const signatureDrawingRef = useRef(false);

  const defectCount = useMemo(
    () => checks.filter((c) => c.status === "defekt").length,
    [checks]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.key === vehicleKey),
    [vehicles, vehicleKey]
  );

  useEffect(() => {
    async function loadVehicles() {
      try {
        const data = await apiRequest("/vehicles");
        setVehicles(data.vehicles);
        if (data.vehicles.length > 0) {
          const first = data.vehicles[0];
          setVehicleKey(first.key);
          setChecks(initialChecksForVehicle(first));
        }
      } catch (err) {
        setError(err.message);
      }
    }

    loadVehicles();
  }, []);

  function handleVehicleChange(nextKey) {
    setVehicleKey(nextKey);
    const vehicle = vehicles.find((v) => v.key === nextKey);
    setChecks(initialChecksForVehicle(vehicle));
  }

  function updateCheck(index, patch) {
    setChecks((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function setStatus(index, nextStatus) {
    if (nextStatus === "ok") {
      updateCheck(index, {
        status: "ok",
        defectDescription: "",
        defectPriority: "mittel"
      });
      return;
    }

    updateCheck(index, { status: "defekt" });
  }

  function getSignaturePoint(event) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function beginSignature(event) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    event.preventDefault();
    const context = canvas.getContext("2d");
    const point = getSignaturePoint(event);

    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111111";
    context.beginPath();
    context.moveTo(point.x, point.y);

    signatureDrawingRef.current = true;
  }

  function drawSignature(event) {
    if (!signatureDrawingRef.current) {
      return;
    }

    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    event.preventDefault();
    const context = canvas.getContext("2d");
    const point = getSignaturePoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endSignature(event) {
    if (!signatureDrawingRef.current) {
      return;
    }

    event.preventDefault();
    signatureDrawingRef.current = false;
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    context.closePath();
    setSignatureDataUrl(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  }

  async function submitChecklist(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!signatureDataUrl) {
      setError("Bitte zuerst im Unterschriftenfeld unterschreiben.");
      return;
    }

    const invalidDefect = checks.find(
      (c) => c.status === "defekt" && (!c.defectDescription || c.defectDescription.trim().length < 3)
    );

    if (invalidDefect) {
      setError(`Bitte Defektbeschreibung für "${invalidDefect.itemLabel}" eingeben.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        vehicleKey,
        username: user.username,
        checks,
        signatureDataUrl
      };

      const data = await apiRequest("/reports", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      setSuccess("Bericht erfolgreich gespeichert.");
      clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccess(""), 6000);
      if (selectedVehicle) {
        setChecks(initialChecksForVehicle(selectedVehicle));
      }
      clearSignature();
      onReportCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={submitChecklist}>
      <div className="card-header">Fahrzeugprüfung</div>
      <div className="section-head" style={{ marginTop: "0.8rem" }}>
        <h2>Prüfbogen</h2>
        <span className="badge">Prüfer: {user.role === "benutzer" ? "Gast" : user.username}</span>
      </div>

      <label>
        Fahrzeug
        <select
          name="vehicleKey"
          value={vehicleKey}
          onChange={(e) => handleVehicleChange(e.target.value)}
        >
          {vehicles.map((v) => (
            <option key={v.key} value={v.key}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      {selectedVehicle ? (
        <div className="vehicle-meta">
          {selectedVehicle.vehicleType ? <p>Fahrzeugtyp: {selectedVehicle.vehicleType}</p> : null}
          {selectedVehicle.chassis ? <p>Fahrgestell: {selectedVehicle.chassis}</p> : null}
          {selectedVehicle.useCase ? <p>Einsatz: {selectedVehicle.useCase}</p> : null}
          {selectedVehicle.model ? <p>Modell: {selectedVehicle.model}</p> : null}
          {selectedVehicle.power ? <p>Leistung: {selectedVehicle.power}</p> : null}
          {selectedVehicle.ladderHeight ? <p>Leiterhöhe: {selectedVehicle.ladderHeight}</p> : null}
          {selectedVehicle.vehicleInfo ? <p>Fahrzeug: {selectedVehicle.vehicleInfo}</p> : null}
        </div>
      ) : null}

      <div className="checks-grid">
        {checks.map((check, index) => (
          <div key={check.itemKey} className="check-row">
            <div className="check-title">{check.itemLabel}</div>

            <div className="inline-fields">
              <label>
                Status
                <div className="status-checkboxes">
                  <label className="status-check">
                    <input
                      type="checkbox"
                      name={`status-${check.itemKey}-ok`}
                      checked={check.status === "ok"}
                      onChange={() => setStatus(index, "ok")}
                    />
                    <span>OK</span>
                  </label>
                  <label className="status-check">
                    <input
                      type="checkbox"
                      name={`status-${check.itemKey}-defekt`}
                      checked={check.status === "defekt"}
                      onChange={() => setStatus(index, "defekt")}
                    />
                    <span>Defekt</span>
                  </label>
                </div>
              </label>

              <label>
                Kommentar
                <input
                  type="text"
                  name={`comment-${check.itemKey}`}
                  value={check.comment}
                  onChange={(e) => updateCheck(index, { comment: e.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>

            {check.status === "defekt" ? (
              <div className="defect-box">
                <label>
                  Defektbeschreibung
                  <textarea
                    name={`defectDescription-${check.itemKey}`}
                    value={check.defectDescription}
                    onChange={(e) => updateCheck(index, { defectDescription: e.target.value })}
                    placeholder="Beschreibung ist Pflicht"
                    required
                  />
                </label>

                <label>
                  Priorität
                  <select
                    name={`defectPriority-${check.itemKey}`}
                    value={check.defectPriority}
                    onChange={(e) => updateCheck(index, { defectPriority: e.target.value })}
                  >
                    <option value="niedrig">Niedrig</option>
                    <option value="mittel">Mittel</option>
                    <option value="kritisch">Kritisch</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}

      <div className="signature-block">
        <div className="section-head" style={{ marginTop: "0.4rem" }}>
          <h2>Unterschrift</h2>
          <span className="badge">{signatureDataUrl ? "Erfasst" : "Pflichtfeld"}</span>
        </div>

        <canvas
          ref={signatureCanvasRef}
          className="signature-canvas"
          width={560}
          height={170}
          onMouseDown={beginSignature}
          onMouseMove={drawSignature}
          onMouseUp={endSignature}
          onMouseLeave={endSignature}
          onTouchStart={beginSignature}
          onTouchMove={drawSignature}
          onTouchEnd={endSignature}
        />

        <div className="signature-actions">
          <button type="button" className="btn-ghost" onClick={clearSignature}>
            Unterschrift löschen
          </button>
        </div>
      </div>

      <button type="submit" disabled={saving}>
        {saving
          ? "Speichere..."
          : defectCount > 0
          ? `Bericht speichern (${defectCount} Mangel${defectCount !== 1 ? "punkte" : "punkt"})`
          : "Bericht speichern"}
      </button>
    </form>
  );
}
